import { createHash, randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { assertKobo, MAX_KOBO } from './amount';

export interface Posting {
  userId: string;
  operation: string;
  idempotencyKey: string;
  amountKobo: number;
  kind: 'CREDIT' | 'DEBIT' | 'COMPENSATION';
  referenceType: string;
  referenceId: string;
  ruleVersion: string;
  /** SHA256 of the owning operation's canonical validated payload (destination/plan/etc). */
  sourcePayloadHash: string;
}
export interface PostingResponse { entryId: string; amountKobo: string; availableKobo: string }
export class LedgerError extends Error {
  constructor(readonly code: 'CONFLICT' | 'INSUFFICIENT_BALANCE' | 'BALANCE_LIMIT') { super(code); }
}
interface EntryRow { id:string; amount_kobo:string; kind:string; reference_type:string; reference_id:string; rule_version:string; created_at:string }
const label = /^[A-Za-z0-9._:-]+$/;
function validate(p: Posting): void {
  assertKobo(p.amountKobo);
  if (!/^[0-9a-f]{64}$/.test(p.sourcePayloadHash)) throw new Error('Invalid source payload hash');
  if (!/^tg_[1-9][0-9]*$/.test(p.userId)) throw new Error('Invalid account');
  for (const [value,max] of [[p.operation,64],[p.referenceType,64],[p.referenceId,128],[p.ruleVersion,64]] as const) {
    if (typeof value !== 'string' || !label.test(value) || value.length > max) throw new Error('Invalid ledger identity');
  }
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(p.idempotencyKey)) throw new Error('Invalid idempotency key');
  if (!['CREDIT','DEBIT','COMPENSATION'].includes(p.kind) || (p.kind === 'CREDIT' && p.amountKobo < 0) || (p.kind === 'DEBIT' && p.amountKobo > 0)) throw new Error('Invalid entry direction');
}
function hash(p: Posting): string {
  return createHash('sha256').update(JSON.stringify([p.userId,p.operation,p.amountKobo,p.kind,p.referenceType,p.referenceId,p.ruleVersion,p.sourcePayloadHash])).digest('hex');
}

/** Internal accounting only. Callers must establish source eligibility; no public credit route. */
export class LedgerRepository {
  constructor(private readonly pool: Pool) {}
  async post(p: Posting, applySource?: (client: PoolClient) => Promise<void>): Promise<PostingResponse> {
    validate(p);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '10s'");
      await client.query('INSERT INTO wallet_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING',[p.userId]);
      await client.query('SELECT user_id FROM wallet_accounts WHERE user_id=$1 FOR UPDATE',[p.userId]);
      const requestHash = hash(p);
      const prior = await client.query<{request_hash:string;response:PostingResponse}>(
        'SELECT request_hash,response FROM financial_requests WHERE user_id=$1 AND operation=$2 AND idempotency_key=$3',
        [p.userId,p.operation,p.idempotencyKey]);
      if (prior.rows[0]) {
        if (prior.rows[0].request_hash !== requestHash) throw new LedgerError('CONFLICT');
        await client.query('COMMIT'); return prior.rows[0].response;
      }
      // A second request key cannot mint the same economic source again. Return the original response.
      const source = await client.query<EntryRow>('SELECT * FROM wallet_entries WHERE account_id=$1 AND reference_type=$2 AND reference_id=$3',[p.userId,p.referenceType,p.referenceId]);
      let response: PostingResponse;
      const entry = source.rows[0];
      if (entry) {
        const original = await client.query<{request_hash:string;response:PostingResponse}>(
          "SELECT request_hash,response FROM financial_requests WHERE user_id=$1 AND response->>'entryId'=$2 LIMIT 1",[p.userId,entry.id]);
        if (!original.rows[0] || original.rows[0].request_hash !== requestHash) throw new LedgerError('CONFLICT');
        response = original.rows[0].response;
      } else {
        // Owning eligibility/state transition shares this transaction and account lock.
        // It must use this client only, and must not call external services.
        if (applySource) await applySource(client);
        const balance = await this.balance(client,p.userId);
        const next = balance + BigInt(p.amountKobo);
        if (next < 0n) throw new LedgerError('INSUFFICIENT_BALANCE');
        if (next > BigInt(MAX_KOBO)) throw new LedgerError('BALANCE_LIMIT');
        const audit = await client.query<{id:string}>(
          'INSERT INTO reward_audit_events(user_id,event_type,amount_kobo,reason,triggering_rule) VALUES($1,$2,$3,$4,$5) RETURNING id',
          [p.userId,`LEDGER_${p.kind}`,p.amountKobo,p.referenceType,p.ruleVersion]);
        const id = randomUUID();
        await client.query('INSERT INTO wallet_entries(id,account_id,amount_kobo,kind,reference_type,reference_id,rule_version,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [id,p.userId,p.amountKobo,p.kind,p.referenceType,p.referenceId,p.ruleVersion,audit.rows[0]!.id]);
        response = {entryId:id,amountKobo:String(p.amountKobo),availableKobo:String(next)};
        await client.query('INSERT INTO outbox_events(id,type,payload) VALUES($1,$2,$3)',[randomUUID(),'WALLET_ENTRY_POSTED',{entryId:id,userId:p.userId}]);
      }
      await client.query('INSERT INTO financial_requests(user_id,operation,idempotency_key,request_hash,response) VALUES($1,$2,$3,$4,$5)',
        [p.userId,p.operation,p.idempotencyKey,requestHash,response]);
      await client.query('COMMIT'); return response;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  private async balance(client: Pick<PoolClient,'query'>, userId:string):Promise<bigint> {
    const result = await client.query<{balance:string}>('SELECT COALESCE(sum(amount_kobo),0)::text AS balance FROM wallet_entries WHERE account_id=$1',[userId]);
    return BigInt(result.rows[0]!.balance);
  }
  async availableKobo(userId:string):Promise<string> { return String(await this.balance(this.pool,userId)); }
  async entries(userId:string,limit=50,cursor?:{createdAt:string;id:string}):Promise<EntryRow[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid page limit');
    if (cursor && (!/^\d{4}-\d\d-\d\dT/.test(cursor.createdAt) || !Number.isFinite(Date.parse(cursor.createdAt)) || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(cursor.id))) throw new Error('Invalid cursor');
    const result = await this.pool.query<EntryRow>(`SELECT id,amount_kobo::text,kind,reference_type,reference_id,rule_version,
      to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at
      FROM wallet_entries WHERE account_id=$1 ${cursor ? 'AND (created_at,id)<($3::timestamptz,$4::uuid)' : ''}
      ORDER BY created_at DESC,id DESC LIMIT $2`,cursor ? [userId,limit,cursor.createdAt,cursor.id] : [userId,limit]);
    return result.rows;
  }
}
