// Real browser -> authenticated gateway -> disposable PostgreSQL/Redis -> browser acceptance.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium,devices } from 'playwright';
import { createServer as createViteServer } from 'vite';
const require=createRequire(new URL('../../cash-dey-play-backend/package.json',import.meta.url));
const {Pool}=require('pg');const Redis=require('ioredis');const jwt=require('jsonwebtoken');
const {attachRealtimeGateway}=require('./dist/realtime/gateway');
const {RealtimeSessionRepository}=require('./dist/realtime/session.repository');
const {GameRepository}=require('./dist/game-engine/repository');
const {RedisGameNotifications}=require('./dist/realtime/game-notifications');
const {runGameDeliveryPass}=require('./dist/realtime/game-delivery.repository');
const {RankedRepository}=require('./dist/ranked/ranked.repository');
const {RedisRankedQueue}=require('./dist/ranked/redis-queue');
const {RankedMatchmaker}=require('./dist/ranked/matchmaker');
const {runGamePass,runGameWorker,waitForNextPass}=require('./dist/workers/game-worker');
const {MemoryRateLimitCounterStore}=require('./dist/http/middleware/rate-limit.middleware');
const db=process.env.TEST_DATABASE_URL,redisUrl=process.env.TEST_REDIS_URL;
if(!db||!/(?:^|_)test(?:_|$)/i.test(new URL(db).pathname.slice(1))||!redisUrl||new URL(redisUrl).pathname!=='/15')throw new Error('Dedicated disposable test database and Redis/15 required');
const schema='cdp_browser_'+randomUUID().replaceAll('-','');const admin=new Pool({connectionString:db});
const pool=new Pool({connectionString:db,options:`-c search_path=${schema}`,max:12});const redis=new Redis(redisUrl,{lazyConnect:true,maxRetriesPerRequest:1,commandTimeout:2000});redis.on('error',()=>{});
const queue=new RedisRankedQueue(redis,'test-browser-'+randomUUID());const api=createServer();const stop=new AbortController();const failures=[];let gateway,vite,browser,notifications;let loops=[];let delivered=0;
try{
 await admin.query(`CREATE SCHEMA "${schema}"`);
 const migrations=fileURLToPath(new URL('../../cash-dey-play-backend/prisma/migrations/',import.meta.url));
 for(const name of (await readdir(migrations)).filter(x=>!x.endsWith('.toml')).sort())await pool.query(await readFile(`${migrations}/${name}/migration.sql`,'utf8'));
 await pool.query("INSERT INTO users(id,telegram_id,first_name) VALUES('tg_123001',123001,'Player A'),('tg_123002',123002,'Player B')");
 await redis.connect();await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
 process.env.VITE_ENABLE_RANKED='true';process.env.VITE_API_URL=`http://127.0.0.1:${api.address().port}/api`;
 vite=await createViteServer({server:{host:'127.0.0.1',port:0}});await vite.listen();const origin=`http://127.0.0.1:${vite.httpServer.address().port}`;
 const subscriber=new Redis(redisUrl,{maxRetriesPerRequest:1,commandTimeout:2000});subscriber.on('error',()=>{});const relay='test-browser-relay:'+randomUUID();notifications=new RedisGameNotifications(subscriber,relay);await notifications.start();
 const secret='real-browser-fixture-secret-'.repeat(2);const ranked=new RankedRepository(pool),games=new GameRepository(pool);
 const sessions=new RealtimeSessionRepository(pool);gateway=attachRealtimeGateway(api,{jwtSecret:secret,origin,sessions,delivery:{source:notifications,snapshots:sessions},rateLimits:new MemoryRateLimitCounterStore(),actions:{games,rateLimits:new MemoryRateLimitCounterStore()},ranked:{repository:ranked,queue,rateLimits:new MemoryRateLimitCounterStore()}});
 const matcher=new RankedMatchmaker(ranked,queue);loops=[runGameWorker(stop.signal,()=>matcher.pass(stop.signal),()=>failures.push('matcher'),s=>waitForNextPass(s,500)),runGameWorker(stop.signal,()=>runGamePass(pool,100,stop.signal),()=>failures.push('games'),s=>waitForNextPass(s,500)),runGameWorker(stop.signal,async()=>{delivered+=await runGameDeliveryPass(pool,notice=>redis.publish(relay,JSON.stringify(notice)),100,stop.signal);},()=>failures.push('delivery'),s=>waitForNextPass(s,250))];
 browser=await chromium.launch({headless:true,channel:'chromium'});const contexts=[],pages=[],errors=[];
 for(const id of [123001,123002]){
  const context=await browser.newContext({...devices['Pixel 7'],timezoneId:'Africa/Lagos'});contexts.push(context);
  const token=jwt.sign({userId:`tg_${id}`,telegramId:id,tokenVersion:0},secret,{issuer:'cash-dey-play',audience:'cash-dey-play-mini-app',expiresIn:120});
  await context.addInitScript(value=>{window.__RANKED_TEST_TOKEN=value;window.__RANKED_TEST_SOCKETS=[];const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);window.__RANKED_TEST_SOCKETS.push(this);}};},token);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));pages.push(page);await page.goto(origin+'/acceptance/ranked-harness.html');
  await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent==='Connected');
 }
 const [a,b]=pages;
 await a.getByRole('button',{name:'Find ranked opponent'}).click();await b.getByRole('button',{name:'Find ranked opponent'}).click();
 await a.getByRole('button',{name:'Accept match',exact:true}).click();await b.getByRole('button',{name:'Accept match',exact:true}).click();
 for(const page of pages)await page.getByRole('region',{name:'Game board'}).waitFor();
 const match=(await pool.query("SELECT id FROM game_matches WHERE status='ACTIVE'")).rows[0].id;
 await a.getByRole('button',{name:'Draw',exact:true}).click();
 await b.getByRole('heading',{name:'Your turn',exact:true}).waitFor();assert.equal(await a.getByRole('alert').count(),0,'real move acknowledgement must parse');
 assert.equal((await pool.query('SELECT version FROM game_matches WHERE id=$1',[match])).rows[0].version,1);
 const deadline=(await pool.query('SELECT private_state FROM game_matches WHERE id=$1',[match])).rows[0].private_state.deadlineAt;
 await contexts[0].setOffline(true);await a.evaluate(()=>window.__RANKED_TEST_SOCKETS.filter(s=>s.url.includes('/socket.io/')).forEach(s=>s.close()));await a.getByRole('status').filter({hasText:/^Disconnected/}).waitFor();await contexts[0].setOffline(false);await a.getByRole('status').filter({hasText:/^Connected$/}).waitFor();
 assert.equal((await pool.query('SELECT private_state FROM game_matches WHERE id=$1',[match])).rows[0].private_state.deadlineAt,deadline,'reconnect cannot reset turn time');
 await b.getByRole('button',{name:'Forfeit',exact:true}).click();await b.getByRole('button',{name:'Confirm forfeit',exact:true}).click();
 await a.getByRole('heading',{name:'WIN',exact:true}).waitFor();await b.getByRole('heading',{name:'LOSS',exact:true}).waitFor();
 assert.deepEqual((await pool.query('SELECT user_id,outcome FROM ranked_results ORDER BY user_id')).rows,[{user_id:'tg_123001',outcome:'WIN'},{user_id:'tg_123002',outcome:'LOSS'}]);
 assert.deepEqual((await pool.query('SELECT id,points FROM users ORDER BY id')).rows,[{id:'tg_123001',points:50},{id:'tg_123002',points:0}]);
 for(const page of pages){assert.equal(await page.getByRole('button',{name:/rematch/i}).count(),0);await page.getByRole('button',{name:'Find ranked opponent',exact:true}).click();await page.getByRole('region',{name:'Searching'}).waitFor();}
 await new Promise(resolve=>setTimeout(resolve,1500));
 assert.equal((await pool.query('SELECT count(*)::int n FROM game_matches')).rows[0].n,1,'same-day pairing cannot start a second match');
 assert.equal((await pool.query("SELECT count(*)::int n FROM ranked_offers")).rows[0].n,1,'same-day pairing cannot generate a second offer');
 assert.equal((await pool.query("SELECT count(*)::int n FROM ranked_reservations WHERE state='STARTED'")).rows[0].n,2);
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);assert.ok(delivered>=2,'committed move/finish outbox relayed through Redis');
 await a.screenshot({path:'/tmp/ranked-live-browser.png',fullPage:true});console.log(JSON.stringify({rankedLiveBrowser:{passed:true,players:2,flow:'queue/offer/move/network reconnect/SQL settlement/task points/repeat pairing blocked',matches:1,resultReceipts:2,startedCharges:2,pointsAwarded:50,privateProjection:true,relayedCommittedEvents:delivered}}));
}finally{
 stop.abort();if(browser)await browser.close();await Promise.allSettled(loops);if(gateway)await new Promise(resolve=>gateway.close(resolve));else if(api.listening)await new Promise(resolve=>api.close(resolve));if(vite)await vite.close();notifications?.close();
 const keys=await redis.keys(queue.prefix+'*').catch(()=>[]);if(keys.length)await redis.del(...keys);redis.disconnect();await pool.end();await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await admin.end();
}
