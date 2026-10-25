import { randomUUID } from 'node:crypto';
import { RankedRepository } from './ranked.repository';
import { RedisRankedQueue } from './redis-queue';
/** SQL-first offers avoid removing players before their durable reservation exists. */
export class RankedMatchmaker {
 private afterUser='';
 constructor(private readonly ranked:RankedRepository,private readonly queue:RedisRankedQueue){}
 async sync(signal?:AbortSignal):Promise<void>{
  const entries=await this.ranked.cacheEntries(this.afterUser,100);
  for(const entry of entries){if(signal?.aborted)return;await this.queue.sync(entry);}
  this.afterUser=entries.length===100?entries[entries.length-1]!.userId:'';
 }
 async pass(signal?:AbortSignal):Promise<number>{
  if(signal?.aborted)return 0;await this.ranked.recover(100,signal);await this.sync(signal);if(signal?.aborted)return 0;const token=randomUUID();if(!await this.queue.acquire(token))return 0;
  const fence=await this.ranked.acquireFence(token);if(!fence){await this.queue.release(token);return 0;}
  let offers=0;
  try{
   const cached=await this.ranked.candidateIds(await this.queue.scan(token));
   // A narrow/stale cache window must not hide an eligible opponent elsewhere in durable truth.
   const candidates=[...new Set([...cached,...(cached.length<3?await this.ranked.candidateIds():[])])];const used=new Set<string>();let attempts=0;
   for(let i=0;i<candidates.length&&attempts<100;i++){
    if(used.has(candidates[i]!))continue;
    for(let j=i+1;j<candidates.length&&attempts<100;j++){
     if(signal?.aborted)return offers;
     if(used.has(candidates[j]!))continue;
     if(!await this.queue.renew(token)||!await this.ranked.renewFence(fence))return offers;attempts++;
     const offer=await this.ranked.createOffer(fence,candidates[i]!,candidates[j]!);
     if(offer){for(const entry of await this.ranked.cacheForOffer(offer.id))await this.queue.sync(entry);used.add(candidates[i]!);used.add(candidates[j]!);offers++;break;}
    }
   }
   // Fresh snapshots remove committed offers or recreate missing queue entries. A failed cache write cannot undo SQL.
   await this.sync(signal);return offers;
  }finally{await this.ranked.releaseFence(fence);await this.queue.release(token);}
 }
}
