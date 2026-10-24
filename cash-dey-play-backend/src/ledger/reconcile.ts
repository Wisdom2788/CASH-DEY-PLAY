import 'dotenv/config';
import { Pool } from 'pg';

/** Counts only: safe for operational alerts; no player identifiers or provider payloads. */
export async function reconcileLedger(pool:Pool):Promise<Record<string,number>> {
  const client=await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result=await client.query<{check_name:string;count:string}>(`
      SELECT 'invalid_balances' AS check_name,count(*)::text AS count FROM
        (SELECT account_id,sum(amount_kobo) AS total FROM wallet_entries GROUP BY account_id HAVING sum(amount_kobo)<0 OR sum(amount_kobo)>2000000000) bad
      UNION ALL SELECT 'audit_mismatches',count(*)::text FROM wallet_entries e JOIN reward_audit_events a ON a.id=e.audit_id
        WHERE a.user_id<>e.account_id OR a.amount_kobo IS DISTINCT FROM e.amount_kobo OR a.triggering_rule<>e.rule_version
      UNION ALL SELECT 'opening_mismatches',count(*)::text FROM wallets w
        WHERE w.balance_ngn::bigint*100 <> COALESCE((SELECT sum(e.amount_kobo) FROM wallet_entries e WHERE e.account_id=w.user_id AND e.kind='OPENING_BALANCE'),0)
      UNION ALL SELECT 'missing_request_receipts',count(*)::text FROM wallet_entries e WHERE e.kind<>'OPENING_BALANCE'
        AND NOT EXISTS (SELECT 1 FROM financial_requests r WHERE r.user_id=e.account_id AND r.response->>'entryId'=e.id::text AND r.response->>'amountKobo'=e.amount_kobo::text)
      UNION ALL SELECT 'invalid_request_receipts',count(*)::text FROM financial_requests r WHERE NOT EXISTS
        (SELECT 1 FROM wallet_entries e WHERE e.account_id=r.user_id AND e.id::text=r.response->>'entryId' AND e.amount_kobo::text=r.response->>'amountKobo')
      UNION ALL SELECT 'missing_outbox_intents',count(*)::text FROM wallet_entries e WHERE e.kind<>'OPENING_BALANCE'
        AND NOT EXISTS (SELECT 1 FROM outbox_events o WHERE o.type='WALLET_ENTRY_POSTED' AND o.payload->>'entryId'=e.id::text AND o.payload->>'userId'=e.account_id)
    `);
    await client.query('COMMIT');
    return Object.fromEntries(result.rows.map(row=>[row.check_name,Number(row.count)]));
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();}
}
async function main():Promise<void> {
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  const pool=new Pool({connectionString:process.env.DATABASE_URL});
  try {
    const counts=await reconcileLedger(pool); console.log(JSON.stringify(counts,null,2));
    if(Object.values(counts).some(count=>count!==0)) process.exitCode=1;
  } finally {await pool.end();}
}
if(require.main===module) void main().catch(()=>{console.error('Ledger reconciliation failed; inspect restricted database diagnostics');process.exitCode=1;});
