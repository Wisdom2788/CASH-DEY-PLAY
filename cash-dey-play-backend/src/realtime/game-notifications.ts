import { z } from 'zod';
import { Redis } from 'ioredis';

export const gameNoticeSchema=z.strictObject({eventId:z.string().uuid(),matchId:z.string().uuid(),version:z.number().int().positive().max(2000),
 userIds:z.array(z.string().regex(/^tg_[1-9][0-9]{0,19}$/)).min(1).max(2).refine(v=>new Set(v).size===v.length)});
export type GameNotice=z.infer<typeof gameNoticeSchema>;
export interface GameNotificationSource {subscribe(listener:(notice:GameNotice)=>void):()=>void}
/** Redis carries routing hints only. SQL authorization and snapshot reads remain mandatory. */
export class RedisGameNotifications implements GameNotificationSource {
 private readonly listeners=new Set<(notice:GameNotice)=>void>();
 private readonly receive=(channel:string,message:string)=>{
  if(channel!==this.channel||message.length>2048)return;
  try{const notice=gameNoticeSchema.parse(JSON.parse(message));for(const listener of this.listeners)listener(notice);}catch{/* malformed notices never authorize a read */}
 };
 private readonly ready=()=>{void this.redis.subscribe(this.channel).catch(()=>undefined);};
 constructor(private readonly redis:Redis,private readonly channel:string){
  if(!/^[A-Za-z0-9:_-]{1,100}$/.test(channel))throw new Error('Invalid relay channel');
  redis.on('message',this.receive);redis.on('ready',this.ready);
 }
 async start():Promise<void>{await this.redis.subscribe(this.channel);}
 subscribe(listener:(notice:GameNotice)=>void):()=>void{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
 close():void{this.listeners.clear();this.redis.removeListener('message',this.receive);this.redis.removeListener('ready',this.ready);this.redis.disconnect();}
}
