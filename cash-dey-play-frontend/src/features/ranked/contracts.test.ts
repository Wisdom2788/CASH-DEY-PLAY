import { describe,it,expect } from 'vitest';
import { rankedSnapshotSchema,rankedActionReplySchema,mergeRankedView,viewSchema,secondsLeft } from './contracts';
const card={id:'CIRCLE-3',suit:'CIRCLE',number:3};
const view={version:0,ruleVersion:'whot-v1',status:'ACTIVE',winner:null,reason:null,seat:0,turn:0,hand:[card],opponentCount:6,top:card,marketCount:41,nominated:null,pendingCount:0,deadlineAt:10000,plays:[card.id],canDraw:true,canPass:false};
describe('ranked wire boundary',()=>{
 it('accepts own-hand projections and rejects hidden opponent hands or private snapshots',()=>{
  expect(viewSchema.safeParse(view).success).toBe(true);
  expect(viewSchema.safeParse({...view,opponentHand:[card]}).success).toBe(false);
  expect(viewSchema.safeParse({...view,market:[card]}).success).toBe(false);
  expect(viewSchema.safeParse({...view,private_state:{}}).success).toBe(false);
 });
 it('accepts the gateway move reply without pretending it is a full session snapshot',()=>{
  const reply={ok:true,data:{matchId:'11111111-1111-4111-8111-111111111111',view}};
  expect(rankedActionReplySchema.safeParse(reply).success).toBe(true);
  expect(rankedSnapshotSchema.safeParse(reply.data).success).toBe(false);
  expect(rankedActionReplySchema.safeParse({...reply,data:{...reply.data,winner:'you',reward:500}}).success).toBe(false);
 });
 it('never regresses a newer view or replaces another match, and preserves an active search',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  const current=rankedSnapshotSchema.parse({protocolVersion:1,serverTime:1,phase:'IN_MATCH',match:{id,mode:'RANKED',view:{...view,version:2}},ranked:{stats:{played:0,wins:0,losses:0,draws:0,taskDays:0,practice:0,month:'2026-10',eligible:false},ticket:null,offer:null,allowance:{day:'2026-10-26',used:1,reserved:0,remaining:2,cooldownUntil:null,resetAt:10000,isPremium:false},penalty:{misses:0,lockedUntil:null},rematches:[],recentOpponents:[],result:null}});
  expect(mergeRankedView(current,{matchId:id,view:viewSchema.parse({...view,version:1})})).toBe(current);
  expect(mergeRankedView(current,{matchId:'22222222-2222-4222-8222-222222222222',view:viewSchema.parse({...view,version:3})})).toBe(current);
  const ended=viewSchema.parse({...view,version:3,status:'FINISHED',winner:0,reason:'FORFEIT',deadlineAt:null});
  expect(mergeRankedView(current,{matchId:id,view:ended}).phase).toBe('RESULT');
  expect(mergeRankedView({...current,phase:'SEARCHING'},{matchId:id,view:ended}).phase).toBe('SEARCHING');
 });
 it('rejects legacy or client-authoritative snapshots',()=>{
  for(const input of [{winner:'you',reward:500},{protocolVersion:2},{phase:'IN_MATCH',match:{view}}])expect(rankedSnapshotSchema.safeParse(input).success).toBe(false);
 });
 it('uses server-relative deadlines only for display and clamps elapsed deadlines',()=>{
  expect(secondsLeft(10000,9001)).toBe(1);expect(secondsLeft(10000,10000)).toBe(0);expect(secondsLeft(10000,20000)).toBe(0);expect(secondsLeft(null,10000)).toBe(0);
 });
});
