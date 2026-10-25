import 'dotenv/config';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { runGameDeliveryPass } from '../realtime/game-delivery.repository';
import { runGameWorker } from './game-worker';
async function main():Promise<void>{
 const {DATABASE_URL,REDIS_URL,GAME_RELAY_CHANNEL}=process.env;
 if(!DATABASE_URL||!REDIS_URL||!GAME_RELAY_CHANNEL||!/^[A-Za-z0-9:_-]{1,100}$/.test(GAME_RELAY_CHANNEL))throw new Error('Delivery configuration required');
 const stop=new AbortController();const shutdown=()=>stop.abort();process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
 const pool=new Pool({connectionString:DATABASE_URL,max:2,connectionTimeoutMillis:10000,statement_timeout:10000});
 const redis=new Redis(REDIS_URL,{enableOfflineQueue:false,maxRetriesPerRequest:1,commandTimeout:5000});redis.on('error',()=>undefined);
 try{await runGameWorker(stop.signal,()=>runGameDeliveryPass(pool,notice=>redis.publish(GAME_RELAY_CHANNEL,JSON.stringify(notice)),100,stop.signal),
  ()=>console.error('Game delivery pass failed; retry retained; investigate persistent failures'));}
 finally{process.removeListener('SIGTERM',shutdown);process.removeListener('SIGINT',shutdown);redis.disconnect();await pool.end();}
}
void main().catch(()=>{console.error('Game delivery worker stopped unexpectedly');process.exitCode=1;});
