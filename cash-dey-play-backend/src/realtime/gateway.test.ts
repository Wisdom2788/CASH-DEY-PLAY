import { createServer,Server as HttpServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { io,Socket } from 'socket.io-client';
import { Server } from 'socket.io';
import { AccessIdentity } from '../auth/access-token';
import { MemoryRateLimitCounterStore } from '../http/middleware/rate-limit.middleware';
import { RankedRepository } from '../ranked/ranked.repository';
import { RedisRankedQueue } from '../ranked/redis-queue';
import { GameError } from '../game-engine/model';
import { attachRealtimeGateway } from './gateway';
import { RealtimeConnection,RealtimeError,ResumeSnapshot } from './session.repository';

const secret='s'.repeat(40);const origin='https://mini.example';
const token=(seconds=60)=>jwt.sign({userId:'tg_123',telegramId:123,tokenVersion:0},secret,
 {algorithm:'HS256',issuer:'cash-dey-play',audience:'cash-dey-play-mini-app',expiresIn:seconds});
describe('real Socket.IO read gateway',()=>{
 let server:HttpServer,gateway:Server,url:string,clients:Socket[],current:RealtimeConnection|null,revoked:boolean;
 let act:jest.Mock;let moveLimit:jest.Mock;let options:Parameters<typeof attachRealtimeGateway>[1];
 let sessions:Parameters<typeof attachRealtimeGateway>[1]['sessions'];
 beforeEach(async()=>{
  clients=[];current=null;revoked=false;
  sessions={
   claim:jest.fn(async(identity:AccessIdentity)=>{current={...identity,connectionId:randomUUID()};return current;}),
   assertCurrent:jest.fn(async(connection:RealtimeConnection)=>{
    if(revoked)throw new RealtimeError('UNAUTHORIZED');
    if(current?.connectionId!==connection.connectionId)throw new RealtimeError('SESSION_REPLACED');
   }),
   release:jest.fn(async(connection:RealtimeConnection)=>{if(current?.connectionId===connection.connectionId)current=null;}),
   resume:jest.fn(async(connection:RealtimeConnection):Promise<ResumeSnapshot>=>{
    await sessions.assertCurrent(connection);return {protocolVersion:1,phase:'IDLE',serverTime:Date.now(),match:null};
   }),
  };
  act=jest.fn().mockResolvedValue({version:1,hand:[]});moveLimit=jest.fn().mockResolvedValue(1);
  options={jwtSecret:secret,origin,rateLimits:new MemoryRateLimitCounterStore(),sessions,actions:{games:{actForConnection:act},rateLimits:{increment:moveLimit}}};
  server=createServer();gateway=attachRealtimeGateway(server,options);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 });
 afterEach(async()=>{for(const client of clients)client.disconnect();await new Promise<void>(resolve=>gateway.close(()=>resolve()));});
 async function connect(auth:Record<string,unknown>={token:token()},requestOrigin=origin):Promise<Socket>{
  const client=io(url,{auth,transports:['websocket'],extraHeaders:{Origin:requestOrigin},reconnection:false,autoConnect:false});clients.push(client);
  await new Promise<void>((resolve,reject)=>{client.once('connect',resolve);client.once('connect_error',reject);client.connect();});return client;
 }
 it('accepts auth.token and resumes only through the server-owned connection',async()=>{
  const client=await connect();const response=await client.timeout(2000).emitWithAck('session:resume',{});
  expect(response.ok).toBe(true);expect(response.data.phase).toBe('IDLE');
  expect(sessions.resume).toHaveBeenCalledWith(current,undefined);
 });
 it('rejects missing auth, client-selected identities, wrong origin and forged/expired tokens before claiming ownership',async()=>{
  for(const auth of [{},{token:'forged'},{token:token(-1)},{token:token(),userId:'tg_456'}])await expect(connect(auth)).rejects.toThrow();
  await expect(connect({token:token()},'https://evil.example')).rejects.toThrow();
  expect(sessions.claim).not.toHaveBeenCalled();
 });
 it('rejects room joins, move commands and extra/invalid request fields without reading a match',async()=>{
  const client=await connect();
  for(const [event,payload] of [['join',{room:'other'}],['match:action',{winner:'tg_123'}],['session:resume',{userId:'tg_456'}],['match:view',{matchId:'nope'}]]){
   expect(await client.timeout(2000).emitWithAck(event as string,payload)).toEqual({ok:false,error:{code:'INVALID_INPUT'}});
  }
  expect(sessions.resume).not.toHaveBeenCalled();
 });
 it('passes match IDs only to the authorized repository and returns no raw database errors',async()=>{
  const client=await connect();const id=randomUUID();
  (sessions.resume as jest.Mock).mockRejectedValueOnce(new RealtimeError('NOT_FOUND'));
  expect(await client.timeout(2000).emitWithAck('match:view',{matchId:id})).toEqual({ok:false,error:{code:'NOT_FOUND'}});
  expect(sessions.resume).toHaveBeenCalledWith(current,id);
  (sessions.resume as jest.Mock).mockRejectedValueOnce(new Error('connection string and private state'));
  expect(await client.timeout(2000).emitWithAck('session:resume',{})).toEqual({ok:false,error:{code:'UNAVAILABLE'}});
 });
 it('revokes an established socket at the next sensitive event',async()=>{
  const client=await connect();revoked=true;
  expect(await client.timeout(2000).emitWithAck('session:resume',{})).toEqual({ok:false,error:{code:'UNAUTHORIZED'}});
 });
 it('invalidates the old device and compare-deletes only its own generation',async()=>{
  const first=await connect();const second=await connect();const newest=current;
  expect(await first.timeout(2000).emitWithAck('session:resume',{})).toEqual({ok:false,error:{code:'SESSION_REPLACED'}});
  expect(await second.timeout(2000).emitWithAck('session:resume',{})).toMatchObject({ok:true});expect(current).toEqual(newest);
 });
 it('disconnects an idle socket when its signed token expires',async()=>{
  const client=await connect({token:token(2)});
  await new Promise<void>((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(new Error('expiry did not disconnect')),3000);
   client.once('disconnect',()=>{clearTimeout(timeout);resolve();});
  });expect(client.connected).toBe(false);
 });
 it('shares the per-player event budget across successive connections',async()=>{
  const client=await connect();
  // Invalid requests still consume budget; avoid triggering the separate per-connection flood limiter.
  for(let i=0;i<30;i++)await client.timeout(2000).emitWithAck('unknown',{});
  const second=await connect();for(let i=0;i<30;i++)await second.timeout(2000).emitWithAck('unknown',{});
  const third=await connect();
  expect(await third.timeout(2000).emitWithAck('session:resume',{})).toEqual({ok:false,error:{code:'RATE_LIMITED'}});
 });
 const move=()=>({matchId:randomUUID(),actionId:'human-move-01',expectedVersion:0,command:{type:'DRAW'}});
 it('maps move intentions to the server connection and engine action, without a client clock',async()=>{
  const client=await connect();const payload=move();
  expect(await client.timeout(2000).emitWithAck('match:action',payload)).toEqual({ok:true,data:{matchId:payload.matchId,view:{version:1,hand:[]}}});
  expect(act).toHaveBeenCalledWith(current,payload.matchId,{id:payload.actionId,expectedVersion:0,command:{type:'DRAW'}});
  expect(moveLimit).toHaveBeenCalledWith('rt:move:tg_123',60);
 });
 it('keeps actions disabled without explicit action configuration',async()=>{
  delete options.actions;const client=await connect();
  expect(await client.timeout(2000).emitWithAck('match:action',move())).toEqual({ok:false,error:{code:'INVALID_INPUT'}});expect(act).not.toHaveBeenCalled();
 });
 it('rejects move identity, timestamp, reward, result and unknown command fields',async()=>{
  const client=await connect();
  for(const extra of [{userId:'tg_456'},{at:0},{winner:'tg_123'},{reward:100},{command:{type:'TIMEOUT'}},{command:{type:'DRAW',amount:5}}]){
   expect(await client.timeout(2000).emitWithAck('match:action',{...move(),...extra})).toEqual({ok:false,error:{code:'INVALID_INPUT'}});
  }expect(act).not.toHaveBeenCalled();expect(moveLimit).not.toHaveBeenCalled();
 });
 it('denies moves when the shared rate store fails or exceeds the budget',async()=>{
  const first=await connect();moveLimit.mockRejectedValueOnce(new Error('private Redis URL'));
  expect(await first.timeout(2000).emitWithAck('match:action',move())).toEqual({ok:false,error:{code:'UNAVAILABLE'}});
  const second=await connect();moveLimit.mockResolvedValueOnce(61);
  expect(await second.timeout(2000).emitWithAck('match:action',move())).toEqual({ok:false,error:{code:'RATE_LIMITED'}});expect(act).not.toHaveBeenCalled();
 });
 it('returns bounded engine rejection codes and suppresses corrupt-state details',async()=>{
  const client=await connect();
  for(const code of ['STALE_VERSION','ACTION_CONFLICT','WRONG_TURN','ILLEGAL_MOVE','EXPIRED'] as const){
   act.mockRejectedValueOnce(new GameError(code));
   expect(await client.timeout(2000).emitWithAck('match:action',move())).toEqual({ok:false,error:{code}});
  }
  act.mockRejectedValueOnce(new GameError('INVALID_STATE'));
  expect(await client.timeout(2000).emitWithAck('match:action',move())).toEqual({ok:false,error:{code:'UNAVAILABLE'}});
 });

 it('keeps queue events disabled by default and denies writes if the ranked limiter fails',async()=>{
  const first=await connect();expect(await first.timeout(2000).emitWithAck('queue:join',{requestKey:'ranked-gated'})).toEqual({ok:false,error:{code:'INVALID_INPUT'}});
  const join=jest.fn();options.ranked={repository:{join} as unknown as RankedRepository,queue:{} as RedisRankedQueue,rateLimits:{increment:async()=>{throw new Error('private redis details');}}};
  expect(await first.timeout(2000).emitWithAck('queue:join',{requestKey:'ranked-gated'})).toEqual({ok:false,error:{code:'UNAVAILABLE'}});expect(join).not.toHaveBeenCalled();
 });

});
