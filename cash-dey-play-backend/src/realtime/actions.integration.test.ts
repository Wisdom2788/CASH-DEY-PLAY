import { randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { APPROVED_WHOT_RULES } from '../game-engine/approved-rules';
import { GameRepository } from '../game-engine/repository';
import { RealtimeSessionRepository } from './session.repository';
const url=process.env.TEST_DATABASE_URL;
if(process.env.REQUIRE_DB_TESTS==='true'&&!url)throw new Error('TEST_DATABASE_URL required');
const suite=url?describe:describe.skip;
const identity=(id=123,version=0)=>({userId:`tg_${id}`,telegramId:id,tokenVersion:version,expiresAt:(Math.floor(Date.now()/1000)+60)*1000});
suite('session-guarded game writes on PostgreSQL',()=>{
 let admin:Pool,pool:Pool,schema:string,games:GameRepository,sessions:RealtimeSessionRepository;
 beforeAll(()=>{if(!/(?:^|_)test(?:_|$)/i.test(new URL(url!).pathname.slice(1)))throw new Error('Disposable test database required');admin=new Pool({connectionString:url});});
 beforeEach(async()=>{
  schema='cdp_actions_'+randomUUID().replace(/-/g,'');await admin.query(`CREATE SCHEMA "${schema}"`);
  pool=new Pool({connectionString:url,options:`-c search_path=${schema}`,max:12});
  const root=join(__dirname,'../../prisma/migrations');for(const name of readdirSync(root).filter(x=>!x.endsWith('.toml')).sort())await pool.query(readFileSync(join(root,name,'migration.sql'),'utf8'));
  await pool.query("INSERT INTO users(id,telegram_id,first_name) VALUES('tg_123',123,'One'),('tg_456',456,'Two'),('tg_789',789,'Other')");
  games=new GameRepository(pool,max=>max-1);sessions=new RealtimeSessionRepository(pool);
 });
 afterEach(async()=>{await pool.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);});afterAll(async()=>{await admin.end();});
 const match=(turnMs=30000)=>games.createMatch({mode:'RANKED',rules:{...APPROVED_WHOT_RULES,turnMs},players:[{userId:'tg_123',isBot:false},{userId:'tg_456',isBot:false}],at:Date.now()});
 const draw=(id='draw-01',expectedVersion=0)=>({id,expectedVersion,command:{type:'DRAW' as const}});
 const count=async()=>Number((await pool.query('SELECT count(*)::int n FROM game_events')).rows[0].n);
 it('commits ten duplicate deliveries once with exact replay and a server event timestamp',async()=>{
  const m=await match();const c=await sessions.claim(identity());const before=Date.now();
  const all=await Promise.all(Array.from({length:10},()=>games.actForConnection(c,m.id,draw())));
  for(const view of all)expect(view).toEqual(all[0]);expect(await count()).toBe(1);
  const event=(await pool.query('SELECT occurred_at FROM game_events')).rows[0];expect(event.occurred_at.getTime()).toBeGreaterThanOrEqual(before);
  expect(event.occurred_at.getTime()).toBeLessThanOrEqual(Date.now());
  expect((await pool.query("SELECT count(*)::int n FROM outbox_events WHERE type='GAME_STATE_CHANGED'")).rows[0].n).toBe(1);
  expect((await games.replay(m.id)).version).toBe(1);
 });
 it('rejects conflicts, stale versions, wrong turns and nonparticipants without another event',async()=>{
  const m=await match();const c=await sessions.claim(identity());await games.actForConnection(c,m.id,draw());
  await expect(games.actForConnection(c,m.id,{id:'draw-01',expectedVersion:0,command:{type:'FORFEIT'}})).rejects.toMatchObject({code:'ACTION_CONFLICT'});
  await expect(games.actForConnection(c,m.id,draw('stale-01',0))).rejects.toMatchObject({code:'STALE_VERSION'});
  await expect(games.actForConnection(c,m.id,draw('wrong-turn-01',1))).rejects.toMatchObject({code:'WRONG_TURN'});
  const other=await sessions.claim(identity(789));await expect(games.actForConnection(other,m.id,draw('other-01',1))).rejects.toMatchObject({code:'INVALID_INPUT'});
  expect(await count()).toBe(1);
 });
 it('rejects replaced and revoked sessions before reading even a previously committed receipt',async()=>{
  const m=await match();const first=await sessions.claim(identity());const current=await sessions.claim(identity());
  await expect(games.actForConnection(first,m.id,draw())).rejects.toMatchObject({code:'SESSION_REPLACED'});
  await games.actForConnection(current,m.id,draw());await pool.query("UPDATE users SET token_version=1 WHERE id='tg_123'");
  await expect(games.actForConnection(current,m.id,draw())).rejects.toMatchObject({code:'UNAUTHORIZED'});expect(await count()).toBe(1);
 });
 it('keeps receipts bound to actor/payload after later turns and after reconnect',async()=>{
  const m=await match();const a=await sessions.claim(identity());const b=await sessions.claim(identity(456));
  const original=await games.actForConnection(a,m.id,draw());await games.actForConnection(b,m.id,draw('opponent-draw',1));
  const replacement=await sessions.claim(identity());
  expect(await games.actForConnection(replacement,m.id,draw())).toEqual(original);
  expect((await sessions.resume(replacement)).match?.view.version).toBe(2);
  await expect(games.actForConnection(b,m.id,draw())).rejects.toMatchObject({code:'ACTION_CONFLICT'});
  expect(await count()).toBe(2);expect((await games.replay(m.id)).version).toBe(2);
 });
 it('rechecks token expiry after waiting for the match lock',async()=>{
  const m=await match();const c=await sessions.claim({...identity(),expiresAt:Date.now()+1000});const locker=await pool.connect();let pending:Promise<unknown>|undefined;
  try{
   await locker.query('BEGIN');await locker.query('SELECT id FROM game_matches WHERE id=$1 FOR UPDATE',[m.id]);
   pending=games.actForConnection(c,m.id,draw()).then(()=>({code:'unexpected success'}),error=>error);
   await locker.query('SELECT pg_sleep(1.1)');await locker.query('COMMIT');expect(await pending).toMatchObject({code:'UNAUTHORIZED'});expect(await count()).toBe(0);
  }finally{await locker.query('ROLLBACK');locker.release();await pending;}
 });
 it('uses the post-lock database clock for game deadlines and cannot outrun a due timeout',async()=>{
  const m=await match(1000);const c=await sessions.claim(identity());const locker=await pool.connect();let pending:Promise<unknown>|undefined;
  try{
   await locker.query('BEGIN');await locker.query('SELECT id FROM game_matches WHERE id=$1 FOR UPDATE',[m.id]);
   pending=games.actForConnection(c,m.id,draw()).then(()=>({code:'unexpected success'}),error=>error);
   await locker.query('SELECT pg_sleep(1.1)');await locker.query('COMMIT');expect(await pending).toMatchObject({code:'EXPIRED'});expect(await count()).toBe(0);
   expect(await games.advanceDueMatch(m.id,0)).toBe('TIMEOUT');expect((await games.replay(m.id)).reason).toBe('TIMEOUT');
  }finally{await locker.query('ROLLBACK');locker.release();await pending;}
 });
 it('rolls back the action and outbox together and accepts an exact retry after repair',async()=>{
  const m=await match();const c=await sessions.claim(identity());
  await pool.query("CREATE FUNCTION reject_move_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type='GAME_STATE_CHANGED' THEN RAISE EXCEPTION 'move outbox failure'; END IF; RETURN NEW; END $$");
  await pool.query('CREATE TRIGGER reject_move_outbox BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_move_outbox()');
  await expect(games.actForConnection(c,m.id,draw())).rejects.toThrow('move outbox failure');expect(await count()).toBe(0);expect((await games.replay(m.id)).version).toBe(0);await sessions.assertCurrent(c);
  await pool.query('DROP TRIGGER reject_move_outbox ON outbox_events');expect((await games.actForConnection(c,m.id,draw())).version).toBe(1);
 });
 it('retains session locks through the game commit, so a waiting replacement cannot overtake the write',async()=>{
  const m=await match();const first=await sessions.claim(identity());const locker=await pool.connect();let pending:ReturnType<GameRepository['actForConnection']>|undefined;let replacement:ReturnType<RealtimeSessionRepository['claim']>|undefined;
  try{
   await locker.query('BEGIN');await locker.query('SELECT id FROM game_matches WHERE id=$1 FOR UPDATE',[m.id]);
   pending=games.actForConnection(first,m.id,draw());
   let guarded=false;
   for(let i=0;i<20&&!guarded;i++){
    try{await pool.query("SELECT id FROM users WHERE id='tg_123' FOR UPDATE NOWAIT");}
    catch(error){if((error as {code?:string}).code!=='55P03')throw error;guarded=true;}
    if(!guarded)await pool.query('SELECT pg_sleep(0.05)');
   }
   expect(guarded).toBe(true);replacement=sessions.claim(identity());await locker.query('COMMIT');
   expect((await pending).version).toBe(1);const current=await replacement;
   await expect(games.actForConnection(first,m.id,draw())).rejects.toMatchObject({code:'SESSION_REPLACED'});
   expect((await sessions.resume(current)).match?.view.version).toBe(1);expect(await count()).toBe(1);
  }finally{await locker.query('ROLLBACK');locker.release();await pending?.catch(()=>undefined);await replacement?.catch(()=>undefined);}
 });
});
