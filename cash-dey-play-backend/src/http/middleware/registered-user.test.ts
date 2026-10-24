import jwt from "jsonwebtoken";
import request from "supertest";
import express from "express";
import { createAuthMiddleware,requireUserId } from "./auth.middleware";
import { errorHandler } from "./error-handler.middleware";
import { buildSignedTelegramInitData } from "../telegram/verify-telegram-init-data";

const secret="x".repeat(40);
function appWith(state:{telegramId:number;tokenVersion:number}|null) {
  const app=express();
  app.use(createAuthMiddleware({jwtSecret:secret,telegramBotToken:"bot",allowDevAuthBypass:false,loadUser:async()=>state}));
  app.get("/protected",(req,res)=>{res.json({userId:requireUserId(req)});}); app.use(errorHandler);return app;
}
describe("registered user and revocable sessions",()=>{
  const sign=(version:number)=>jwt.sign({userId:"tg_123",telegramId:123,tokenVersion:version},secret,{issuer:"cash-dey-play",audience:"cash-dey-play-mini-app",expiresIn:60});
  it("rejects a verified Telegram identity that has not signed in",async()=>{
    const signed=buildSignedTelegramInitData({botToken:"bot",user:{id:123},authDate:Math.floor(Date.now()/1000)});
    expect((await request(appWith(null)).get("/protected").set("X-Telegram-Init-Data",signed)).status).toBe(401);
  });
  it("uses the same canonical identity for JWT and signed data",async()=>{
    const app=appWith({telegramId:123,tokenVersion:0});
    const signed=buildSignedTelegramInitData({botToken:"bot",user:{id:123},authDate:Math.floor(Date.now()/1000)});
    expect((await request(app).get("/protected").auth(sign(0),{type:"bearer"})).body.userId).toBe("tg_123");
    expect((await request(app).get("/protected").set("X-Telegram-Init-Data",signed)).body.userId).toBe("tg_123");
  });
  it("rejects old tokens immediately after the account version changes",async()=>{
    const app=appWith({telegramId:123,tokenVersion:1});
    expect((await request(app).get("/protected").auth(sign(0),{type:"bearer"})).status).toBe(401);
    expect((await request(app).get("/protected").auth(sign(1),{type:"bearer"})).status).toBe(200);
  });
});
