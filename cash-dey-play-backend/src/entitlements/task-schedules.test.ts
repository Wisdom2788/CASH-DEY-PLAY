import { taskScheduleForDate } from './task-schedules';
import { lagosDateOfInstant } from '../time/lagos-calendar-clock';
describe('daily catalogue rotation',()=>{
 it('is deterministic, budgeted and changes objective sets on adjacent dates across calendar boundaries',()=>{
  let previous='';
  for(let day=0;day<800;day++){
   const date=new Date(Date.UTC(2027,0,1)+day*86400000).toISOString().slice(0,10);
   const tasks=taskScheduleForDate(date);const keys=tasks.map(t=>t.key).sort().join(',');
   expect(tasks).toEqual(taskScheduleForDate(date));expect(tasks).toHaveLength(3);expect(new Set(tasks.map(t=>t.key)).size).toBe(3);
   expect(tasks.reduce((n,t)=>n+t.points,50)).toBe(200);expect(keys).not.toBe(previous);previous=keys;
  }
 });
 it('changes at Lagos midnight rather than the device or UTC date',()=>{
  const before=lagosDateOfInstant(new Date('2028-02-29T22:59:59.999Z'));const after=lagosDateOfInstant(new Date('2028-02-29T23:00:00Z'));
  expect(before).toBe('2028-02-29');expect(after).toBe('2028-03-01');expect(taskScheduleForDate(before)).not.toEqual(taskScheduleForDate(after));
 });
 it.each(['2026-02-30','2026-13-01','2026-1-01','not-a-date'])('rejects invalid date %s',date=>expect(()=>taskScheduleForDate(date)).toThrow('INVALID_TASK_DATE'));
});
