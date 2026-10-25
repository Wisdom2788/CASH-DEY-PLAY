import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { io } from 'socket.io-client';
import { attachRealtimeGateway } from './gateway';
import { RealtimeConnection,GameUpdate } from './session.repository';
import { GameNotice } from './game-notifications';
import { MemoryRateLimitCounterStore } from '../http/middleware/rate-limit.middleware';

it('retries invalid/missing socket acknowledgements, then suppresses the acknowledged duplicate',async()=>{
 const secret='n'.repeat(40);const origin='https://mini.example';const server=createServer();
 const update:GameUpdate={matchId:randomUUID(),eventId:randomUUID(),view:{version:1} as GameUpdate['view']};
 const listeners=new Set<(value:GameNotice)=>void>();
 const source={subscribe:(fn:(value:GameNotice)=>void)=>{listeners.add(fn);return ()=>{listeners.delete(fn);};}};
 const gateway=attachRealtimeGateway(server,{jwtSecret:secret,origin,rateLimits:new MemoryRateLimitCounterStore(),
  sessions:{claim:async identity=>({...identity,connectionId:randomUUID()}),assertCurrent:async()=>undefined,release:async()=>undefined,
   resume:async()=>({protocolVersion:1,phase:'IDLE',serverTime:Date.now(),match:null})},
  delivery:{source,snapshots:{deliverySnapshot:async(_connection:RealtimeConnection)=>update},catchupMs:25,ackMs:50}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const token=jwt.sign({userId:'tg_123',telegramId:123,tokenVersion:0},secret,{issuer:'cash-dey-play',audience:'cash-dey-play-mini-app',expiresIn:60});
 const client=io(`http://127.0.0.1:${(server.address() as AddressInfo).port}`,{auth:{token},transports:['websocket'],extraHeaders:{Origin:origin},autoConnect:false,reconnection:false});
 const received:GameUpdate[]=[];
 client.on('match:update',(value:GameUpdate,ack:(value:unknown)=>void)=>{
  received.push(value);
  if(received.length===1)ack({matchId:value.matchId,eventId:value.eventId,version:999});
  if(received.length>=3)ack({matchId:value.matchId,eventId:value.eventId,version:value.view.version});
 });
 try{
  await new Promise<void>((resolve,reject)=>{client.once('connect',resolve);client.once('connect_error',reject);client.connect();});
  const until=Date.now()+2000;while(received.length<3){if(Date.now()>until)throw new Error('ACK recovery failed');await new Promise(resolve=>setTimeout(resolve,20));}
  await new Promise(resolve=>setTimeout(resolve,100));expect(received).toEqual([update,update,update]);
 }finally{client.disconnect();await new Promise<void>(resolve=>gateway.close(()=>resolve()));}
 expect(listeners.size).toBe(0);
});
