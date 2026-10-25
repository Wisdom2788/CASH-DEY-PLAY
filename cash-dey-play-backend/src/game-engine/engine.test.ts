import { applyCommand,applyTimeout,assertConservation,createGame,projectGame,restoreGame } from './engine';
import { buildDeck,Card,GameState,Rules } from './model';
import { cryptoRandomInt,recordRandom,replayRandom } from './crypto-random';
import { chooseBotCommand } from './bot';
// Proposal only. No application runtime imports this fixture or selects default rules.
const proposal:Rules={version:'proposal-v1',deck:[{suit:'CIRCLE',numbers:[1,2,3,4,5,7,8,10,11,12,13,14]},{suit:'TRIANGLE',numbers:[1,2,3,4,5,7,8,10,11,12,13,14]},{suit:'CROSS',numbers:[1,2,3,5,7,10,11,13,14]},{suit:'SQUARE',numbers:[1,2,3,5,7,10,11,13,14]},{suit:'STAR',numbers:[1,2,3,4,5,7,8]}],wildCount:5,initialHand:6,firstSeat:0,stacking:'NONE',drawMode:'DRAW_AND_PASS',voluntaryDraw:true,penaltySkipsTurn:true,marketRetainsTurn:true,allowSpecialFinish:true,lastCardPenalty:0,turnMs:30000,maxActions:500,timeout:'FORFEIT'};
const random=(max:number)=>max-1;
function fixture(h0:string[],h1:string[],top:string,overrides:Partial<Rules>={},extra:Partial<GameState>={}):GameState {
 const rules={...proposal,...overrides};const cards=buildDeck(rules);const get=(id:string):Card=>{const c=cards.find(c=>c.id===id);if(!c)throw new Error('Bad fixture');return c;};
 const used=[...h0,...h1,top];return restoreGame({...createGame(rules,100,random),hands:[h0.map(get),h1.map(get)],market:cards.filter(c=>!used.includes(c.id)),discard:[get(top)],...extra});
}
function marketFixture(discardIds:string[]):GameState {
 const cards=buildDeck(proposal),get=(id:string)=>cards.find(c=>c.id===id)!;const own=['CIRCLE-4'];
 const used=new Set([...own,...discardIds]);const opponent=cards.filter(c=>!used.has(c.id));
 return restoreGame({...createGame(proposal,100,random),hands:[own.map(get),opponent],market:[],discard:discardIds.map(get)});
}
function play(s:GameState,id:string,chosenSuit?:'CIRCLE'|'SQUARE'){return applyCommand(s,s.turn,{id:`action-${s.version}`,expectedVersion:s.version,command:{type:'PLAY',cardId:id,...(chosenSuit?{chosenSuit}:{})}},s.lastAt+1,random);}
describe('pure configurable Whot engine',()=>{
 it('constructs the explicit proposed54-card multiset and deals without mutating inputs',()=>{
  expect(buildDeck(proposal)).toHaveLength(54);expect(new Set(buildDeck(proposal).map(c=>c.id)).size).toBe(54);
  const state=createGame(proposal,100,random);expect(state.hands.map(h=>h.length)).toEqual([6,6]);expect(state.market).toHaveLength(41);
  expect([1,2,5,8,14,20]).not.toContain(state.discard[0]!.number);expect(Object.isFrozen(state.hands[0])).toBe(true);assertConservation(state);
 });
 it.each([()=>-1,()=>0.5,(max:number)=>max])('rejects biased-out-of-range adapter output',bad=>{expect(()=>createGame(proposal,100,bad)).toThrow('INVALID_INPUT');});
 it('rejects duplicate/missing physical cards and invalid restored outcomes',()=>{
  const s=fixture(['CIRCLE-4'],['SQUARE-3'],'CIRCLE-3');expect(()=>restoreGame({...s,market:[]})).toThrow('INVALID_STATE');
  expect(()=>restoreGame({...s,status:'FINISHED',reason:'EMPTY_HAND',winner:0})).toThrow('INVALID_STATE');
  expect(()=>createGame({...proposal,deck:[...proposal.deck.slice(1),proposal.deck[1]!]},100,random)).toThrow('INVALID_INPUT');
 });
 it('requires ownership, turn, version and a legal match',()=>{
  const s=fixture(['CIRCLE-4','SQUARE-3'],['STAR-3'],'CIRCLE-3');const act={id:'test',expectedVersion:0,command:{type:'PLAY' as const,cardId:'STAR-3'}};
  expect(()=>applyCommand(s,0,act,101,random)).toThrow('ILLEGAL_MOVE');expect(()=>applyCommand(s,1,act,101,random)).toThrow('WRONG_TURN');
  expect(()=>applyCommand(s,0,{...act,expectedVersion:1},101,random)).toThrow('STALE_VERSION');
  expect(()=>applyCommand(s,0,{...act,command:{type:'PLAY',cardId:'unknown'}},101,random)).toThrow('ILLEGAL_MOVE');
  expect(()=>applyCommand(s,0,{...act,command:{type:'PLAY',cardId:'CIRCLE-4',chosenSuit:'CIRCLE'}},101,random)).toThrow('INVALID_INPUT');
  expect(play(s,'CIRCLE-4').turn).toBe(1);expect(s.version).toBe(0);
 });
 it.each([1,8])('applies skip card%s in two-seat play',number=>{expect(play(fixture([`CIRCLE-${number}`,'SQUARE-3'],['STAR-3'],'CIRCLE-3'),`CIRCLE-${number}`).turn).toBe(0);});
 it.each([[2,2],[5,3]])('handles penalty%s drawing%s and same-number stacking only when enabled',(number,count)=>{
  const s=play(fixture([`CIRCLE-${number}`,'SQUARE-3'],[`TRIANGLE-${number}`,'STAR-3'],'CIRCLE-3'),`CIRCLE-${number}`);
  expect(s.pending?.count).toBe(count);expect(()=>play(s,`TRIANGLE-${number}`)).toThrow('ILLEGAL_MOVE');
  const drawn=applyCommand(s,1,{id:'draw',expectedVersion:1,command:{type:'DRAW'}},102,random);expect(drawn.hands[1]).toHaveLength(2+count);expect(drawn.turn).toBe(0);expect(drawn.pending).toBeNull();
  const stacked=play(play(fixture([`CIRCLE-${number}`,'SQUARE-3'],[`TRIANGLE-${number}`,'STAR-3'],'CIRCLE-3',{stacking:'SAME_NUMBER'}),`CIRCLE-${number}`),`TRIANGLE-${number}`);expect(stacked.pending?.count).toBe(count*2);assertConservation(stacked);
 });
 it('applies market and wild nomination without accepting a fabricated suit',()=>{
  const market=play(fixture(['CIRCLE-14','SQUARE-3'],['STAR-3'],'CIRCLE-3'),'CIRCLE-14');expect(market.hands[1]).toHaveLength(2);expect(market.turn).toBe(0);
  const s=fixture(['WHOT-0','CIRCLE-4'],['STAR-3','SQUARE-3'],'CIRCLE-3');expect(()=>play(s,'WHOT-0')).toThrow('INVALID_INPUT');
  const wild=play(s,'WHOT-0','SQUARE');expect(()=>play(wild,'STAR-3')).toThrow('ILLEGAL_MOVE');expect(play(wild,'SQUARE-3').nominated).toBeNull();
 });
 it('restricts draw-then-play to the drawn card and allows pass only afterward',()=>{
  const s=fixture(['CIRCLE-4','SQUARE-3'],['STAR-3'],'CIRCLE-3',{drawMode:'DRAW_THEN_PLAY'});
  expect(()=>applyCommand(s,0,{id:'pass',expectedVersion:0,command:{type:'PASS'}},101,random)).toThrow('ILLEGAL_MOVE');
  const d=applyCommand(s,0,{id:'draw',expectedVersion:0,command:{type:'DRAW'}},101,random);expect(d.turn).toBe(0);expect(d.drawnId).not.toBeNull();
  expect(()=>play(d,'CIRCLE-4')).toThrow('ILLEGAL_MOVE');expect(()=>applyCommand(d,0,{id:'draw2',expectedVersion:1,command:{type:'DRAW'}},102,random)).toThrow('ILLEGAL_MOVE');
  expect(applyCommand(d,0,{id:'pass',expectedVersion:1,command:{type:'PASS'}},102,random).turn).toBe(1);
 });
 it('rejects optional draws under the disabled policy and safely reshuffles only older discards',()=>{
  const noVoluntary=fixture(['CIRCLE-4','SQUARE-3'],['STAR-3'],'CIRCLE-3',{voluntaryDraw:false});
  expect(()=>applyCommand(noVoluntary,0,{id:'optional-draw',expectedVersion:0,command:{type:'DRAW'}},101,random)).toThrow('ILLEGAL_MOVE');
  const s=marketFixture(['CIRCLE-3','SQUARE-3']);const d=applyCommand(s,0,{id:'reshuffle',expectedVersion:0,command:{type:'DRAW'}},101,random);
  expect(d.hands[0].map(c=>c.id)).toContain('CIRCLE-3');expect(d.discard.map(c=>c.id)).toEqual(['SQUARE-3']);expect(d.market).toHaveLength(0);assertConservation(d);
 });
 it('ends as an unawarded draw when no drawable card remains and applies timeout draw policy',()=>{
  const empty=marketFixture(['SQUARE-3']);const end=applyCommand(empty,0,{id:'empty-market',expectedVersion:0,command:{type:'DRAW'}},101,random);
  expect(end).toMatchObject({status:'FINISHED',winner:null,reason:'EXHAUSTED'});assertConservation(end);
  const timeout=fixture(['CIRCLE-4','SQUARE-3'],['STAR-3'],'CIRCLE-3',{timeout:'DRAW_AND_PASS'});
  const t=applyTimeout(timeout,'server-timer',0,timeout.deadlineAt,random);expect(t.status).toBe('ACTIVE');expect(t.turn).toBe(1);expect(t.hands[0]).toHaveLength(3);
 });
 it('supports declaration penalties and explicit special finishing policy',()=>{
  const s=fixture(['CIRCLE-4','SQUARE-3'],['STAR-3'],'CIRCLE-3',{lastCardPenalty:2});expect(play(s,'CIRCLE-4').hands[0]).toHaveLength(3);
  const declared=applyCommand(s,0,{id:'declared',expectedVersion:0,command:{type:'PLAY',cardId:'CIRCLE-4',declareLast:true}},101,random);expect(declared.hands[0]).toHaveLength(1);
  expect(play(fixture(['CIRCLE-2'],['STAR-3'],'CIRCLE-3'),'CIRCLE-2')).toMatchObject({status:'FINISHED',winner:0,reason:'EMPTY_HAND'});
  expect(()=>play(fixture(['CIRCLE-2'],['STAR-3'],'CIRCLE-3',{allowSpecialFinish:false}),'CIRCLE-2')).toThrow('ILLEGAL_MOVE');
 });
 it('deduplicates identical actions before version/terminal checks and rejects changed payloads',()=>{
  const s=fixture(['CIRCLE-4'],['STAR-3'],'CIRCLE-3');const a={id:'once',expectedVersion:0,command:{type:'PLAY' as const,cardId:'CIRCLE-4'}};const end=applyCommand(s,0,a,101,random);
  expect(applyCommand(end,0,a,200,random)).toBe(end);expect(()=>applyCommand(end,0,{...a,command:{type:'DRAW'}},200,random)).toThrow('ACTION_CONFLICT');
  expect(()=>applyCommand(end,1,{id:'new',expectedVersion:1,command:{type:'DRAW'}},200,random)).toThrow('TERMINAL');
 });
 it('separates server timeout, rejects boundary moves and cannot award two outcomes',()=>{
  const s=fixture(['CIRCLE-4'],['STAR-3'],'CIRCLE-3');const a={id:'late',expectedVersion:0,command:{type:'PLAY' as const,cardId:'CIRCLE-4'}};
  expect(()=>applyCommand(s,0,a,s.deadlineAt,random)).toThrow('EXPIRED');expect(()=>applyTimeout(s,'timer',0,s.deadlineAt-1,random)).toThrow('TOO_EARLY');
  const end=applyTimeout(s,'timer',0,s.deadlineAt,random);expect(end).toMatchObject({winner:1,reason:'TIMEOUT'});expect(applyTimeout(end,'timer',0,s.deadlineAt+1,random)).toBe(end);
  const moved=applyCommand(s,0,a,s.deadlineAt-1,random);expect(()=>applyTimeout(moved,'timer',0,s.deadlineAt,random)).toThrow('TERMINAL');
 });
 it('projects only authorized hand/public state and bot consumes only that view',()=>{
  const s=createGame(proposal,100,random);const view=projectGame(s,0);const json=JSON.stringify(view);
  for(const key of ['hands','market','discard','receipts','fingerprint','rules'])expect(Object.keys(view)).not.toContain(key);
  for(const card of s.hands[1])expect(json).not.toContain(`"${card.id}"`);
  expect(()=>projectGame(s,2 as 0)).toThrow('INVALID_INPUT');expect(()=>chooseBotCommand(projectGame(s,1))).toThrow('Bot cannot act');
  expect(chooseBotCommand(view)).toBeDefined();
 });
 it('replays private commands and recorded entropy to exactly the same state',()=>{
  let s=createGame(proposal,100,cryptoRandomInt);const initial=JSON.parse(JSON.stringify(s));const events:{action:Parameters<typeof applyCommand>[2];seat:0|1;at:number;entropy:{max:number;value:number}[]}[]=[];
  for(let i=0;i<80&&s.status==='ACTIVE';i++){const recorded=recordRandom(cryptoRandomInt);const action={id:`event-${i}`,expectedVersion:s.version,command:chooseBotCommand(projectGame(s,s.turn))};const seat=s.turn,at=s.lastAt+1;s=applyCommand(s,seat,action,at,recorded.random);events.push({action,seat,at,entropy:recorded.choices});}
  let replay=restoreGame(initial);for(const e of events){const rng=replayRandom(e.entropy);replay=applyCommand(replay,e.seat,e.action,e.at,rng.random);expect(rng.complete()).toBe(true);}expect(replay).toEqual(s);
 });
 it('finishes10000 generated bot games within the configured bound and preserves cards',()=>{
  const rules={...proposal,maxActions:100};
  for(let game=0;game<10000;game++){let s=createGame(rules,100,cryptoRandomInt);while(s.status==='ACTIVE'){s=applyCommand(s,s.turn,{id:`a-${s.version}`,expectedVersion:s.version,command:chooseBotCommand(projectGame(s,s.turn))},s.lastAt+1,cryptoRandomInt);}expect(s.version).toBeLessThanOrEqual(100);assertConservation(s);}
 },120000);
});
