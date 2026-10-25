import { tasksStateSchema,taskClaimSchema } from './tasks.contracts';
const fixture={tasks:['MANDATORY_VIDEO_LOGIN','MANDATORY_VIDEO_UNLOCK','WIN_MATCH','BONUS_ALL_COMPLETE'].map(type=>({id:type,title:type,type,points:50,isCompleted:false,progress:0,target:1,status:'AVAILABLE',action:'NONE'})),optionalVideosWatchedToday:0,practiceMatchesUnlocked:0,freeMatchesRemaining:0,cooldownActive:false,cooldownSecondsLeft:0,allBonusClaimed:false,timeRemainingSeconds:3600};
describe('server task contracts',()=>{
 it('accepts real bounded state and rejects duplicate or inconsistent claims',()=>{
  expect(tasksStateSchema.parse(fixture).tasks).toHaveLength(4);
  expect(()=>tasksStateSchema.parse({...fixture,tasks:Array(4).fill(fixture.tasks[0])})).toThrow();
  expect(()=>tasksStateSchema.parse({...fixture,tasks:fixture.tasks.map(t=>({...t,status:'CLAIMED'}))})).toThrow();
 });
 it('accepts replay and bonus responses and rejects unbounded rewards',()=>{
  expect(taskClaimSchema.parse({pointsEarned:0,alreadyClaimed:true}).pointsEarned).toBe(0);
  expect(taskClaimSchema.parse({pointsEarned:100,alreadyClaimed:false}).pointsEarned).toBe(100);
  expect(()=>taskClaimSchema.parse({pointsEarned:999,alreadyClaimed:false})).toThrow();
 });
});
