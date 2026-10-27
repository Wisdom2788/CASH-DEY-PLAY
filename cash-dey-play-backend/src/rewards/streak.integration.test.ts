import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { StreakRepository } from './streak.repository';
import { STREAK_RULE_VERSION } from './streak-policy';
import { LedgerRepository } from '../ledger/ledger.repository';
import { reconcileLedger } from '../ledger/reconcile';
import { loadEntitlements } from '../entitlements/entitlements';
import { PracticeRepository } from '../practice/practice.repository';
import { GameRepository } from '../game-engine/repository';
import { chooseBotCommand } from '../game-engine/bot';
import request from 'supertest';
import { createApp } from '../app';
import { PostgresUserRepository } from '../db/repositories/user.repository';
import { PostgresWalletRepository } from '../db/repositories/wallet.repository';
import { MemoryRateLimitCounterStore } from '../http/middleware/rate-limit.middleware';
import { buildSignedTelegramInitData } from '../http/telegram/verify-telegram-init-data';

const url=process.env.TEST_DATABASE_URL;
if(process.env.REQUIRE_DB_TESTS==='true'&&!url)throw new Error('TEST_DATABASE_URL required');
const suite=url?describe:describe.skip;
suite('versioned streak cycles and transactional claims on PostgreSQL',()=>{
  let admin:Pool,pool:Pool,schema:string,rewards:StreakRepository;
  beforeAll(()=>{
    if(!/(?:^|_)test(?:_|$)/i.test(new URL(url!).pathname.slice(1)))throw new Error('Disposable test database required');
    admin=new Pool({connectionString:url});
  });
  beforeEach(async()=>{
    schema='cdp_streak_'+randomUUID().replace(/-/g,'');await admin.query(`CREATE SCHEMA "${schema}"`);
    pool=new Pool({connectionString:url,options:`-c search_path=${schema}`,max:12});
    const root=join(__dirname,'../../prisma/migrations');
    for(const name of readdirSync(root).filter(n=>!n.includes('.')).sort()) {
      await pool.query(readFileSync(join(root,name,'migration.sql'),'utf8'));
    }
    await pool.query("INSERT INTO users(id,telegram_id,first_name) VALUES('tg_123',123,'Test'),('tg_456',456,'Other')");
    rewards=new StreakRepository(pool);
  });
  afterEach(async()=>{await pool.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);});
  afterAll(async()=>{await admin.end();});
  // Privileged fixtures simulate prior days only in a disposable schema. No test
  // clock, eligibility writer, premium grant or provider-proof bypass is exported.
  async function fixture(day:number,lastDay=day,expired=false):Promise<string> {
    const id=randomUUID();
    await pool.query(`INSERT INTO streak_cycles(id,user_id,rule_version,start_date,last_completed_date)
      SELECT $1,'tg_123',$2,today-$3::int,today-$3::int+$4::int-1
      FROM (SELECT (clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date AS today) x`,
      [id,STREAK_RULE_VERSION,expired?30:day-1,lastDay]);return id;
  }
  async function premium(expired=false):Promise<void> {
    const id=randomUUID();
    await pool.query("INSERT INTO premium_orders(id,user_id,plan_id,duration_days,stars_amount,currency,status,charge_id) VALUES($1,'tg_123','30d',30,55,'XTR','PAID',$2)",[id,randomUUID()]);
    await pool.query(`INSERT INTO paid_entitlements(order_id,starts_at,expires_at) VALUES($1,clock_timestamp()-interval '2 days',clock_timestamp()+$2::interval)`,[id,expired?'-1 day':'1 day']);
  }
  it('records concurrent first/same-day logins exactly once without granting anything',async()=>{
    const results=await Promise.all(Array.from({length:10},()=>rewards.recordLogin('tg_123')));
    expect(new Set(results.map(r=>r.cycle.id)).size).toBe(1);
    expect(results[0]!.cycle.ends_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/);
    expect((await pool.query('SELECT count(*)::int AS n FROM streak_login_dates')).rows[0].n).toBe(1);
    expect((await rewards.progress('tg_123')).milestones.every(m=>!m.claimable)).toBe(true);
    expect(await new LedgerRepository(pool).availableKobo('tg_123')).toBe('0');
  });
  it('runs the real authenticated claim HTTP route through SQL ledger and wallet readback',async()=>{
    const id=await fixture(10);const bot='sql-streak-contract-bot';
    const app=createApp({pool,streakRewardsEnabled:true,userRepository:new PostgresUserRepository(pool),
      walletRepository:new PostgresWalletRepository(pool),authService:{} as any,tasksRepository:{} as any,
      loginStreakService:{} as any,monthlyLeaderboardService:{} as any,telegramBotToken:bot,jwtSecret:'x'.repeat(40),
      corsOrigin:'http://localhost',allowDevAuthBypass:false,rateLimitStore:new MemoryRateLimitCounterStore(),
      userRequestsPerMinute:100,ipRequestsPerMinute:100});
    const headers={'X-Telegram-Init-Data':buildSignedTelegramInitData({botToken:bot,user:{id:123,first_name:'Test'},authDate:Math.floor(Date.now()/1000)})};
    const path=`/api/streak/cycles/${id}/milestones/10/claim`;
    expect((await request(app).post(path).send({})).status).toBe(401);
    const response=await request(app).post(path).set(headers).set('Idempotency-Key','real-sql-claim').send({});
    expect(response.status).toBe(200);expect(response.body.data).toMatchObject({amountKobo:'5000',availableKobo:'5000'});
    expect((await request(app).get('/api/wallet/balance').set(headers)).body.data.availableKobo).toBe('5000');
    const retry=await request(app).post(path).set(headers).set('Idempotency-Key','real-sql-retry').send({});
    expect(retry.body).toEqual(response.body);
    expect((await pool.query('SELECT count(*)::int AS n FROM wallet_entries')).rows[0].n).toBe(1);
  });
  it('resets an early miss, preserves old cycle history and begins at Day1',async()=>{
    const old=await fixture(7,5);const result=await rewards.recordLogin('tg_123');
    expect(result.decision).toEqual({kind:'RESET',day:1});expect(result.cycle.id).not.toBe(old);
    expect((await pool.query('SELECT closed_reason FROM streak_cycles WHERE id=$1',[old])).rows[0].closed_reason).toBe('RESET');
  });
  it('does not auto-recover after Day10; records actual return without advancing progress',async()=>{
    await fixture(12,10);const result=await rewards.recordLogin('tg_123');
    expect(result.decision.kind).toBe('RECOVERY_REQUIRED');expect(result.recoveryAvailable).toBe(false);
    expect((await rewards.progress('tg_123')).completedDay).toBe(10);
    expect((await pool.query('SELECT recovery_used FROM streak_cycles')).rows[0].recovery_used).toBe(false);
    expect((await pool.query('SELECT count(*)::int AS n FROM streak_login_dates')).rows[0].n).toBe(1);
  });
  it('starts a new cycle after the original window ends',async()=>{
    const old=await fixture(30,30,true);const result=await rewards.recordLogin('tg_123');
    expect(result.decision.kind).toBe('NEW_CYCLE');expect(result.cycle.id).not.toBe(old);
    expect((await pool.query('SELECT closed_reason FROM streak_cycles WHERE id=$1',[old])).rows[0].closed_reason).toBe('ENDED');
  });
  it.each([false,true])('Day10 pays ₦50 once for premium=%s, with actor/payload-bound retries',async paid=>{
    const id=await fixture(10);if(paid)await premium();
    const results=await Promise.all(Array.from({length:10},(_,i)=>rewards.claim('tg_123',id,10,`claim-key-${i}`)));
    expect(new Set(results.map(r=>r.entryId)).size).toBe(1);
    expect(results[0]).toMatchObject({amountKobo:'5000',tier:paid?'PREMIUM':'REGULAR'});
    await expect(rewards.claim('tg_123',id,20,'claim-key-0')).rejects.toMatchObject({code:'CONFLICT'});
    await expect(rewards.claim('tg_456',id,10,'other-user-key')).rejects.toMatchObject({code:'NOT_FOUND'});
    expect(await new LedgerRepository(pool).availableKobo('tg_123')).toBe('5000');
    expect(Object.values(await reconcileLedger(pool)).every(n=>n===0)).toBe(true);
  });
  it('does not pay a second tier variant after upgrading',async()=>{
    const id=await fixture(20);const first=await rewards.claim('tg_123',id,20,'regular-claim');
    expect(first.kind).toBe('AD_FREE');await premium();
    expect(await rewards.claim('tg_123',id,20,'premium-retry')).toEqual(first);
    expect(await new LedgerRepository(pool).availableKobo('tg_123')).toBe('0');
  });
  it('grants regular Day20 only until next Lagos midnight without premium privileges',async()=>{
    const id=await fixture(20);const receipt=await rewards.claim('tg_123',id,20,'ad-free-request');
    expect(receipt).toMatchObject({kind:'AD_FREE',amountKobo:'0',tier:'REGULAR'});
    expect(receipt.expiresAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/);
    const at=(await pool.query('SELECT clock_timestamp() AS t')).rows[0].t;
    expect(await loadEntitlements(pool,'tg_123',at)).toMatchObject({adFree:true,isPremium:false});
    expect((await loadEntitlements(pool,'tg_123',new Date(receipt.expiresAt!))).adFree).toBe(false);
    expect((await pool.query('SELECT count(*)::int AS n FROM wallet_entries')).rows[0].n).toBe(0);
  });
  it.each([20,30] as const)('pays the retained premium Day%i amount, waiving only practice',async day=>{
    const id=await fixture(day);await premium();
    expect(await rewards.claim('tg_123',id,day,'premium-request')).toMatchObject({kind:'AIRTIME_CREDIT',tier:'PREMIUM',amountKobo:day===20?'10000':'20000'});
  });
  it('does not accept expired premium entitlement as a practice waiver',async()=>{
    const id=await fixture(30);await premium(true);
    await expect(rewards.claim('tg_123',id,30,'expired-premium')).rejects.toMatchObject({code:'PRACTICE_TARGET'});
  });
  it('requires 25 real normal finishes for regular Day30; 24 and forfeits cannot pass',async()=>{
    const id=await fixture(30);await premium();
    const fixed=(max:number)=>max-1;
    const practice=new PracticeRepository(pool,'BLOCK',fixed);const games=new GameRepository(pool,fixed);
    async function finish(n:number) {
      const start=await practice.start('tg_123',`practice-${n}`);let view=await games.view(start.matchId,'tg_123');
      // Historical source times remain inside the cycle and before actual claim time.
      let at=start.view.deadlineAt!-29999;
      while(view.status==='ACTIVE') {
        if(view.turn===0)await games.act(start.matchId,'tg_123',{id:`human-${view.version}`,expectedVersion:view.version,command:chooseBotCommand(view)},at++);
        else await games.botAct(start.matchId,at++);
        view=await games.view(start.matchId,'tg_123');
      }
      expect(view.reason).toBe('EMPTY_HAND');expect(await practice.recordCompletion(start.matchId)).toBe(true);
    }
    for(let i=0;i<24;i++)await finish(i);
    await pool.query('UPDATE paid_entitlements SET revoked_at=clock_timestamp()');
    await expect(rewards.claim('tg_123',id,30,'regular-24')).rejects.toMatchObject({code:'PRACTICE_TARGET'});
    await premium();
    const abandoned=await practice.start('tg_123','forfeit-not-normal');
    await games.act(abandoned.matchId,'tg_123',{id:'forfeit-001',expectedVersion:0,command:{type:'FORFEIT'}},abandoned.view.deadlineAt!-29999);
    expect(await practice.recordCompletion(abandoned.matchId)).toBe(false);
    await finish(25);await pool.query('UPDATE paid_entitlements SET revoked_at=clock_timestamp()');
    expect(await rewards.claim('tg_123',id,30,'regular-25')).toMatchObject({tier:'REGULAR',amountKobo:'10000'});
  },30000);
  it('expired cycles never unlock new claims',async()=>{
    const id=await fixture(30,30,true);
    await expect(rewards.claim('tg_123',id,10,'expired-cycle')).rejects.toMatchObject({code:'EXPIRED'});
  });
  it('rejects expired/unlocked claims and returns committed replay after window expiry',async()=>{
    const id=await fixture(10);const receipt=await rewards.claim('tg_123',id,10,'original-claim');
    // Advance SQL time only for this repository instance's private clock reader;
    // the production constructor exposes no clock/config override.
    const tomorrow=(await pool.query("SELECT (clock_timestamp()+interval '31 days')::text AS now,((clock_timestamp()+interval '31 days') AT TIME ZONE 'Africa/Lagos')::date::text AS today")).rows[0];
    const time=jest.spyOn(rewards as unknown as {time:()=>Promise<typeof tomorrow>},'time').mockResolvedValue(tomorrow);
    expect(await rewards.claim('tg_123',id,10,'original-claim')).toEqual(receipt);
    expect(await rewards.claim('tg_123',id,10,'another-request')).toEqual(receipt);
    await expect(rewards.claim('tg_123',id,20,'new-expired-key')).rejects.toMatchObject({code:'EXPIRED'});
    time.mockRestore();
  });
  it('rejects a milestone not completed even if its calendar day has arrived',async()=>{
    const id=await fixture(12,10);await expect(rewards.claim('tg_123',id,20,'not-unlocked')).rejects.toMatchObject({code:'NOT_UNLOCKED'});
  });
  it('keeps an old unlocked reward discoverable and claimable only until its original end after reset',async()=>{
    const id=await fixture(13,10);const recorded=await rewards.recordLogin('tg_123');
    expect(recorded.decision.kind).toBe('RESET');
    const state=await rewards.progress('tg_123');expect(state.previousCycles.map(c=>c.id)).toContain(id);
    expect(await rewards.claim('tg_123',id,10,'old-unlocked')).toMatchObject({cycleId:id,amountKobo:'5000'});
    await expect(rewards.claim('tg_123',id,20,'old-not-unlocked')).rejects.toMatchObject({code:'NOT_UNLOCKED'});
  });
  it.each(['reward_audit_events','wallet_entries','financial_requests','outbox_events','streak_claims','streak_claim_requests'])(
    'rolls back every monetary/source write when %s fails',async table=>{
      const id=await fixture(10);
      await pool.query("CREATE FUNCTION fail_streak_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$");
      await pool.query(`CREATE TRIGGER fail_streak_write BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION fail_streak_write()`);
      await expect(rewards.claim('tg_123',id,10,'rollback-request')).rejects.toThrow('injected failure');
      for(const name of ['wallet_entries','financial_requests','reward_audit_events','outbox_events','streak_claims','streak_claim_requests']) {
        expect((await pool.query(`SELECT count(*)::int AS n FROM ${name}`)).rows[0].n).toBe(0);
      }
      expect(await new LedgerRepository(pool).availableKobo('tg_123')).toBe('0');
    });
  it('rolls back the ad-free grant if its final receipt fails',async()=>{
    const id=await fixture(20);
    await pool.query("CREATE FUNCTION fail_streak_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'receipt failure'; END $$");
    await pool.query('CREATE TRIGGER fail_streak_write BEFORE INSERT ON streak_claim_requests FOR EACH ROW EXECUTE FUNCTION fail_streak_write()');
    await expect(rewards.claim('tg_123',id,20,'ad-free-rollback')).rejects.toThrow('receipt failure');
    expect((await pool.query('SELECT count(*)::int AS n FROM ad_free_days')).rows[0].n).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS n FROM outbox_events')).rows[0].n).toBe(0);
  });
  it('preserves claim history and refuses cycle identity/backward/closed edits',async()=>{
    const id=await fixture(10);await rewards.claim('tg_123',id,10,'immutable-claim');
    await expect(pool.query('DELETE FROM streak_claims')).rejects.toThrow('Immutable');
    await expect(pool.query("UPDATE streak_cycles SET start_date=start_date-1 WHERE id=$1",[id])).rejects.toThrow('Invalid streak');
    await expect(pool.query("UPDATE streak_cycles SET last_completed_date=last_completed_date-1 WHERE id=$1",[id])).rejects.toThrow('Invalid streak');
    await pool.query("UPDATE streak_cycles SET closed_reason='RESET',closed_at=clock_timestamp() WHERE id=$1",[id]);
    await expect(pool.query("UPDATE streak_cycles SET closed_at=NULL,closed_reason=NULL WHERE id=$1",[id])).rejects.toThrow('Invalid streak');
  });
});
