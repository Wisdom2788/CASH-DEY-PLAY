import { z } from 'zod';
import { GameUpdate } from './session.repository';
import { GameNotificationSource,gameNoticeSchema } from './game-notifications';
const ackSchema=z.strictObject({matchId:z.string().uuid(),eventId:z.string().uuid().nullable(),version:z.number().int().min(0).max(2000)});
interface Recipient {
 userId:string;load:()=>Promise<GameUpdate|null>;send:(update:GameUpdate)=>Promise<unknown>;onError:(error:unknown)=>void;
}
interface Pending extends Recipient {active:boolean;dirty:boolean;running:boolean;cursor:{matchId:string;version:number}|null}
/** Bounded FIFO snapshot fanout. Cursor advances only on an exact client acknowledgement. */
export class SnapshotDelivery {
 private readonly recipients=new Map<string,Set<Pending>>();private readonly queue=new Set<Pending>();
 private inFlight=0;private closed=false;private readonly unsubscribe:()=>void;private readonly timer:NodeJS.Timeout;
 constructor(source:GameNotificationSource,catchupMs=5000,private readonly concurrency=8){
  if(!Number.isInteger(catchupMs)||catchupMs<10||catchupMs>60000||!Number.isInteger(concurrency)||concurrency<1||concurrency>64)throw new Error('Invalid delivery bounds');
  this.unsubscribe=source.subscribe(value=>{
   const parsed=gameNoticeSchema.safeParse(value);if(!parsed.success)return;
   for(const userId of parsed.data.userIds)for(const recipient of this.recipients.get(userId)??[])this.mark(recipient);
  });
  this.timer=setInterval(()=>{for(const group of this.recipients.values())for(const r of group)this.mark(r);},catchupMs);this.timer.unref();
 }
 register(recipient:Recipient):()=>void{
  if(this.closed)throw new Error('Delivery closed');
  const pending:Pending={...recipient,active:true,dirty:false,running:false,cursor:null};
  const group=this.recipients.get(recipient.userId)??new Set<Pending>();group.add(pending);this.recipients.set(recipient.userId,group);this.mark(pending);
  return ()=>{pending.active=false;this.queue.delete(pending);group.delete(pending);if(!group.size)this.recipients.delete(recipient.userId);};
 }
 close():void{
  if(this.closed)return;this.closed=true;clearInterval(this.timer);this.unsubscribe();
  for(const group of this.recipients.values())for(const r of group)r.active=false;
  this.recipients.clear();this.queue.clear();
 }
 private mark(recipient:Pending):void{
  if(this.closed||!recipient.active)return;recipient.dirty=true;if(!recipient.running)this.queue.add(recipient);this.drain();
 }
 private drain():void{
  while(!this.closed&&this.inFlight<this.concurrency&&this.queue.size){
   const next=this.queue.values().next().value as Pending;this.queue.delete(next);
   if(!next.active)continue;next.running=true;next.dirty=false;this.inFlight++;
   void this.load(next).then(update=>{this.inFlight--;this.drain();return this.deliver(next,update);})
    .finally(()=>{next.running=false;if(next.dirty&&next.active&&!this.closed)this.queue.add(next);this.drain();});
  }
 }
 private async load(recipient:Pending):Promise<GameUpdate|null>{
  try{return await recipient.load();}catch(error){if(recipient.active){try{recipient.onError(error);}catch{/* cleanup must not reject the delivery loop */}}return null;}
 }
 private async deliver(recipient:Pending,update:GameUpdate|null):Promise<void>{
  if(!recipient.active||!update||(recipient.cursor?.matchId===update.matchId&&recipient.cursor.version>=update.view.version))return;
  try{
   const ack=ackSchema.safeParse(await recipient.send(update));
   if(recipient.active&&ack.success&&ack.data.matchId===update.matchId&&ack.data.eventId===update.eventId&&ack.data.version===update.view.version)
    recipient.cursor={matchId:update.matchId,version:update.view.version};
  }catch{/* Lost/invalid acknowledgements are retried by a notice or the catch-up timer. */}
 }
}
