import express from 'express';
import request from 'supertest';
import { createStreakRouter } from './streak.routes';
import { createAuthMiddleware } from '../middleware/auth.middleware';
import { buildSignedTelegramInitData } from '../telegram/verify-telegram-init-data';
import { errorHandler } from '../middleware/error-handler.middleware';
import { StreakRepository } from '../../rewards/streak.repository';

const bot='streak-contract-test-bot';
const claim=jest.fn().mockResolvedValue({amountKobo:'5000'});
const recordLogin=jest.fn().mockResolvedValue({serverDate:'2026-10-27'});
function app(enabled=true) {
  const a=express();a.use(express.json());
  a.use(createAuthMiddleware({jwtSecret:'x'.repeat(40),allowDevAuthBypass:false,telegramBotToken:bot,
    loadUser:async()=>({telegramId:123,tokenVersion:0})}));
  a.use('/api/streak',createStreakRouter({claim,recordLogin,progress:async()=>({cycle:null})} as unknown as StreakRepository,enabled));
  a.use(errorHandler);return a;
}
const headers=()=>({'X-Telegram-Init-Data':buildSignedTelegramInitData({botToken:bot,user:{id:123,first_name:'Test'},authDate:Math.floor(Date.now()/1000)})});
const id='67f6a2eb-8fb3-4af4-99d8-e78c5b90a441';
const path=`/api/streak/cycles/${id}/milestones/10/claim`;
describe('streak reward HTTP contracts',()=>{
  beforeEach(()=>jest.clearAllMocks());
  it('requires registered authentication and stays unavailable when disabled',async()=>{
    expect((await request(app()).post(path).send({})).status).toBe(401);
    expect((await request(app(false)).post(path).set(headers()).send({})).status).toBe(503);
    expect(claim).not.toHaveBeenCalled();
  });
  it.each([{userId:'tg_456'},{tier:'PREMIUM'},{amountKobo:5000},{date:'2026-10-01'},{adSuccess:true}])('rejects claimed authority %j',async body=>{
    expect((await request(app()).post(path).set(headers()).set('Idempotency-Key','valid-key-001').send(body)).status).toBe(400);
    expect(claim).not.toHaveBeenCalled();
  });
  it('requires idempotency and binds the empty validated request to its authenticated actor',async()=>{
    expect((await request(app()).post(path).set(headers()).send({})).status).toBe(400);
    const response=await request(app()).post(path).set(headers()).set('Idempotency-Key','valid-key-001').send({});
    expect(response.status).toBe(200);expect(response.headers['cache-control']).toBe('no-store');
    expect(claim).toHaveBeenCalledWith('tg_123',id,10,'valid-key-001');
  });
  it('rejects unknown milestone/UUID/query and records login without accepting client dates',async()=>{
    expect((await request(app()).post(path.replace('/10/','/14/')).set(headers()).send({})).status).toBe(400);
    expect((await request(app()).post(path.replace(id,'bad')).set(headers()).send({})).status).toBe(400);
    expect((await request(app()).post(path+'?userId=tg_456').set(headers()).send({})).status).toBe(400);
    expect((await request(app()).post('/api/streak/login').set(headers()).send({today:'2026-10-01'})).status).toBe(400);
    expect((await request(app()).post('/api/streak/login').set(headers()).send({})).status).toBe(200);
    expect(recordLogin).toHaveBeenCalledWith('tg_123');
  });
});
