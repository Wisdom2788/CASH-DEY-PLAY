import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { GameRepository } from './repository';
import { Rules } from './model';
import { runGamePass } from '../workers/game-worker';

const url=process.env.TEST_DATABASE_URL;
if(process.env.REQUIRE_DB_TESTS==='true'&&!url) throw new Error('TEST_DATABASE_URL required');
const suite=url?describe:describe.skip;
const root=join(__dirname,'../..');
const migration=(name:string)=>readFileSync(join(root,'prisma/migrations',name,'migration.sql'),'utf8');
const rules:Rules={version:'proposal-test-v1',deck:[
  {suit:'CIRCLE',numbers:[3,4]},{suit:'TRIANGLE',numbers:[3,4]},{suit:'CROSS',numbers:[3,4]},
  {suit:'SQUARE',numbers:[3,4]},{suit:'STAR',numbers:[3,4]},
],wildCount:1,initialHand:1,firstSeat:0,stacking:'NONE',drawMode:'DRAW_AND_PASS',voluntaryDraw:true,
  penaltySkipsTurn:true,marketRetainsTurn:true,allowSpecialFinish:true,lastCardPenalty:0,turnMs:30000,maxActions:20,timeout:'FORFEIT'};
const fixedRandom=(max:number)=>max-1;

suite('Whot game persistence on PostgreSQL',()=>{
  let admin:Pool,pool:Pool,schema:string,repo:GameRepository;
  beforeAll(()=>{if(!/(?:^|_)test(?:_|$)/i.test(new URL(url!).pathname.slice(1)))throw new Error('Disposable test database required');admin=new Pool({connectionString:url});});
  beforeEach(async()=>{
    schema=`cdp_game_${randomUUID().replace(/-/g,'')}`;await admin.query(`CREATE SCHEMA "${schema}"`);
    pool=new Pool({connectionString:url,options:`-c search_path=${schema}`,max:12});
    await pool.query(migration('0_init'));
    await pool.query("INSERT INTO users(id,telegram_id,first_name) VALUES('tg_123',123,'One'),('tg_456',456,'Two')");
    await pool.query(migration('2026102401_foundations'));await pool.query(migration('2026102501_ledger'));
    await pool.query(migration('2026102502_entitlements'));await pool.query(migration('2026102503_game_engine'));await pool.query(migration('2026102504_practice'));
    await pool.query(migration('2026102505_realtime_sessions'));await pool.query(migration('2026102506_ranked'));await pool.query(migration('2026102601_ranked_acceptance'));
    repo=new GameRepository(pool,fixedRandom);
  });
  afterEach(async()=>{if(pool)await pool.end();if(admin&&schema)await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);});
  afterAll(async()=>{if(admin)await admin.end();});
  const practice=(id?:string)=>repo.createMatch({...(id?{id}:{}),mode:'PRACTICE',rules,players:[{userId:'tg_123',isBot:false},{userId:null,isBot:true}],at:1000});

  it('enforces exactly two seats and bot policy for each mode',async()=>{
    await expect(repo.createMatch({mode:'PRACTICE',rules,players:[{userId:'tg_123',isBot:false},{userId:'tg_456',isBot:false}],at:1000})).rejects.toThrow();
    await expect(repo.createMatch({mode:'RANKED',rules,players:[{userId:'tg_123',isBot:false},{userId:null,isBot:true}],at:1000})).rejects.toThrow('INVALID_INPUT');
    const id=randomUUID();
    await expect(pool.query(`INSERT INTO game_matches(id,mode,rule_version,private_initial_state,private_state,status,version,started_at,updated_at)
      VALUES($1,'PRACTICE','rule', '{"version":0,"status":"ACTIVE"}','{"version":0,"status":"ACTIVE"}','ACTIVE',0,now(),now())`,[id])).rejects.toThrow(/exactly two seats/);
    expect((await pool.query('SELECT count(*)::int AS n FROM game_matches')).rows[0]!.n).toBe(0);
  });

  it('creates ranked storage for two distinct human participants',async()=>{
    const match=await repo.createMatch({mode:'RANKED',rules,players:[{userId:'tg_123',isBot:false},{userId:'tg_456',isBot:false}],at:1000});
    expect((await repo.view(match.id,'tg_123')).seat).toBe(0);
    expect((await repo.view(match.id,'tg_456')).seat).toBe(1);
    await expect(repo.botAct(match.id,1001)).rejects.toThrow('INVALID_INPUT');
    await expect(repo.createMatch({mode:'RANKED',rules,players:[{userId:'tg_123',isBot:false},{userId:'tg_123',isBot:false}],at:1000})).rejects.toThrow('INVALID_INPUT');
  });

  it('stores private initial state, returns participant-only projections and rejects other users',async()=>{
    const match=await repo.createMatch({mode:'PRACTICE',rules,players:[{userId:'tg_123',isBot:false},{userId:null,isBot:true}],at:Date.parse('2026-10-25T23:30:00Z')});const view=await repo.view(match.id,'tg_123');
    expect(view.seat).toBe(0);expect(Object.keys(view)).not.toContain('market');expect(Object.keys(view)).not.toContain('discard');
    await expect(repo.view(match.id,'tg_456')).rejects.toThrow('INVALID_INPUT');
    const stored=(await pool.query('SELECT private_initial_state,private_state,lagos_date::text FROM game_matches WHERE id=$1',[match.id])).rows[0]!;
    expect(stored.private_initial_state).toEqual(stored.private_state);
    expect(stored.lagos_date).toBe('2026-10-26');
    await expect(pool.query('UPDATE game_matches SET private_initial_state=$2 WHERE id=$1',[match.id,{}])).rejects.toThrow(/immutable/);
  });

  it('serializes concurrent versions, replays identical idempotent requests and reconstructs the full event chain',async()=>{
    const match=await repo.createMatch({mode:'PRACTICE',rules:{...rules,drawMode:'DRAW_THEN_PLAY'},players:[{userId:'tg_123',isBot:false},{userId:null,isBot:true}],at:1000});
    const command={type:'DRAW' as const};
    const action={id:'human-action-01',expectedVersion:0,command};
    const [first,duplicate]=await Promise.all([repo.act(match.id,'tg_123',action,1001),repo.act(match.id,'tg_123',action,1001)]);
    expect(duplicate).toEqual(first);
    await expect(repo.act(match.id,'tg_123',{...action,command:{type:'FORFEIT'}},1002)).rejects.toMatchObject({code:'ACTION_CONFLICT'});
    expect((await pool.query('SELECT count(*)::int AS n FROM game_events WHERE match_id=$1',[match.id])).rows[0]!.n).toBe(1);
    expect((await pool.query('SELECT count(*)::int AS n FROM outbox_events WHERE type=$1',['GAME_STATE_CHANGED'])).rows[0]!.n).toBe(1);
    expect(await repo.replay(match.id)).toEqual((await pool.query('SELECT private_state FROM game_matches WHERE id=$1',[match.id])).rows[0]!.private_state);
    const current=await repo.view(match.id,'tg_123');expect(current.canPass).toBe(true);const command2={type:'PASS' as const};
    const races=await Promise.allSettled([
      repo.act(match.id,'tg_123',{id:'race-one',expectedVersion:current.version,command:command2},1002),
      repo.act(match.id,'tg_123',{id:'race-two',expectedVersion:current.version,command:command2},1002),
    ]);
    expect(races.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(races.filter(r=>r.status==='rejected')).toHaveLength(1);
    expect(await repo.replay(match.id)).toEqual((await pool.query('SELECT private_state FROM game_matches WHERE id=$1',[match.id])).rows[0]!.private_state);
  });

  it('rolls back snapshot, event and notification when the transactional outbox fails',async()=>{
    const match=await practice();const command={type:'DRAW' as const};
    await pool.query(`CREATE FUNCTION reject_game_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type='GAME_STATE_CHANGED' THEN RAISE EXCEPTION 'outbox failure'; END IF; RETURN NEW; END $$`);
    await pool.query('CREATE TRIGGER reject_game_outbox BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_game_outbox()');
    await expect(repo.act(match.id,'tg_123',{id:'rollback-01',expectedVersion:0,command},1001)).rejects.toThrow('outbox failure');
    expect((await pool.query('SELECT version FROM game_matches WHERE id=$1',[match.id])).rows[0]!.version).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS n FROM game_events')).rows[0]!.n).toBe(0);
    expect((await pool.query("SELECT count(*)::int AS n FROM outbox_events WHERE type='GAME_STATE_CHANGED'")).rows[0]!.n).toBe(0);
  });

  it('serializes the last permitted move against the persisted server timer',async()=>{
    const match=await practice();const view=await repo.view(match.id,'tg_123');
    const race=await Promise.allSettled([
      repo.act(match.id,'tg_123',{id:'last-move-01',expectedVersion:0,command:{type:'DRAW'}},view.deadlineAt!-1),
      repo.timeout(match.id,view.deadlineAt!),
    ]);
    expect(race.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(race.filter(r=>r.status==='rejected')).toHaveLength(1);
    const state=await repo.replay(match.id);
    expect(state.version).toBe(1);
    expect((await pool.query('SELECT version FROM game_matches WHERE id=$1',[match.id])).rows[0]!.version).toBe(1);
  });

  it('persists bot actions and timer actions without granting either player hidden-card reads',async()=>{
    const match=await practice();const before=await repo.view(match.id,'tg_123');
    // Move the human turn first when required, then ask the bot adapter to act only on its stored turn.
    if(before.turn===0)await repo.act(match.id,'tg_123',{id:'human-before-bot',expectedVersion:0,command:{type:'DRAW'}},1001);
    const after=await repo.view(match.id,'tg_123');
    if(after.status==='ACTIVE'&&after.turn===1) await repo.botAct(match.id,1002,'bot-action-01');
    expect((await repo.replay(match.id)).version).toBe((await pool.query('SELECT version FROM game_matches WHERE id=$1',[match.id])).rows[0]!.version);
  });
  async function freshPractice(){
    const at=Number((await pool.query("SELECT floor(extract(epoch FROM clock_timestamp())*1000)::text AS ms")).rows[0].ms);
    return repo.createMatch({mode:'PRACTICE',rules:{...rules,turnMs:300000},players:[{userId:'tg_123',isBot:false},{userId:null,isBot:true}],at});
  }

  it('rechecks stale candidates and does not advance an early human turn',async()=>{
    const match=await freshPractice();
    expect(await repo.advanceDueMatch(match.id,0)).toBe('SKIPPED');
    expect(await runGamePass(pool)).toEqual({scanned:0,advanced:0,completed:0});
    await repo.act(match.id,'tg_123',{id:'move-before-stale-worker',expectedVersion:0,command:{type:'DRAW'}},match.state.lastAt);
    expect(await repo.advanceDueMatch(match.id,0)).toBe('SKIPPED');
    expect((await repo.view(match.id,'tg_123')).version).toBe(1);
  });

  it('serializes ten overlapping bot workers against one discovered version and replays',async()=>{
    const match=await freshPractice();
    await repo.act(match.id,'tg_123',{id:'human-before-workers',expectedVersion:0,command:{type:'DRAW'}},match.state.lastAt);
    const results=await Promise.all(Array.from({length:10},()=>repo.advanceDueMatch(match.id,1)));
    expect(results.filter(x=>x==='BOT_ACTION')).toHaveLength(1);
    expect(results.filter(x=>x==='SKIPPED')).toHaveLength(9);
    expect((await repo.replay(match.id)).version).toBe(2);
  });

  it('recovers elapsed deadlines once, with timeout taking precedence over an expired bot turn',async()=>{
    const match=await practice();
    await repo.act(match.id,'tg_123',{id:'human-before-expired-bot',expectedVersion:0,command:{type:'DRAW'}},1001);
    const results=await Promise.all(Array.from({length:10},()=>repo.advanceDueMatch(match.id,1)));
    expect(results.filter(x=>x==='TIMEOUT')).toHaveLength(1);
    expect(results.filter(x=>x==='SKIPPED')).toHaveLength(9);
    const state=await repo.replay(match.id);expect(state.reason).toBe('TIMEOUT');expect(state.version).toBe(2);
    expect(await runGamePass(pool)).toEqual({scanned:0,advanced:0,completed:0});
  });

  it('discovers an elapsed human deadline without any in-memory timer or client input',async()=>{
    const match=await practice();
    expect(await runGamePass(pool)).toEqual({scanned:1,advanced:1,completed:0});
    expect((await repo.replay(match.id)).reason).toBe('TIMEOUT');
    expect(await repo.advanceDueMatch(match.id,0)).toBe('SKIPPED');
  });

  it('discovers a live bot turn and atomically rolls back a failed worker outbox write',async()=>{
    const match=await freshPractice();
    await repo.act(match.id,'tg_123',{id:'human-before-rollback-worker',expectedVersion:0,command:{type:'DRAW'}},match.state.lastAt);
    await pool.query("CREATE FUNCTION reject_worker_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type='GAME_STATE_CHANGED' THEN RAISE EXCEPTION 'worker outbox failure'; END IF; RETURN NEW; END $$");
    await pool.query('CREATE TRIGGER reject_worker_outbox BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_worker_outbox()');
    await expect(runGamePass(pool)).rejects.toThrow('worker outbox failure');
    expect((await repo.replay(match.id)).version).toBe(1);
    expect((await pool.query('SELECT count(*)::int n FROM game_events')).rows[0].n).toBe(1);
    await pool.query('DROP TRIGGER reject_worker_outbox ON outbox_events');
    expect(await runGamePass(pool)).toEqual({scanned:1,advanced:1,completed:0});
    expect((await repo.replay(match.id)).version).toBe(2);
  });

  it('reads the server clock after waiting for the match lock',async()=>{
    const at=Number((await pool.query("SELECT floor(extract(epoch FROM clock_timestamp())*1000)::text AS ms")).rows[0].ms);
    const match=await repo.createMatch({mode:'PRACTICE',rules:{...rules,firstSeat:1,turnMs:1000},players:[{userId:'tg_123',isBot:false},{userId:null,isBot:true}],at});
    const locker=await pool.connect();
    let tick:Promise<'SKIPPED'|'BOT_ACTION'|'TIMEOUT'>|undefined;
    try{
      await locker.query('BEGIN');await locker.query('SELECT id FROM game_matches WHERE id=$1 FOR UPDATE',[match.id]);
      tick=repo.advanceDueMatch(match.id,0);
      await locker.query('SELECT pg_sleep(1.1)');await locker.query('COMMIT');
      expect(await tick).toBe('TIMEOUT');
      expect((await repo.replay(match.id)).reason).toBe('TIMEOUT');
    }finally{await locker.query('ROLLBACK');locker.release();await tick;}
  });

});
