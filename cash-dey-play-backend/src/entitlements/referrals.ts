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

export function referralLink(code:string,bot:string|undefined,miniApp:string|undefined):string|null {
 if(!bot||!miniApp||!/^\w{5,32}$/.test(bot)||!/^\w{1,64}$/.test(miniApp))return null;
 return `https://t.me/${bot}/${miniApp}?startapp=${encodeURIComponent('ref_'+code)}`;
}
export async function referralSummary(pool:Pool,userId:string){
 const user=await pool.query<{referral_code:string|null}>('SELECT referral_code FROM users WHERE id=$1',[userId]);
 const code=user.rows[0]?.referral_code??null;
 const rows=await pool.query<{username:string|null;status:string;complete_task_days:number}>(`SELECT u.username,
 CASE WHEN r.status='PENDING' AND r.expires_at<=clock_timestamp() THEN 'EXPIRED' ELSE r.status END AS status,
 (SELECT count(*)::int FROM qualified_task_days d WHERE d.user_id=r.referred_id
 AND d.first_claim_at>=r.created_at AND d.completed_at<r.expires_at
 AND d.lagos_date>=(r.created_at AT TIME ZONE 'Africa/Lagos')::date AND d.lagos_date<=(r.expires_at AT TIME ZONE 'Africa/Lagos')::date) AS complete_task_days
 FROM referrals r JOIN users u ON u.id=r.referred_id WHERE r.referrer_id=$1 ORDER BY r.created_at DESC,r.id DESC LIMIT 50`,[userId]);
 return {code,shareLink:code?referralLink(code,process.env.TELEGRAM_BOT_USERNAME,process.env.TELEGRAM_MINI_APP_NAME):null,referrals:rows.rows.map(r=>({username:r.username,status:r.status,completeTaskDays:r.complete_task_days})),limit:50};
}
