import request from 'supertest';
import { createApp } from '../../app';
import { MemoryRateLimitCounterStore } from '../middleware/rate-limit.middleware';
import { buildSignedTelegramInitData } from '../telegram/verify-telegram-init-data';
const token='ledger-contract-test-bot-token';
const getEntries=jest.fn().mockResolvedValue([]);
function app() {
  return createApp({pool:{} as any,authService:{} as any,loginStreakService:{} as any,monthlyLeaderboardService:{} as any,
    userRepository:{findAuthState:async()=>({telegramId:123,tokenVersion:0})} as any,tasksRepository:{} as any,
    walletRepository:{getEntries,getBalance:async()=>({balanceNgn:10,availableKobo:'1000'})} as any,
    telegramBotToken:token,jwtSecret:'x'.repeat(40),corsOrigin:'http://localhost',allowDevAuthBypass:false,
    rateLimitStore:new MemoryRateLimitCounterStore(),userRequestsPerMinute:100,ipRequestsPerMinute:100});
}
function headers() {return {'X-Telegram-Init-Data':buildSignedTelegramInitData({botToken:token,user:{id:123,first_name:'Test'},authDate:Math.floor(Date.now()/1000)})};}
describe('ledger read contracts',()=>{
  beforeEach(()=>getEntries.mockClear());
  it('requires authentication',async()=>{expect((await request(app()).get('/api/wallet/entries')).status).toBe(401);expect(getEntries).not.toHaveBeenCalled();});
  it.each(['limit=0','limit=101','limit=1.5','limit=2&limit=3','createdAt=2026-10-25T00:00:00.000000Z','userId=tg_999'])('rejects invalid page %s',async query=>{
    expect((await request(app()).get('/api/wallet/entries?'+query).set(headers())).status).toBe(400);
    expect(getEntries).not.toHaveBeenCalled();
  });
  it('scopes reads to the registered player and returns decimal-string balance',async()=>{
    const response=await request(app()).get('/api/wallet/entries?limit=25').set(headers());
    expect(response.status).toBe(200);expect(response.body).toEqual({data:[],nextCursor:null});
    expect(response.headers['cache-control']).toBe('no-store');
    expect(getEntries).toHaveBeenCalledWith('tg_123',25,undefined);
    expect((await request(app()).get('/api/wallet/balance').set(headers())).body.data.availableKobo).toBe('1000');
  });
});
