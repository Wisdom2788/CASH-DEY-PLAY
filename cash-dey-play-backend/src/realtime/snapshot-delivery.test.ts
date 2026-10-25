import { randomUUID } from 'node:crypto';
import { SnapshotDelivery } from './snapshot-delivery';
import { GameNotice } from './game-notifications';
import { GameUpdate } from './session.repository';
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
const update=(version=1,matchId:string=randomUUID()):GameUpdate=>({matchId,eventId:randomUUID(),view:{version} as GameUpdate['view']});
const ack=(v:GameUpdate)=>({matchId:v.matchId,eventId:v.eventId,version:v.view.version});
function bus(){const listeners=new Set<(value:GameNotice)=>void>();return {subscribe:(fn:(value:GameNotice)=>void)=>{listeners.add(fn);return ()=>{listeners.delete(fn);};},
 emit:(v:GameUpdate,userIds=['tg_123'])=>{for(const fn of listeners)fn({eventId:v.eventId!,matchId:v.matchId,version:v.view.version,userIds});},listeners};}
describe('bounded snapshot delivery',()=>{
 it('delivers initial state, ignores acknowledged duplicates and routes only matching users',async()=>{
  const source=bus();const delivery=new SnapshotDelivery(source);const v=update();const load=jest.fn().mockResolvedValue(v);const send=jest.fn(async x=>ack(x));
  try{delivery.register({userId:'tg_123',load,send,onError:jest.fn()});await settle();expect(send).toHaveBeenCalledTimes(1);
   source.emit(v,['tg_456']);await settle();expect(load).toHaveBeenCalledTimes(1);
   source.emit(v);source.emit(v);await settle();expect(send).toHaveBeenCalledTimes(1);
  }finally{delivery.close();}
 });
 it('retries lost and invalid acknowledgements without advancing the cursor',async()=>{
  const source=bus();const delivery=new SnapshotDelivery(source);const v=update();const send=jest.fn().mockRejectedValueOnce(new Error('lost ack')).mockResolvedValueOnce({...ack(v),version:99}).mockResolvedValue(ack(v));
  try{delivery.register({userId:'tg_123',load:async()=>v,send,onError:jest.fn()});await settle();source.emit(v);await settle();source.emit(v);await settle();
   expect(send).toHaveBeenCalledTimes(3);source.emit(v);await settle();expect(send).toHaveBeenCalledTimes(3);
  }finally{delivery.close();}
 });
 it('coalesces notices and prevents older snapshots from regressing an acknowledged version',async()=>{
  const source=bus();const delivery=new SnapshotDelivery(source);const newer=update(2);let value=newer;
  const send=jest.fn(async x=>ack(x));
  try{delivery.register({userId:'tg_123',load:async()=>value,send,onError:jest.fn()});source.emit(newer);source.emit(newer);await settle();
   expect(send).toHaveBeenCalledTimes(1);value=update(1,newer.matchId);source.emit(value);await settle();expect(send).toHaveBeenCalledTimes(1);
  }finally{delivery.close();}
 });
 it('bounds concurrent recipients and fairly drains queued work',async()=>{
  const source=bus();const delivery=new SnapshotDelivery(source,5000,1);const v=update();let release!:(value:unknown)=>void;
  const first=jest.fn(()=>new Promise(resolve=>{release=resolve;}));const load=jest.fn(async()=>v);
  try{delivery.register({userId:'tg_123',load,send:first,onError:jest.fn()});delivery.register({userId:'tg_456',load,send:async x=>ack(x),onError:jest.fn()});
   await settle();expect(load).toHaveBeenCalledTimes(1);release(ack(v));await settle();expect(load).toHaveBeenCalledTimes(2);
  }finally{delivery.close();}
 });
 it('cancels queued/disconnected recipients and closes the source subscription',async()=>{
  const source=bus();const delivery=new SnapshotDelivery(source);const v=update();let resolve!:(value:GameUpdate)=>void;
  const send=jest.fn();const remove=delivery.register({userId:'tg_123',load:()=>new Promise(r=>{resolve=r;}),send,onError:jest.fn()});
  remove();delivery.close();resolve(v);await settle();expect(send).not.toHaveBeenCalled();expect(source.listeners.size).toBe(0);
 });
 it('reports authoritative read failures without sending a packet',async()=>{
  const source=bus();const delivery=new SnapshotDelivery(source);const error=new Error('revoked');const onError=jest.fn();const send=jest.fn();
  try{delivery.register({userId:'tg_123',load:async()=>{throw error;},send,onError});await settle();expect(onError).toHaveBeenCalledWith(error);expect(send).not.toHaveBeenCalled();}
  finally{delivery.close();}
 });
 it('recovers missed notices on the periodic SQL catch-up path',async()=>{
  jest.useFakeTimers();const source=bus();const delivery=new SnapshotDelivery(source);let value:GameUpdate|null=null;const send=jest.fn(async x=>ack(x));
  try{delivery.register({userId:'tg_123',load:async()=>value,send,onError:jest.fn()});await jest.advanceTimersByTimeAsync(1);expect(send).not.toHaveBeenCalled();
   value=update();await jest.advanceTimersByTimeAsync(5000);expect(send).toHaveBeenCalledTimes(1);
  }finally{delivery.close();jest.useRealTimers();}
 });
});
