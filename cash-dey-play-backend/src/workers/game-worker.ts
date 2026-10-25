import { Pool } from 'pg';
import { GameRepository } from '../game-engine/repository';
import { PracticeRepository } from '../practice/practice.repository';

/** One bounded pass. SQL is the authority; Redis is not required for game recovery. */
export async function runGamePass(pool:Pool,limit=100,signal?:AbortSignal):Promise<{scanned:number;advanced:number;completed:number}>{
 if(signal?.aborted)return {scanned:0,advanced:0,completed:0};
 if(!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new Error('INVALID_BATCH_LIMIT');
 const candidates=await pool.query<{id:string;version:number}>(`
  SELECT m.id,m.version FROM game_matches m WHERE m.status='ACTIVE' AND (
   (m.private_state->>'deadlineAt')::bigint <= floor(extract(epoch FROM clock_timestamp())*1000)
   OR (m.mode='PRACTICE' AND EXISTS(SELECT 1 FROM game_players p WHERE p.match_id=m.id
    AND p.is_bot AND p.seat=(m.private_state->>'turn')::int)))
  ORDER BY m.updated_at,m.id LIMIT $1`,[limit]);
 const games=new GameRepository(pool);let advanced=0;
 for(const row of candidates.rows){
  if(signal?.aborted)break;
  if(await games.advanceDueMatch(row.id,row.version)!=='SKIPPED')advanced++;
 }
 if(signal?.aborted)return {scanned:candidates.rows.length,advanced,completed:0};
 const completion=await new PracticeRepository(pool).recoverCompletions(limit,signal);
 return {scanned:candidates.rows.length,advanced,completed:completion.recorded};
}

export function waitForNextPass(signal:AbortSignal,ms=2000):Promise<void>{
 if(signal.aborted)return Promise.resolve();
 return new Promise(resolve=>{
  const finish=()=>{clearTimeout(timer);signal.removeEventListener('abort',finish);resolve();};
  const timer=setTimeout(finish,ms);signal.addEventListener('abort',finish,{once:true});
 });
}

/** Finish the current bounded pass on shutdown; never overlap passes within this process. */
export async function runGameWorker(signal:AbortSignal,pass:()=>Promise<unknown>,onError:()=>void,
 wait:(signal:AbortSignal)=>Promise<void>=waitForNextPass):Promise<void>{
 while(!signal.aborted){
  try{await pass();}catch{onError();}
  if(!signal.aborted)await wait(signal);
 }
}
