import 'dotenv/config';
import { Pool } from 'pg';
import { runGamePass,runGameWorker } from './game-worker';

async function main():Promise<void>{
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
 const stop=new AbortController();const shutdown=()=>stop.abort();
 process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:10000,
  statement_timeout:10000,idle_in_transaction_session_timeout:15000});
 try{await runGameWorker(stop.signal,()=>runGamePass(pool,100,stop.signal),()=>console.error('Game worker pass failed; will retry; investigate persistent failures'));}
 finally{process.removeListener('SIGTERM',shutdown);process.removeListener('SIGINT',shutdown);await pool.end();}
}
void main().catch(()=>{console.error('Game worker stopped unexpectedly');process.exitCode=1;});
