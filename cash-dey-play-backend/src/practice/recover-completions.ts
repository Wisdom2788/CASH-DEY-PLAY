import 'dotenv/config';
import { Pool } from 'pg';
import { PracticeRepository } from './practice.repository';

async function main():Promise<void>{
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
 const pool=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
 try{console.log(JSON.stringify(await new PracticeRepository(pool).recoverCompletions()));}
 finally{await pool.end();}
}
void main().catch(()=>{console.error('Practice completion recovery failed; retry after investigation');process.exitCode=1;});
