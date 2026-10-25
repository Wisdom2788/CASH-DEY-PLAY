import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { DailyTasks } from './daily-tasks';
import { loadEntitlements } from './entitlements';
import { assignReferralCode,resolveReferral,resolvePendingReferrals,referralLink } from './referrals';
import { PostgresUserRepository } from '../db/repositories/user.repository';
import { lagosDateOfInstant } from '../time/lagos-calendar-clock';
const url=process.env.TEST_DATABASE_URL;
if(process.env.REQUIRE_DB_TESTS==='true'&&!url)throw new Error('TEST_DATABASE_URL required');
const suite=url?describe:describe.skip;
suite('entitlements, task claims and first-login referrals on PostgreSQL',()=>{
 let admin:Pool,pool:Pool,schema:string,tasks:DailyTasks;
 beforeAll(()=>{if(!/(?:^|_)test(?:_|$)/i.test(new URL(url!).pathname.slice(1)))throw new Error('Disposable test database required');admin=new Pool({connectionString:url});});
 beforeEach(async()=>{
  schema='cdp_entitlement_'+randomUUID().replace(/-/g,'');await admin.query(`CREATE SCHEMA "${schema}"`);
  pool=new Pool({connectionString:url,options:`-c search_path=${schema}`,max:12});
  for(const name of ['0_init','2026102401_foundations','2026102501_ledger'])await pool.query(readFileSync(join(__dirname,'../../prisma/migrations',name,'migration.sql'),'utf8'));
  await pool.query("INSERT INTO users(id,telegram_id,first_name,is_premium,referral_code) VALUES('tg_123',123,'Test',true,'ABCDEFGH')");
  await pool.query("INSERT INTO premium_subscriptions(user_id,expires_at) VALUES('tg_123',now()+interval '90 days')");
  await pool.query("INSERT INTO task_completions(user_id,completed_on,task_key) VALUES('tg_123','2020-01-01','MANDATORY_VIDEO_LOGIN')");
  await pool.query(readFileSync(join(__dirname,'../../prisma/migrations/2026102502_entitlements/migration.sql'),'utf8'));
  tasks=new DailyTasks(pool);
 });
 afterEach(async()=>{await pool.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);});afterAll(async()=>{await admin.end();});
 async function premium(start:Date,end:Date){const id=randomUUID();await pool.query("INSERT INTO premium_orders(id,user_id,plan_id,duration_days,stars_amount,currency,status,charge_id) VALUES($1,'tg_123','30d',30,55,'XTR','PAID',$2)",[id,randomUUID()]);await pool.query('INSERT INTO paid_entitlements(order_id,starts_at,expires_at) VALUES($1,$2,$3)',[id,start,end]);return id;}
 async function exempt(){await pool.query("INSERT INTO ad_free_days(user_id,valid_on,starts_at) VALUES('tg_123',(clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date,((clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date)::timestamp AT TIME ZONE 'Africa/Lagos')");}
 it('revokes legacy flags and uses exact paid expiry/revocation instead',async()=>{
  expect((await pool.query("SELECT is_premium FROM users")).rows[0].is_premium).toBe(false);
  const at=new Date('2026-10-25T12:00:00Z');const id=await premium(new Date('2026-10-24T12:00:00Z'),at);
  expect((await loadEntitlements(pool,'tg_123',at)).isPremium).toBe(false);
  expect((await loadEntitlements(pool,'tg_123',new Date(at.getTime()-1))).isPremium).toBe(true);
  await pool.query("UPDATE premium_orders SET status='REFUNDED' WHERE id=$1",[id]);
  expect((await loadEntitlements(pool,'tg_123',new Date(at.getTime()-1))).isPremium).toBe(false);
 });
 it('rechecks stale auto-ready after refund and never treats ad-free as premium',async()=>{
  const id=await premium(new Date(Date.now()-10000),new Date(Date.now()+86400000));
  expect((await tasks.state('tg_123')).tasks[0]!.action).toBe('CLAIM');
  await pool.query('UPDATE paid_entitlements SET revoked_at=now() WHERE order_id=$1',[id]);
  await expect(tasks.claim('tg_123','MANDATORY_VIDEO_LOGIN')).rejects.toThrow(/exemption/);
  await exempt();const state=await loadEntitlements(pool,'tg_123',new Date());expect(state.adFree).toBe(true);expect(state.isPremium).toBe(false);
 });
 it('claims once under ten concurrent requests and refuses client-supplied ranked claims',async()=>{
  await exempt();await Promise.all(Array.from({length:10},()=>tasks.claim('tg_123','MANDATORY_VIDEO_LOGIN')));
  expect((await pool.query('SELECT points FROM users')).rows[0].points).toBe(50);
  expect((await pool.query('SELECT count(*)::int AS n FROM task_claims')).rows[0].n).toBe(1);
  await expect(tasks.claim('tg_123','WIN_MATCH')).rejects.toThrow(/server-eligible/);
 });
 it('serializes different final completions and awards the all-complete bonus once',async()=>{
  await exempt();await tasks.state('tg_123');const today=lagosDateOfInstant(new Date());
  await pool.query("UPDATE daily_task_state SET status='CLAIMED',claimed_at=now(),source='SETTLEMENT' WHERE task_key='WIN_MATCH'");
  await Promise.all(['MANDATORY_VIDEO_LOGIN','MANDATORY_VIDEO_UNLOCK'].map(key=>tasks.claim('tg_123',key)));
  expect((await pool.query('SELECT points FROM users')).rows[0].points).toBe(150);
  expect((await pool.query("SELECT count(*)::int AS n FROM daily_task_state WHERE lagos_date=$1 AND status='CLAIMED'",[today])).rows[0].n).toBe(4);
  expect((await tasks.state('tg_123')).allBonusClaimed).toBe(true);
 });
 it('rolls back task state, points and completion when audit insertion fails',async()=>{
  await exempt();await pool.query("CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit failure'; END $$");
  await pool.query('CREATE TRIGGER fail_audit BEFORE INSERT ON reward_audit_events FOR EACH ROW EXECUTE FUNCTION fail_audit()');
  await expect(tasks.claim('tg_123','MANDATORY_VIDEO_LOGIN')).rejects.toThrow('audit failure');
  expect((await pool.query('SELECT points FROM users')).rows[0].points).toBe(0);
  expect((await pool.query('SELECT count(*)::int AS n FROM task_claims')).rows[0].n).toBe(0);
 });
 it('resolves signed first-login intent once and ignores late links',async()=>{
  const users=new PostgresUserRepository(pool);await users.upsertTelegramUser(456,'New',null,null,'ref_ABCDEFGH');
  await Promise.all(Array.from({length:10},()=>resolveReferral(pool,'tg_456')));
  await users.upsertTelegramUser(456,'New',null,null,'OTHERABC');
  expect((await pool.query('SELECT referrer_id,referred_id FROM referrals')).rows).toEqual([{referrer_id:'tg_123',referred_id:'tg_456'}]);
  expect((await users.findById('tg_456'))?.referralCode).toMatch(/^[A-Z2-9]{8}$/);
 });
 it.each(['UNKNOWNX','ref_ABCDEFGH'])('does not self-attribute or resolve unknown links: %s',async code=>{
  await pool.query('INSERT INTO first_login_attributions(user_id,start_param) VALUES($1,$2)',['tg_123',code]);await resolveReferral(pool,'tg_123');
  expect((await pool.query('SELECT count(*)::int AS n FROM referrals')).rows[0].n).toBe(0);
 });
 it('retries random-code collisions with savepoints',async()=>{
  await pool.query("INSERT INTO users(id,telegram_id,first_name) VALUES('tg_456',456,'New')");const c=await pool.connect();
  try{await c.query('BEGIN');const generate=jest.fn().mockReturnValueOnce('ABCDEFGH').mockReturnValue('JKLMNPQR');await assignReferralCode(c,'tg_456',generate);await c.query('COMMIT');expect(generate).toHaveBeenCalledTimes(2);}finally{c.release();}
  expect((await pool.query("SELECT referral_code FROM users WHERE id='tg_456'")).rows[0].referral_code).toBe('JKLMNPQR');
 });
 it('preserves recognized historical claims without awarding points again',async()=>{
  const row=(await pool.query("SELECT status,points_awarded FROM daily_task_state WHERE lagos_date='2020-01-01'")).rows[0];
  expect(row).toEqual({status:'CLAIMED',points_awarded:0});expect((await pool.query('SELECT points FROM users')).rows[0].points).toBe(0);
 });
 it('keeps committed login and retries attribution after resolution failure',async()=>{
  await pool.query("CREATE FUNCTION reject_referral() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'resolution unavailable'; END $$");
  await pool.query('CREATE TRIGGER reject_referral BEFORE INSERT ON referrals FOR EACH ROW EXECUTE FUNCTION reject_referral()');
  const profile=await new PostgresUserRepository(pool).upsertTelegramUser(456,'New',null,null,'ref_ABCDEFGH');expect(profile.id).toBe('tg_456');
  expect((await pool.query("SELECT resolved_at FROM first_login_attributions WHERE user_id='tg_456'")).rows[0].resolved_at).toBeNull();
  await pool.query('DROP TRIGGER reject_referral ON referrals');expect(await resolvePendingReferrals(pool)).toBe(1);
  expect((await pool.query('SELECT count(*)::int AS n FROM referrals')).rows[0].n).toBe(1);
 });
 it('ignores expired attribution and builds only configured Mini App links',async()=>{
  await pool.query("INSERT INTO users(id,telegram_id,first_name) VALUES('tg_456',456,'New')");
  await pool.query("INSERT INTO first_login_attributions(user_id,start_param,captured_at) VALUES('tg_456','ref_ABCDEFGH',now()-interval '31 days')");await resolveReferral(pool,'tg_456');
  expect((await pool.query('SELECT count(*)::int AS n FROM referrals')).rows[0].n).toBe(0);
  expect(referralLink('ABCDEFGH',undefined,'game')).toBeNull();expect(referralLink('ABCDEFGH','ExampleBot','game')).toBe('https://t.me/ExampleBot/game?startapp=ref_ABCDEFGH');
 });

 it('preserves PostgreSQL microsecond expiry boundaries',async()=>{
  const id=await premium(new Date('2026-10-24T00:00:00Z'),new Date('2026-10-26T00:00:00Z'));
  await pool.query("UPDATE paid_entitlements SET expires_at='2026-10-25T12:00:00.000500Z' WHERE order_id=$1",[id]);
  expect((await loadEntitlements(pool,'tg_123','2026-10-25T12:00:00.000499Z')).isPremium).toBe(true);
  expect((await loadEntitlements(pool,'tg_123','2026-10-25T12:00:00.000500Z')).isPremium).toBe(false);
 });

 it('rejects claims from unregistered users without creating state',async()=>{
  await expect(tasks.claim('tg_999','MANDATORY_VIDEO_LOGIN')).rejects.toThrow(/Registered/);
  expect((await pool.query("SELECT count(*)::int AS n FROM daily_task_state WHERE user_id='tg_999'")).rows[0].n).toBe(0);
 });

});
