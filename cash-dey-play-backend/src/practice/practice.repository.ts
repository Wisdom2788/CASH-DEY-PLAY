import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { APPROVED_WHOT_RULES } from '../game-engine/approved-rules';
import { createGame, projectGame, restoreGame, PlayerView } from '../game-engine/engine';
import { cryptoRandomInt } from '../game-engine/crypto-random';
import { RandomInt } from '../game-engine/model';
import { loadEntitlements } from '../entitlements/entitlements';

export class PracticeError extends Error {
 constructor(readonly code:'INVALID_INPUT'|'NOT_FOUND'|'ACTIVE_MATCH'|'RANKED_QUEUE'|'DAILY_LIMIT'|'AD_VERIFICATION_REQUIRED'){super(code);}
}
export interface PracticeStart {matchId:string;reason:'PREMIUM'|'AD_FREE'|'PROVIDER_UNAVAILABLE';view:PlayerView}
/** Internal admission only. No public endpoint or unverified ad-credit writer is exposed. */
export class PracticeRepository {
 constructor(private readonly pool:Pool,private readonly fallback:'BLOCK'|'ALLOW_PROVIDER_UNAVAILABLE'='BLOCK',private readonly random:RandomInt=cryptoRandomInt){}
 async start(userId:string,key:string):Promise<PracticeStart>{
  if(!/^tg_[1-9][0-9]{0,19}$/.test(userId)||!/^[A-Za-z0-9._:-]{8,128}$/.test(key))throw new PracticeError('INVALID_INPUT');
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s'");await client.query("SET LOCAL statement_timeout='10s'");
   const user=await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);if(!user.rowCount)throw new PracticeError('NOT_FOUND');
   const hash=createHash('sha256').update(JSON.stringify(['practice-start-v1',userId])).digest('hex');
   const old=await client.query<{request_hash:string;response:PracticeStart}>('SELECT request_hash,response FROM practice_starts WHERE user_id=$1 AND request_key=$2',[userId,key]);
   if(old.rows[0]){if(old.rows[0].request_hash!==hash)throw new PracticeError('INVALID_INPUT');await client.query('COMMIT');return old.rows[0].response;}
   await client.query('INSERT INTO player_admissions(user_id) VALUES($1) ON CONFLICT DO NOTHING',[userId]);
   const admission=await client.query<{ranked_queued:boolean}>('SELECT ranked_queued FROM player_admissions WHERE user_id=$1 FOR UPDATE',[userId]);
   if(admission.rows[0]!.ranked_queued)throw new PracticeError('RANKED_QUEUE');
   const active=await client.query(`SELECT 1 FROM game_players p JOIN game_matches m ON m.id=p.match_id WHERE p.user_id=$1 AND m.status='ACTIVE' LIMIT 1`,[userId]);
   if(active.rowCount)throw new PracticeError('ACTIVE_MATCH');
   // Refund/revocation writers must use the same user->order/entitlement lock order.
   await client.query('SELECT o.id FROM premium_orders o JOIN paid_entitlements e ON e.order_id=o.id WHERE o.user_id=$1 FOR SHARE OF o,e',[userId]);
   await client.query('SELECT user_id FROM ad_free_days WHERE user_id=$1 FOR SHARE',[userId]);
   const clock=await client.query<{at:string;day:string}>("SELECT t::text AS at,(t AT TIME ZONE 'Africa/Lagos')::date::text AS day FROM (SELECT clock_timestamp() t) c");
   const {at,day}=clock.rows[0]!;const entitlement=await loadEntitlements(client,userId,at);
   const usage=await client.query<{n:number}>('SELECT count(*)::int AS n FROM practice_starts WHERE user_id=$1 AND lagos_date=$2',[userId,day]);
   if(!entitlement.isPremium&&usage.rows[0]!.n>=5)throw new PracticeError('DAILY_LIMIT');
   let reason:PracticeStart['reason'];
   if(entitlement.isPremium)reason='PREMIUM';else if(entitlement.adFree)reason='AD_FREE';
   else if(this.fallback==='ALLOW_PROVIDER_UNAVAILABLE')reason='PROVIDER_UNAVAILABLE';else throw new PracticeError('AD_VERIFICATION_REQUIRED');
   const matchId=randomUUID();const state=createGame(APPROVED_WHOT_RULES,Date.parse(at),this.random);
   await client.query(`INSERT INTO game_matches(id,mode,rule_version,private_initial_state,private_state,status,version,started_at,updated_at) VALUES($1,'PRACTICE',$2,$3,$3,'ACTIVE',0,$4,$4)`,[matchId,state.rules.version,state,at]);
   await client.query('INSERT INTO game_players(match_id,seat,user_id,is_bot) VALUES($1,0,$2,false),($1,1,NULL,true)',[matchId,userId]);
   const response:PracticeStart={matchId,reason,view:projectGame(state,0)};
   await client.query('INSERT INTO practice_starts(id,user_id,request_key,request_hash,match_id,reason,started_at,response) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),userId,key,hash,matchId,reason,at,response]);
   await client.query('INSERT INTO outbox_events(id,type,payload) VALUES($1,$2,$3)',[randomUUID(),'PRACTICE_STARTED',{matchId,userId}]);
   await client.query('COMMIT');return response;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 /** Bounded crash recovery. Candidate filtering is advisory; recordCompletion validates authority again. */
 async recoverCompletions(limit=100,signal?:AbortSignal):Promise<{scanned:number;recorded:number}>{
  if(!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new PracticeError('INVALID_INPUT');
  const candidates=await this.pool.query<{match_id:string}>(`
   SELECT s.match_id FROM practice_starts s
   JOIN game_matches m ON m.id=s.match_id
   WHERE m.mode='PRACTICE' AND m.status='FINISHED'
    AND m.private_state->>'reason'='EMPTY_HAND' AND m.ended_at IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM practice_completions c WHERE c.match_id=s.match_id)
   ORDER BY m.ended_at,s.match_id LIMIT $1`,[limit]);
  let recorded=0;
  // Independent transactions retain progress on failure; retries and concurrent runners are safe.
  for(const row of candidates.rows){
   if(signal?.aborted)break;
   if(await this.recordCompletion(row.match_id))recorded++;
  }
  return {scanned:candidates.rows.length,recorded};
 }
 /** Recovery-safe internal consumer; only a persisted normal finish qualifies. No client outcome accepted. */
 async recordCompletion(matchId:string):Promise<boolean>{
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(matchId))throw new PracticeError('INVALID_INPUT');
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s'");await client.query("SET LOCAL statement_timeout='10s'");
   const result=await client.query<{user_id:string;private_state:unknown;ended_at:Date|null}>(`SELECT s.user_id,m.private_state,m.ended_at FROM practice_starts s JOIN game_matches m ON m.id=s.match_id JOIN game_players p ON p.match_id=m.id AND p.user_id=s.user_id AND NOT p.is_bot WHERE s.match_id=$1 AND m.mode='PRACTICE' FOR SHARE OF m`,[matchId]);
   const row=result.rows[0];if(!row)throw new PracticeError('NOT_FOUND');const state=restoreGame(row.private_state);
   if(state.status!=='FINISHED'||state.reason!=='EMPTY_HAND'||!row.ended_at){await client.query('COMMIT');return false;}
   const added=await client.query('INSERT INTO practice_completions(match_id,user_id,completed_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING match_id',[matchId,row.user_id,row.ended_at]);
   if(added.rowCount)await client.query('INSERT INTO outbox_events(id,type,payload) VALUES($1,$2,$3)',[randomUUID(),'PRACTICE_COMPLETED',{matchId,userId:row.user_id}]);
   await client.query('COMMIT');return Boolean(added.rowCount);
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
}
