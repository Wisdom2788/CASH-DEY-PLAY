import { Command,SUITS,Suit } from './model';
import { PlayerView } from './engine';
/** Receives only the same redacted view as a human player. No private-state parameter. */
export function chooseBotCommand(view:PlayerView):Command {
 if(view.status!=='ACTIVE'||view.turn!==view.seat)throw new Error('Bot cannot act');
 const card=view.hand.find(c=>view.plays.includes(c.id));
 if(card){
  if(card.suit==='WHOT'){
   const counts=new Map<Suit,number>(SUITS.map(s=>[s,view.hand.filter(c=>c.suit===s).length]));
   const chosenSuit=[...SUITS].sort((a,b)=>counts.get(b)!-counts.get(a)!)[0]!;
   return {type:'PLAY',cardId:card.id,chosenSuit,declareLast:view.hand.length===2};
  }
  return {type:'PLAY',cardId:card.id,declareLast:view.hand.length===2};
 }
 if(view.canPass)return {type:'PASS'};if(view.canDraw)return {type:'DRAW'};return {type:'FORFEIT'};
}
