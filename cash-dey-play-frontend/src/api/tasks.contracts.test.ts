import { tasksStateSchema,taskClaimSchema } from './tasks.contracts';
const fixture={tasks:['MANDATORY_VIDEO_LOGIN','MANDATORY_VIDEO_UNLOCK','WIN_MATCH','BONUS_ALL_COMPLETE'].map(type=>({id:type,title:type,type,points:50,isCompleted:false,progress:0,target:1,status:'AVAILABLE',action:'NONE'})),optionalVideosWatchedToday:0,practiceMatchesUnlocked:0,freeMatchesRemaining:0,cooldownActive:false,cooldownSecondsLeft:0,allBonusClaimed:false,timeRemainingSeconds:3600};
describe('server task contracts',()=>{
 it('accepts real bounded state and rejects duplicate or inconsistent claims',()=>{
  expect(tasksStateSchema.parse(fixture).tasks).toHaveLength(4);
  expect(()=>tasksStateSchema.parse({...fixture,tasks:Array(4).fill(fixture.tasks[0])})).toThrow();
  expect(()=>tasksStateSchema.parse({...fixture,tasks:fixture.tasks.map(t=>({...t,status:'CLAIMED'}))})).toThrow();
 });
 it('accepts rotating progress and variable scheduled counts but rejects overflow and false completion',()=>{
  const tasks=[{id:'cards',type:'RANKED_PLAY_CARDS',title:'Play 3 cards',points:50,target:3,progress:2,isCompleted:false,status:'AVAILABLE',action:'PLAY_RANKED'},{id:'win',type:'WIN_MATCH',title:'Win 1',points:50,target:1,progress:0,isCompleted:false,status:'AVAILABLE',action:'PLAY_RANKED'},{id:'bonus',type:'BONUS_ALL_COMPLETE',title:'Complete objectives',points:50,target:2,progress:0,isCompleted:false,status:'AVAILABLE',action:'NONE'}];
  expect(tasksStateSchema.parse({...fixture,tasks,scheduleVersion:'rotating-v2',lagosDate:'2026-10-27',maxPoints:200}).tasks).toHaveLength(3);
  expect(()=>tasksStateSchema.parse({...fixture,tasks:tasks.map(t=>({...t,progress:9}))})).toThrow();
  expect(()=>tasksStateSchema.parse({...fixture,tasks,allBonusClaimed:true})).toThrow();
 });
 it('accepts replay and bonus responses and rejects unbounded rewards',()=>{
  expect(taskClaimSchema.parse({pointsEarned:0,alreadyClaimed:true}).pointsEarned).toBe(0);
  expect(taskClaimSchema.parse({pointsEarned:100,alreadyClaimed:false}).pointsEarned).toBe(100);
  expect(()=>taskClaimSchema.parse({pointsEarned:999,alreadyClaimed:false})).toThrow();
 });
});
