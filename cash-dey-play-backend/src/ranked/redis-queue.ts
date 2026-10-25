import { Redis } from 'ioredis';
import { QueueCacheEntry } from './ranked.repository';
const syncScript=`
 local old=redis.call('HGET',KEYS[2],'epoch')
 if old and (string.len(old)>string.len(ARGV[1]) or (string.len(old)==string.len(ARGV[1]) and old>ARGV[1])) then return 0 end
 local previous=redis.call('HGET',KEYS[2],'ticket')
 if previous and previous~='' then redis.call('ZREM',KEYS[1],previous) end
 redis.call('HSET',KEYS[2],'epoch',ARGV[1],'ticket',ARGV[2]);redis.call('PEXPIRE',KEYS[2],86400000)
 if ARGV[3]=='1' then
  local ttl=math.min(45000,tonumber(ARGV[6])-tonumber(ARGV[7]),tonumber(ARGV[8])+45000-tonumber(ARGV[7]))
  if ttl>0 then
   redis.call('SET',KEYS[3],ARGV[2],'PX',math.floor(ttl))
   redis.call('ZADD',KEYS[1],ARGV[4],ARGV[2]);redis.call('SET',KEYS[4],ARGV[9],'PX',math.floor(ttl));return 1
  end
 end
 redis.call('DEL',KEYS[3]);return 1`;
const scanScript=`
 if redis.call('GET',KEYS[1])~=ARGV[1] then return nil end
 local n=redis.call('ZCARD',KEYS[2]);if n==0 then return {} end
 local start=tonumber(redis.call('GET',KEYS[3]) or '0')%n
 local rows=redis.call('ZRANGE',KEYS[2],start,start+tonumber(ARGV[2])-1)
 redis.call('SET',KEYS[3],tostring((start+math.max(1,math.floor(#rows/2)))%n))
 return rows`;
const cleanScript=`
 if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
 for i=3,#KEYS do if redis.call('EXISTS',KEYS[i])==0 then redis.call('ZREM',KEYS[2],ARGV[i-1]) end end
 return 1`;
const ownerScript=`if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
 if ARGV[2]=='release' then return redis.call('DEL',KEYS[1]) else return redis.call('PEXPIRE',KEYS[1],5000) end`;
export class RedisRankedQueue {
 readonly prefix:string;
 constructor(private readonly redis:Redis,namespace:string){if(!/^[A-Za-z0-9_-]{1,80}$/.test(namespace))throw new Error('Invalid queue namespace');this.prefix=`cdp:{${namespace}}:ranked:`;}
 async sync(entry:QueueCacheEntry):Promise<void>{
  const now=Date.now();await this.redis.eval(syncScript,4,this.prefix+'queue',this.prefix+'user:'+entry.userId,this.prefix+'presence:'+entry.userId,this.prefix+'ticket:'+entry.ticketId,
   entry.epoch,entry.ticketId??'',entry.searching?'1':'0',String(entry.joinedAt),entry.connectionId??'',String(entry.expiresAt),String(now),String(entry.lastSeenAt),entry.userId);
 }
 async acquire(token:string):Promise<boolean>{return await this.redis.set(this.prefix+'owner',token,'PX',5000,'NX')==='OK';}
 async renew(token:string):Promise<boolean>{return Number(await this.redis.eval(ownerScript,1,this.prefix+'owner',token,'renew'))===1;}
 async release(token:string):Promise<void>{await this.redis.eval(ownerScript,1,this.prefix+'owner',token,'release');}
 async scan(token:string,count=100):Promise<string[]>{
  if(!Number.isSafeInteger(count)||count<2||count>200)throw new Error('Invalid scan bound');
  const result=await this.redis.eval(scanScript,3,this.prefix+'owner',this.prefix+'queue',this.prefix+'cursor',token,String(count));
  if(result===null)throw new Error('Queue owner lost');const ids=result as string[];if(!ids.length)return [];
  const present=await this.redis.mget(...ids.map(id=>this.prefix+'ticket:'+id));const stale=ids.filter((_,i)=>present[i]===null);
  if(stale.length&&Number(await this.redis.eval(cleanScript,2+stale.length,this.prefix+'owner',this.prefix+'queue',...stale.map(id=>this.prefix+'ticket:'+id),token,...stale))!==1)throw new Error('Queue owner lost');
  return ids.filter((_,i)=>present[i]!==null);
 }
}
