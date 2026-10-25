import { Pool } from 'pg';
import { GameRepository } from '../game-engine/repository';
import { PracticeRepository } from '../practice/practice.repository';
import { runGamePass,runGameWorker,waitForNextPass } from './game-worker';

describe('game worker lifecycle',()=>{
 it('does no work if already stopped',async()=>{
  const stop=new AbortController();stop.abort();const pass=jest.fn();
  await runGameWorker(stop.signal,pass,jest.fn());expect(pass).not.toHaveBeenCalled();
 });
 it('finishes in-flight work without starting another pass on shutdown',async()=>{
  const stop=new AbortController();const calls:string[]=[];
  await runGameWorker(stop.signal,async()=>{calls.push('begin');stop.abort();await Promise.resolve();calls.push('commit');},jest.fn(),async()=>{calls.push('wait');});
  expect(calls).toEqual(['begin','commit']);
 });
 it('retries failed passes after a pause, without overlapping or exposing the error',async()=>{
  const stop=new AbortController();const error=jest.fn();const calls:string[]=[];
  const pass=jest.fn().mockImplementationOnce(async()=>{calls.push('failed');throw new Error('private details');})
   .mockImplementationOnce(async()=>{calls.push('recovered');stop.abort();});
  await runGameWorker(stop.signal,pass,error,async()=>{calls.push('wait');});
  expect(calls).toEqual(['failed','wait','recovered']);expect(error).toHaveBeenCalledTimes(1);expect(error.mock.calls[0]).toEqual([]);
 });
 it('interrupts the polling pause immediately on abort',async()=>{
  const stop=new AbortController();const waiting=waitForNextPass(stop.signal,60000);stop.abort();await waiting;
  await waitForNextPass(stop.signal);
 });
 it.each([0,-1,1.5,1001,NaN,Infinity])('rejects invalid batch limit %s before querying',async limit=>{
  const query=jest.fn();await expect(runGamePass({query} as unknown as Pool,limit)).rejects.toThrow('INVALID_BATCH_LIMIT');expect(query).not.toHaveBeenCalled();
 });
 it('stops between candidates on shutdown and does not start completion recovery',async()=>{
  const stop=new AbortController();
  const pool={query:jest.fn().mockResolvedValue({rows:[{id:'first',version:1},{id:'second',version:2}]})} as unknown as Pool;
  const advance=jest.spyOn(GameRepository.prototype,'advanceDueMatch').mockImplementation(async()=>{stop.abort();return 'BOT_ACTION';});
  const completion=jest.spyOn(PracticeRepository.prototype,'recoverCompletions');
  try{
   expect(await runGamePass(pool,100,stop.signal)).toEqual({scanned:2,advanced:1,completed:0});
   expect(advance).toHaveBeenCalledTimes(1);expect(completion).not.toHaveBeenCalled();
  }finally{advance.mockRestore();completion.mockRestore();}
 });
});
