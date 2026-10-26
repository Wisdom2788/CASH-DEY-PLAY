import { randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { io,Socket } from 'socket.io-client';
import { attachRealtimeGateway } from '../realtime/gateway';
import { MemoryRateLimitCounterStore } from '../http/middleware/rate-limit.middleware';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { APPROVED_WHOT_RULES } from '../game-engine/approved-rules';
import { GameRepository } from '../game-engine/repository';
import { PracticeRepository } from '../practice/practice.repository';
import { RealtimeConnection,RealtimeSessionRepository } from '../realtime/session.repository';
import { RankedSettlement } from './settlement.repository';
import { DailyTasks } from '../entitlements/daily-tasks';
import { RankedRepository } from './ranked.repository';
import { RedisRankedQueue } from './redis-queue';
import { RankedMatchmaker } from './matchmaker';
const url=process.env.TEST_DATABASE_URL;const redisUrl=process.env.TEST_REDIS_URL;
if(process.env.REQUIRE_DB_TESTS==='true'&&!url)throw new Error('TEST_DATABASE_URL required');
if(process.env.REQUIRE_REDIS_TESTS==='true'&&!redisUrl)throw new Error('TEST_REDIS_URL required');
const suite=url?describe:describe.skip;
const identity=(id:number)=>({userId:`tg_${id}`,telegramId:id,tokenVersion:0,expiresAt:(Math.floor(Date.now()/1000)+120)*1000});
suite('durable ranked admission and Redis matchmaking',()=>{
 let admin:Pool,pool:Pool,schema:string,ranked:RankedRepository,sessions:RealtimeSessionRepository,games:GameRepository,connections:Map<number,RealtimeConnection>;
 beforeAll(()=>{if(!/(?:^|_)test(?:_|$)/i.test(new URL(url!).pathname.slice(1)))throw new Error('Disposable test database required');admin=new Pool({connectionString:url});});
 beforeEach(async()=>{
  schema='cdp_ranked_'+randomUUID().replace(/-/g,'');await admin.query(`CREATE SCHEMA "${schema}"`);pool=new Pool({connectionString:url,options:`-c search_path=${schema}`,max:12});
  const root=join(__dirname,'../../prisma/migrations');for(const name of readdirSync(root).filter(x=>!x.endsWith('.toml')).sort())await pool.query(readFileSync(join(root,name,'migration.sql'),'utf8'));
  for(const id of [123,456,789,999])await pool.query('INSERT INTO users(id,telegram_id,first_name) VALUES($1,$2,$3)',[`tg_${id}`,id,'Player']);
  ranked=new RankedRepository(pool);sessions=new RealtimeSessionRepository(pool);games=new GameRepository(pool);connections=new Map();
  for(const id of [123,456,789,999])connections.set(id,await sessions.claim(identity(id)));
 });
 afterEach(async()=>{await pool.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);});afterAll(async()=>{await admin.end();});
 const c=(id:number)=>connections.get(id)!;
 async function premium(id:number){const order=randomUUID();await pool.query("INSERT INTO premium_orders(id,user_id,plan_id,duration_days,stars_amount,currency,status,charge_id) VALUES($1,$2,'PREMIUM_1M',30,55,'XTR','PAID',$3)",[order,`tg_${id}`,randomUUID()]);await pool.query("INSERT INTO paid_entitlements(order_id,starts_at,expires_at) VALUES($1,clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day')",[order]);return order;}
 async function offer(a=123,b=456){const ta=await ranked.join(c(a),'join-'+randomUUID());const tb=await ranked.join(c(b),'join-'+randomUUID());const fence=(await ranked.acquireFence(randomUUID()))!;try{return {offer:(await ranked.createOffer(fence,ta.id,tb.id))!,ta,tb};}finally{await ranked.releaseFence(fence);}}
 async function start(a=123,b=456){const queued=await offer(a,b);expect(queued.offer).not.toBeNull();await ranked.respond(c(a),queued.offer.id,true);const result=await ranked.respond(c(b),queued.offer.id,true);expect(result.state).toBe('STARTED');return {...queued,matchId:result.matchId!};}
 async function finish(matchId:string){const actor=(await pool.query<{user_id:string}>('SELECT user_id FROM game_players WHERE match_id=$1 AND seat=0',[matchId])).rows[0]!.user_id;return games.actForConnection(c(Number(actor.slice(3))),matchId,{id:'forfeit-'+randomUUID(),expectedVersion:0,command:{type:'FORFEIT'}});}
 it('settles server forfeits once, feeds ranked-win task and all-complete bonus atomically',async()=>{
  await premium(456);const tasks=new DailyTasks(pool);await tasks.claim('tg_456','MANDATORY_VIDEO_LOGIN');await tasks.claim('tg_456','MANDATORY_VIDEO_UNLOCK');
  const m=await start();await finish(m.matchId);const settlement=new RankedSettlement(pool);
  const results=await Promise.all(Array.from({length:10},()=>settlement.settle(m.matchId)));expect(results.filter(Boolean)).toHaveLength(1);
  expect((await pool.query('SELECT user_id,outcome FROM ranked_results ORDER BY user_id')).rows).toEqual([{user_id:'tg_123',outcome:'LOSS'},{user_id:'tg_456',outcome:'WIN'}]);
  expect((await pool.query("SELECT points FROM users WHERE id='tg_456'")).rows[0].points).toBe(200);
  expect((await tasks.state('tg_456')).allBonusClaimed).toBe(true);
  expect((await pool.query("SELECT count(*)::int n FROM outbox_events WHERE type='RANKED_SETTLED'")).rows[0].n).toBe(1);
  await expect(pool.query("UPDATE ranked_results SET outcome='WIN' WHERE user_id='tg_123'")).rejects.toThrow('immutable');
 });
 it('rolls back result receipts, task points and outbox on a settlement failure then recovers',async()=>{
  const m=await start();expect(await new RankedSettlement(pool).settle(m.matchId)).toBe(false);await finish(m.matchId);
  await pool.query(`CREATE FUNCTION fail_settle() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type='RANKED_SETTLED' THEN RAISE EXCEPTION 'injected'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_settle BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION fail_settle()`);
  await expect(new RankedSettlement(pool).settle(m.matchId)).rejects.toThrow('injected');
  expect((await pool.query('SELECT count(*)::int n FROM ranked_results')).rows[0].n).toBe(0);expect((await pool.query("SELECT points FROM users WHERE id='tg_456'")).rows[0].points).toBe(0);
  await pool.query('DROP TRIGGER fail_settle ON outbox_events');expect(await new RankedSettlement(pool).recover()).toBe(1);
  expect(await new RankedSettlement(pool).recover()).toBe(0);
 });
 it('attributes no-shows once, applies the warning/2/5/15 ladder and resets after24 hours',async()=>{
  for(const [miss,minutes] of [[1,0],[2,2],[3,5],[4,15]]){
   const o=await offer();await ranked.respond(c(123),o.offer.id,true);await ranked.respond(c(456),o.offer.id,false);await ranked.respond(c(456),o.offer.id,false);
   const snapshot=await ranked.resume(c(456));expect(snapshot.ranked.penalty.misses).toBe(miss);expect(Boolean(snapshot.ranked.penalty.lockedUntil)).toBe(minutes!==0);
   expect((await ranked.resume(c(123))).ranked.penalty.misses).toBe(0);
   if(minutes){await expect(ranked.join(c(456),'locked-'+randomUUID())).rejects.toMatchObject({code:'RANKED_LOCKED'});await pool.query("UPDATE ranked_penalties SET locked_until=clock_timestamp()-interval '1 second' WHERE user_id='tg_456'");}
   await ranked.cancel(c(123),o.ta.id);
  }
  await pool.query("UPDATE ranked_penalties SET last_miss_at=clock_timestamp()-interval '24 hours',locked_until=NULL WHERE user_id='tg_456'");
  const o=await offer();await ranked.respond(c(456),o.offer.id,false);expect((await ranked.resume(c(456))).ranked.penalty).toEqual({misses:1,lockedUntil:null});
  expect((await pool.query("SELECT count(*)::int n FROM ranked_no_shows WHERE user_id='tg_456'")).rows[0].n).toBe(5);
 });
 it('starts mutually accepted rematch once with no second ready check and rechecks opponent cap',async()=>{
  const first=await start();await finish(first.matchId);await new RankedSettlement(pool).settle(first.matchId);
  const request=await ranked.requestRematch(c(123),'tg_456','rematch-key');expect(await ranked.requestRematch(c(123),'tg_456','rematch-key')).toBe(request);
  expect((await ranked.resume(c(456))).ranked.rematches).toMatchObject([{id:request,incoming:true,opponentId:'tg_123'}]);
  await expect(ranked.respondRematch(c(123),request,true)).rejects.toMatchObject({code:'INVALID_INPUT'});
  const starts=await Promise.all(Array.from({length:10},()=>ranked.respondRematch(c(456),request,true)));expect(new Set(starts.map(v=>v.matchId)).size).toBe(1);expect(starts[0]!.state).toBe('STARTED');
  await finish(starts[0]!.matchId!);await premium(123);await premium(456);
  await expect(ranked.requestRematch(c(123),'tg_456','third-pair')).rejects.toMatchObject({code:'INCOMPATIBLE'});
 });
 it('throttles three rolling-hour rematch requests and declines/expiries do not penalize or charge',async()=>{
  const first=await start();await finish(first.matchId);await new RankedSettlement(pool).settle(first.matchId);
  for(let i=0;i<3;i++){const id=await ranked.requestRematch(c(123),'tg_456','request-'+i);await ranked.respondRematch(c(456),id,false);}
  await expect(ranked.requestRematch(c(123),'tg_456','request-four')).rejects.toMatchObject({code:'REMATCH_LIMIT'});
  await pool.query("UPDATE ranked_rematches SET created_at=created_at-interval '1 hour',expires_at=expires_at-interval '1 hour'");
  const id=await ranked.requestRematch(c(123),'tg_456','new-hour');await pool.query("UPDATE ranked_rematches SET created_at=created_at-interval '20 seconds',expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[id]);
  expect((await ranked.respondRematch(c(456),id,true)).state).toBe('EXPIRED');expect((await ranked.resume(c(456))).ranked.penalty.misses).toBe(0);expect((await ranked.resume(c(456))).ranked.allowance.used).toBe(1);
 });
 it('serializes duplicate queue joins and shares the admission lock with practice',async()=>{
  const joined=await Promise.all(Array.from({length:10},()=>ranked.join(c(123),'same-join-key')));expect(new Set(joined.map(t=>t.id)).size).toBe(1);
  await expect(new PracticeRepository(pool,'ALLOW_PROVIDER_UNAVAILABLE').start('tg_123','practice-conflict')).rejects.toMatchObject({code:'RANKED_QUEUE'});
  await ranked.cancel(c(123),joined[0]!.id);await premium(123);
  const race=await Promise.allSettled([ranked.join(c(123),'another-join-key'),new PracticeRepository(pool).start('tg_123','practice-race')]);expect(race.filter(v=>v.status==='fulfilled')).toHaveLength(1);
 });
 it('reserves free offers and charges two starts only once under concurrent accepts',async()=>{
  const o=await offer();const allowance=(await ranked.resume(c(123))).ranked.allowance;expect(allowance).toMatchObject({used:0,reserved:1,remaining:2});
  await ranked.respond(c(123),o.offer.id,true);const results=await Promise.all(Array.from({length:10},()=>ranked.respond(c(456),o.offer.id,true)));
  expect(new Set(results.map(r=>r.matchId)).size).toBe(1);expect((await pool.query('SELECT count(*)::int n FROM game_matches')).rows[0].n).toBe(1);
  expect((await ranked.resume(c(123))).ranked.allowance).toMatchObject({used:1,reserved:0,remaining:2});
  await expect(pool.query("UPDATE ranked_reservations SET state='RELEASED' WHERE user_id='tg_123'")).rejects.toThrow('immutable');
 });
 it('releases declined offers and restores the nonfaulting original queue priority',async()=>{
  const o=await offer();await ranked.respond(c(123),o.offer.id,true);await ranked.respond(c(456),o.offer.id,false);
  const a=await ranked.resume(c(123));expect(a.phase).toBe('SEARCHING');expect(a.ranked.ticket!.joinedAt).toBe(o.ta.joined_at.getTime());
  expect(a.ranked.allowance).toMatchObject({used:0,reserved:0,remaining:3});expect((await ranked.resume(c(456))).ranked.ticket).toBeNull();
 });
 it('cancels a search racing with offer creation without losing the opponent or charging either player',async()=>{
  const a=await ranked.join(c(123),'cancel-race-a'),b=await ranked.join(c(456),'cancel-race-b');const fence=(await ranked.acquireFence(randomUUID()))!;
  try{await Promise.all([ranked.createOffer(fence,a.id,b.id),ranked.cancel(c(123),a.id)]);}finally{await ranked.releaseFence(fence);}
  expect((await ranked.resume(c(123))).ranked.ticket).toBeNull();expect((await ranked.resume(c(456))).phase).toBe('SEARCHING');
  expect((await ranked.resume(c(123))).ranked.allowance).toMatchObject({used:0,reserved:0,remaining:3});
 });
 it('expires offers and stale searches without charging or extending original search deadlines',async()=>{
  const o=await offer();await ranked.respond(c(123),o.offer.id,true);
  await pool.query("UPDATE ranked_offers SET created_at=clock_timestamp()-interval '20 seconds',expires_at=clock_timestamp()-interval '1 second'");await ranked.recover();
  expect((await ranked.resume(c(123))).phase).toBe('SEARCHING');expect((await ranked.resume(c(456))).ranked.ticket).toBeNull();
  await pool.query("UPDATE ranked_tickets SET last_seen_at=clock_timestamp()-interval '46 seconds' WHERE state='SEARCHING'");await ranked.recover();expect((await ranked.resume(c(123))).ranked.ticket).toBeNull();
 });
 it('permits newest-device adoption without resetting priority or allowing old-device heartbeats',async()=>{
  const old=c(123);const t=await ranked.join(old,'adopt-ticket');const replacement=await sessions.claim(identity(123));
  await expect(ranked.heartbeat(old,t.id)).rejects.toMatchObject({code:'SESSION_REPLACED'});
  const adopted=await ranked.heartbeat(replacement,t.id);expect(adopted.joined_at).toEqual(t.joined_at);expect(adopted.search_expires_at).toEqual(t.search_expires_at);expect(adopted.connection_id).toBe(replacement.connectionId);
  expect(JSON.stringify(await ranked.resume(replacement))).not.toContain(replacement.connectionId);
 });
 it('enforces three starts for premium too and keeps forfeits chargeable',async()=>{
  await premium(123);await premium(456);await premium(789);await premium(999);
  for(const opponent of [456,789,999]){const m=await start(123,opponent);await finish(m.matchId);}
  await expect(ranked.join(c(123),'fourth-start-denied')).rejects.toMatchObject({code:'RANKED_DAILY_LIMIT'});expect((await ranked.resume(c(123))).ranked.allowance.used).toBe(3);
 });
 it('starts regular cooldown at the second finish; premium bypass and downgrade are rechecked',async()=>{
  const first=await start();await finish(first.matchId);const second=await start();await finish(second.matchId);
  const allowance=(await ranked.resume(c(123))).ranked.allowance;const end=(await pool.query('SELECT ended_at FROM game_matches WHERE id=$1',[second.matchId])).rows[0].ended_at as Date;
  expect(allowance.cooldownUntil).toBe(Math.min(allowance.resetAt,end.getTime()+3600000));await expect(ranked.join(c(123),'blocked-cooldown')).rejects.toMatchObject({code:'RANKED_COOLDOWN'});
  const order=await premium(123);expect((await ranked.resume(c(123))).ranked.allowance.cooldownUntil).toBeNull();
  const ta=await ranked.join(c(123),'premium-third-offer');const tb=await ranked.join(c(789),'new-opponent-offer');const f=(await ranked.acquireFence(randomUUID()))!;
  const next=await ranked.createOffer(f,ta.id,tb.id);await ranked.releaseFence(f);expect(next).not.toBeNull();await ranked.respond(c(789),next!.id,true);
  await pool.query('UPDATE paid_entitlements SET revoked_at=clock_timestamp() WHERE order_id=$1',[order]);
  expect((await ranked.respond(c(123),next!.id,true)).state).toBe('CANCELLED');expect((await ranked.resume(c(789))).phase).toBe('SEARCHING');expect((await ranked.resume(c(123))).ranked.allowance.used).toBe(2);
 });
 it('enforces two starts per opponent per Lagos day using a count, not membership',async()=>{
  await premium(123);await premium(456);
  for(let i=0;i<2;i++){const m=await start();await finish(m.matchId);}
  const third=await offer();expect(third.offer).toBeNull();expect((await ranked.resume(c(123))).ranked.allowance.used).toBe(2);
 });
 it('moves a reservation to the actual Lagos start day across midnight without charging the old day',async()=>{
  const o=await offer();await pool.query("UPDATE ranked_reservations SET lagos_date=(clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date-1 WHERE state='RESERVED'");
  await ranked.respond(c(123),o.offer.id,true);const result=await ranked.respond(c(456),o.offer.id,true);expect(result.state).toBe('STARTED');
  const day=(await ranked.resume(c(123))).ranked.allowance.day;expect((await pool.query('SELECT lagos_date::text AS day,slot FROM ranked_reservations')).rows).toEqual([{day,slot:1},{day,slot:1}]);
 });
 it('resets daily quota, pair count and finish-based cooldown at Lagos midnight without rewriting charges',async()=>{
  const day=(await pool.query("SELECT (clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date::text AS day")).rows[0].day as string;
  const past=Date.parse(day+'T00:00:00+01:00')-7200000;
  for(let i=0;i<2;i++){
   const at=past+i*100;const m=await games.createMatch({mode:'RANKED',rules:APPROVED_WHOT_RULES,players:[{userId:'tg_123',isBot:false},{userId:'tg_456',isBot:false}],at});
   await games.act(m.id,'tg_123',{id:'historic-forfeit',expectedVersion:0,command:{type:'FORFEIT'}},at+1);
   const writer=await pool.connect();const a=randomUUID(),b=randomUUID(),o=randomUUID();
   try{await writer.query('BEGIN');
    for(const [id,user] of [[a,'tg_123'],[b,'tg_456']])await writer.query("INSERT INTO ranked_tickets(id,user_id,connection_id,request_key,state,joined_at,last_seen_at,search_expires_at) VALUES($1,$2,$3,$4,'STARTED',$5,$5,$5::timestamptz+interval '120 seconds')",[id,user,randomUUID(),'historic-'+randomUUID(),new Date(at-1)]);
    await writer.query("INSERT INTO ranked_offers(id,a_ticket,b_ticket,state,accepted_a,accepted_b,created_at,expires_at,match_id) VALUES($1,$2,$3,'STARTED',true,true,$4,$4::timestamptz+interval '10 seconds',$5)",[o,a,b,new Date(at-1),m.id]);
    for(const user of ['tg_123','tg_456'])await writer.query("INSERT INTO ranked_reservations(offer_id,user_id,state,lagos_date,reserved_at,started_at,slot,match_id) VALUES($1,$2,'STARTED',($3::timestamptz AT TIME ZONE 'Africa/Lagos')::date,$3,$3,$4,$5)",[o,user,new Date(at),i+1,m.id]);
    await writer.query('COMMIT');
   }catch(error){await writer.query('ROLLBACK');throw error;}finally{writer.release();}
  }
  expect((await ranked.resume(c(123))).ranked.allowance).toMatchObject({used:0,reserved:0,remaining:3,cooldownUntil:null});
  expect((await offer()).offer).not.toBeNull();
 });
 it('rolls back both charges, seats and acceptance when starting the game fails',async()=>{
  const o=await offer();await ranked.respond(c(123),o.offer.id,true);
  await pool.query("CREATE FUNCTION reject_ranked_start() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type='RANKED_STARTED' THEN RAISE EXCEPTION 'ranked start failure'; END IF; RETURN NEW; END $$");await pool.query('CREATE TRIGGER reject_ranked_start BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_ranked_start()');
  await expect(ranked.respond(c(456),o.offer.id,true)).rejects.toThrow('ranked start failure');expect((await pool.query('SELECT count(*)::int n FROM game_matches')).rows[0].n).toBe(0);
  expect((await ranked.resume(c(123))).ranked.allowance).toMatchObject({used:0,reserved:1});await pool.query('DROP TRIGGER reject_ranked_start ON outbox_events');expect((await ranked.respond(c(456),o.offer.id,true)).state).toBe('STARTED');
 });
 (redisUrl?it:it.skip)('recovers Redis loss, scans beyond stale/blocked prefixes, and fences a replaced leader',async()=>{
  const redis=new Redis(redisUrl!,{lazyConnect:true,maxRetriesPerRequest:1,commandTimeout:1000});redis.on('error',()=>undefined);const namespace='test-'+randomUUID();const queue=new RedisRankedQueue(redis,namespace);
  try{await redis.connect();await ranked.join(c(123),'redis-a-join');await ranked.join(c(456),'redis-b-join');
   // Fifty live-looking cache entries without SQL tickets cannot become real matches or starve the tail.
   for(let i=0;i<50;i++)await queue.sync({userId:`tg_${10000+i}`,epoch:'1',ticketId:randomUUID(),connectionId:randomUUID(),joinedAt:Date.now()-10000,expiresAt:Date.now()+120000,lastSeenAt:Date.now(),searching:true});
   const worker=new RankedMatchmaker(ranked,queue);let created=0;for(let i=0;i<8&&!created;i++)created+=await worker.pass();expect(created).toBe(1);
   expect((await pool.query('SELECT count(*)::int n FROM ranked_offers')).rows[0].n).toBe(1);
   const oldToken=randomUUID();expect(await queue.acquire(oldToken)).toBe(true);const oldFence=(await ranked.acquireFence(oldToken))!;
   await redis.del(queue.prefix+'owner');const newToken=randomUUID();expect(await queue.acquire(newToken)).toBe(true);expect(await ranked.acquireFence(newToken)).toBeNull();
   await pool.query("UPDATE ranked_matchmaker_lease SET expires_at=clock_timestamp()-interval '1 second'");const replacement=(await ranked.acquireFence(newToken))!;
   const tickets=(await pool.query<{id:string}>('SELECT id FROM ranked_tickets ORDER BY user_id')).rows;
   await expect(ranked.createOffer(oldFence,tickets[0]!.id,tickets[1]!.id)).rejects.toMatchObject({code:'STALE_OWNER'});await queue.release(oldToken);expect(await redis.get(queue.prefix+'owner')).toBe(newToken);await ranked.releaseFence(replacement);await queue.release(newToken);
   const keys=await redis.keys(queue.prefix+'*');if(keys.length)await redis.del(...keys);await new RankedMatchmaker(ranked,queue).sync();
   // Offered users are not reinserted as SEARCHING when rebuilding the cache.
   expect(await redis.zcard(queue.prefix+'queue')).toBe(0);
  }finally{const keys=await redis.keys(queue.prefix+'*').catch(()=>[]);if(keys.length)await redis.del(...keys);redis.disconnect();}
 },20000);
 (redisUrl?it:it.skip)('lets two actual clients queue, accept one offer, resume the same game and spend allowance once',async()=>{
  const redis=new Redis(redisUrl!,{lazyConnect:true,maxRetriesPerRequest:1,commandTimeout:1000});redis.on('error',()=>undefined);const queue=new RedisRankedQueue(redis,'test-'+randomUUID());
  const servers=[createServer(),createServer()];const secret='r'.repeat(40);const origin='https://mini.example';const clients:Socket[]=[];
  const gateways=servers.map(server=>attachRealtimeGateway(server,{jwtSecret:secret,origin,rateLimits:new MemoryRateLimitCounterStore(),sessions,
   actions:{games,rateLimits:new MemoryRateLimitCounterStore()},ranked:{repository:ranked,queue,rateLimits:new MemoryRateLimitCounterStore()}}));
  try{await redis.connect();await Promise.all(servers.map(s=>new Promise<void>(resolve=>s.listen(0,'127.0.0.1',resolve))));
   const connect=async(index:number,id:number)=>{const token=jwt.sign({userId:`tg_${id}`,telegramId:id,tokenVersion:0},secret,{issuer:'cash-dey-play',audience:'cash-dey-play-mini-app',expiresIn:60});
    const client=io(`http://127.0.0.1:${(servers[index]!.address() as AddressInfo).port}`,{auth:{token},extraHeaders:{Origin:origin},transports:['websocket'],autoConnect:false,reconnection:false});clients.push(client);
    await new Promise<void>((resolve,reject)=>{client.once('connect',resolve);client.once('connect_error',reject);client.connect();});return client;};
   const a=await connect(0,123),b=await connect(1,456);const call=(s:Socket,event:string,payload:unknown={})=>s.timeout(2000).emitWithAck(event,payload);
   const joined=await Promise.all([call(a,'queue:join',{requestKey:'socket-ranked-a'}),call(b,'queue:join',{requestKey:'socket-ranked-b'})]);for(const r of joined)expect(r).toMatchObject({ok:true,data:{phase:'SEARCHING'}});
   expect(await new RankedMatchmaker(ranked,queue).pass()).toBe(1);
   const offers=await Promise.all([call(a,'session:resume'),call(b,'session:resume')]);for(const r of offers)expect(r.data.phase).toBe('OFFER');const offerId=offers[0].data.ranked.offer.id;
   expect(offers[1].data.ranked.offer.id).toBe(offerId);expect(JSON.stringify(offers)).not.toContain('connection_id');
   const accepted=await Promise.all([call(a,'offer:respond',{offerId,accept:true}),call(b,'offer:respond',{offerId,accept:true})]);for(const r of accepted)expect(r.ok).toBe(true);
   const states=await Promise.all([call(a,'session:resume'),call(b,'session:resume')]);for(const r of states)expect(r).toMatchObject({ok:true,data:{phase:'IN_MATCH',ranked:{allowance:{used:1,remaining:2}}}});
   expect(states[0].data.match.id).toBe(states[1].data.match.id);expect(states[0].data.match.view.seat).toBe(0);expect(states[1].data.match.view.seat).toBe(1);
   expect((await call(a,'offer:respond',{offerId,accept:true})).data.match.id).toBe(states[0].data.match.id);
   const other=await connect(0,789);expect(await call(other,'offer:respond',{offerId,accept:true})).toEqual({ok:false,error:{code:'INVALID_INPUT'}});
   expect(await call(a,'queue:join',{requestKey:'spoof-tier',isPremium:true})).toEqual({ok:false,error:{code:'INVALID_INPUT'}});
   expect((await pool.query('SELECT count(*)::int n FROM game_matches')).rows[0].n).toBe(1);
   expect((await call(a,'match:action',{matchId:states[0].data.match.id,actionId:'socket-ranked-forfeit',expectedVersion:0,command:{type:'FORFEIT'}})).ok).toBe(true);
   expect((await call(b,'session:resume')).data.phase).toBe('RESULT');
  }finally{for(const client of clients)client.disconnect();await Promise.all(gateways.map(g=>new Promise<void>(resolve=>g.close(()=>resolve()))));const keys=await redis.keys(queue.prefix+'*').catch(()=>[]);if(keys.length)await redis.del(...keys);redis.disconnect();}
 },20000);

 async function withQueue(work:(queue:RedisRankedQueue,redis:Redis)=>Promise<void>){
  if(!redisUrl||new URL(redisUrl).pathname!=='/15')throw new Error('Dedicated Redis test database required');
  const redis=new Redis(redisUrl,{lazyConnect:true,maxRetriesPerRequest:1,commandTimeout:1000});redis.on('error',()=>undefined);const queue=new RedisRankedQueue(redis,'test-'+randomUUID());
  try{await redis.connect();await work(queue,redis);}finally{const keys=await redis.keys(queue.prefix+'*').catch(()=>[]);if(keys.length)await redis.del(...keys);redis.disconnect();}
 }
 (redisUrl?it:it.skip)('never assigns four players twice under ten competing matchmaker workers',async()=>{
  await Promise.all([123,456,789,999].map(id=>ranked.join(c(id),'concurrent-'+id)));
  await withQueue(async queue=>{
   const results=await Promise.all(Array.from({length:10},()=>new RankedMatchmaker(ranked,queue).pass()));expect(results.reduce((a,b)=>a+b,0)).toBe(2);
   const offers=(await pool.query<{a_ticket:string;b_ticket:string}>('SELECT a_ticket,b_ticket FROM ranked_offers')).rows;expect(offers).toHaveLength(2);
   expect(new Set(offers.flatMap(o=>[o.a_ticket,o.b_ticket])).size).toBe(4);
   expect((await pool.query("SELECT count(*)::int n FROM ranked_reservations WHERE state='RESERVED'")).rows[0].n).toBe(4);
  });
 },20000);
 (redisUrl?it:it.skip)('recovers a crash after SQL offer commit but before Redis removal without losing or pairing players again',async()=>{
  const a=await ranked.join(c(123),'sql-first-a');const b=await ranked.join(c(456),'sql-first-b');
  await withQueue(async(queue,redis)=>{
   await new RankedMatchmaker(ranked,queue).sync();expect(await redis.zcard(queue.prefix+'queue')).toBe(2);
   const fence=(await ranked.acquireFence(randomUUID()))!;const committed=await ranked.createOffer(fence,a.id,b.id);await ranked.releaseFence(fence);expect(committed).not.toBeNull();
   // Simulate losing the process before any cache cleanup: the old SEARCHING entries are still present.
   expect(await redis.zcard(queue.prefix+'queue')).toBe(2);expect(await new RankedMatchmaker(ranked,queue).pass()).toBe(0);expect(await redis.zcard(queue.prefix+'queue')).toBe(0);
   expect((await ranked.resume(c(123))).ranked.allowance).toMatchObject({used:0,reserved:1});expect((await pool.query('SELECT count(*)::int n FROM ranked_offers')).rows[0].n).toBe(1);
  });
 },20000);
 (redisUrl?it:it.skip)('retains both Redis tickets when SQL offer creation rolls back, then pairs after repair',async()=>{
  await ranked.join(c(123),'sql-fail-a');await ranked.join(c(456),'sql-fail-b');
  await withQueue(async(queue,redis)=>{
   await pool.query("CREATE FUNCTION reject_offer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'offer storage failure'; END $$");await pool.query('CREATE TRIGGER reject_offer BEFORE INSERT ON ranked_offers FOR EACH ROW EXECUTE FUNCTION reject_offer()');
   await expect(new RankedMatchmaker(ranked,queue).pass()).rejects.toThrow('offer storage failure');expect(await redis.zcard(queue.prefix+'queue')).toBe(2);
   expect((await ranked.resume(c(123))).phase).toBe('SEARCHING');await pool.query('DROP TRIGGER reject_offer ON ranked_offers');expect(await new RankedMatchmaker(ranked,queue).pass()).toBe(1);
  });
 },20000);

});
