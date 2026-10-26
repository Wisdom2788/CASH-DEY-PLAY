import { RankedDelivery } from './ranked-delivery';
const pause=()=>new Promise(resolve=>setImmediate(resolve));
describe('automatic ranked snapshot recovery',()=>{
 it('ignores clock-only changes, retries lost ACK and sends changed offers',async()=>{
  let phase='SEARCHING',clock=1;const send=jest.fn().mockRejectedValueOnce(new Error('lost')).mockImplementation(async value=>({deliveryId:value.deliveryId}));
  const delivery=new RankedDelivery(60000);delivery.register({load:async()=>({serverTime:clock++,phase}),send,onError:jest.fn()});
  try{await pause();delivery.wake();await pause();expect(send).toHaveBeenCalledTimes(2);delivery.wake();await pause();expect(send).toHaveBeenCalledTimes(2);phase='OFFER';delivery.wake();await pause();expect(send).toHaveBeenCalledTimes(3);}finally{delivery.close();}
 });
 it('bounds simultaneous reads and isolates slow acknowledgements',async()=>{
  let active=0,max=0;const load=async()=>{active++;max=Math.max(max,active);await pause();active--;return {phase:'OFFER'};};
  const delivery=new RankedDelivery(60000,3);let release:()=>void=()=>{};const slow=new Promise<void>(resolve=>release=resolve);const fast=jest.fn(async v=>({deliveryId:v.deliveryId}));
  delivery.register({load,send:()=>slow,onError:jest.fn()});for(let i=0;i<50;i++)delivery.register({load,send:fast,onError:jest.fn()});
  try{for(let i=0;i<25;i++)await pause();expect(max).toBe(3);expect(fast).toHaveBeenCalledTimes(50);}finally{release();delivery.close();}
 });
 it('does not send a private projection after unregistering while SQL is in flight',async()=>{
  let resolve:(v:unknown)=>void=()=>{};const load=new Promise(r=>resolve=r);const send=jest.fn();const delivery=new RankedDelivery(60000);
  const unregister=delivery.register({load:()=>load,send,onError:jest.fn()});unregister();resolve({phase:'OFFER'});await pause();expect(send).not.toHaveBeenCalled();delivery.close();
 });
});
