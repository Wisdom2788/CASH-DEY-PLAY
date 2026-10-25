import jwt from 'jsonwebtoken';
import { TelegramAuthError } from '../http/telegram/verify-telegram-init-data';

export interface AccessIdentity {userId:string;telegramId:number;tokenVersion:number;expiresAt:number}
/** Shared REST/socket JWT contract. No identity may come from event payloads or room names. */
export function verifyAccessToken(token:unknown,secret:string,nowSeconds=Math.floor(Date.now()/1000)):AccessIdentity {
 try{
  if(typeof token!=='string'||token.length<1||token.length>8192)throw new Error();
  const decoded=jwt.verify(token,secret,{algorithms:['HS256'],issuer:'cash-dey-play',audience:'cash-dey-play-mini-app',clockTimestamp:nowSeconds});
  if(typeof decoded==='string'||!Number.isSafeInteger(decoded.telegramId)||decoded.telegramId<=0||decoded.userId!==`tg_${decoded.telegramId}`||
   (decoded.tokenVersion!==undefined&&(!Number.isSafeInteger(decoded.tokenVersion)||decoded.tokenVersion<0))||
   !Number.isSafeInteger(decoded.exp)||decoded.exp!<=nowSeconds||decoded.exp!>Math.floor(Number.MAX_SAFE_INTEGER/1000))throw new Error();
  return {userId:decoded.userId,telegramId:decoded.telegramId,tokenVersion:decoded.tokenVersion??0,expiresAt:decoded.exp!*1000};
 }catch{throw new TelegramAuthError('Invalid token');}
}
