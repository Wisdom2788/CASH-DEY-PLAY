import { describe,it,expect } from 'vitest';
import { rankedSnapshotSchema,viewSchema,secondsLeft } from './contracts';
const card={id:'CIRCLE-3',suit:'CIRCLE',number:3};
const view={version:0,ruleVersion:'whot-v1',status:'ACTIVE',winner:null,reason:null,seat:0,turn:0,hand:[card],opponentCount:6,top:card,marketCount:41,nominated:null,pendingCount:0,deadlineAt:10000,plays:[card.id],canDraw:true,canPass:false};
describe('ranked wire boundary',()=>{
 it('accepts own-hand projections and rejects hidden opponent hands or private snapshots',()=>{
  expect(viewSchema.safeParse(view).success).toBe(true);
  expect(viewSchema.safeParse({...view,opponentHand:[card]}).success).toBe(false);
  expect(viewSchema.safeParse({...view,market:[card]}).success).toBe(false);
  expect(viewSchema.safeParse({...view,private_state:{}}).success).toBe(false);
 });
 it('rejects legacy or client-authoritative snapshots',()=>{
  for(const input of [{winner:'you',reward:500},{protocolVersion:2},{phase:'IN_MATCH',match:{view}}])expect(rankedSnapshotSchema.safeParse(input).success).toBe(false);
 });
 it('uses server-relative deadlines only for display and clamps elapsed deadlines',()=>{
  expect(secondsLeft(10000,9001)).toBe(1);expect(secondsLeft(10000,10000)).toBe(0);expect(secondsLeft(10000,20000)).toBe(0);expect(secondsLeft(null,10000)).toBe(0);
 });
});
