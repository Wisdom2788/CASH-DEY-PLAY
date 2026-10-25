import { Pool } from 'pg';
import { PracticeRepository } from './practice.repository';

describe('practice recovery bounds',()=>{
 it.each([0,-1,1.5,1001,NaN,Infinity])('rejects invalid limit %s before accessing storage',async limit=>{
  const query=jest.fn();
  const repo=new PracticeRepository({query} as unknown as Pool);
  await expect(repo.recoverCompletions(limit)).rejects.toMatchObject({code:'INVALID_INPUT'});
  expect(query).not.toHaveBeenCalled();
 });
 it('stops after failure while preserving prior committed records for retry',async()=>{
  const query=jest.fn().mockResolvedValue({rows:[{match_id:'one'},{match_id:'two'},{match_id:'three'}]});
  const repo=new PracticeRepository({query} as unknown as Pool);
  const record=jest.spyOn(repo,'recordCompletion').mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('storage failed'));
  await expect(repo.recoverCompletions(3)).rejects.toThrow('storage failed');
  expect(record.mock.calls).toEqual([['one'],['two']]);
 });
 it('stops before starting another completion transaction on shutdown',async()=>{
  const stop=new AbortController();
  const query=jest.fn().mockResolvedValue({rows:[{match_id:'one'},{match_id:'two'}]});
  const repo=new PracticeRepository({query} as unknown as Pool);
  const record=jest.spyOn(repo,'recordCompletion').mockImplementation(async()=>{stop.abort();return true;});
  expect(await repo.recoverCompletions(100,stop.signal)).toEqual({scanned:2,recorded:1});
  expect(record).toHaveBeenCalledTimes(1);
 });

});
