import { Pool, PoolClient } from 'pg';
import { loadEntitlements } from './entitlements';
import { lagosDateOfInstant,secondsUntilNextLagosMidnight } from '../time/lagos-calendar-clock';
export const TASK_KEYS=['MANDATORY_VIDEO_LOGIN','MANDATORY_VIDEO_UNLOCK','WIN_MATCH','BONUS_ALL_COMPLETE'] as const;
type TaskKey=typeof TASK_KEYS[number];
interface DailyRow {task_key:TaskKey;status:'AVAILABLE'|'AUTO_READY'|'CLAIMED'}
export class TaskEligibilityError extends Error {}
export class DailyTasks {
 constructor(private readonly pool:Pool){}
 private async day(client:PoolClient,userId:string):Promise<{at:Date;date:string;rows:DailyRow[]}> {
  const locked=await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
  if(!locked.rowCount) throw new TaskEligibilityError('Registered player required');
  await client.query('SELECT o.id FROM premium_orders o JOIN paid_entitlements e ON e.order_id=o.id WHERE o.user_id=$1 FOR SHARE OF o,e',[userId]);
  await client.query('SELECT user_id FROM ad_free_days WHERE user_id=$1 FOR SHARE',[userId]);
  const instant=(await client.query<{at:Date;exact_at:string}>(`SELECT at,to_char(at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS exact_at FROM (SELECT clock_timestamp() AS at) instant`)).rows[0]!;
  const at=instant.at;
  const date=lagosDateOfInstant(at);const entitlements=await loadEntitlements(client,userId,instant.exact_at);
  for(const key of TASK_KEYS) await client.query("INSERT INTO daily_task_state(user_id,lagos_date,task_key,status) VALUES($1,$2,$3,'AVAILABLE') ON CONFLICT DO NOTHING",[userId,date,key]);
  await client.query(`UPDATE daily_task_state SET status=$3 WHERE user_id=$1 AND lagos_date=$2 AND task_key IN('MANDATORY_VIDEO_LOGIN','MANDATORY_VIDEO_UNLOCK') AND status<>'CLAIMED'`,[userId,date,entitlements.adFree?'AUTO_READY':'AVAILABLE']);
  return {at,date,rows:(await client.query<DailyRow>('SELECT task_key,status FROM daily_task_state WHERE user_id=$1 AND lagos_date=$2',[userId,date])).rows};
 }
 private async transaction<T>(fn:(c:PoolClient)=>Promise<T>):Promise<T>{const c=await this.pool.connect();try{await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='10s'");const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 async state(userId:string){return this.transaction(async c=>{
  const day=await this.day(c,userId);
  const ids=['task_login_video','task_unlock_video','task_win_match','task_all_complete'];
  const titles=['Watch Daily Login Video','Watch Match Unlock Video','Win 1 Ranked Match','Complete All Daily Tasks'];
  const tasks=TASK_KEYS.map((key,i)=>{const row=day.rows.find(r=>r.task_key===key)!;return {id:ids[i]!,title:titles[i]!,type:key,points:50,isCompleted:row.status==='CLAIMED',status:row.status,action:row.status==='CLAIMED'?'NONE':row.status==='AUTO_READY'?'CLAIM':i<2?'WATCH_VIDEO':'NONE',progress:row.status==='CLAIMED'?1:0,target:1};});
  return {tasks,lagosDate:day.date,allBonusClaimed:tasks.every(t=>t.isCompleted),timeRemainingSeconds:secondsUntilNextLagosMidnight(day.at),optionalVideosWatchedToday:0,practiceMatchesUnlocked:0,freeMatchesRemaining:0,cooldownActive:false,cooldownSecondsLeft:0,gameplayAvailable:false};
 });}
 async claim(userId:string,key:string){
  if(key!=='MANDATORY_VIDEO_LOGIN' && key!=='MANDATORY_VIDEO_UNLOCK')throw new TaskEligibilityError('Only server-eligible video exemptions may be claimed');
  return this.transaction(async c=>{
   const day=await this.day(c,userId);const row=day.rows.find(r=>r.task_key===key)!;
   if(row.status==='CLAIMED')return {pointsEarned:0,alreadyClaimed:true};
   if(row.status!=='AUTO_READY')throw new TaskEligibilityError('Verified ad completion or current exemption required');
   await this.award(c,userId,day.date,key,day.at,'EXEMPT');
   const n=await c.query<{n:number}>("SELECT count(*)::int AS n FROM daily_task_state WHERE user_id=$1 AND lagos_date=$2 AND task_key<>'BONUS_ALL_COMPLETE' AND status='CLAIMED'",[userId,day.date]);
   let pointsEarned=50;
   if(n.rows[0]!.n===3 && !day.rows.some(r=>r.task_key==='BONUS_ALL_COMPLETE'&&r.status==='CLAIMED')){await this.award(c,userId,day.date,'BONUS_ALL_COMPLETE',day.at,'ALL_COMPLETE');pointsEarned+=50;}
   return {pointsEarned,alreadyClaimed:false};
  });
 }
 private async award(c:PoolClient,userId:string,date:string,key:string,at:Date,source:string){
  await c.query("INSERT INTO task_claims(user_id,lagos_date,task_key,source_event) VALUES($1,$2,$3,$4)",[userId,date,key,`${date}:${key}`]);
  await c.query("UPDATE daily_task_state SET status='CLAIMED',source=$4,claimed_at=$5,points_awarded=50 WHERE user_id=$1 AND lagos_date=$2 AND task_key=$3",[userId,date,key,source,at]);
  await c.query('UPDATE users SET points=points+50,updated_at=$2 WHERE id=$1',[userId,at]);
  await c.query('INSERT INTO task_completions(user_id,completed_on,task_key) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[userId,date,key]);
  await c.query("INSERT INTO reward_audit_events(user_id,event_type,reason,triggering_rule) VALUES($1,'TASK_POINTS',$2,'daily-tasks-v1')",[userId,`${date}:${key}`]);
 }
}
