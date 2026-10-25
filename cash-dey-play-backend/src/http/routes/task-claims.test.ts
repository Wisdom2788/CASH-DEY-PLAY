import request from 'supertest';
import { createApp } from '../../app';
import { buildSignedTelegramInitData } from '../telegram/verify-telegram-init-data';
import { MemoryRateLimitCounterStore } from '../middleware/rate-limit.middleware';
const bot='task-claims-test-bot';const claim=jest.fn().mockResolvedValue({pointsEarned:50,alreadyClaimed:false});
const app=()=>createApp({pool:{} as any,authService:{} as any,userRepository:{findAuthState:async()=>({telegramId:123,tokenVersion:0})} as any,tasksRepository:{claimExemptTask:claim} as any,walletRepository:{} as any,loginStreakService:{} as any,monthlyLeaderboardService:{} as any,telegramBotToken:bot,jwtSecret:'x'.repeat(40),corsOrigin:'http://localhost',allowDevAuthBypass:false,rateLimitStore:new MemoryRateLimitCounterStore(),userRequestsPerMinute:60,ipRequestsPerMinute:60});
const signed=()=>({'X-Telegram-Init-Data':buildSignedTelegramInitData({botToken:bot,user:{id:123,first_name:'Test'},authDate:Math.floor(Date.now()/1000)})});
describe('task claim authority',()=>{
 beforeEach(()=>claim.mockClear());
 it('requires signed identity',async()=>{expect((await request(app()).post('/api/tasks/MANDATORY_VIDEO_LOGIN/claim').send({})).status).toBe(401);expect(claim).not.toHaveBeenCalled();});
 it.each(['WIN_MATCH','BONUS_ALL_COMPLETE','arbitrary'])('rejects client-selected source %s',async key=>{expect((await request(app()).post(`/api/tasks/${key}/claim`).set(signed()).send({})).status).toBe(400);expect(claim).not.toHaveBeenCalled();});
 it('rejects proof/premium assertions and scopes eligible claims to authenticated identity',async()=>{
  expect((await request(app()).post('/api/tasks/MANDATORY_VIDEO_LOGIN/claim').set(signed()).send({premium:true,userId:'tg_999'})).status).toBe(400);expect(claim).not.toHaveBeenCalled();
  expect((await request(app()).post('/api/tasks/MANDATORY_VIDEO_LOGIN/claim').set(signed()).send({})).status).toBe(200);expect(claim).toHaveBeenCalledWith('tg_123','MANDATORY_VIDEO_LOGIN');
 });
});
