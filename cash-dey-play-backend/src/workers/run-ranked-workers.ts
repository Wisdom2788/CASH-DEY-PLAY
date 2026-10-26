import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { RankedRepository } from '../ranked/ranked.repository';
import { RedisRankedQueue } from '../ranked/redis-queue';
import { RankedMatchmaker } from '../ranked/matchmaker';
import { runGameDeliveryPass } from '../realtime/game-delivery.repository';
import { runGamePass,runGameWorker,waitForNextPass } from './game-worker';
/** One supervised service, three independent bounded loops. No public listener or self-ping. */
async function main():Promise<void>{
 const {DATABASE_URL,REDIS_URL,RANKED_QUEUE_NAMESPACE,GAME_RELAY_CHANNEL}=process.env;
 if(!DATABASE_URL||!REDIS_URL||!RANKED_QUEUE_NAMESPACE||!GAME_RELAY_CHANNEL||!/^[A-Za-z0-9:_-]{1,100}$/.test(GAME_RELAY_CHANNEL))throw new Error('Worker configuration required');
 const stop=new AbortController();const shutdown=()=>stop.abort();process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
 const pool=new Pool({connectionString:DATABASE_URL,max:5,connectionTimeoutMillis:10000,statement_timeout:10000});
 const redis=new Redis(REDIS_URL,{maxRetriesPerRequest:1,enableOfflineQueue:false,commandTimeout:5000});redis.on('error',()=>undefined);
 const instance=randomUUID();const matcher=new RankedMatchmaker(new RankedRepository(pool),new RedisRankedQueue(redis,RANKED_QUEUE_NAMESPACE));
 const heartbeat=async(role:string,success:boolean)=>{await pool.query(`INSERT INTO ranked_worker_health(instance_id,role,last_success_at,last_failure_at,failures)
  VALUES($1,$2,CASE WHEN $3 THEN clock_timestamp() END,CASE WHEN NOT $3 THEN clock_timestamp() END,CASE WHEN $3 THEN 0 ELSE 1 END)
  ON CONFLICT(instance_id,role) DO UPDATE SET last_success_at=CASE WHEN $3 THEN clock_timestamp() ELSE ranked_worker_health.last_success_at END,
  last_failure_at=CASE WHEN NOT $3 THEN clock_timestamp() ELSE ranked_worker_health.last_failure_at END,failures=ranked_worker_health.failures+CASE WHEN $3 THEN 0 ELSE 1 END`,[instance,role,success]);};
 const loop=(role:string,pass:()=>Promise<unknown>,interval:number)=>runGameWorker(stop.signal,async()=>{
  try{await pass();await heartbeat(role,true);}catch(error){await heartbeat(role,false).catch(()=>undefined);throw error;}
 },()=>console.error(`${role} pass failed; durable recovery retained`),signal=>waitForNextPass(signal,interval));
 try{
  // Refuse to run against an unmigrated database before starting any writer loop.
  await pool.query('SELECT instance_id FROM ranked_worker_health LIMIT 0');
  await pool.query("DELETE FROM ranked_worker_health WHERE greatest(last_success_at,last_failure_at)<clock_timestamp()-interval '7 days'");
  await Promise.all([loop('games',()=>runGamePass(pool,100,stop.signal),1000),loop('matchmaker',()=>matcher.pass(stop.signal),500),
   loop('delivery',()=>runGameDeliveryPass(pool,notice=>redis.publish(GAME_RELAY_CHANNEL,JSON.stringify(notice)),100,stop.signal),500)]);
 }finally{stop.abort();process.removeListener('SIGTERM',shutdown);process.removeListener('SIGINT',shutdown);redis.disconnect();await pool.end();}
}
void main().catch(()=>{console.error('Ranked worker supervisor stopped unexpectedly');process.exitCode=1;});
