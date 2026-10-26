import { randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { DailyTasks } from '../entitlements/daily-tasks';
import { PracticeRepository,PracticeStart } from './practice.repository';
import { GameRepository } from '../game-engine/repository';
import { chooseBotCommand } from '../game-engine/bot';
import { runGamePass } from '../workers/game-worker';
import { APPROVED_WHOT_RULES } from '../game-engine/approved-rules';
const url=process.env.TEST_DATABASE_URL;
if(process.env.REQUIRE_DB_TESTS==='true'&&!url)throw new Error('TEST_DATABASE_URL required');
const suite=url?describe:describe.skip;
const fixed=(max:number)=>max-1;
suite('practice admission PostgreSQL boundary',()=>{
 let admin:Pool,pool:Pool,schema:string,repo:PracticeRepository,games:GameRepository;
 beforeAll(()=>{if(!/(?:^|_)test(?:_|$)/i.test(new URL(url!).pathname.slice(1)))throw new Error('Disposable test database required');admin=new Pool({connectionString:url});});
 beforeEach(async()=>{
  schema='cdp_practice_'+randomUUID().replace(/-/g,'');await admin.query(`CREATE SCHEMA "${schema}"`);
  pool=new Pool({connectionString:url,options:`-c search_path=${schema}`,max:12});
  const root=join(__dirname,'../../prisma/migrations');for(const name of readdirSync(root).filter(x=>!x.endsWith('.toml')).sort())await pool.query(readFileSync(join(root,name,'migration.sql'),'utf8'));
  await pool.query("INSERT INTO users(id,telegram_id,first_name) VALUES('tg_123',123,'One'),('tg_456',456,'Two')");
  repo=new PracticeRepository(pool,'ALLOW_PROVIDER_UNAVAILABLE',fixed);games=new GameRepository(pool,fixed);
 });
 afterEach(async()=>{await pool.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);});afterAll(async()=>{await admin.end();});
 const forfeit=(s:PracticeStart)=>games.act(s.matchId,'tg_123',{id:'forfeit-01',expectedVersion:0,command:{type:'FORFEIT'}},s.view.deadlineAt!-29999);
 async function premium(expired=false){const id=randomUUID();await pool.query("INSERT INTO premium_orders(id,user_id,plan_id,duration_days,stars_amount,currency,status,charge_id) VALUES($1,'tg_123','PREMIUM_1M',30,55,'XTR','PAID',$2)",[id,randomUUID()]);await pool.query("INSERT INTO paid_entitlements(order_id,starts_at,expires_at) VALUES($1,clock_timestamp()-interval '1 day',clock_timestamp()+$2::interval)",[id,expired?'-1 second':'1 day']);return id;}
 it('blocks regular admissions by default and never creates ad evidence for fallback',async()=>{
  await expect(new PracticeRepository(pool).start('tg_123','blocked-01')).rejects.toMatchObject({code:'AD_VERIFICATION_REQUIRED'});
  expect((await pool.query('SELECT count(*)::int n FROM game_matches')).rows[0].n).toBe(0);
  const s=await repo.start('tg_123','fallback-01');expect(s.reason).toBe('PROVIDER_UNAVAILABLE');expect(s.view.ruleVersion).toBe('whot-v1');expect(s.view.seat).toBe(0);
  expect(JSON.stringify(s)).not.toContain('private_state');
 });
 it('replays ten concurrent requests exactly, including after terminal state',async()=>{
  const all=await Promise.all(Array.from({length:10},()=>repo.start('tg_123','same-key-01')));for(const s of all)expect(s).toEqual(all[0]);
  expect((await pool.query('SELECT count(*)::int n FROM practice_starts')).rows[0].n).toBe(1);
  await forfeit(all[0]!);expect(await repo.start('tg_123','same-key-01')).toEqual(all[0]);
 });
 it('serializes different keys into one active game and enforces five spent starts despite forfeits',async()=>{
  const results=await Promise.allSettled(Array.from({length:10},(_,i)=>repo.start('tg_123',`parallel-${i}`)));
  expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  const s=results.find(x=>x.status==='fulfilled') as PromiseFulfilledResult<PracticeStart>;await forfeit(s.value);
  for(let i=1;i<5;i++)await forfeit(await repo.start('tg_123',`daily-key-${i}`));
  await expect(repo.start('tg_123','sixth-key-01')).rejects.toMatchObject({code:'DAILY_LIMIT'});
  expect((await pool.query('SELECT count(*)::int n FROM practice_completions')).rows[0].n).toBe(0);
 });
 it('bypasses video and daily cap only for paid premium; expired premium is rechecked',async()=>{
  await premium();const strict=new PracticeRepository(pool,'BLOCK',fixed);
  for(let i=0;i<6;i++){const s=await strict.start('tg_123',`premium-${i}`);expect(s.reason).toBe('PREMIUM');await forfeit(s);}
  await pool.query("UPDATE paid_entitlements SET revoked_at=clock_timestamp()");
  await expect(strict.start('tg_123','expired-key')).rejects.toMatchObject({code:'DAILY_LIMIT'});
 });
 it('treats ad-free as video exemption but preserves regular daily limit',async()=>{
  await pool.query("INSERT INTO ad_free_days(user_id,valid_on,starts_at) VALUES('tg_123',(clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date,((clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date)::timestamp AT TIME ZONE 'Africa/Lagos')");
  const strict=new PracticeRepository(pool,'BLOCK',fixed);for(let i=0;i<5;i++){const s=await strict.start('tg_123',`adfree-${i}`);expect(s.reason).toBe('AD_FREE');await forfeit(s);}
  await expect(strict.start('tg_123','adfree-sixth')).rejects.toMatchObject({code:'DAILY_LIMIT'});
 });
 it('does not trust legacy premium flags or an expired paid grant',async()=>{
  await premium(true);await pool.query('UPDATE users SET is_premium=true');
  await expect(new PracticeRepository(pool).start('tg_123','expired-first')).rejects.toMatchObject({code:'AD_VERIFICATION_REQUIRED'});
 });
 it('blocks a ranked queue or existing ranked match',async()=>{
  await pool.query("INSERT INTO player_admissions VALUES('tg_123',true)");await expect(repo.start('tg_123','queue-key-01')).rejects.toMatchObject({code:'RANKED_QUEUE'});
  await pool.query('UPDATE player_admissions SET ranked_queued=false');
  await games.createMatch({mode:'RANKED',rules:APPROVED_WHOT_RULES,players:[{userId:'tg_123',isBot:false},{userId:'tg_456',isBot:false}],at:Date.now()});
  await expect(repo.start('tg_123','ranked-key-01')).rejects.toMatchObject({code:'ACTIVE_MATCH'});
 });
 it('serializes ranked creation against practice admission through the shared player lock',async()=>{
  const result=await Promise.allSettled([
   repo.start('tg_123','practice-race'),
   games.createMatch({mode:'RANKED',rules:APPROVED_WHOT_RULES,players:[{userId:'tg_123',isBot:false},{userId:'tg_456',isBot:false}],at:Date.now()}),
  ]);
  expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect((await pool.query("SELECT count(*)::int n FROM game_matches WHERE status='ACTIVE'")).rows[0].n).toBe(1);
 });
 it.each(['practice_starts','outbox_events'])('rolls back admission and match creation on %s failure',async table=>{
  await pool.query("CREATE FUNCTION reject_start() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected start failure'; END $$");
  await pool.query(`CREATE TRIGGER reject_start BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_start()`);
  await expect(repo.start('tg_123','rollback-01')).rejects.toThrow('injected start failure');
  for(const tableName of ['practice_starts','game_matches','game_players','outbox_events'])expect((await pool.query(`SELECT count(*)::int n FROM ${tableName}`)).rows[0].n).toBe(0);
 });
 it('records a real normal server finish once, without advancing rotating ranked objectives',async()=>{
  await pool.query("ALTER TABLE daily_task_policy DISABLE TRIGGER daily_task_policy_immutable; UPDATE daily_task_policy SET rotating_from=(clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date; ALTER TABLE daily_task_policy ENABLE TRIGGER daily_task_policy_immutable");
  const s=await repo.start('tg_123','completion-01');expect(await repo.recordCompletion(s.matchId)).toBe(false);
  let human=await games.view(s.matchId,'tg_123');let at=s.view.deadlineAt!-29999;
  while(human.status==='ACTIVE'){
   if(human.turn===0)await games.act(s.matchId,'tg_123',{id:`human-${human.version}`,expectedVersion:human.version,command:chooseBotCommand(human)},at++);
   else await games.botAct(s.matchId,at++);
   human=await games.view(s.matchId,'tg_123');
  }
  expect(human.reason).toBe('EMPTY_HAND');
  await pool.query("CREATE FUNCTION reject_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type='PRACTICE_COMPLETED' THEN RAISE EXCEPTION 'completion outbox failure'; END IF; RETURN NEW; END $$");
  await pool.query('CREATE TRIGGER reject_completion BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_completion()');
  await expect(repo.recoverCompletions()).rejects.toThrow('completion outbox failure');
  expect((await pool.query('SELECT count(*)::int n FROM practice_completions')).rows[0].n).toBe(0);
  await pool.query('DROP TRIGGER reject_completion ON outbox_events');
  const delivered=await Promise.all(Array.from({length:10},()=>runGamePass(pool)));
  expect(delivered.reduce((n,r)=>n+r.completed,0)).toBe(1);
  expect(await repo.recoverCompletions()).toEqual({scanned:0,recorded:0});
  expect((await pool.query('SELECT count(*)::int n FROM practice_completions')).rows[0].n).toBe(1);
  expect((await pool.query("SELECT count(*)::int n FROM outbox_events WHERE type='PRACTICE_COMPLETED'")).rows[0].n).toBe(1);
  expect((await new DailyTasks(pool).state('tg_123')).tasks.every(t=>t.progress===0)).toBe(true);
 });
 it('does not charge yesterday’s Lagos starts against today’s allowance',async()=>{
  const old=(await pool.query<{at:Date}>("SELECT ((((clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date)-1)::timestamp AT TIME ZONE 'Africa/Lagos') AS at")).rows[0]!.at;
  for(let i=0;i<5;i++){
   const match=await games.createMatch({mode:'PRACTICE',rules:APPROVED_WHOT_RULES,players:[{userId:'tg_123',isBot:false},{userId:null,isBot:true}],at:old.getTime()});
   const view=await games.view(match.id,'tg_123');
   await pool.query("INSERT INTO practice_starts(id,user_id,request_key,request_hash,match_id,reason,started_at,response) VALUES($1,'tg_123',$2,$3,$4,'PROVIDER_UNAVAILABLE',$5,$6)",[randomUUID(),`yesterday-${i}`,'a'.repeat(64),match.id,old,{matchId:match.id,reason:'PROVIDER_UNAVAILABLE',view}]);
   await games.act(match.id,'tg_123',{id:'forfeit-yesterday',expectedVersion:0,command:{type:'FORFEIT'}},old.getTime()+1);
  }
  expect((await repo.start('tg_123','new-day-start')).reason).toBe('PROVIDER_UNAVAILABLE');
 });
 it('never counts forfeit or terminal timeout as practice qualification',async()=>{
  const s=await repo.start('tg_123','forfeit-count');await forfeit(s);expect(await repo.recordCompletion(s.matchId)).toBe(false);
  const t=await repo.start('tg_123','timeout-count');await games.timeout(t.matchId,t.view.deadlineAt!);expect(await repo.recordCompletion(t.matchId)).toBe(false);
 });
 it('rejects malformed identities and unknown players without creating a match',async()=>{
  await expect(repo.start('123','valid-key-01')).rejects.toMatchObject({code:'INVALID_INPUT'});
  await expect(repo.start('tg_123','short')).rejects.toMatchObject({code:'INVALID_INPUT'});
  await expect(repo.start('tg_999','valid-key-01')).rejects.toMatchObject({code:'NOT_FOUND'});
 });
 it('enforces completion ownership in PostgreSQL as well as in the service',async()=>{
  const s=await repo.start('tg_123','ownership-01');
  await expect(pool.query("INSERT INTO practice_completions(match_id,user_id,completed_at) VALUES($1,'tg_456',clock_timestamp())",[s.matchId])).rejects.toThrow(/foreign key/);
  expect((await pool.query('SELECT count(*)::int n FROM practice_completions')).rows[0].n).toBe(0);
 });
});
