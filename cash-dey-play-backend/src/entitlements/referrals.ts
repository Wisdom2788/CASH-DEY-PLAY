import { randomInt } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function referralCode():string{return Array.from({length:8},()=>alphabet[randomInt(alphabet.length)]).join('');}
export async function assignReferralCode(c:PoolClient,userId:string,generate:()=>string=referralCode):Promise<void>{
 for(let attempt=0;attempt<8;attempt++){
  const code=generate();if(!/^[A-Z2-9]{8}$/.test(code))throw new Error('Invalid generated referral code');
  await c.query('SAVEPOINT referral_code');
  try{await c.query('UPDATE users SET referral_code=$2 WHERE id=$1',[userId,code]);await c.query('RELEASE SAVEPOINT referral_code');return;}
  catch(error){await c.query('ROLLBACK TO SAVEPOINT referral_code');if((error as {code?:string;constraint?:string}).code!=='23505'||(error as {constraint?:string}).constraint!=='users_referral_code_key')throw error;}
 }
 throw new Error('Referral code allocation exhausted');
}
export async function resolveReferral(pool:Pool,userId:string):Promise<void>{
 const c=await pool.connect();try{
  await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'");
  const intent=await c.query<{start_param:string|null;captured_at:Date}>('SELECT start_param,captured_at FROM first_login_attributions WHERE user_id=$1 AND resolved_at IS NULL FOR UPDATE',[userId]);
  const row=intent.rows[0];if(row){
   const code=row.start_param?.replace(/^ref_/, '')??'';
   if(/^(?:[A-Z2-9]{8}|REF_[1-9][0-9]*)$/.test(code))await c.query(`INSERT INTO referrals(referrer_id,referred_id,created_at,expires_at,status)
    SELECT id,$1,$3,$3::timestamptz+interval '30 days','PENDING' FROM users WHERE referral_code=$2 AND id<>$1 AND $3::timestamptz+interval '30 days'>clock_timestamp()
    ON CONFLICT(referred_id) DO NOTHING`,[userId,code,row.captured_at]);
   await c.query('UPDATE first_login_attributions SET resolved_at=clock_timestamp() WHERE user_id=$1',[userId]);
  }await c.query('COMMIT');
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}
export async function resolvePendingReferrals(pool:Pool,limit=100):Promise<number>{
 if(!Number.isInteger(limit)||limit<1||limit>1000)throw new Error('Invalid batch size');
 const rows=await pool.query<{user_id:string}>('SELECT user_id FROM first_login_attributions WHERE resolved_at IS NULL ORDER BY captured_at,user_id LIMIT $1',[limit]);
 for(const row of rows.rows)await resolveReferral(pool,row.user_id);return rows.rows.length;
}
