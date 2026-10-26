import { RankedDelivery } from './ranked-delivery';
import { RankedRepository,RankedError } from '../ranked/ranked.repository';
import { RedisRankedQueue } from '../ranked/redis-queue';
import { SnapshotDelivery } from './snapshot-delivery';
import { GameNotificationSource } from './game-notifications';
import { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { GameRepository } from '../game-engine/repository';
import { actionSchema,GameError } from '../game-engine/model';
import { z } from 'zod';
import { verifyAccessToken } from '../auth/access-token';
import { RateLimitCounterStore } from '../http/middleware/rate-limit.middleware';
import { RealtimeConnection,RealtimeError,RealtimeSessionRepository } from './session.repository';

interface GatewayOptions {
 jwtSecret:string;origin:string;rateLimits:RateLimitCounterStore;
 sessions:Pick<RealtimeSessionRepository,'claim'|'assertCurrent'|'release'|'resume'>;
 delivery?:{source:GameNotificationSource;snapshots:Pick<RealtimeSessionRepository,'deliverySnapshot'>;catchupMs?:number;ackMs?:number};
 ranked?:{repository:RankedRepository;queue:RedisRankedQueue;rateLimits:RateLimitCounterStore;pushMs?:number;ackMs?:number};
 actions?:{games:Pick<GameRepository,'actForConnection'>;rateLimits:RateLimitCounterStore};
}
const authSchema=z.strictObject({token:z.string().min(1).max(8192)});
const empty=z.strictObject({});const matchRequest=z.strictObject({matchId:z.string().uuid()});
const moveRequest=z.strictObject({matchId:z.string().uuid(),actionId:actionSchema.shape.id,expectedVersion:actionSchema.shape.expectedVersion,command:actionSchema.shape.command});
function code(error:unknown):string{
 if(error instanceof RealtimeError||error instanceof RankedError)return error.code;
 if(error instanceof GameError&&error.code!=='INVALID_STATE')return error.code;
 return 'UNAVAILABLE';
}

/** Reads and opt-in atomic moves. No client room joins, rewards or cached packet recovery. */
export function attachRealtimeGateway(server:HttpServer,options:GatewayOptions):Server {
 const io=new Server(server,{transports:['websocket'],maxHttpBufferSize:8192,
  cors:{origin:options.origin},allowRequest:(req,done)=>done(null,req.headers.origin===options.origin)});
 const delivery=options.delivery?new SnapshotDelivery(options.delivery.source,options.delivery.catchupMs):undefined;
 const rankedDelivery=options.ranked?new RankedDelivery(options.ranked.pushMs):undefined;
 server.once('close',()=>{delivery?.close();rankedDelivery?.close();});
 io.use((socket,next)=>{void(async()=>{
  const parsed=authSchema.safeParse(socket.handshake.auth);if(!parsed.success)throw new RealtimeError('UNAUTHORIZED');
  let identity;
  try{identity=verifyAccessToken(parsed.data.token,options.jwtSecret);}catch{throw new RealtimeError('UNAUTHORIZED');}
  if(await options.rateLimits.increment(`rt:connect:${identity.userId}`,60)>20)throw new RealtimeError('RATE_LIMITED');
  socket.data.connection=await options.sessions.claim(identity);socket.data.token=parsed.data.token;
 })().then(()=>next(),error=>next(new Error(code(error))));});
 io.on('connection',socket=>{
  const connection=socket.data.connection as RealtimeConnection;const token=socket.data.token as string;
  let busy=false;let frameCount=0;let frameWindow=Date.now();
  const disconnect=(reason:string)=>{socket.emit('session:error',{code:reason});socket.disconnect(true);};
  const verifyToken=()=>{try{verifyAccessToken(token,options.jwtSecret);}catch{throw new RealtimeError('UNAUTHORIZED');}};
  const expiry=setTimeout(()=>disconnect('UNAUTHORIZED'),Math.min(2147483647,Math.max(0,connection.expiresAt-Date.now())));
  const monitor=setInterval(()=>{
   if(busy||!socket.connected)return;busy=true;
   void(async()=>{verifyToken();await options.sessions.assertCurrent(connection);})()
    .catch(error=>disconnect(code(error))).finally(()=>{busy=false;});
  },5000);
  expiry.unref();monitor.unref();
  const unregister=delivery?.register({userId:connection.userId,
   load:async()=>{verifyToken();return options.delivery!.snapshots.deliverySnapshot(connection);},
   send:async update=>socket.timeout(options.delivery?.ackMs??2000).emitWithAck('match:update',update),
   onError:error=>disconnect(code(error))});
  const unregisterRanked=rankedDelivery?.register({load:async()=>{verifyToken();return options.ranked!.repository.resume(connection);},
   send:update=>socket.timeout(options.ranked?.ackMs??2000).emitWithAck('session:update',update),onError:error=>disconnect(code(error))});
  socket.on('disconnect',()=>{unregisterRanked?.();unregister?.();clearTimeout(expiry);clearInterval(monitor);void options.sessions.release(connection).catch(()=>undefined);});
  socket.onAny((event:string,...args:unknown[])=>{
   const now=Date.now();if(now-frameWindow>=1000){frameWindow=now;frameCount=0;}
   if(++frameCount>30){disconnect('RATE_LIMITED');return;}
   const ack=args[args.length-1];
   if(args.length!==2||typeof ack!=='function'){socket.emit('protocol:error',{code:'INVALID_INPUT'});return;}
   if(busy){ack({ok:false,error:{code:'BUSY'}});return;}busy=true;
   void(async()=>{
    if(await options.rateLimits.increment(`rt:event:${connection.userId}`,60)>60)throw new RealtimeError('RATE_LIMITED');
    verifyToken();
    if(options.ranked&&['queue:join','queue:heartbeat','queue:cancel','offer:respond','rematch:request','rematch:respond'].includes(event)){
     const ranked=options.ranked;
     if(await ranked.rateLimits.increment(`rt:ranked:${connection.userId}`,60)>30)throw new RealtimeError('RATE_LIMITED');
     if(event==='rematch:request'){
      const parsed=z.strictObject({opponentId:z.string().regex(/^tg_[1-9][0-9]{0,19}$/),requestKey:z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/)}).safeParse(args[0]);if(!parsed.success)throw new RealtimeError('INVALID_INPUT');
      await ranked.repository.requestRematch(connection,parsed.data.opponentId,parsed.data.requestKey);
     }else if(event==='rematch:respond'){
      const parsed=z.strictObject({requestId:z.string().uuid(),accept:z.boolean()}).safeParse(args[0]);if(!parsed.success)throw new RealtimeError('INVALID_INPUT');
      await ranked.repository.respondRematch(connection,parsed.data.requestId,parsed.data.accept);
     }else if(event==='queue:join'){
      const parsed=z.strictObject({requestKey:z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/)}).safeParse(args[0]);if(!parsed.success)throw new RealtimeError('INVALID_INPUT');
      await ranked.repository.join(connection,parsed.data.requestKey);
     }else if(event==='offer:respond'){
      const parsed=z.strictObject({offerId:z.string().uuid(),accept:z.boolean()}).safeParse(args[0]);if(!parsed.success)throw new RealtimeError('INVALID_INPUT');
      await ranked.repository.respond(connection,parsed.data.offerId,parsed.data.accept);
      for(const entry of await ranked.repository.cacheForOffer(parsed.data.offerId))await ranked.queue.sync(entry);
     }else{
      const parsed=z.strictObject({ticketId:z.string().uuid()}).safeParse(args[0]);if(!parsed.success)throw new RealtimeError('INVALID_INPUT');
      if(event==='queue:heartbeat')await ranked.repository.heartbeat(connection,parsed.data.ticketId);else await ranked.repository.cancel(connection,parsed.data.ticketId);
     }
     for(const entry of await ranked.repository.cacheEntries('',1,[connection.userId]))await ranked.queue.sync(entry);
     rankedDelivery?.wake();
     const snapshot=await ranked.repository.resume(connection);if(socket.connected)ack({ok:true,data:snapshot});return;
    }
    if(event==='session:resume'&&options.ranked){
     if(!empty.safeParse(args[0]).success)throw new RealtimeError('INVALID_INPUT');
     const snapshot=await options.ranked.repository.resume(connection);if(socket.connected)ack({ok:true,data:snapshot});return;
    }
    if(event==='match:action'&&options.actions){
     const parsed=moveRequest.safeParse(args[0]);if(!parsed.success)throw new RealtimeError('INVALID_INPUT');
     // Use the shared store directly. Errors deny the action; no local fallback for writes.
     if(await options.actions.rateLimits.increment(`rt:move:${connection.userId}`,60)>60)throw new RealtimeError('RATE_LIMITED');
     const {matchId,actionId,expectedVersion,command}=parsed.data;
     const view=await options.actions.games.actForConnection(connection,matchId,{id:actionId,expectedVersion,command});
     if(socket.connected)ack({ok:true,data:{matchId,view}});return;
    }
    if(event!=='session:resume'&&event!=='match:view')throw new RealtimeError('INVALID_INPUT');
    let matchId:string|undefined;
    if(event==='match:view'){
     const parsed=matchRequest.safeParse(args[0]);if(!parsed.success)throw new RealtimeError('INVALID_INPUT');matchId=parsed.data.matchId;
    }else if(!empty.safeParse(args[0]).success)throw new RealtimeError('INVALID_INPUT');
    const snapshot=await options.sessions.resume(connection,matchId);
    if(socket.connected)ack({ok:true,data:snapshot});
   })().catch(error=>{
    const reason=code(error);if(socket.connected)ack({ok:false,error:{code:reason}});
    if(['UNAUTHORIZED','SESSION_REPLACED','UNAVAILABLE','RATE_LIMITED'].includes(reason))disconnect(reason);
   }).finally(()=>{busy=false;});
  });
 });
 return io;
}
