import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { RedisRankedQueue } from './redis-queue';
const url=process.env.TEST_REDIS_URL;
if(process.env.REQUIRE_REDIS_TESTS==='true'&&!url)throw new Error('TEST_REDIS_URL required');
(url?describe:describe.skip)('Redis ranked cache ownership',()=>{
 let redis:Redis,queue:RedisRankedQueue;
 beforeEach(async()=>{if(new URL(url!).pathname!=='/15')throw new Error('Dedicated Redis test database required');redis=new Redis(url!,{lazyConnect:true,maxRetriesPerRequest:1,commandTimeout:1000});redis.on('error',()=>undefined);await redis.connect();queue=new RedisRankedQueue(redis,'test-'+randomUUID());});
 afterEach(async()=>{const keys=await redis.keys(queue.prefix+'*');if(keys.length)await redis.del(...keys);redis.disconnect();});
 const entry=()=>({userId:'tg_123',epoch:'9007199254740993',ticketId:randomUUID(),connectionId:randomUUID(),joinedAt:Date.now(),lastSeenAt:Date.now(),expiresAt:Date.now()+120000,searching:true});
 it('compares large decimal epochs without losing precision and never revives cancelled older snapshots',async()=>{
  const live=entry();await queue.sync(live);await queue.sync({...live,epoch:'9007199254740994',ticketId:null,searching:false});await queue.sync(live);
  expect(await redis.zcard(queue.prefix+'queue')).toBe(0);expect(await redis.hget(queue.prefix+'user:tg_123','epoch')).toBe('9007199254740994');
 });
 it('never lets an old owner delete or extend its replacement lease',async()=>{
  const first=randomUUID(),second=randomUUID();expect(await queue.acquire(first)).toBe(true);expect(await queue.acquire(second)).toBe(false);
  await redis.del(queue.prefix+'owner');expect(await queue.acquire(second)).toBe(true);await queue.release(first);expect(await queue.renew(first)).toBe(false);expect(await redis.get(queue.prefix+'owner')).toBe(second);
 });
 it('cleans fifty missing-presence tickets and scans through to live candidates',async()=>{
  for(let i=0;i<50;i++)await redis.zadd(queue.prefix+'queue',i,randomUUID());
  const live=entry();await queue.sync(live);const owner=randomUUID();await queue.acquire(owner);expect(await queue.scan(owner)).toEqual([live.ticketId]);expect(await redis.zcard(queue.prefix+'queue')).toBe(1);
 });
 it('advances the cursor even when the whole queue fits in one window',async()=>{
  const first=entry();const second={...entry(),userId:'tg_456'};await queue.sync(first);await queue.sync(second);const owner=randomUUID();await queue.acquire(owner);
  expect((await queue.scan(owner)).length).toBe(2);expect(await redis.get(queue.prefix+'cursor')).toBe('1');
 });
});
