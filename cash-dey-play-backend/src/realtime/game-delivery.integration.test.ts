import { randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { io,Socket } from 'socket.io-client';
import { APPROVED_WHOT_RULES } from '../game-engine/approved-rules';
import { GameRepository } from '../game-engine/repository';
import { OutboxRepository } from '../ledger/outbox.repository';
import { MemoryRateLimitCounterStore } from '../http/middleware/rate-limit.middleware';
import { attachRealtimeGateway } from './gateway';
import { GameDeliveryRepository,runGameDeliveryPass } from './game-delivery.repository';
import { GameNotice,RedisGameNotifications } from './game-notifications';
import { GameUpdate,RealtimeSessionRepository } from './session.repository';
const url=process.env.TEST_DATABASE_URL;const redisUrl=process.env.TEST_REDIS_URL;
if(process.env.REQUIRE_DB_TESTS==='true'&&!url)throw new Error('TEST_DATABASE_URL required');
if(process.env.REQUIRE_REDIS_TESTS==='true'&&!redisUrl)throw new Error('TEST_REDIS_URL required');
const suite=url?describe:describe.skip;
const identity=(id=123)=>({userId:`tg_${id}`,telegramId:id,tokenVersion:0,expiresAt:(Math.floor(Date.now()/1000)+60)*1000});
const waitFor=async(test:()=>boolean)=>{const end=Date.now()+3000;while(!test()){if(Date.now()>end)throw new Error('Expected delivery did not arrive');await new Promise(resolve=>setTimeout(resolve,20));}};
suite('committed game delivery on PostgreSQL',()=>{
 let admin:Pool,pool:Pool,schema:string,games:GameRepository,sessions:RealtimeSessionRepository,outbox:OutboxRepository;
 beforeAll(()=>{if(!/(?:^|_)test(?:_|$)/i.test(new URL(url!).pathname.slice(1)))throw new Error('Disposable test database required');admin=new Pool({connectionString:url});});
 beforeEach(async()=>{
  schema='cdp_delivery_'+randomUUID().replace(/-/g,'');await admin.query(`CREATE SCHEMA "${schema}"`);
  pool=new Pool({connectionString:url,options:`-c search_path=${schema}`,max:12});
  const root=join(__dirname,'../../prisma/migrations');for(const name of readdirSync(root).filter(x=>!x.endsWith('.toml')).sort())await pool.query(readFileSync(join(root,name,'migration.sql'),'utf8'));
  await pool.query("INSERT INTO users(id,telegram_id,first_name) VALUES('tg_123',123,'One'),('tg_456',456,'Two'),('tg_789',789,'Other')");
  games=new GameRepository(pool,max=>max-1);sessions=new RealtimeSessionRepository(pool);outbox=new OutboxRepository(pool);
 });
 afterEach(async()=>{await pool.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);});afterAll(async()=>{await admin.end();});
 async function fixture(){const m=await games.createMatch({mode:'RANKED',rules:APPROVED_WHOT_RULES,players:[{userId:'tg_123',isBot:false},{userId:'tg_456',isBot:false}],at:Date.now()});await games.act(m.id,'tg_123',{id:'fixture-draw',expectedVersion:0,command:{type:'DRAW'}},Date.now());return m;}
 it('claims only game updates and publishes routing metadata from committed participant/event rows',async()=>{
  const m=await fixture();const other=randomUUID();await pool.query("INSERT INTO outbox_events(id,type,payload,available_at) VALUES($1,'WALLET_ENTRY_POSTED','{}',clock_timestamp()-interval '1 day')",[other]);
  const publish=jest.fn().mockResolvedValue(0);expect(await runGameDeliveryPass(pool,publish)).toBe(1);
  const notice=publish.mock.calls[0]![0] as GameNotice;expect(notice).toEqual({eventId:expect.any(String),matchId:m.id,version:1,userIds:['tg_123','tg_456']});
  expect(notice.eventId).toBe((await pool.query('SELECT event_id FROM game_events')).rows[0].event_id);
  expect((await pool.query('SELECT state,attempts FROM outbox_events WHERE id=$1',[other])).rows[0]).toEqual({state:'PENDING',attempts:0});
 });
 it('bounds each pass and stops without claiming new work when aborted',async()=>{
  const m=await fixture();await games.act(m.id,'tg_456',{id:'second-fixture-draw',expectedVersion:1,command:{type:'DRAW'}},Date.now());
  const stop=new AbortController();stop.abort();const publish=jest.fn().mockResolvedValue(1);
  expect(await runGameDeliveryPass(pool,publish,1,stop.signal)).toBe(0);expect(publish).not.toHaveBeenCalled();
  expect(await runGameDeliveryPass(pool,publish,1)).toBe(1);expect(await runGameDeliveryPass(pool,publish,1)).toBe(1);
  expect(publish.mock.calls.map(call=>(call[0] as GameNotice).version).sort()).toEqual([1,2]);
 });
 it('does not see an uncommitted outbox intent or publish a rolled-back one',async()=>{
  const m=await fixture();await pool.query("UPDATE outbox_events SET state='DELIVERED'");const writer=await pool.connect();
  try{await writer.query('BEGIN');await writer.query("INSERT INTO outbox_events(id,type,payload) VALUES($1,'GAME_STATE_CHANGED',$2)",[randomUUID(),{matchId:m.id,version:1}]);
   const publish=jest.fn();expect(await runGameDeliveryPass(pool,publish)).toBe(0);expect(publish).not.toHaveBeenCalled();await writer.query('ROLLBACK');
   expect(await runGameDeliveryPass(pool,publish)).toBe(0);
  }finally{await writer.query('ROLLBACK');writer.release();}
 });
 it('retries publication failure with the same committed event and no economic/game mutation',async()=>{
  await fixture();const publish=jest.fn().mockRejectedValueOnce(new Error('relay unavailable')).mockResolvedValue(1);
  await expect(runGameDeliveryPass(pool,publish)).rejects.toThrow('relay unavailable');expect((await pool.query('SELECT state FROM outbox_events')).rows[0].state).toBe('PENDING');
  expect(await runGameDeliveryPass(pool,publish)).toBe(0);await pool.query("UPDATE outbox_events SET available_at=clock_timestamp()-interval '1 second'");
  expect(await runGameDeliveryPass(pool,publish)).toBe(1);expect(publish.mock.calls[0]![0]).toEqual(publish.mock.calls[1]![0]);
  expect((await pool.query('SELECT count(*)::int n FROM game_events')).rows[0].n).toBe(1);
 });
 it('recovers publish-before-ack crashes and fences stale worker leases',async()=>{
  await fixture();const delivery=new GameDeliveryRepository(pool);const first=(await outbox.claim(60,['GAME_STATE_CHANGED']))!;const publish=jest.fn().mockResolvedValue(1);
  const acknowledge=jest.spyOn(OutboxRepository.prototype,'acknowledge').mockRejectedValueOnce(new Error('crashed before acknowledgement'));
  try{await expect(delivery.publish(first,publish)).rejects.toThrow('crashed before acknowledgement');}finally{acknowledge.mockRestore();}
  await pool.query("UPDATE outbox_events SET lease_until=clock_timestamp()-interval '1 second'");const recovered=(await outbox.claim(60,['GAME_STATE_CHANGED']))!;
  expect(await delivery.publish(first,publish)).toBe(false);expect(publish).toHaveBeenCalledTimes(1);
  expect(await delivery.publish(recovered,publish)).toBe(true);expect(publish.mock.calls[0]![0]).toEqual(publish.mock.calls[1]![0]);expect(await outbox.acknowledge(first)).toBe(false);
 });
 it('never publishes an intent without its committed source event',async()=>{
  const m=await fixture();await pool.query('UPDATE outbox_events SET payload=$1',[{matchId:m.id,version:999}]);const publish=jest.fn();
  await expect(runGameDeliveryPass(pool,publish)).rejects.toThrow('Committed game event missing');expect(publish).not.toHaveBeenCalled();
 });
 it('projects only the current participant and rejects replaced/revoked snapshot reads',async()=>{
  const m=await fixture();const a=await sessions.claim(identity());const b=await sessions.claim(identity(456));const other=await sessions.claim(identity(789));
  const first=(await sessions.deliverySnapshot(a))!;const second=(await sessions.deliverySnapshot(b))!;
  expect(first.matchId).toBe(m.id);expect(first.eventId).toBe(second.eventId);expect(first.view.seat).toBe(0);expect(second.view.seat).toBe(1);
  for(const card of first.view.hand)expect(JSON.stringify(second)).not.toContain(card.id);
  expect(await sessions.deliverySnapshot(other)).toBeNull();await sessions.claim(identity());await expect(sessions.deliverySnapshot(a)).rejects.toMatchObject({code:'SESSION_REPLACED'});
  await pool.query("UPDATE users SET token_version=1 WHERE id='tg_456'");await expect(sessions.deliverySnapshot(b)).rejects.toMatchObject({code:'UNAUTHORIZED'});
 });
 (redisUrl?it:it.skip)('delivers across two actual gateways through Redis, then recovers lost notices and disconnected clients from SQL',async()=>{
  if(new URL(redisUrl!).pathname!=='/15')throw new Error('Dedicated Redis test database /15 required; channels also use random namespaces');
  const m=await games.createMatch({mode:'RANKED',rules:APPROVED_WHOT_RULES,players:[{userId:'tg_123',isBot:false},{userId:'tg_456',isBot:false}],at:Date.now()});
  const channel='cdp:test:'+randomUUID();const connections=[0,1,2].map(()=>{const r=new Redis(redisUrl!,{lazyConnect:true,maxRetriesPerRequest:1,commandTimeout:1000,connectTimeout:1000});r.on('error',()=>undefined);return r;});
  const sources=[new RedisGameNotifications(connections[0]!,channel),new RedisGameNotifications(connections[1]!,channel)];
  const servers=[createServer(),createServer()];const origin='https://mini.example';const secret='d'.repeat(40);const clients:Socket[]=[];
  const gateways=servers.map((server,index)=>attachRealtimeGateway(server,{jwtSecret:secret,origin,rateLimits:new MemoryRateLimitCounterStore(),sessions,
   actions:{games,rateLimits:new MemoryRateLimitCounterStore()},delivery:{source:sources[index]!,snapshots:sessions,catchupMs:index===0?100:60000,ackMs:200}}));
  try{
   await Promise.all(connections.map(r=>r.connect()));await Promise.all(sources.map(s=>s.start()));
   await Promise.all(servers.map(s=>new Promise<void>(resolve=>s.listen(0,'127.0.0.1',resolve))));
   const connect=async(index:number,id:number)=>{
    const token=jwt.sign({userId:`tg_${id}`,telegramId:id,tokenVersion:0},secret,{issuer:'cash-dey-play',audience:'cash-dey-play-mini-app',expiresIn:60});
    const client=io(`http://127.0.0.1:${(servers[index]!.address() as AddressInfo).port}`,{auth:{token},transports:['websocket'],extraHeaders:{Origin:origin},autoConnect:false,reconnection:false});clients.push(client);
    const updates:GameUpdate[]=[];client.on('match:update',(v:GameUpdate,ack:(value:unknown)=>void)=>{updates.push(v);ack({matchId:v.matchId,eventId:v.eventId,version:v.view.version});});
    await new Promise<void>((resolve,reject)=>{client.once('connect',resolve);client.once('connect_error',reject);client.connect();});return {client,updates};
   };
   const a=await connect(0,123);const b=await connect(1,456);const other=await connect(0,789);
   await waitFor(()=>a.updates.length>0&&b.updates.length>0);expect(a.updates[0]!.eventId).toBeNull();
   const send=(client:Socket,version:number)=>client.timeout(2000).emitWithAck('match:action',{matchId:m.id,actionId:`relay-draw-${version}`,expectedVersion:version,command:{type:'DRAW'}});
   expect((await send(a.client,0)).ok).toBe(true);
   const notices:GameNotice[]=[];
   expect(await runGameDeliveryPass(pool,async notice=>{notices.push(notice);return connections[2]!.publish(channel,JSON.stringify(notice));})).toBe(1);
   await waitFor(()=>a.updates.some(v=>v.view.version===1)&&b.updates.some(v=>v.view.version===1));
   const av=a.updates.find(v=>v.view.version===1)!;const bv=b.updates.find(v=>v.view.version===1)!;
   for(const card of av.view.hand)expect(JSON.stringify(bv)).not.toContain(card.id);
   const lengths=[a.updates.length,b.updates.length];await connections[2]!.publish(channel,JSON.stringify(notices[0]));
   // Even a syntactically valid forged routing hint cannot reveal a nonparticipant's match.
   await connections[2]!.publish(channel,JSON.stringify({...notices[0],userIds:['tg_789']}));
   await new Promise(resolve=>setTimeout(resolve,150));expect([a.updates.length,b.updates.length]).toEqual(lengths);expect(other.updates).toHaveLength(0);
   sources[0]!.close();expect((await send(b.client,1)).ok).toBe(true);
   // No worker publication occurs here; gateway catch-up independently repairs missed relay delivery.
   await waitFor(()=>a.updates.some(v=>v.view.version===2));
   // An old hint must fetch current SQL state rather than regress the recipient.
   await connections[2]!.publish(channel,JSON.stringify(notices[0]));await waitFor(()=>b.updates.some(v=>v.view.version===2));
   b.client.disconnect();expect((await send(a.client,2)).ok).toBe(true);
   expect(await runGameDeliveryPass(pool,notice=>connections[2]!.publish(channel,JSON.stringify(notice)))).toBe(2);
   const reconnected=await connect(1,456);await waitFor(()=>reconnected.updates.some(v=>v.view.version===3));
   const persisted=(await games.view(m.id,'tg_456')).deadlineAt;expect(reconnected.updates[reconnected.updates.length-1]!.view.deadlineAt).toBe(persisted);
   await pool.query("UPDATE users SET token_version=1 WHERE id='tg_123'");await waitFor(()=>!a.client.connected);
   expect((await games.replay(m.id)).version).toBe(3);
  }finally{
   for(const client of clients)client.disconnect();await Promise.all(gateways.map(g=>new Promise<void>(resolve=>g.close(()=>resolve()))));
   for(const source of sources)source.close();for(const connection of connections)connection.disconnect();
  }
 },20000);
});
