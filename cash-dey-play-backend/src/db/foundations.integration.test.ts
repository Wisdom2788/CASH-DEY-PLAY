import { PostgresUserRepository } from "./repositories/user.repository";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";

const url = process.env.TEST_DATABASE_URL;
if (process.env.REQUIRE_DB_TESTS === "true" && !url) throw new Error("TEST_DATABASE_URL required");
const databaseTests = url ? describe : describe.skip;
const root = join(__dirname, "../..");
const baseline = readFileSync(join(root,"prisma/migrations/0_init/migration.sql"),"utf8");
const foundations = readFileSync(join(root,"prisma/migrations/2026102401_foundations/migration.sql"),"utf8");

databaseTests("foundations migrations on PostgreSQL", () => {
  let admin: Pool;
  let pool: Pool;
  let schema: string;
  beforeAll(() => {
    if (!/(?:^|_)test(?:_|$)/i.test(new URL(url!).pathname.slice(1))) throw new Error("Disposable test database required");
    admin = new Pool({connectionString:url});
  });
  beforeEach(async () => {
    schema = `cdp_migration_${randomUUID().replace(/-/g,"")}`;
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({connectionString:url,options:`-c search_path=${schema}`});
  });
  afterEach(async () => { if(pool) await pool.end(); await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); });
  afterAll(async () => { if(admin) await admin.end(); });
  async function apply() {
    const client = await pool.connect();
    try { await client.query(foundations); await client.query(readFileSync(join(root,"prisma/migrations/2026102501_ledger/migration.sql"),"utf8")); await client.query(readFileSync(join(root,"prisma/migrations/2026102502_entitlements/migration.sql"),"utf8")); await client.query(readFileSync(join(root,"prisma/migrations/2026102503_game_engine/migration.sql"),"utf8")); } catch(error) { await client.query("ROLLBACK"); throw error; }
    finally {client.release();}
  }
  async function fixture() {
    await pool.query(baseline);
    await pool.query("INSERT INTO users(id,telegram_id,first_name) VALUES('tg_123',123,'Test')");
  }
  it("deploys from empty schema through Prisma and replays migration history safely", async () => {
    const database = new URL(url!); database.searchParams.set("schema",schema);
    for(let i=0;i<2;i++) execFileSync(process.execPath,[join(root,"node_modules/prisma/build/index.js"),"migrate","deploy"],{
      cwd:root,env:{...process.env,DATABASE_URL:database.toString()},stdio:"pipe",timeout:60000,
    });
    expect((await pool.query("SELECT count(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL")).rows[0].count).toBe(11);
    expect((await pool.query("SELECT count(*)::int AS count FROM first_login_attributions")).rows[0].count).toBe(0);
  },130000);
  it('snapshots legacy streak flags without importing monetary eligibility or deleting history',async()=>{
    await fixture();await apply();
    await pool.query("INSERT INTO login_streaks VALUES('tg_123','2026-10-01','2026-10-12',11,1,true,now())");
    await pool.query(readFileSync(join(root,'prisma/migrations/2026102702_streak_rewards/migration.sql'),'utf8'));
    expect((await pool.query('SELECT snapshot FROM streak_legacy_snapshots')).rows[0].snapshot).toMatchObject({has_claimed_bonus:true,grace_days_used:1});
    expect((await pool.query('SELECT count(*)::int AS n FROM login_streaks')).rows[0].n).toBe(1);
    expect((await pool.query('SELECT count(*)::int AS n FROM streak_cycles')).rows[0].n).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS n FROM streak_claims')).rows[0].n).toBe(0);
    await expect(pool.query('DELETE FROM streak_legacy_snapshots')).rejects.toThrow('Immutable');
  });
  it("refuses an ambiguous future task cutover without changing existing claims",async()=>{
    await fixture();await apply();
    await pool.query("INSERT INTO daily_task_state(user_id,lagos_date,task_key,status,claimed_at) VALUES('tg_123',(clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date+1,'WIN_MATCH','CLAIMED',clock_timestamp())");
    const c=await pool.connect();try{await expect(c.query(readFileSync(join(root,'prisma/migrations/2026102701_rotating_tasks/migration.sql'),'utf8'))).rejects.toThrow('Future daily task');await c.query('ROLLBACK');}finally{c.release();}
    expect((await pool.query("SELECT status FROM daily_task_state")).rows).toEqual([{status:'CLAIMED'}]);
    expect((await pool.query("SELECT to_regclass('daily_task_policy') AS policy")).rows[0].policy).toBeNull();
  });
  it("merges same-window identities without unclaiming, deduplicates tasks and rewrites the winner", async () => {
    await fixture();
    await pool.query("INSERT INTO login_streaks VALUES('123','2026-10-01','2026-10-20',20,1,true,now()),('tg_123','2026-10-01','2026-10-21',21,0,false,now())");
    await pool.query("INSERT INTO task_completions(user_id,completed_on,task_key) VALUES('123','2026-10-20','VIDEO'),('tg_123','2026-10-20','VIDEO')");
    await pool.query("INSERT INTO matches(user_id,winner_id,created_at) VALUES('123','123','2026-10-31T23:30:00Z')");
    await apply();
    expect((await pool.query("SELECT user_id,has_claimed_bonus,grace_days_used,consecutive_login_days_count FROM login_streaks")).rows).toEqual([{user_id:"tg_123",has_claimed_bonus:true,grace_days_used:1,consecutive_login_days_count:21}]);
    expect((await pool.query("SELECT user_id FROM task_completions")).rows).toEqual([{user_id:"tg_123"}]);
    expect((await pool.query("SELECT user_id,winner_id,lagos_date::text FROM matches")).rows).toEqual([{user_id:"tg_123",winner_id:"tg_123",lagos_date:"2026-11-01"}]);
    await expect(pool.query("INSERT INTO matches(user_id,winner_id) VALUES('tg_123','tg_missing')")).rejects.toThrow();
  });
  it.each(["orphan","cross-window","idempotency"])("rejects %s conflicts and rolls back changes", async scenario => {
    await fixture();
    if(scenario === "orphan") await pool.query("INSERT INTO matches(user_id,winner_id) VALUES('123','999')");
    if(scenario === "cross-window") await pool.query("INSERT INTO login_streaks VALUES('123','2026-09-01','2026-09-20',20,0,true,now()),('tg_123','2026-10-01','2026-10-20',20,0,false,now())");
    if(scenario === "idempotency") await pool.query(`INSERT INTO idempotency_keys(user_id,endpoint,idempotency_key,response_body) VALUES('123','claim','key','{"ok":true}'),('tg_123','claim','key','{"ok":false}')`);
    await expect(apply()).rejects.toThrow(/preflight/);
    expect((await pool.query("SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema=$1 AND table_name='users' AND column_name='token_version'",[schema])).rows[0].count).toBe(0);
  });
  it("captures first-login intent once under concurrent sign-in and never attributes an existing player", async()=>{
    await fixture(); await apply();
    const users=new PostgresUserRepository(pool);
    await users.upsertTelegramUser(123,"Existing",null,null,"LATE_CODE");
    expect((await pool.query("SELECT count(*)::int AS count FROM first_login_attributions WHERE user_id='tg_123'")).rows[0].count).toBe(0);
    await Promise.all(Array.from({length:10},()=>users.upsertTelegramUser(456,"New",null,null,"FIRST_CODE")));
    await users.upsertTelegramUser(456,"New",null,null,"OTHER_CODE");
    expect((await pool.query("SELECT user_id,start_param FROM first_login_attributions")).rows).toEqual([{user_id:"tg_456",start_param:"FIRST_CODE"}]);
    expect(await users.findAuthState("tg_456")).toEqual({telegramId:456,tokenVersion:0});
    await pool.query("UPDATE users SET token_version=token_version+1 WHERE id='tg_456'");
    expect((await users.findAuthState("tg_456"))?.tokenVersion).toBe(1);
  });
  it("rolls back new account creation when attribution persistence fails",async()=>{
    await fixture(); await apply();
    await pool.query(`CREATE FUNCTION reject_intent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'intent failure'; END; $$`);
    await pool.query("CREATE TRIGGER reject_intent BEFORE INSERT ON first_login_attributions FOR EACH ROW EXECUTE FUNCTION reject_intent()");
    await expect(new PostgresUserRepository(pool).upsertTelegramUser(456,"New",null,null,"CODE")).rejects.toThrow("intent failure");
    expect(await new PostgresUserRepository(pool).findById("tg_456")).toBeNull();
  });

});
