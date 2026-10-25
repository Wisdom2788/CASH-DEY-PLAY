import { z } from 'zod';
import { Action,Card,Command,GameError,GameState,RandomInt,Rules,Seat,SUITS,actionSchema,buildDeck,freeze,other,rulesSchema,shuffle,special,validInstant } from './model';
type Mutable={-readonly [K in keyof GameState]:GameState[K]} & {hands:[Card[],Card[]];market:Card[];discard:Card[]};
const cardSchema=z.strictObject({id:z.string(),suit:z.enum([...SUITS,'WHOT']),number:z.number().int()});
const stateSchema=z.strictObject({rules:rulesSchema,hands:z.tuple([z.array(cardSchema),z.array(cardSchema)]),market:z.array(cardSchema),discard:z.array(cardSchema).min(1),turn:z.union([z.literal(0),z.literal(1)]),nominated:z.enum(SUITS).nullable(),pending:z.strictObject({number:z.union([z.literal(2),z.literal(5)]),count:z.number().int().positive().max(6000)}).nullable(),drawnId:z.string().nullable(),version:z.number().int().nonnegative(),lastAt:z.number().int().nonnegative(),deadlineAt:z.number().int().nonnegative(),status:z.enum(['ACTIVE','FINISHED']),winner:z.union([z.literal(0),z.literal(1)]).nullable(),reason:z.enum(['EMPTY_HAND','FORFEIT','TIMEOUT','EXHAUSTED','ACTION_LIMIT']).nullable(),receipts:z.array(z.strictObject({id:z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/),fingerprint:z.string().max(1024),version:z.number().int().positive()})).max(2000)});
const trusted=new WeakSet<object>();
export function assertConservation(state:GameState):void {
 const expected=new Map(buildDeck(state.rules).map(c=>[c.id,`${c.suit}:${c.number}`]));
 const cards=[...state.hands[0],...state.hands[1],...state.market,...state.discard];
 if(cards.length!==expected.size)throw new GameError('INVALID_STATE');
 for(const card of cards){if(expected.get(card.id)!==`${card.suit}:${card.number}`)throw new GameError('INVALID_STATE');expected.delete(card.id);}
 if(expected.size)throw new GameError('INVALID_STATE');
}
function seal(state:GameState):GameState {assertConservation(state);freeze(state);trusted.add(state);return state;}
export function restoreGame(input:unknown):GameState {
 const result=stateSchema.safeParse(input);if(!result.success)throw new GameError('INVALID_STATE');const s=result.data;
 validInstant(s.lastAt);
 if(s.receipts.length!==s.version||s.version>s.rules.maxActions||(s.status==='ACTIVE'&&s.version>=s.rules.maxActions)||new Set(s.receipts.map(r=>r.id)).size!==s.version||s.receipts.some((r,i)=>r.version!==i+1)||s.deadlineAt!==s.lastAt+s.rules.turnMs)throw new GameError('INVALID_STATE');
 if((s.status==='ACTIVE'&&(s.reason!==null||s.winner!==null||s.hands.some(h=>!h.length)))||(s.status==='FINISHED'&&(s.reason===null||((s.reason==='EXHAUSTED'||s.reason==='ACTION_LIMIT')!==(s.winner===null)))))throw new GameError('INVALID_STATE');
 if(s.status==='FINISHED'&&s.reason==='EMPTY_HAND'&&(s.winner===null||s.hands[s.winner].length!==0))throw new GameError('INVALID_STATE');
 if(s.status==='FINISHED'&&(s.reason==='FORFEIT'||s.reason==='TIMEOUT')&&(s.winner===null||s.winner===s.turn))throw new GameError('INVALID_STATE');
 if(s.status==='FINISHED'&&s.reason!=='EMPTY_HAND'&&s.hands.some(h=>!h.length))throw new GameError('INVALID_STATE');
 if(s.drawnId!==null&&(s.rules.drawMode!=='DRAW_THEN_PLAY'||s.pending!==null||!s.hands[s.turn].some(c=>c.id===s.drawnId)))throw new GameError('INVALID_STATE');
 const top=s.discard[s.discard.length-1]!;
 if((top.suit==='WHOT')!==(s.nominated!==null)||(s.pending!==null&&s.pending.number!==top.number))throw new GameError('INVALID_STATE');
 return seal(s);
}
export function createGame(input:Rules,at:number,random:RandomInt):GameState {
 validInstant(at);const parsed=rulesSchema.safeParse(input);if(!parsed.success)throw new GameError('INVALID_INPUT');const rules=parsed.data;
 const deck=shuffle(buildDeck(rules),random);if(deck.length<rules.initialHand*2+1)throw new GameError('INVALID_INPUT');
 const hands:[Card[],Card[]]=[[],[]];for(let i=0;i<rules.initialHand;i++)for(const seat of [0,1] as const)hands[seat].push(deck.pop()!);
 const opening=deck.findIndex(c=>!special(c));if(opening<0)throw new GameError('INVALID_INPUT');const first=deck.splice(opening,1)[0]!;
 return seal({rules,hands,market:deck,discard:[first],turn:rules.firstSeat,nominated:null,pending:null,drawnId:null,version:0,lastAt:at,deadlineAt:at+rules.turnMs,status:'ACTIVE',winner:null,reason:null,receipts:[]});
}
function stateOf(state:GameState):GameState{return trusted.has(state)?state:restoreGame(state);}
function playable(s:GameState,seat:Seat,card:Card):boolean {
 if(s.drawnId!==null&&card.id!==s.drawnId)return false;
 if(!s.rules.allowSpecialFinish&&s.hands[seat].length===1&&special(card))return false;
 if(s.pending)return s.rules.stacking==='SAME_NUMBER'&&card.number===s.pending.number;
 const top=s.discard[s.discard.length-1]!;
 return card.suit==='WHOT'||(s.nominated!==null?card.suit===s.nominated:card.suit===top.suit||card.number===top.number);
}
export function legalActions(state:GameState,seat:Seat){const s=stateOf(state);if((seat!==0&&seat!==1)||s.status!=='ACTIVE'||seat!==s.turn)return {plays:[] as string[],canDraw:false,canPass:false};
 const plays=s.hands[seat].filter(c=>playable(s,seat,c)).map(c=>c.id);
 return {plays,canDraw:s.drawnId===null&&(s.pending!==null||s.rules.voluntaryDraw||plays.length===0),canPass:s.drawnId!==null};
}
function mutable(s:GameState):Mutable{return {...s,hands:[[...s.hands[0]],[...s.hands[1]]],market:[...s.market],discard:[...s.discard]};}
function finish(s:Mutable,winner:Seat|null,reason:GameState['reason']):void{s.status='FINISHED';s.winner=winner;s.reason=reason;s.drawnId=null;}
function draw(s:Mutable,seat:Seat,count:number,random:RandomInt):Card[] {
 const drawn:Card[]=[];
 for(let i=0;i<count;i++){
  if(!s.market.length&&s.discard.length>1){const top=s.discard.pop()!;s.market=shuffle(s.discard,random);s.discard=[top];}
  if(!s.market.length){finish(s,null,'EXHAUSTED');break;}
  const card=s.market.pop()!;s.hands[seat].push(card);drawn.push(card);
 }return drawn;
}
function fingerprint(seat:Seat,version:number,command:Command|'TIMEOUT'):string{return JSON.stringify([command==='TIMEOUT'?'SERVER':seat,version,command]);}
function prepare(state:GameState,seat:Seat,id:string,version:number,command:Command|'TIMEOUT',at:number):{state:GameState;replay:boolean;fingerprint:string}{
 const s=stateOf(state);validInstant(at);
 if((seat!==0&&seat!==1)||!/^[A-Za-z0-9._:-]{1,128}$/.test(id)||!Number.isSafeInteger(version)||version<0)throw new GameError('INVALID_INPUT');
 const fp=fingerprint(seat,version,command);const receipt=s.receipts.find(r=>r.id===id);
 if(receipt){if(receipt.fingerprint!==fp)throw new GameError('ACTION_CONFLICT');return {state:s,replay:true,fingerprint:fp};}
 if(s.status!=='ACTIVE')throw new GameError('TERMINAL');if(version!==s.version)throw new GameError('STALE_VERSION');if(seat!==s.turn)throw new GameError('WRONG_TURN');if(at<s.lastAt)throw new GameError('INVALID_INPUT');
 if(command==='TIMEOUT'){if(at<s.deadlineAt)throw new GameError('TOO_EARLY');}else if(at>=s.deadlineAt)throw new GameError('EXPIRED');
 return {state:s,replay:false,fingerprint:fp};
}
function complete(s:Mutable,id:string,fp:string,at:number):GameState {
 s.version++;s.lastAt=at;s.deadlineAt=at+s.rules.turnMs;
 if(s.status==='ACTIVE'&&s.version>=s.rules.maxActions)finish(s,null,'ACTION_LIMIT');
 s.receipts=[...s.receipts,{id,fingerprint:fp,version:s.version}];return seal(s);
}
export function applyCommand(state:GameState,seat:Seat,action:Action,at:number,random:RandomInt):GameState {
 const parsed=actionSchema.safeParse(action);if(!parsed.success)throw new GameError('INVALID_INPUT');const command=parsed.data.command;
 const p=prepare(state,seat,action.id,action.expectedVersion,command,at);if(p.replay)return p.state;
 const s=mutable(p.state);const options=legalActions(p.state,seat);
 if(command.type==='FORFEIT')finish(s,other(seat),'FORFEIT');
 else if(command.type==='PASS'){if(!options.canPass)throw new GameError('ILLEGAL_MOVE');s.drawnId=null;s.turn=other(seat);}
 else if(command.type==='DRAW'){
  if(!options.canDraw)throw new GameError('ILLEGAL_MOVE');const pending=s.pending;const drawn=draw(s,seat,pending?.count??1,random);s.pending=null;
  if(s.status==='ACTIVE'){
   if(pending){s.turn=s.rules.penaltySkipsTurn?other(seat):seat;s.drawnId=null;}
   else if(s.rules.drawMode==='DRAW_THEN_PLAY'){s.drawnId=drawn[0]!.id;}
   else{s.turn=other(seat);s.drawnId=null;}
  }
 }else {
  if(!options.plays.includes(command.cardId))throw new GameError('ILLEGAL_MOVE');
  const index=s.hands[seat].findIndex(c=>c.id===command.cardId);const card=s.hands[seat][index]!;
  if((card.suit==='WHOT')!==(command.chosenSuit!==undefined))throw new GameError('INVALID_INPUT');
  if(command.declareLast&&s.hands[seat].length!==2)throw new GameError('INVALID_INPUT');
  s.hands[seat].splice(index,1);s.discard.push(card);s.nominated=command.chosenSuit??null;s.drawnId=null;
  if(!s.hands[seat].length)finish(s,seat,'EMPTY_HAND');
  else {
   if(s.hands[seat].length===1&&s.rules.lastCardPenalty>0&&!command.declareLast)draw(s,seat,s.rules.lastCardPenalty,random);
   if(s.status==='ACTIVE'){
    if(card.number===2||card.number===5){s.pending={number:card.number,count:(s.pending?.count??0)+(card.number===2?2:3)};s.turn=other(seat);}
    else if(card.number===1||card.number===8){s.turn=seat;}
    else if(card.number===14){draw(s,other(seat),1,random);s.turn=s.rules.marketRetainsTurn?seat:other(seat);}
    else{s.turn=other(seat);}
   }
  }
 }
 return complete(s,action.id,p.fingerprint,at);
}
/** Server-only timer transition. Never part of commandSchema or the client action union. */
export function applyTimeout(state:GameState,id:string,version:number,at:number,random:RandomInt):GameState {
 const current=stateOf(state);const p=prepare(current,current.turn,id,version,'TIMEOUT',at);if(p.replay)return p.state;const s=mutable(p.state);
 if(s.rules.timeout==='FORFEIT')finish(s,other(s.turn),'TIMEOUT');else{draw(s,s.turn,s.pending?.count??1,random);s.pending=null;s.drawnId=null;s.turn=other(s.turn);}
 return complete(s,id,p.fingerprint,at);
}
export function projectGame(state:GameState,seat:Seat){const s=stateOf(state);if(seat!==0&&seat!==1)throw new GameError('INVALID_INPUT');return freeze({version:s.version,ruleVersion:s.rules.version,status:s.status,winner:s.winner,reason:s.reason,seat,turn:s.turn,hand:s.hands[seat].map(c=>({...c})),opponentCount:s.hands[other(seat)].length,top:{...s.discard[s.discard.length-1]!},marketCount:s.market.length,nominated:s.nominated,pendingCount:s.pending?.count??0,deadlineAt:s.status==='ACTIVE'?s.deadlineAt:null,...legalActions(s,seat)});}
export type PlayerView=ReturnType<typeof projectGame>;
