import 'dotenv/config';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { RankedRepository } from '../ranked/ranked.repository';
import { RedisRankedQueue } from '../ranked/redis-queue';
import { RankedMatchmaker } from '../ranked/matchmaker';
import { runGameWorker } from './game-worker';
async function main():Promise<void>{
 const {DATABASE_URL,REDIS_URL,RANKED_QUEUE_NAMESPACE}=process.env;if(!DATABASE_URL||!REDIS_URL||!RANKED_QUEUE_NAMESPACE)throw new Error('Ranked worker configuration required');
 const pool=new Pool({connectionString:DATABASE_URL,max:3,connectionTimeoutMillis:10000,statement_timeout:10000});
 const redis=new Redis(REDIS_URL,{maxRetriesPerRequest:1,enableOfflineQueue:false,commandTimeout:5000});redis.on('error',()=>undefined);
 const stop=new AbortController();const shutdown=()=>stop.abort();process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
 try{const worker=new RankedMatchmaker(new RankedRepository(pool),new RedisRankedQueue(redis,RANKED_QUEUE_NAMESPACE));
  await runGameWorker(stop.signal,()=>worker.pass(stop.signal),()=>console.error('Ranked matchmaking pass failed; durable tickets retained'));
 }finally{process.removeListener('SIGTERM',shutdown);process.removeListener('SIGINT',shutdown);redis.disconnect();await pool.end();}
}
void main().catch(()=>{console.error('Ranked worker stopped unexpectedly');process.exitCode=1;});
