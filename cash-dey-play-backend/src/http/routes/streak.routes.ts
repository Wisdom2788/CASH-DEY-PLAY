import { Router } from 'express';
import { z } from 'zod';
import { StreakRepository } from '../../rewards/streak.repository';
import { readIdempotencyKey } from '../errors/http-errors';
import { requireUserId } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate-request.middleware';

export function createStreakRouter(repository:StreakRepository,enabled:boolean):Router {
  const router=Router();
  router.use((_req,res,next)=>{
    res.setHeader('Cache-Control','no-store');
    if(!enabled){res.status(503).json({error:'StreakRewardsUnavailable'});return;}
    next();
  });
  const empty=z.object({query:z.strictObject({}),body:z.strictObject({})});
  router.get('/progress',validateRequest(z.object({query:z.strictObject({})})),async(req,res)=>{
    res.json({data:await repository.progress(requireUserId(req))});
  });
  router.post('/login',validateRequest(empty),async(req,res)=>{
    res.json({data:await repository.recordLogin(requireUserId(req))});
  });
  router.post('/cycles/:cycleId/milestones/:day/claim',validateRequest(z.object({
    query:z.strictObject({}),body:z.strictObject({}),params:z.strictObject({cycleId:z.uuid(),day:z.enum(['10','20','30'])}),
  })),async(req,res)=>{
    const key=readIdempotencyKey(req.header('Idempotency-Key'));
    res.json({data:await repository.claim(requireUserId(req),String(req.params.cycleId),Number(req.params.day) as 10|20|30,key)});
  });
  return router;
}
