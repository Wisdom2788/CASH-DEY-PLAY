import { freeze, Rules, rulesSchema } from './model';

/** Owner approved 25 October 2026. Existing matches retain their persisted rules. */
export const APPROVED_WHOT_RULES:Rules=freeze(rulesSchema.parse({version:'whot-v1',deck:[{suit:'CIRCLE',numbers:[1,2,3,4,5,7,8,10,11,12,13,14]},{suit:'TRIANGLE',numbers:[1,2,3,4,5,7,8,10,11,12,13,14]},{suit:'CROSS',numbers:[1,2,3,5,7,10,11,13,14]},{suit:'SQUARE',numbers:[1,2,3,5,7,10,11,13,14]},{suit:'STAR',numbers:[1,2,3,4,5,7,8]}],wildCount:5,initialHand:6,firstSeat:0,stacking:'NONE',drawMode:'DRAW_AND_PASS',voluntaryDraw:true,penaltySkipsTurn:true,marketRetainsTurn:true,allowSpecialFinish:true,lastCardPenalty:0,turnMs:30000,maxActions:500,timeout:'FORFEIT'}));
