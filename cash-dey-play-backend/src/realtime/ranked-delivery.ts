import { randomUUID } from 'node:crypto';
/** SQL snapshot push with bounded reads, one outstanding ACK per socket and lost-ACK retry.
 * Polling is a recovery path and never refreshes queue presence. No private state enters Redis.
 */
interface Recipient {load:()=>Promise<unknown>;send:(value:{deliveryId:string;snapshot:unknown})=>Promise<unknown>;onError:(error:unknown)=>void}
interface Pending extends Recipient {active:boolean;running:boolean;cursor:string|null}
export class RankedDelivery {
 private readonly recipients=new Set<Pending>();private readonly waiting=new Set<Pending>();private reads=0;private closed=false;
 private readonly timer:NodeJS.Timeout;
 constructor(intervalMs=1000,private readonly concurrency=8){
  if(!Number.isInteger(intervalMs)||intervalMs<10||intervalMs>60000||!Number.isInteger(concurrency)||concurrency<1||concurrency>64)throw new Error('Invalid delivery bounds');
  this.timer=setInterval(()=>this.wake(),intervalMs);this.timer.unref();
 }
 register(recipient:Recipient):()=>void{
  if(this.closed)throw new Error('Delivery closed');const pending:Pending={...recipient,active:true,running:false,cursor:null};this.recipients.add(pending);this.waiting.add(pending);this.drain();
  return ()=>{pending.active=false;this.recipients.delete(pending);this.waiting.delete(pending);};
 }
 wake():void{for(const r of this.recipients)if(!r.running)this.waiting.add(r);this.drain();}
 close():void{this.closed=true;clearInterval(this.timer);for(const r of this.recipients)r.active=false;this.recipients.clear();this.waiting.clear();}
 private drain():void{
  while(!this.closed&&this.reads<this.concurrency&&this.waiting.size){
   const r=this.waiting.values().next().value!;this.waiting.delete(r);if(!r.active||r.running)continue;r.running=true;this.reads++;
   void this.load(r).then(snapshot=>{this.reads--;this.drain();return this.deliver(r,snapshot);}).finally(()=>{r.running=false;});
  }
 }
 private async load(r:Pending):Promise<unknown>{try{return await r.load();}catch(error){if(r.active)try{r.onError(error);}catch{/* cannot reject shared scheduler */}return null;}}
 private async deliver(r:Pending,snapshot:unknown):Promise<void>{
  if(this.closed||!r.active||!snapshot)return;
  // Server time changes on every read; state cursor must ignore it.
  const {serverTime:_,...state}=snapshot as Record<string,unknown>;const fingerprint=JSON.stringify(state);if(r.cursor===fingerprint)return;
  const deliveryId=randomUUID();try{
   const ack=await r.send({deliveryId,snapshot});
   if(r.active&&ack&&typeof ack==='object'&&Object.keys(ack).length===1&&(ack as {deliveryId?:unknown}).deliveryId===deliveryId)r.cursor=fingerprint;
  }catch{/* periodic catch-up retries the latest state */}
 }
}
