import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { restoreGame,projectGame } from '../game-engine/engine';
import { DailyTasks } from '../entitlements/daily-tasks';
/** Internal recovery consumer: no client-supplied winner, time, participant or reward. */
export class RankedSettlement {
 constructor(private readonly pool:Pool){}
 async settle(matchId:string):Promise<boolean>{
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(matchId))throw new Error('INVALID_MATCH');
  const c=await this.pool.connect();try{
   await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='10s'");
   const players=(await c.query<{user_id:string;seat:0|1}>(`SELECT user_id,seat FROM game_players WHERE match_id=$1 AND NOT is_bot ORDER BY user_id`,[matchId])).rows;
   if(players.length!==2)throw new Error('INVALID_RANKED_SOURCE');
   await c.query('SELECT id FROM users WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[players.map(p=>p.user_id)]);
   const row=(await c.query<{private_state:unknown;ended_at:Date;day:string;version:number}>(`SELECT private_state,ended_at,version,(ended_at AT TIME ZONE 'Africa/Lagos')::date::text AS day
    FROM game_matches WHERE id=$1 AND mode='RANKED' AND status='FINISHED' AND ended_at IS NOT NULL FOR SHARE`,[matchId])).rows[0];
   if(!row){await c.query('COMMIT');return false;}
   const state=restoreGame(row.private_state);
   const event=(await c.query<{id:string;occurred_at:Date;projected_response:unknown;command_type:string;actor_seat:0|1|null}>(`SELECT event_id AS id,occurred_at,projected_response,command_type,actor_seat FROM game_events WHERE match_id=$1 AND sequence=$2`,[matchId,row.version])).rows[0];
   const expected=event?.command_type==='TIMEOUT'?{seat0:projectGame(state,0),seat1:projectGame(state,1)}:event&&event.actor_seat!==null?projectGame(state,event.actor_seat):null;
   const reservations=await c.query(`SELECT user_id FROM ranked_reservations WHERE match_id=$1 AND state='STARTED' ORDER BY user_id`,[matchId]);
   if(state.status!=='FINISHED'||!state.reason||state.version!==row.version||!event||event.occurred_at.getTime()!==row.ended_at.getTime()||state.lastAt!==row.ended_at.getTime()||!expected||!isDeepStrictEqual(event.projected_response,expected)||reservations.rows.length!==2||reservations.rows.some((r,i)=>r.user_id!==players[i]!.user_id))throw new Error('INVALID_RANKED_SOURCE');
   const existing=await c.query('SELECT user_id FROM ranked_results WHERE match_id=$1',[matchId]);
   if(existing.rowCount){if(existing.rowCount!==2)throw new Error('INCOMPLETE_RANKED_RESULT');await c.query('COMMIT');return false;}
   for(const p of players){
    const outcome=state.winner===null?'DRAW':state.winner===p.seat?'WIN':'LOSS';
    await c.query(`INSERT INTO ranked_results(match_id,user_id,opponent_id,outcome,reason,finished_at,lagos_date,terminal_event_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
     [matchId,p.user_id,players.find(other=>other.user_id!==p.user_id)!.user_id,outcome,state.reason,row.ended_at,row.day,event.id]);
    if(outcome==='WIN')await new DailyTasks(this.pool).awardRankedWin(c,p.user_id,row.day,row.ended_at,matchId);
   }
   await c.query("INSERT INTO outbox_events(id,type,payload) VALUES($1,'RANKED_SETTLED',$2)",[randomUUID(),{matchId}]);
   await c.query('COMMIT');return true;
  }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
 }
 async recover(limit=100,signal?:AbortSignal):Promise<number>{
  if(!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new Error('INVALID_BATCH');
  if(signal?.aborted)return 0;
  const rows=(await this.pool.query<{id:string}>(`SELECT m.id FROM game_matches m WHERE m.mode='RANKED' AND m.status='FINISHED'
   AND EXISTS(SELECT 1 FROM ranked_reservations r WHERE r.match_id=m.id AND r.state='STARTED')
   AND (SELECT count(*) FROM ranked_results r WHERE r.match_id=m.id)<2 ORDER BY m.ended_at,m.id LIMIT $1`,[limit])).rows;
  let count=0,failed=0;for(const row of rows){if(signal?.aborted)break;try{if(await this.settle(row.id))count++;}catch{failed++;}}
  if(failed)throw new Error('RANKED_SETTLEMENT_RECOVERY_FAILURE');return count;
 }
}
