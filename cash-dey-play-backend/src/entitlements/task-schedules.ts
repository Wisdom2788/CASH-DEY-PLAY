import { PoolClient } from 'pg';
import { z } from 'zod';
const keySchema=z.enum(['WIN_MATCH','RANKED_FINISH','RANKED_PLAY_CARDS','RANKED_SUITS']);
export type RotatingTaskKey=z.infer<typeof keySchema>;
const definitionSchema=z.array(z.strictObject({key:keySchema,title:z.string().min(1).max(160),target:z.number().int().min(1).max(50),points:z.literal(50)})).length(3).refine(tasks=>new Set(tasks.map(t=>t.key)).size===tasks.length,'Duplicate schedule key');
export type TaskDefinition=z.infer<typeof definitionSchema>[number];
function task(key:RotatingTaskKey,target:number):TaskDefinition {
 const title=key==='WIN_MATCH'?`Win ${target} ranked match${target===1?'':'es'}`:key==='RANKED_FINISH'?`Finish ${target} ranked match${target===1?'':'es'} without forfeiting or timing out`:key==='RANKED_PLAY_CARDS'?`Play ${target} cards in finished ranked matches`:`Play ${target} different ordinary suits in finished ranked matches`;
 return {key,title,target,points:50};
}
/** Calendar rotation, not randomness at login. Persisted definitions remain authoritative. */
export function taskScheduleForDate(date:string):TaskDefinition[]{
 const at=Date.parse(date+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(at)||new Date(at).toISOString().slice(0,10)!==date)throw new Error('INVALID_TASK_DATE');
 const sets=[
  [task('RANKED_FINISH',1),task('WIN_MATCH',1),task('RANKED_PLAY_CARDS',3)],
  [task('RANKED_FINISH',2),task('RANKED_PLAY_CARDS',5),task('RANKED_SUITS',2)],
  [task('WIN_MATCH',1),task('RANKED_PLAY_CARDS',3),task('RANKED_SUITS',2)],
  [task('RANKED_FINISH',1),task('WIN_MATCH',1),task('RANKED_SUITS',3)],
 ];
 return definitionSchema.parse(sets[((at/86400000)%sets.length+sets.length)%sets.length]);
}
export async function loadTaskSchedule(c:PoolClient,date:string):Promise<TaskDefinition[]|null>{
 const policy=(await c.query<{active:boolean}>('SELECT $1::date>=rotating_from AS active FROM daily_task_policy WHERE id',[date])).rows[0];
 if(!policy)throw new Error('TASK_POLICY_REQUIRED');
 if(!policy.active)return null;
 const definition=taskScheduleForDate(date);
 await c.query("INSERT INTO daily_task_schedules(lagos_date,version,definition) VALUES($1,'rotating-v2',$2) ON CONFLICT DO NOTHING",[date,JSON.stringify(definition)]);
 return definitionSchema.parse((await c.query<{definition:unknown}>('SELECT definition FROM daily_task_schedules WHERE lagos_date=$1',[date])).rows[0]!.definition);
}
