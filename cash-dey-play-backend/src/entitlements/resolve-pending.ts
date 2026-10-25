import 'dotenv/config';
import { Pool } from 'pg';
import { resolvePendingReferrals } from './referrals';
async function main(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');const pool=new Pool({connectionString:process.env.DATABASE_URL});try{console.log(JSON.stringify({resolved:await resolvePendingReferrals(pool)}));}finally{await pool.end();}}
void main().catch(()=>{console.error('Referral resolution failed; pending intents retained');process.exitCode=1;});
