import { randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { io,Socket } from 'socket.io-client';
import { AccessIdentity } from '../auth/access-token';
import { APPROVED_WHOT_RULES } from '../game-engine/approved-rules';
import { GameRepository } from '../game-engine/repository';
import { MemoryRateLimitCounterStore } from '../http/middleware/rate-limit.middleware';
import { attachRealtimeGateway } from './gateway';
import { RealtimeSessionRepository } from './session.repository';
const url=process.env.TEST_DATABASE_URL;
if(process.env.REQUIRE_DB_TESTS==='true'&&!url)throw new Error('TEST_DATABASE_URL required');
const suite=url?describe:describe.skip;
const identity=(id=123,version=0):AccessIdentity=>({userId:`tg_${id}`,telegramId:id,tokenVersion:version,expiresAt:(Math.floor(Date.now()/1000)+60)*1000});
suite('durable realtime sessions on PostgreSQL',()=>{
 let admin:Pool,pool:Pool,schema:string,sessions:RealtimeSessionRepository,games:GameRepository;
 beforeAll(()=>{if(!/(?:^|_)test(?:_|$)/i.test(new URL(url!).pathname.slice(1)))throw new Error('Disposable test database required');admin=new Pool({connectionString:url});});
 beforeEach(async()=>{
  schema='cdp_realtime_'+randomUUID().replace(/-/g,'');await admin.query(`CREATE SCHEMA "${schema}"`);
  pool=new Pool({connectionString:url,options:`-c search_path=${schema}`,max:12});
  const root=join(__dirname,'../../prisma/migrations');for(const name of readdirSync(root).filter(x=>!x.endsWith('.toml')).sort())await pool.query(readFileSync(join(root,name,'migration.sql'),'utf8'));
  await pool.query("INSERT INTO users(id,telegram_id,first_name) VALUES('tg_123',123,'One'),('tg_456',456,'Two'),('tg_789',789,'Other')");
  sessions=new RealtimeSessionRepository(pool);games=new GameRepository(pool,max=>max-1);
 });
 afterEach(async()=>{await pool.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);});afterAll(async()=>{await admin.end();});
 const ranked=()=>games.createMatch({mode:'RANKED',rules:APPROVED_WHOT_RULES,players:[{userId:'tg_123',isBot:false},{userId:'tg_456',isBot:false}],at:Date.now()});
 it('accepts only a registered, current canonical identity and rejects expiry',async()=>{
  for(const value of [{...identity(),userId:'tg_456'},identity(999),identity(123,1),{...identity(),expiresAt:Date.now()-1}])
   await expect(sessions.claim(value)).rejects.toMatchObject({code:'UNAUTHORIZED'});
  expect((await pool.query('SELECT count(*)::int n FROM realtime_sessions')).rows[0].n).toBe(0);
 });
 it('keeps exactly one current generation across ten concurrent connection claims',async()=>{
  const connections=await Promise.all(Array.from({length:10},()=>sessions.claim(identity())));
  const results=await Promise.allSettled(connections.map(c=>sessions.assertCurrent(c)));
  expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  const current=(await pool.query('SELECT connection_id FROM realtime_sessions')).rows[0].connection_id;
  for(const c of connections.filter(c=>c.connectionId!==current))await sessions.release(c);
  const winner=connections.find(c=>c.connectionId===current)!;await sessions.assertCurrent(winner);
  await sessions.release(winner);await expect(sessions.assertCurrent(winner)).rejects.toMatchObject({code:'SESSION_REPLACED'});
 });
 it('enforces revocation for established reads and future claims',async()=>{
  const c=await sessions.claim(identity());await pool.query("UPDATE users SET token_version=1 WHERE id='tg_123'");
  await expect(sessions.resume(c)).rejects.toMatchObject({code:'UNAUTHORIZED'});
  await expect(sessions.claim(identity())).rejects.toMatchObject({code:'UNAUTHORIZED'});
  await expect(sessions.claim(identity(123,1))).resolves.toMatchObject({userId:'tg_123',tokenVersion:1});
 });
 it('projects each stored participant hand and does not expose another player’s match',async()=>{
  const match=await ranked();const a=await sessions.claim(identity());const b=await sessions.claim(identity(456));const other=await sessions.claim(identity(789));
  const first=await sessions.resume(a);const second=await sessions.resume(b,match.id);
  expect(first.phase).toBe('IN_MATCH');expect(first.match?.view.seat).toBe(0);expect(second.match?.view.seat).toBe(1);
  expect(first.match?.view.hand).toEqual(match.state.hands[0]);expect(second.match?.view.hand).toEqual(match.state.hands[1]);
  const encoded=JSON.stringify(first);for(const card of match.state.hands[1])expect(encoded).not.toContain(card.id);
  expect(first.match?.view).not.toHaveProperty('market');expect(first.match?.view).not.toHaveProperty('discard');
  expect(await sessions.resume(other)).toMatchObject({phase:'IDLE',match:null});
  await expect(sessions.resume(other,match.id)).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(sessions.resume(a,randomUUID())).rejects.toMatchObject({code:'NOT_FOUND'});
 });
 it('resumes latest durable state after replacement without resetting clocks or generating events',async()=>{
  const match=await ranked();const first=await sessions.claim(identity());const initial=await sessions.resume(first);
  await games.act(match.id,'tg_123',{id:'before-reconnect',expectedVersion:0,command:{type:'DRAW'}},Date.now());
  const before=(await pool.query('SELECT version,private_state,updated_at FROM game_matches WHERE id=$1',[match.id])).rows[0];
  const second=await new RealtimeSessionRepository(pool).claim(identity());
  await sessions.release(first);await expect(sessions.resume(first)).rejects.toMatchObject({code:'SESSION_REPLACED'});
  const resumed=await sessions.resume(second);expect(resumed.match?.view.version).toBe(1);
  expect(resumed.match?.view.deadlineAt).toBe(before.private_state.deadlineAt);expect(initial.match?.id).toBe(match.id);
  expect((await pool.query('SELECT version,private_state,updated_at FROM game_matches WHERE id=$1',[match.id])).rows[0]).toEqual(before);
  expect((await pool.query('SELECT count(*)::int n FROM game_events')).rows[0].n).toBe(1);
  await games.act(match.id,'tg_456',{id:'finish-after-reconnect',expectedVersion:1,command:{type:'FORFEIT'}},Date.now());
  expect(await sessions.resume(second)).toMatchObject({phase:'RESULT',match:{view:{deadlineAt:null,status:'FINISHED',reason:'FORFEIT'}}});
 });
 it('rechecks expiry after waiting for the user lock before claiming',async()=>{
  const locker=await pool.connect();let claim:Promise<unknown>|undefined;
  try{
   await locker.query('BEGIN');await locker.query("SELECT id FROM users WHERE id='tg_123' FOR UPDATE");
   // Convert the rejection into a value immediately to avoid an unhandled promise while holding the lock.
   claim=sessions.claim({...identity(),expiresAt:Date.now()+1000}).then(()=>({code:'unexpected success'}),error=>error);
   await locker.query('SELECT pg_sleep(1.1)');await locker.query('COMMIT');
   expect(await claim).toMatchObject({code:'UNAUTHORIZED'});
   expect((await pool.query('SELECT count(*)::int n FROM realtime_sessions')).rows[0].n).toBe(0);
  }finally{await locker.query('ROLLBACK');locker.release();await claim;}
 });
 it('preserves the previous generation if claiming its replacement fails',async()=>{
  const first=await sessions.claim(identity());
  await pool.query("CREATE FUNCTION reject_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'claim storage failure'; END $$");
  await pool.query('CREATE TRIGGER reject_session BEFORE UPDATE ON realtime_sessions FOR EACH ROW EXECUTE FUNCTION reject_session()');
  await expect(sessions.claim(identity())).rejects.toThrow('claim storage failure');await sessions.assertCurrent(first);
 });
 it('uses SQL ownership across two actual gateways, without leaking match data or resetting deadlines',async()=>{
  const match=await ranked();const clients:Socket[]=[];const origin='https://mini.example';const secret='q'.repeat(40);
  const servers=[createServer(),createServer()];
  const gateways=servers.map(server=>attachRealtimeGateway(server,{jwtSecret:secret,origin,rateLimits:new MemoryRateLimitCounterStore(),sessions:new RealtimeSessionRepository(pool)}));
  try{
   await Promise.all(servers.map(server=>new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))));
   const connect=async(index:number,id=123)=>{
    const token=jwt.sign({userId:`tg_${id}`,telegramId:id,tokenVersion:0},secret,{issuer:'cash-dey-play',audience:'cash-dey-play-mini-app',expiresIn:60});
    const client=io(`http://127.0.0.1:${(servers[index]!.address() as AddressInfo).port}`,{auth:{token},transports:['websocket'],extraHeaders:{Origin:origin},reconnection:false,autoConnect:false});clients.push(client);
    await new Promise<void>((resolve,reject)=>{client.once('connect',resolve);client.once('connect_error',reject);client.connect();});return client;
   };
   const first=await connect(0);const a=await first.timeout(2000).emitWithAck('session:resume',{});
   expect(a.data.match.view.hand).toEqual(match.state.hands[0]);
   const second=await connect(1);
   expect(await first.timeout(2000).emitWithAck('session:resume',{})).toEqual({ok:false,error:{code:'SESSION_REPLACED'}});
   const b=await second.timeout(2000).emitWithAck('session:resume',{});expect(b.data.match.view.deadlineAt).toBe(a.data.match.view.deadlineAt);
   const other=await connect(0,789);
   expect(await other.timeout(2000).emitWithAck('match:view',{matchId:match.id})).toEqual({ok:false,error:{code:'NOT_FOUND'}});
   await pool.query("UPDATE users SET token_version=1 WHERE id='tg_123'");
   expect(await second.timeout(2000).emitWithAck('session:resume',{})).toEqual({ok:false,error:{code:'UNAUTHORIZED'}});
  }finally{
   for(const client of clients)client.disconnect();
   await Promise.all(gateways.map(gateway=>new Promise<void>(resolve=>gateway.close(()=>resolve()))));
  }
 });
});
