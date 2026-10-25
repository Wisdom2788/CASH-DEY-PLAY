import jwt from 'jsonwebtoken';
import { verifyAccessToken } from './access-token';
const secret='x'.repeat(40);const claims={userId:'tg_123',telegramId:123,tokenVersion:0};
const options={issuer:'cash-dey-play',audience:'cash-dey-play-mini-app'};
describe('shared access token contract',()=>{
 it('requires bounded expiry and preserves legacy version-zero tokens',()=>{
  expect(verifyAccessToken(jwt.sign({...claims,exp:200},secret,options),secret,100)).toEqual({...claims,expiresAt:200000});
  expect(verifyAccessToken(jwt.sign({userId:'tg_123',telegramId:123,exp:200},secret,options),secret,100).tokenVersion).toBe(0);
 });
 it.each([
  {...claims},{...claims,exp:100},{...claims,exp:99},{...claims,exp:200,tokenVersion:-1},
  {...claims,exp:200,userId:'tg_456'},{...claims,exp:200,telegramId:1.5},{...claims,exp:200,nbf:150},
  {...claims,exp:1e15},
 ])('rejects malformed, expired or premature claims %j',payload=>{
  expect(()=>verifyAccessToken(jwt.sign(payload,secret,options),secret,100)).toThrow('Invalid token');
 });
 it('rejects wrong algorithm, issuer, audience, key and oversized or non-string input',()=>{
  const payload={...claims,exp:200};
  for(const token of [jwt.sign(payload,secret,{...options,algorithm:'HS512'}),jwt.sign(payload,secret,{...options,issuer:'other'}),
   jwt.sign(payload,secret,{...options,audience:'other'}),jwt.sign(payload,'wrong',options),'x'.repeat(8193),null,{}])
   expect(()=>verifyAccessToken(token,secret,100)).toThrow('Invalid token');
 });
});
