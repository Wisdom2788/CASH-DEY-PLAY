import { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';
import { verifyAccessToken } from '../auth/access-token';
import { RateLimitCounterStore } from '../http/middleware/rate-limit.middleware';
import { RealtimeConnection,RealtimeError,RealtimeSessionRepository } from './session.repository';

interface GatewayOptions {
 jwtSecret:string;origin:string;rateLimits:RateLimitCounterStore;
 sessions:Pick<RealtimeSessionRepository,'claim'|'assertCurrent'|'release'|'resume'>;
}
const authSchema=z.strictObject({token:z.string().min(1).max(8192)});
const empty=z.strictObject({});const matchRequest=z.strictObject({matchId:z.string().uuid()});
function code(error:unknown):string{return error instanceof RealtimeError?error.code:'UNAVAILABLE';}

/** Read-only protocol slice. No client room joins, actions, rewards or cached packet recovery. */
export function attachRealtimeGateway(server:HttpServer,options:GatewayOptions):Server {
 const io=new Server(server,{transports:['websocket'],maxHttpBufferSize:8192,
  cors:{origin:options.origin},allowRequest:(req,done)=>done(null,req.headers.origin===options.origin)});
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
  socket.on('disconnect',()=>{clearTimeout(expiry);clearInterval(monitor);void options.sessions.release(connection).catch(()=>undefined);});
  socket.onAny((event:string,...args:unknown[])=>{
   const now=Date.now();if(now-frameWindow>=1000){frameWindow=now;frameCount=0;}
   if(++frameCount>30){disconnect('RATE_LIMITED');return;}
   const ack=args[args.length-1];
   if(args.length!==2||typeof ack!=='function'){socket.emit('protocol:error',{code:'INVALID_INPUT'});return;}
   if(busy){ack({ok:false,error:{code:'BUSY'}});return;}busy=true;
   void(async()=>{
    if(await options.rateLimits.increment(`rt:event:${connection.userId}`,60)>60)throw new RealtimeError('RATE_LIMITED');
    verifyToken();
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
