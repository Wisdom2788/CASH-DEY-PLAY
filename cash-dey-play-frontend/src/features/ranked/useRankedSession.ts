import { useEffect,useRef,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import WebApp from '@twa-dev/sdk';
import { io,Socket } from 'socket.io-client';
import { z } from 'zod';
import { useAuthStore } from '../../store/auth.store';
import { rankedSnapshotSchema,RankedSnapshot,RankedCommand } from './contracts';
const pushSchema=z.strictObject({deliveryId:z.string().uuid(),snapshot:rankedSnapshotSchema});
const errorSchema=z.object({ok:z.literal(false),error:z.object({code:z.string().max(64)})});
const responseSchema=z.object({ok:z.literal(true),data:rankedSnapshotSchema});
export function useRankedSession(enabled:boolean){
 const queryClient=useQueryClient();const settled=useRef<string|null>(null);
 const token=useAuthStore(s=>s.token);const socket=useRef<Socket|null>(null);const busy=useRef(false);const current=useRef<RankedSnapshot|null>(null);
 const [snapshotToken,setSnapshotToken]=useState<string|null>(null);const [snapshot,setSnapshot]=useState<RankedSnapshot|null>(null);const [connected,setConnected]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState<string|null>(null);const [clock,setClock]=useState({server:0,local:0});const [now,setNow]=useState(Date.now);
 useEffect(()=>{
  if(!enabled||!token)return;
  let active=true;current.current=null;busy.current=false;
  const base=import.meta.env.VITE_API_URL||'http://localhost:3000/api';const url=new URL(base,window.location.href);url.pathname='/';url.search='';url.hash='';
  const client=io(url.origin,{auth:{token},transports:['websocket'],autoConnect:false,reconnection:true,reconnectionDelay:1000,reconnectionDelayMax:10000,randomizationFactor:0.5});socket.current=client;
  const accept=(value:unknown)=>{const parsed=rankedSnapshotSchema.safeParse(value);if(!parsed.success){setError('INVALID_SERVER_RESPONSE');return false;}if(!active)return false;const receipt=parsed.data.ranked.result?`${parsed.data.match?.id}:${parsed.data.ranked.result.outcome}`:null;if(receipt&&settled.current!==receipt){settled.current=receipt;void queryClient.invalidateQueries({queryKey:['tasks-state']});void queryClient.invalidateQueries({queryKey:['currentUser']});}current.current=parsed.data;setSnapshotToken(token);setSnapshot(parsed.data);setClock({server:parsed.data.serverTime,local:Date.now()});return true;};
  const resume=()=>{client.timeout(5000).emit('session:resume',{},(err:Error|null,value:unknown)=>{if(!active||err)return;const parsed=responseSchema.safeParse(value);if(parsed.success)accept(parsed.data.data);});};
  client.on('connect',()=>{if(active){setConnected(true);setError(null);resume();}});
  client.on('disconnect',()=>{if(active)setConnected(false);});client.on('connect_error',()=>{if(active){setConnected(false);setError('CONNECTION_UNAVAILABLE');}});
  client.on('session:error',(value:unknown)=>{if(!active)return;const parsed=z.object({code:z.string().max(64)}).safeParse(value);setError(parsed.success?parsed.data.code:'UNAVAILABLE');if(parsed.success&&['UNAUTHORIZED','SESSION_REPLACED'].includes(parsed.data.code))client.disconnect();});
  client.on('session:update',(value:unknown,ack:unknown)=>{if(!active)return;const parsed=pushSchema.safeParse(value);if(parsed.success&&accept(parsed.data.snapshot)&&typeof ack==='function')ack({deliveryId:parsed.data.deliveryId});});
  const heartbeat=setInterval(()=>{const ticket=current.current?.ranked.ticket;if(client.connected&&ticket&&!busy.current)client.timeout(5000).emit('queue:heartbeat',{ticketId:ticket.id},(err:Error|null,value:unknown)=>{if(!active||err)return;const parsed=responseSchema.safeParse(value);if(parsed.success)accept(parsed.data.data);});},15000);
  const ticker=setInterval(()=>{if(active)setNow(Date.now());},1000);
  const foreground=()=>{if(document.visibilityState==='visible'&&client.connected)resume();};document.addEventListener('visibilitychange',foreground);if(WebApp.isVersionAtLeast('8.0'))WebApp.onEvent('activated',foreground);client.connect();
  return ()=>{active=false;clearInterval(heartbeat);clearInterval(ticker);document.removeEventListener('visibilitychange',foreground);if(WebApp.isVersionAtLeast('8.0'))WebApp.offEvent('activated',foreground);client.removeAllListeners();client.disconnect();if(socket.current===client)socket.current=null;current.current=null;};
 },[enabled,token,queryClient]);
 const live=!!snapshot&&['SEARCHING','OFFER','IN_MATCH'].includes(snapshot.phase);
 const inMatch=snapshot?.phase==='IN_MATCH';
 useEffect(()=>{
  if(!enabled)return;
  const closing=live&&WebApp.isVersionAtLeast('6.2')&&!WebApp.isClosingConfirmationEnabled;
  const swipes=inMatch&&WebApp.isVersionAtLeast('7.7')&&WebApp.isVerticalSwipesEnabled;
  if(closing)WebApp.enableClosingConfirmation();if(swipes)WebApp.disableVerticalSwipes();
  return ()=>{if(closing)WebApp.disableClosingConfirmation();if(swipes)WebApp.enableVerticalSwipes();};
 },[enabled,live,inMatch]);
 async function send(event:string,payload:unknown){
  const client=socket.current;if(!client?.connected||busy.current)return;busy.current=true;setPending(true);setError(null);
  try{const value:unknown=await client.timeout(5000).emitWithAck(event,payload);if(socket.current!==client)return;const failed=errorSchema.safeParse(value);if(failed.success){setError(failed.data.error.code);return;}const parsed=responseSchema.safeParse(value);if(!parsed.success)throw new Error('INVALID_SERVER_RESPONSE');current.current=parsed.data.data;setSnapshotToken(token);setSnapshot(parsed.data.data);setClock({server:parsed.data.data.serverTime,local:Date.now()});}
  catch{if(socket.current!==client)return;setError('RESPONSE_UNCERTAIN');if(client.connected)client.emit('session:resume',{},(value:unknown)=>{if(socket.current!==client)return;const parsed=responseSchema.safeParse(value);if(parsed.success){current.current=parsed.data.data;setSnapshotToken(token);setSnapshot(parsed.data.data);}});}
  finally{if(socket.current===client){busy.current=false;setPending(false);}}
 }
 const action=(command:RankedCommand)=>{const match=current.current?.match;if(!match)return Promise.resolve();return send('match:action',{matchId:match.id,actionId:crypto.randomUUID(),expectedVersion:match.view.version,command});};
 const visibleSnapshot=snapshotToken===token?snapshot:null;
 return {snapshot:visibleSnapshot,connected:connected&&!!visibleSnapshot,pending,error,send,action,serverNow:clock.server+Math.max(0,now-clock.local)};
}
