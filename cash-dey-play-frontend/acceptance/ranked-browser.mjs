// Component acceptance with a local protocol fixture. Real authority is tested separately on PostgreSQL/Redis.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium,webkit,devices } from 'playwright';
import { createServer as createViteServer } from 'vite';
const backendRequire=createRequire(new URL('../../cash-dey-play-backend/package.json',import.meta.url));
const {Server}=backendRequire('socket.io');
const server=createServer();const io=new Server(server,{transports:['websocket'],cors:{origin:true}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
process.env.VITE_ENABLE_RANKED='true';process.env.VITE_API_URL=`http://127.0.0.1:${server.address().port}/api`;
const vite=await createViteServer({server:{host:'127.0.0.1',port:0}});await vite.listen();
const address=`http://127.0.0.1:${vite.httpServer.address().port}/acceptance/ranked-harness.html`;
const commands=[];let state;let latest;let connections=0;
const card={id:'CIRCLE-3',suit:'CIRCLE',number:3};
function reset(){const now=Date.now();state={protocolVersion:1,serverTime:now,phase:'IDLE',match:null,ranked:{ticket:null,offer:null,allowance:{day:'2026-10-26',used:0,reserved:0,remaining:3,cooldownUntil:null,resetAt:now+3600000,isPremium:false},penalty:{misses:0,lockedUntil:null},rematches:[],recentOpponents:[],result:null}};}
function push(socket){state.serverTime=Date.now();socket.emit('session:update',{deliveryId:randomUUID(),snapshot:state},()=>{});}
function start(){state.phase='IN_MATCH';state.ranked.ticket=null;state.ranked.offer=null;state.ranked.rematches=[];state.ranked.allowance.used++;state.ranked.allowance.remaining--;state.ranked.allowance.reserved=0;state.match={id:randomUUID(),mode:'RANKED',view:{version:0,ruleVersion:'whot-v1',status:'ACTIVE',winner:null,reason:null,seat:0,turn:0,hand:[card,{id:'WHOT-0',suit:'WHOT',number:20}],opponentCount:6,top:card,marketCount:41,nominated:null,pendingCount:0,deadlineAt:Date.now()+30000,plays:[card.id,'WHOT-0'],canDraw:true,canPass:false}};}
io.on('connection',socket=>{latest=socket;connections++;push(socket);socket.onAny((event,payload,ack)=>{
 if(typeof ack!=='function')return;
 if(event==='queue:join'){state.phase='OFFER';state.ranked.ticket={id:randomUUID(),state:'OFFER',joinedAt:Date.now(),searchExpiresAt:Date.now()+120000};state.ranked.offer={id:randomUUID(),state:'PENDING',expiresAt:Date.now()+10000,acceptedYou:false,acceptedOpponent:true};state.ranked.allowance.reserved=1;}
 if(event==='queue:cancel'){state.phase='IDLE';state.ranked.ticket=null;state.ranked.offer=null;state.ranked.allowance.reserved=0;}
 if(event==='offer:respond')start();
 if(event==='match:action'){
  commands.push(payload);assert.equal(payload.expectedVersion,state.match.view.version);assert.equal(typeof payload.actionId,'string');assert.equal('winner' in payload,false);
  const view=state.match.view;view.version++;
  if(payload.command.type==='PLAY'){view.hand=view.hand.filter(c=>c.id!==payload.command.cardId);view.plays=view.hand.map(c=>c.id);view.nominated=payload.command.chosenSuit??null;}
  if(payload.command.type==='FORFEIT'){state.phase='RESULT';view.status='FINISHED';view.winner=1;view.reason='FORFEIT';view.deadlineAt=null;view.plays=[];view.canDraw=false;state.ranked.result={outcome:'LOSS',reason:'FORFEIT',lagos_date:'2026-10-26'};state.ranked.recentOpponents=[{id:'tg_456',name:'Opponent'}];}
 }
 if(event==='rematch:request')state.ranked.rematches=[{id:randomUUID(),opponentId:'tg_456',incoming:true,expiresAt:Date.now()+15000}];
 if(event==='rematch:respond')start();
 state.serverTime=Date.now();ack({ok:true,data:state});push(socket);
 });});
try{
 for(const [name,engine,device] of [['chromium-mobile',chromium,devices['Pixel 7']],['webkit-mobile',webkit,devices['iPhone 13']]]){
  reset();const browser=await engine.launch({headless:true,...(engine===chromium?{channel:"chromium"}:{})});try{const context=await browser.newContext({...device,timezoneId:'Africa/Lagos'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(address);
   await page.getByRole('button',{name:'Find ranked opponent'}).click();await page.getByRole('button',{name:'Accept match',exact:true}).click();
   await page.getByRole('button',{name:'WHOT 20',exact:true}).click();await page.getByRole('button',{name:'CIRCLE',exact:true}).click();assert.equal(commands.at(-1).command.chosenSuit,'CIRCLE');
   const count=connections;latest.conn.close();await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent==='Connected');
   for(let i=0;i<100&&connections===count;i++)await new Promise(resolve=>setTimeout(resolve,25));assert.ok(connections>count,'transport reconnect occurred');
   await page.getByRole('button',{name:'Forfeit',exact:true}).click();await page.getByRole('button',{name:'Confirm forfeit',exact:true}).click();await page.getByRole('heading',{name:'LOSS',exact:true}).waitFor();
   await page.getByRole('button',{name:'Request rematch · Opponent',exact:true}).click();await page.getByRole('button',{name:'Accept rematch',exact:true}).click();await page.getByRole('region',{name:'Game board'}).waitFor();
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false,'no horizontal overflow');assert.deepEqual(errors,[]);
   await page.screenshot({path:`/tmp/ranked-${name}.png`,fullPage:true});console.log(JSON.stringify({browser:name,passed:true,flow:'offer/play/wild/transport reconnect/result/rematch',viewport:page.viewportSize(),horizontalOverflow:overflow}));await context.close();
  }finally{await browser.close();}
 }
}finally{await vite.close();await new Promise(resolve=>io.close(resolve));}
