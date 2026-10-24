import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { LedgerRepository, Posting } from './ledger.repository';
import { OutboxRepository } from './outbox.repository';
import { reconcileLedger } from './reconcile';
const url=process.env.TEST_DATABASE_URL;
if(process.env.REQUIRE_DB_TESTS==='true' && !url) throw new Error('TEST_DATABASE_URL required');
const suite=url ? describe : describe.skip;
const root=join(__dirname,'../..');
const migration=(name:string)=>readFileSync(join(root,'prisma/migrations',name,'migration.sql'),'utf8');
suite('ledger PostgreSQL economic boundary',()=>{
  let admin:Pool,pool:Pool,schema:string,ledger:LedgerRepository;
  beforeAll(()=>{
    if(!/(?:^|_)test(?:_|$)/i.test(new URL(url!).pathname.slice(1))) throw new Error('Disposable test database required');
    admin=new Pool({connectionString:url});
  });
  beforeEach(async()=>{
    schema='cdp_ledger_'+randomUUID().replace(/-/g,'');
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool=new Pool({connectionString:url,options:`-c search_path=${schema}`,max:12});
    await pool.query(migration('0_init'));
    await pool.query("INSERT INTO users(id,telegram_id,first_name) VALUES('tg_123',123,'Test')");
    await pool.query("INSERT INTO wallets(user_id,balance_ngn) VALUES('tg_123',10)");
    await pool.query(migration('2026102401_foundations'));
    await pool.query(migration('2026102501_ledger'));
    ledger=new LedgerRepository(pool);
  });
  afterEach(async()=>{await pool.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);});
  afterAll(async()=>{await admin.end();});
  function credit(overrides:Partial<Posting>={}):Posting {
    return {userId:'tg_123',operation:'reward',idempotencyKey:'request-0001',amountKobo:100,kind:'CREDIT',referenceType:'TASK',referenceId:'day-1',ruleVersion:'v1',...overrides};
  }
  it('imports balance once without replaying transaction history and freezes old writers',async()=>{
    expect(await ledger.availableKobo('tg_123')).toBe('1000');
    expect((await ledger.entries('tg_123'))[0]?.kind).toBe('OPENING_BALANCE');
    await expect(pool.query("UPDATE wallets SET balance_ngn=99")).rejects.toThrow(/Immutable/);
    await expect(pool.query("INSERT INTO wallet_transactions(user_id,type,amount_ngn,description) VALUES('tg_123','TEST',10,'old')")).rejects.toThrow(/Immutable/);
  });
  it('serializes ten debits without overspending',async()=>{
    const results=await Promise.allSettled(Array.from({length:10},(_,i)=>ledger.post(credit({operation:'reserve',idempotencyKey:`debit-key-${i}`,kind:'DEBIT',amountKobo:-300,referenceType:'PAYOUT',referenceId:`payout-${i}`}))));
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(3);
    expect(results.filter(r=>r.status==='rejected')).toHaveLength(7);
    expect(await ledger.availableKobo('tg_123')).toBe('100');
    expect((await pool.query('SELECT count(*)::int AS n FROM outbox_events')).rows[0].n).toBe(3);
  });
  it('replays same request and economic source without duplicate credit and rejects changed payload',async()=>{
    const first=await ledger.post(credit());
    await ledger.post(credit({idempotencyKey:'another-key',referenceId:'day-2'}));
    expect(await ledger.post(credit())).toEqual(first);
    expect(await ledger.post(credit({idempotencyKey:'source-retry'}))).toEqual(first);
    await expect(ledger.post(credit({amountKobo:200}))).rejects.toMatchObject({code:'CONFLICT'});
    await expect(ledger.post(credit({idempotencyKey:'different-key',amountKobo:200}))).rejects.toMatchObject({code:'CONFLICT'});
    expect(await ledger.availableKobo('tg_123')).toBe('1200');
  });
  it('serializes an accountless concurrent first write',async()=>{
    await pool.query("INSERT INTO users(id,telegram_id,first_name) VALUES('tg_456',456,'New')");
    const responses=await Promise.all(Array.from({length:10},()=>ledger.post(credit({userId:'tg_456'}))));
    expect(new Set(responses.map(r=>r.entryId)).size).toBe(1);
    expect(await ledger.availableKobo('tg_456')).toBe('100');
  });
  it.each(['reward_audit_events','wallet_entries','outbox_events','financial_requests'])('rolls back every economic write when %s insertion fails',async table=>{
    await pool.query(`CREATE FUNCTION reject_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$`);
    await pool.query(`CREATE TRIGGER reject_insert BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_insert()`);
    await expect(ledger.post(credit())).rejects.toThrow(/injected failure/);
    expect(await ledger.availableKobo('tg_123')).toBe('1000');
    expect((await pool.query('SELECT count(*)::int AS n FROM wallet_entries')).rows[0].n).toBe(1);
    expect((await pool.query('SELECT count(*)::int AS n FROM reward_audit_events')).rows[0].n).toBe(1);
    expect((await pool.query('SELECT count(*)::int AS n FROM financial_requests')).rows[0].n).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS n FROM outbox_events')).rows[0].n).toBe(0);
  });
  it('preserves history and pages tied timestamps without duplication',async()=>{
    await pool.query("ALTER TABLE wallet_entries ALTER COLUMN created_at SET DEFAULT '2099-01-01T00:00:00.123456Z'::timestamptz");
    await ledger.post(credit());
    await ledger.post(credit({idempotencyKey:'request-0002',referenceId:'day-2'}));
    await expect(pool.query('DELETE FROM wallet_entries')).rejects.toThrow(/Immutable/);
    await expect(pool.query('UPDATE reward_audit_events SET amount_kobo=999')).rejects.toThrow(/Immutable/);
    const first=await ledger.entries('tg_123',1);
    const second=await ledger.entries('tg_123',1,{createdAt:first[0]!.created_at,id:first[0]!.id});
    expect(second).toHaveLength(1);
    expect(second[0]!.id).not.toBe(first[0]!.id);
    expect(await ledger.availableKobo('tg_missing')).toBe('0');
    await expect(ledger.post(credit({userId:'tg_999'}))).rejects.toThrow(/foreign key/);
  });
  it('commits source state with accounting and skips source transition on replay',async()=>{
    const source=jest.fn(async(client:import('pg').PoolClient)=>{
      await client.query("INSERT INTO task_completions(user_id,completed_on,task_key) VALUES('tg_123','2026-10-25','TEST')");
    });
    await ledger.post(credit(),source); await ledger.post(credit(),source);
    expect(source).toHaveBeenCalledTimes(1);
    await expect(ledger.post(credit({referenceId:'next',idempotencyKey:'next-key-001'}),async(client)=>{
      await client.query("INSERT INTO task_completions(user_id,completed_on,task_key) VALUES('tg_123','2026-10-25','ROLLBACK')");
      throw new Error('source failed');
    })).rejects.toThrow('source failed');
    expect((await pool.query("SELECT task_key FROM task_completions ORDER BY task_key")).rows).toEqual([{task_key:'TEST'}]);
    expect(await ledger.availableKobo('tg_123')).toBe('1100');
  });
  it('reclaims crashed outbox deliveries with a stable event identity and fences stale acknowledgements',async()=>{
    await ledger.post(credit());
    const outbox=new OutboxRepository(pool);
    const original=(await outbox.claim())!;
    expect(original.payload).toEqual({entryId:expect.any(String),userId:'tg_123'});
    expect(await outbox.claim()).toBeNull();
    await pool.query("UPDATE outbox_events SET lease_until=clock_timestamp()-interval '1 second'");
    const recovered=(await outbox.claim())!;
    expect(recovered.id).toBe(original.id); expect(recovered.attempts).toBe(2);
    expect(await outbox.acknowledge(original)).toBe(false);
    expect(await outbox.acknowledge(recovered)).toBe(true);
    expect(await outbox.claim()).toBeNull();
  });
  it('claims an outbox event once under concurrent workers and schedules retry',async()=>{
    await ledger.post(credit()); const outbox=new OutboxRepository(pool);
    const claims=await Promise.all(Array.from({length:10},()=>outbox.claim()));
    const active=claims.filter((e):e is NonNullable<typeof e>=>e!==null);
    expect(active).toHaveLength(1); expect(await outbox.retry(active[0]!)).toBe(true);
    expect(await outbox.claim()).toBeNull();
    await pool.query("UPDATE outbox_events SET available_at=clock_timestamp()-interval '1 second'");
    const next=(await outbox.claim())!; expect(next.id).toBe(active[0]!.id);
    expect(await outbox.acknowledge(active[0]!)).toBe(false);
  });

  it('rejects balance overflow and compensates with an immutable new entry',async()=>{
    await expect(ledger.post(credit({amountKobo:2_000_000_000}))).rejects.toMatchObject({code:'BALANCE_LIMIT'});
    await ledger.post(credit());
    await ledger.post(credit({kind:'COMPENSATION',amountKobo:-100,referenceType:'CORRECTION',referenceId:'entry-1',idempotencyKey:'correct-key-1'}));
    expect(await ledger.availableKobo('tg_123')).toBe('1000');
    expect((await ledger.entries('tg_123')).map(e=>e.kind)).toEqual(expect.arrayContaining(['OPENING_BALANCE','CREDIT','COMPENSATION']));
  });
  it('rolls back account creation when the first source transition fails',async()=>{
    await pool.query("INSERT INTO users(id,telegram_id,first_name) VALUES('tg_456',456,'New')");
    await expect(ledger.post(credit({userId:'tg_456'}),async()=>{throw new Error('source failed');})).rejects.toThrow('source failed');
    expect((await pool.query("SELECT count(*)::int AS n FROM wallet_accounts WHERE user_id='tg_456'")).rows[0].n).toBe(0);
  });

  it('reconciles valid postings and reports integrity mismatches without private values',async()=>{
    await ledger.post(credit());
    expect(Object.values(await reconcileLedger(pool)).every(n=>n===0)).toBe(true);
    // Simulate a privileged faulty writer inserting a mismatched audit/entry pair.
    const audit=await pool.query("INSERT INTO reward_audit_events(user_id,event_type,amount_kobo,reason,triggering_rule) VALUES('tg_123','TEST',1,'test','v1') RETURNING id");
    await pool.query("INSERT INTO wallet_entries(id,account_id,amount_kobo,kind,reference_type,reference_id,rule_version,audit_id) VALUES($1,'tg_123',100,'CREDIT','FAULT','fault-1','v1',$2)",[randomUUID(),audit.rows[0].id]);
    const counts=await reconcileLedger(pool);
    expect(counts.audit_mismatches).toBe(1);expect(counts.missing_request_receipts).toBe(1);expect(counts.missing_outbox_intents).toBe(1);
    expect(Object.values(counts).every(n=>typeof n==='number')).toBe(true);
  });

});
