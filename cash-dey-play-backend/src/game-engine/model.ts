import { z } from 'zod';
export const SUITS=['CIRCLE','TRIANGLE','CROSS','SQUARE','STAR'] as const;
export type Suit=typeof SUITS[number];
export type Seat=0|1;
export interface Card {readonly id:string;readonly suit:Suit|'WHOT';readonly number:number}
const label=z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/);
export const rulesSchema=z.strictObject({
 version:label,deck:z.array(z.strictObject({suit:z.enum(SUITS),numbers:z.array(z.number().int().min(1).max(14)).min(1).max(14).refine(n=>new Set(n).size===n.length)})).length(5).refine(d=>new Set(d.map(s=>s.suit)).size===5),
 wildCount:z.number().int().min(1).max(10),initialHand:z.number().int().min(1).max(20),firstSeat:z.union([z.literal(0),z.literal(1)]),
 stacking:z.enum(['NONE','SAME_NUMBER']),drawMode:z.enum(['DRAW_AND_PASS','DRAW_THEN_PLAY']),voluntaryDraw:z.boolean(),
 penaltySkipsTurn:z.boolean(),marketRetainsTurn:z.boolean(),allowSpecialFinish:z.boolean(),lastCardPenalty:z.number().int().min(0).max(5),
 turnMs:z.number().int().min(1000).max(300000),maxActions:z.number().int().min(10).max(2000),timeout:z.enum(['FORFEIT','DRAW_AND_PASS']),
});
export type Rules=z.infer<typeof rulesSchema>;
export const commandSchema=z.discriminatedUnion('type',[
 z.strictObject({type:z.literal('PLAY'),cardId:label,chosenSuit:z.enum(SUITS).optional(),declareLast:z.boolean().optional()}),
 z.strictObject({type:z.literal('DRAW')}),z.strictObject({type:z.literal('PASS')}),z.strictObject({type:z.literal('FORFEIT')}),
]);
export type Command=z.infer<typeof commandSchema>;
export const actionSchema=z.strictObject({id:label,expectedVersion:z.number().int().nonnegative().safe(),command:commandSchema});
export interface Receipt {readonly id:string;readonly fingerprint:string;readonly version:number}
export interface GameState {
 readonly rules:Rules;readonly hands:readonly [readonly Card[],readonly Card[]];readonly market:readonly Card[];readonly discard:readonly Card[];
 readonly turn:Seat;readonly nominated:Suit|null;readonly pending:Readonly<{number:2|5;count:number}>|null;readonly drawnId:string|null;
 readonly version:number;readonly lastAt:number;readonly deadlineAt:number;readonly status:'ACTIVE'|'FINISHED';readonly winner:Seat|null;
 readonly reason:'EMPTY_HAND'|'FORFEIT'|'TIMEOUT'|'EXHAUSTED'|'ACTION_LIMIT'|null;readonly receipts:readonly Receipt[];
}
export interface Action {readonly id:string;readonly expectedVersion:number;readonly command:Command}
export type RandomInt=(maxExclusive:number)=>number;
export class GameError extends Error {constructor(readonly code:'INVALID_INPUT'|'ILLEGAL_MOVE'|'WRONG_TURN'|'STALE_VERSION'|'ACTION_CONFLICT'|'TERMINAL'|'EXPIRED'|'TOO_EARLY'|'INVALID_STATE'){super(code);}}
export const other=(seat:Seat):Seat=>seat===0?1:0;
export const special=(card:Card):boolean=>[1,2,5,8,14,20].includes(card.number);
export function validInstant(at:number):void {if(!Number.isSafeInteger(at)||at<0||at>Number.MAX_SAFE_INTEGER-300000)throw new GameError('INVALID_INPUT');}
export function freeze<T>(value:T):T {if(value!==null&&typeof value==='object'&&!Object.isFrozen(value)){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;}
export function boundedRandom(random:RandomInt,max:number):number{const n=random(max);if(!Number.isInteger(n)||n<0||n>=max)throw new GameError('INVALID_INPUT');return n;}
export function shuffle<T>(input:readonly T[],random:RandomInt):T[]{const out=[...input];for(let i=out.length-1;i>0;i--){const j=boundedRandom(random,i+1);[out[i],out[j]]=[out[j]!,out[i]!];}return out;}
export function buildDeck(rules:Rules):Card[]{return [...rules.deck.flatMap(group=>group.numbers.map(number=>({id:`${group.suit}-${number}`,suit:group.suit,number}))),...Array.from({length:rules.wildCount},(_,i)=>({id:`WHOT-${i}`,suit:'WHOT' as const,number:20}))];}
