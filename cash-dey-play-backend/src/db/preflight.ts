import "dotenv/config";
import { Pool } from "pg";

/** Read-only counts; no player identifiers, credentials or phone values are emitted. */
async function main():Promise<void> {
  if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool=new Pool({connectionString:process.env.DATABASE_URL});
  const client=await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const result: Record<string,number>={};
    const users=await client.query<{count:string}>("SELECT count(*) FROM users WHERE telegram_id < 1 OR telegram_id > 9007199254740991 OR id <> 'tg_' || telegram_id::text");
    result.invalidUsers=Number(users.rows[0]?.count ?? 0);
    for(const [table,column] of [["login_streaks","user_id"],["task_completions","user_id"],["matches","user_id"],["matches","winner_id"],["reward_audit_events","user_id"],["idempotency_keys","user_id"]] as const) {
      const stats=await client.query<{bare:string;orphans:string}>(`SELECT count(*) FILTER (WHERE ${column} ~ '^[1-9][0-9]*$') AS bare,
        count(*) FILTER (WHERE ${column} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id=CASE WHEN t.${column} ~ '^[1-9][0-9]*$' THEN 'tg_' || t.${column} ELSE t.${column} END)) AS orphans FROM ${table} t`);
      result[`${table}.${column}.bare`]=Number(stats.rows[0]?.bare ?? 0);
      result[`${table}.${column}.orphans`]=Number(stats.rows[0]?.orphans ?? 0);
    }
    const collisions=await client.query<{count:string}>("SELECT count(*) FROM login_streaks b JOIN login_streaks p ON p.user_id='tg_' || b.user_id WHERE b.user_id ~ '^[1-9][0-9]*$' AND b.window_start_date<>p.window_start_date");
    result.crossWindowStreakCollisions=Number(collisions.rows[0]?.count ?? 0);
    const conflicts=await client.query<{count:string}>("SELECT count(*) FROM idempotency_keys b JOIN idempotency_keys p ON p.user_id='tg_' || b.user_id AND p.endpoint=b.endpoint AND p.idempotency_key=b.idempotency_key WHERE b.user_id ~ '^[1-9][0-9]*$' AND b.response_body IS DISTINCT FROM p.response_body");
    result.conflictingIdempotencyResponses=Number(conflicts.rows[0]?.count ?? 0);
    await client.query("COMMIT"); console.log(JSON.stringify(result,null,2));
  } catch { await client.query("ROLLBACK").catch(()=>undefined); throw new Error("Preflight failed; check database availability and baseline schema using restricted server logs"); }
  finally {client.release();await pool.end();}
}
if(require.main === module) void main().catch((error:unknown)=>{console.error(error instanceof Error ? error.message : "Preflight failed"); process.exitCode=1;});
