import { randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { loadTaskSchedule,TaskDefinition,RotatingTaskKey } from './task-schedules';
import { loadEntitlements } from './entitlements';
import { lagosDateOfInstant,secondsUntilNextLagosMidnight } from '../time/lagos-calendar-clock';
export const TASK_KEYS=['MANDATORY_VIDEO_LOGIN','MANDATORY_VIDEO_UNLOCK','WIN_MATCH','BONUS_ALL_COMPLETE'] as const;
type TaskKey=typeof TASK_KEYS[number]|RotatingTaskKey;
interface DailyRow {task_key:TaskKey;status:'AVAILABLE'|'AUTO_READY'|'CLAIMED';progress:number}
export class TaskEligibilityError extends Error {}
export class DailyTasks {
 constructor(private readonly pool:Pool){}
 private async day(client:PoolClient,userId:string):Promise<{at:Date;date:string;rows:DailyRow[];schedule:TaskDefinition[]|null}> {
  const locked=await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
  if(!locked.rowCount) throw new TaskEligibilityError('Registered player required');
  await client.query('SELECT o.id FROM premium_orders o JOIN paid_entitlements e ON e.order_id=o.id WHERE o.user_id=$1 FOR SHARE OF o,e',[userId]);
  await client.query('SELECT user_id FROM ad_free_days WHERE user_id=$1 FOR SHARE',[userId]);
  const instant=(await client.query<{at:Date;exact_at:string}>(`SELECT at,to_char(at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS exact_at FROM (SELECT clock_timestamp() AS at) instant`)).rows[0]!;
  const at=instant.at;
  const date=lagosDateOfInstant(at);const entitlements=await loadEntitlements(client,userId,instant.exact_at);
  const schedule=await loadTaskSchedule(client,date);
  if(schedule){
   await this.syncRotating(client,userId,date,at,schedule);
   return {at,date,schedule,rows:(await client.query<DailyRow>('SELECT task_key,status,progress FROM daily_task_state WHERE user_id=$1 AND lagos_date=$2',[userId,date])).rows};
  }
  for(const key of TASK_KEYS) await client.query("INSERT INTO daily_task_state(user_id,lagos_date,task_key,status) VALUES($1,$2,$3,'AVAILABLE') ON CONFLICT DO NOTHING",[userId,date,key]);
  await client.query(`UPDATE daily_task_state SET status=$3 WHERE user_id=$1 AND lagos_date=$2 AND task_key IN('MANDATORY_VIDEO_LOGIN','MANDATORY_VIDEO_UNLOCK') AND status<>'CLAIMED'`,[userId,date,entitlements.adFree?'AUTO_READY':'AVAILABLE']);
  return {at,date,schedule:null,rows:(await client.query<DailyRow>('SELECT task_key,status FROM daily_task_state WHERE user_id=$1 AND lagos_date=$2',[userId,date])).rows};
 }
 private async transaction<T>(fn:(c:PoolClient)=>Promise<T>):Promise<T>{const c=await this.pool.connect();try{await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='10s'");const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 async state(userId:string){return this.transaction(async c=>{
  const day=await this.day(c,userId);
  if(day.schedule){
   const definitions=[...day.schedule,{key:'BONUS_ALL_COMPLETE' as const,title:'Complete today’s three objectives',target:day.schedule.length,points:50}];
   const tasks=definitions.map(def=>{const row=day.rows.find(r=>r.task_key===def.key)!;return {id:`${day.date}:${def.key}`,title:def.title,type:def.key,points:def.points,isCompleted:row.status==='CLAIMED',status:row.status,action:row.status==='CLAIMED'||def.key==='BONUS_ALL_COMPLETE'?'NONE' as const:'PLAY_RANKED' as const,progress:row.progress,target:def.target};});
   return {tasks,lagosDate:day.date,scheduleVersion:'rotating-v2',maxPoints:200,pointsBalance:(await c.query<{points:number}>('SELECT points FROM users WHERE id=$1',[userId])).rows[0]!.points,allBonusClaimed:tasks.every(t=>t.isCompleted),timeRemainingSeconds:secondsUntilNextLagosMidnight(day.at),optionalVideosWatchedToday:0,practiceMatchesUnlocked:0,freeMatchesRemaining:0,cooldownActive:false,cooldownSecondsLeft:0,gameplayAvailable:false};
  }
  const ids=['task_login_video','task_unlock_video','task_win_match','task_all_complete'];
  const titles=['Watch Daily Login Video','Watch Match Unlock Video','Win 1 Ranked Match','Complete All Daily Tasks'];
  const tasks=TASK_KEYS.map((key,i)=>{const row=day.rows.find(r=>r.task_key===key)!;return {id:ids[i]!,title:titles[i]!,type:key,points:50,isCompleted:row.status==='CLAIMED',status:row.status,action:row.status==='CLAIMED'?'NONE':row.status==='AUTO_READY'?'CLAIM':i<2?'WATCH_VIDEO':'NONE',progress:row.status==='CLAIMED'?1:0,target:1};});
  return {tasks,lagosDate:day.date,scheduleVersion:'legacy-v1',maxPoints:200,allBonusClaimed:tasks.every(t=>t.isCompleted),timeRemainingSeconds:secondsUntilNextLagosMidnight(day.at),optionalVideosWatchedToday:0,practiceMatchesUnlocked:0,freeMatchesRemaining:0,cooldownActive:false,cooldownSecondsLeft:0,gameplayAvailable:false};
 });}
 async claim(userId:string,key:string){
  if(key!=='MANDATORY_VIDEO_LOGIN' && key!=='MANDATORY_VIDEO_UNLOCK')throw new TaskEligibilityError('Only server-eligible video exemptions may be claimed');
  return this.transaction(async c=>{
   const day=await this.day(c,userId);if(day.schedule)throw new TaskEligibilityError('Rotating tasks require verified gameplay; client claims are unavailable');const row=day.rows.find(r=>r.task_key===key)!;
   if(row.status==='CLAIMED')return {pointsEarned:0,alreadyClaimed:true};
   if(row.status!=='AUTO_READY')throw new TaskEligibilityError('Verified ad completion or current exemption required');
   await this.award(c,userId,day.date,key,day.at,'EXEMPT');
   const n=await c.query<{n:number}>("SELECT count(*)::int AS n FROM daily_task_state WHERE user_id=$1 AND lagos_date=$2 AND task_key<>'BONUS_ALL_COMPLETE' AND status='CLAIMED'",[userId,day.date]);
   let pointsEarned=50;
   if(n.rows[0]!.n===3 && !day.rows.some(r=>r.task_key==='BONUS_ALL_COMPLETE'&&r.status==='CLAIMED')){await this.award(c,userId,day.date,'BONUS_ALL_COMPLETE',day.at,'ALL_COMPLETE');pointsEarned+=50;}
   return {pointsEarned,alreadyClaimed:false};
  });
 }
 /** Settlement owns the player lock. Identity/date/outcome come only from its immutable receipt. */
 async recordRankedResult(c:PoolClient,userId:string,matchId:string):Promise<number>{
  const result=(await c.query<{day:string;finished_at:Date;outcome:string}>('SELECT lagos_date::text AS day,finished_at,outcome FROM ranked_results WHERE user_id=$1 AND match_id=$2',[userId,matchId])).rows[0];
  if(!result)throw new TaskEligibilityError('Verified ranked result required');
  const schedule=await loadTaskSchedule(c,result.day);
  if(schedule)return this.syncRotating(c,userId,result.day,result.finished_at,schedule);
  return result.outcome==='WIN'?this.awardRankedWin(c,userId,result.day,result.finished_at,matchId):0;
 }
 private async syncRotating(c:PoolClient,userId:string,date:string,at:Date,schedule:TaskDefinition[]):Promise<number>{
  for(const key of [...schedule.map(t=>t.key),'BONUS_ALL_COMPLETE'])await c.query("INSERT INTO daily_task_state(user_id,lagos_date,task_key,status) VALUES($1,$2,$3,'AVAILABLE') ON CONFLICT DO NOTHING",[userId,date,key]);
  const verified=(await c.query<{finishes:number;wins:number;plays:number;suits:number;latest:string|null}>(`
   SELECT count(DISTINCT r.match_id)::int AS finishes,count(DISTINCT r.match_id) FILTER(WHERE r.outcome='WIN')::int AS wins,
    count(e.event_id)::int AS plays,count(DISTINCT CASE WHEN e.projected_response->'top'->>'suit' IN('CIRCLE','TRIANGLE','CROSS','SQUARE','STAR') THEN e.projected_response->'top'->>'suit' END)::int AS suits,
    max(r.finished_at)::text AS latest
   FROM ranked_results r LEFT JOIN game_events e ON e.match_id=r.match_id AND e.actor_user_id=r.user_id AND e.command_type='PLAY'
   WHERE r.user_id=$1 AND r.lagos_date=$2 AND (r.outcome='WIN' OR r.reason NOT IN('FORFEIT','TIMEOUT'))`,[userId,date])).rows[0]!;
  const progress:Record<RotatingTaskKey,number>={RANKED_FINISH:verified.finishes,WIN_MATCH:verified.wins,RANKED_PLAY_CARDS:verified.plays,RANKED_SUITS:verified.suits};
  const rows=(await c.query<DailyRow>('SELECT task_key,status,progress FROM daily_task_state WHERE user_id=$1 AND lagos_date=$2',[userId,date])).rows;
  let points=0;const awardedAt=verified.latest??at;
  for(const def of schedule){
   const row=rows.find(r=>r.task_key===def.key)!;if(row.status==='CLAIMED')continue;
   const value=Math.min(def.target,progress[def.key]);
   await c.query('UPDATE daily_task_state SET progress=$4 WHERE user_id=$1 AND lagos_date=$2 AND task_key=$3',[userId,date,def.key,value]);
   if(value===def.target){await this.award(c,userId,date,def.key,awardedAt,'VERIFIED_RANKED_RESULTS',def.target,'rotating-v2');row.status='CLAIMED';points+=50;}
  }
  const completed=schedule.filter(def=>rows.some(r=>r.task_key===def.key&&r.status==='CLAIMED')).length;
  const bonus=rows.find(r=>r.task_key==='BONUS_ALL_COMPLETE')!;
  if(bonus.status!=='CLAIMED'){
   await c.query("UPDATE daily_task_state SET progress=$3 WHERE user_id=$1 AND lagos_date=$2 AND task_key='BONUS_ALL_COMPLETE'",[userId,date,completed]);
   if(completed===schedule.length){await this.award(c,userId,date,'BONUS_ALL_COMPLETE',awardedAt,'ALL_SCHEDULED_COMPLETE',completed,'rotating-v2');points+=50;}
  }
  return points;
 }
 /** Internal settlement hook. Caller holds the user lock and commits the result receipt atomically. */
 async awardRankedWin(c:PoolClient,userId:string,date:string,at:Date,matchId:string):Promise<number>{
  const schedule=await loadTaskSchedule(c,date);if(schedule)return this.syncRotating(c,userId,date,at,schedule);
  for(const key of TASK_KEYS)await c.query("INSERT INTO daily_task_state(user_id,lagos_date,task_key,status) VALUES($1,$2,$3,'AVAILABLE') ON CONFLICT DO NOTHING",[userId,date,key]);
  const rows=(await c.query<DailyRow>('SELECT task_key,status FROM daily_task_state WHERE user_id=$1 AND lagos_date=$2',[userId,date])).rows;
  let points=0;
  if(!rows.some(r=>r.task_key==='WIN_MATCH'&&r.status==='CLAIMED')){await this.award(c,userId,date,'WIN_MATCH',at,'RANKED_RESULT:'+matchId);points+=50;}
  if(rows.filter(r=>r.task_key.startsWith('MANDATORY_VIDEO')&&r.status==='CLAIMED').length===2&&!rows.some(r=>r.task_key==='BONUS_ALL_COMPLETE'&&r.status==='CLAIMED')){
   await this.award(c,userId,date,'BONUS_ALL_COMPLETE',at,'ALL_COMPLETE');points+=50;
  }
  return points;
 }
 private async award(c:PoolClient,userId:string,date:string,key:string,at:Date|string,source:string,progress=1,version='daily-tasks-v1'){
  await c.query("INSERT INTO task_claims(user_id,lagos_date,task_key,source_event) VALUES($1,$2,$3,$4)",[userId,date,key,`${date}:${key}`]);
  await c.query("UPDATE daily_task_state SET status='CLAIMED',source=$4,claimed_at=$5,points_awarded=50,progress=$6 WHERE user_id=$1 AND lagos_date=$2 AND task_key=$3",[userId,date,key,source,at,progress]);
  await c.query('UPDATE users SET points=points+50,updated_at=greatest(updated_at,$2) WHERE id=$1',[userId,at]);
  await c.query('INSERT INTO task_completions(user_id,completed_on,task_key) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[userId,date,key]);
  await c.query("INSERT INTO reward_audit_events(user_id,event_type,reason,triggering_rule) VALUES($1,'TASK_POINTS',$2,$3)",[userId,`${date}:${key}`,version]);
  await c.query('INSERT INTO outbox_events(id,type,payload) VALUES($1,$2,$3)',[randomUUID(),'TASK_CLAIMED',{userId,lagosDate:date,taskKey:key,points:50}]);
 }
}
