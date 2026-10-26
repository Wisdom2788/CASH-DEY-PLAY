import { randomUUID } from 'node:crypto';
import { Pool,PoolClient } from 'pg';
import { loadEntitlements,PREMIUM_SQL } from '../entitlements/entitlements';
import { APPROVED_WHOT_RULES } from '../game-engine/approved-rules';
import { createGame,projectGame,restoreGame } from '../game-engine/engine';
import { cryptoRandomInt } from '../game-engine/crypto-random';
import { RealtimeConnection,RealtimeSessionRepository } from '../realtime/session.repository';

export class RankedError extends Error {
 constructor(readonly code:'INVALID_INPUT'|'ALREADY_IN_MATCH'|'ALREADY_IN_QUEUE'|'RANKED_DAILY_LIMIT'|'RANKED_COOLDOWN'|'STALE_TICKET'|'OFFER_EXPIRED'|'INCOMPATIBLE'|'STALE_OWNER'|'RANKED_LOCKED'|'REMATCH_LIMIT'|'REMATCH_EXPIRED'){super(code);}
}
interface Ticket {id:string;user_id:string;connection_id:string;request_key:string;state:'SEARCHING'|'OFFER'|'STARTED'|'CANCELLED'|'EXPIRED';joined_at:Date;last_seen_at:Date;search_expires_at:Date}
interface Offer {id:string;a_ticket:string;b_ticket:string;state:'PENDING'|'STARTED'|'CANCELLED'|'EXPIRED';accepted_a:boolean;accepted_b:boolean;created_at:Date;expires_at:Date;match_id:string|null}
export interface RankedFence {token:string;generation:string}
export interface QueueCacheEntry {userId:string;epoch:string;ticketId:string|null;connectionId:string|null;joinedAt:number;expiresAt:number;lastSeenAt:number;searching:boolean}
export interface Allowance {day:string;used:number;reserved:number;remaining:number;cooldownUntil:number|null;resetAt:number;isPremium:boolean}
export function rankedCooldownUntil(isPremium:boolean,endedAt:number|null,now:number,resetAt:number):number|null{
 const end=endedAt===null?0:Math.min(resetAt,endedAt+3600000);return !isPremium&&end>now?end:null;
}
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
/** Durable ranked admission. All SQL writers share player locks with practice/session claims. */
export class RankedRepository {
 private readonly sessions:RealtimeSessionRepository;
 constructor(private readonly pool:Pool){this.sessions=new RealtimeSessionRepository(pool);}
 private async tx<T>(work:(c:PoolClient)=>Promise<T>):Promise<T>{const c=await this.pool.connect();try{
  await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='10s'");
  const value=await work(c);await c.query('COMMIT');return value;
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}}
 private async lockUsers(c:PoolClient,ids:string[]):Promise<void>{
  const rows=await c.query('SELECT id FROM users WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[[...ids].sort()]);
  if(rows.rowCount!==new Set(ids).size)throw new RankedError('INVALID_INPUT');
  for(const id of [...ids].sort()){
   await c.query('INSERT INTO player_admissions(user_id) VALUES($1) ON CONFLICT DO NOTHING',[id]);
   await c.query('SELECT o.id FROM premium_orders o JOIN paid_entitlements e ON e.order_id=o.id WHERE o.user_id=$1 FOR SHARE OF o,e',[id]);
  }
 }
 private async clock(c:PoolClient):Promise<{at:Date;day:string;reset:Date}>{return (await c.query<{at:Date;day:string;reset:Date}>(`SELECT t AS at,(t AT TIME ZONE 'Africa/Lagos')::date::text AS day,
  (((t AT TIME ZONE 'Africa/Lagos')::date+1)::timestamp AT TIME ZONE 'Africa/Lagos') AS reset FROM (SELECT clock_timestamp() t)s`)).rows[0]!;}
 private async epoch(c:PoolClient,userId:string,queued:boolean):Promise<void>{await c.query('UPDATE player_admissions SET ranked_queued=$2,ranked_epoch=ranked_epoch+1,ranked_changed_at=clock_timestamp() WHERE user_id=$1',[userId,queued]);}
 private async allowance(c:PoolClient,userId:string,clock:{at:Date;day:string;reset:Date},exclude?:string):Promise<Allowance>{
  const entitlement=await loadEntitlements(c,userId,clock.at);
  const usage=(await c.query<{used:number;reserved:number}>(`SELECT count(*) FILTER(WHERE state='STARTED')::int used,
   count(*) FILTER(WHERE state='RESERVED' AND ($3::uuid IS NULL OR offer_id<>$3))::int reserved
   FROM ranked_reservations WHERE user_id=$1 AND lagos_date=$2`,[userId,clock.day,exclude??null])).rows[0]!;
  const second=(await c.query<{ended_at:Date|null}>(`SELECT m.ended_at FROM ranked_reservations r JOIN game_matches m ON m.id=r.match_id
   WHERE r.user_id=$1 AND r.lagos_date=$2 AND r.state='STARTED' AND r.slot=2`,[userId,clock.day])).rows[0];
  return {day:clock.day,...usage,remaining:Math.max(0,3-usage.used-usage.reserved),isPremium:entitlement.isPremium,
   cooldownUntil:rankedCooldownUntil(entitlement.isPremium,second?.ended_at?.getTime()??null,clock.at.getTime(),clock.reset.getTime()),resetAt:clock.reset.getTime()};
 }
 private async eligible(c:PoolClient,userId:string,clock:{at:Date;day:string;reset:Date},exclude?:string):Promise<Allowance>{
  if((await c.query('SELECT 1 FROM ranked_penalties WHERE user_id=$1 AND locked_until>$2',[userId,clock.at])).rowCount)throw new RankedError('RANKED_LOCKED');
  const value=await this.allowance(c,userId,clock,exclude);if(value.remaining<1)throw new RankedError('RANKED_DAILY_LIMIT');
  if(value.cooldownUntil)throw new RankedError('RANKED_COOLDOWN');
  if((await c.query("SELECT 1 FROM game_players p JOIN game_matches m ON m.id=p.match_id WHERE p.user_id=$1 AND m.status='ACTIVE' LIMIT 1",[userId])).rowCount)throw new RankedError('ALREADY_IN_MATCH');
  return value;
 }
 async join(connection:RealtimeConnection,key:string):Promise<Ticket>{
  if(!/^[A-Za-z0-9._:-]{8,128}$/.test(key))throw new RankedError('INVALID_INPUT');
  return this.tx(async c=>{
   await this.lockUsers(c,[connection.userId]);await this.sessions.lockCurrent(c,connection);
   const old=(await c.query<Ticket>('SELECT * FROM ranked_tickets WHERE user_id=$1 AND request_key=$2',[connection.userId,key])).rows[0];
   if(old)return old;
   const clock=await this.clock(c);await this.eligible(c,connection.userId,clock);
   const live=(await c.query<Ticket>("SELECT * FROM ranked_tickets WHERE user_id=$1 AND state IN('SEARCHING','OFFER')",[connection.userId])).rows[0];
   if(live)throw new RankedError('ALREADY_IN_QUEUE');
   const id=randomUUID();const result=await c.query<Ticket>(`INSERT INTO ranked_tickets(id,user_id,connection_id,request_key,state,joined_at,last_seen_at,search_expires_at)
    VALUES($1,$2,$3,$4,'SEARCHING',$5,$5,$5::timestamptz+interval '120 seconds') RETURNING *`,[id,connection.userId,connection.connectionId,key,clock.at]);
   await this.epoch(c,connection.userId,true);return result.rows[0]!;
  });
 }
 async heartbeat(connection:RealtimeConnection,ticketId:string):Promise<Ticket>{
  if(!uuid.test(ticketId))throw new RankedError('INVALID_INPUT');return this.tx(async c=>{
   await this.lockUsers(c,[connection.userId]);await this.sessions.lockCurrent(c,connection);const clock=await this.clock(c);
   const row=(await c.query<Ticket>("SELECT * FROM ranked_tickets WHERE id=$1 AND user_id=$2 AND state IN('SEARCHING','OFFER') FOR UPDATE",[ticketId,connection.userId])).rows[0];
   if(!row||row.search_expires_at<=clock.at)throw new RankedError('STALE_TICKET');
   const result=await c.query<Ticket>('UPDATE ranked_tickets SET connection_id=$2,last_seen_at=$3 WHERE id=$1 RETURNING *',[ticketId,connection.connectionId,clock.at]);
   await this.epoch(c,connection.userId,true);return result.rows[0]!;
  });
 }
 async cancel(connection:RealtimeConnection,ticketId:string):Promise<void>{
  if(!uuid.test(ticketId))throw new RankedError('INVALID_INPUT');
  // If SEARCHING becomes OFFER while acquiring the user lock, restart with both users in canonical order.
  for(let attempt=0;attempt<3;attempt++){
   const row=(await this.pool.query<Ticket>('SELECT * FROM ranked_tickets WHERE id=$1 AND user_id=$2',[ticketId,connection.userId])).rows[0];
   if(!row)throw new RankedError('INVALID_INPUT');
   const offer=(await this.pool.query<Offer>("SELECT * FROM ranked_offers WHERE state='PENDING' AND (a_ticket=$1 OR b_ticket=$1)",[ticketId])).rows[0];
   if(offer){await this.respond(connection,offer.id,false);return;}
   try{await this.tx(async c=>{
    await this.lockUsers(c,[connection.userId]);await this.sessions.lockCurrent(c,connection);
    const result=await c.query("UPDATE ranked_tickets SET state='CANCELLED' WHERE id=$1 AND user_id=$2 AND state='SEARCHING'",[ticketId,connection.userId]);
    if(result.rowCount)await this.epoch(c,connection.userId,false);
    else if((await c.query("SELECT 1 FROM ranked_tickets WHERE id=$1 AND state='OFFER'",[ticketId])).rowCount)throw new RankedError('ALREADY_IN_QUEUE');
   });return;}catch(error){if(!(error instanceof RankedError)||error.code!=='ALREADY_IN_QUEUE'||attempt===2)throw error;}
  }
 }
 async acquireFence(token:string):Promise<RankedFence|null>{
  if(!uuid.test(token))throw new RankedError('INVALID_INPUT');
  const r=await this.pool.query<{generation:string}>(`UPDATE ranked_matchmaker_lease SET generation=generation+1,token=$1,expires_at=clock_timestamp()+interval '5 seconds'
   WHERE id AND expires_at<=clock_timestamp() RETURNING generation::text`,[token]);return r.rows[0]?{token,generation:r.rows[0].generation}:null;
 }
 async renewFence(fence:RankedFence):Promise<boolean>{return (await this.pool.query(`UPDATE ranked_matchmaker_lease SET expires_at=clock_timestamp()+interval '5 seconds'
  WHERE id AND token=$1 AND generation=$2 AND expires_at>clock_timestamp()`,[fence.token,fence.generation])).rowCount===1;}
 async releaseFence(fence:RankedFence):Promise<void>{await this.pool.query("UPDATE ranked_matchmaker_lease SET expires_at='-infinity' WHERE id AND token=$1 AND generation=$2",[fence.token,fence.generation]);}
 private async tickets(c:Pick<PoolClient,'query'>,ids:string[]):Promise<Ticket[]>{return (await c.query<Ticket>('SELECT * FROM ranked_tickets WHERE id=ANY($1::uuid[]) ORDER BY user_id',[ids])).rows;}
 private async pairCount(c:PoolClient,a:string,b:string,day:string,exclude?:string):Promise<number>{return Number((await c.query<{n:number}>(`SELECT count(*)::int n FROM ranked_reservations a JOIN ranked_reservations b USING(offer_id)
  WHERE a.user_id=$1 AND b.user_id=$2 AND a.lagos_date=$3 AND b.lagos_date=$3 AND a.state IN('RESERVED','STARTED') AND b.state IN('RESERVED','STARTED') AND ($4::uuid IS NULL OR a.offer_id<>$4)`,[a,b,day,exclude??null])).rows[0]!.n);}
 private async ticketPresent(c:PoolClient,t:Ticket,at:Date):Promise<boolean>{return t.last_seen_at.getTime()>at.getTime()-45000&&t.search_expires_at>at&&Boolean((await c.query(`SELECT 1 FROM realtime_sessions s JOIN users u ON u.id=s.user_id
  WHERE s.user_id=$1 AND s.connection_id=$2 AND s.expires_at>$3 AND s.token_version=u.token_version FOR SHARE OF s`,[t.user_id,t.connection_id,at])).rowCount);}
 /** Advisory pruning only; the reservation transaction repeats every eligibility/ownership check. */
 async candidateIds(ids?:string[]):Promise<string[]>{
  if(ids&&!ids.length)return [];
  return (await this.pool.query<{id:string}>(`SELECT t.id FROM ranked_tickets t JOIN users u ON u.id=t.user_id
   JOIN realtime_sessions s ON s.user_id=t.user_id AND s.connection_id=t.connection_id AND s.token_version=u.token_version
   WHERE t.state='SEARCHING' AND t.search_expires_at>clock_timestamp() AND t.last_seen_at>clock_timestamp()-interval '45 seconds'
   AND NOT EXISTS(SELECT 1 FROM ranked_penalties p WHERE p.user_id=t.user_id AND p.locked_until>clock_timestamp())
   AND s.expires_at>clock_timestamp() AND ($1::uuid[] IS NULL OR t.id=ANY($1))
   AND NOT EXISTS(SELECT 1 FROM game_players p JOIN game_matches m ON m.id=p.match_id WHERE p.user_id=t.user_id AND m.status='ACTIVE')
   AND (SELECT count(*) FROM ranked_reservations r WHERE r.user_id=t.user_id AND r.lagos_date=(clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date AND r.state IN('RESERVED','STARTED'))<3
   AND (${PREMIUM_SQL} OR NOT EXISTS(SELECT 1 FROM ranked_reservations r JOIN game_matches m ON m.id=r.match_id
    WHERE r.user_id=t.user_id AND r.lagos_date=(clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date AND r.state='STARTED' AND r.slot=2 AND m.ended_at+interval '1 hour'>clock_timestamp()))
   ORDER BY t.joined_at,t.id LIMIT 100`,[ids??null])).rows.map(r=>r.id);
 }
 async createOffer(fence:RankedFence,a:string,b:string):Promise<Offer|null>{
  if(!uuid.test(a)||!uuid.test(b)||a===b)throw new RankedError('INVALID_INPUT');
  try{return await this.tx(async c=>{
   if(!(await c.query('SELECT id FROM ranked_matchmaker_lease WHERE id AND token=$1 AND generation=$2 AND expires_at>clock_timestamp() FOR SHARE',[fence.token,fence.generation])).rowCount)throw new RankedError('STALE_OWNER');
   let rows=await this.tickets(c,[a,b]);if(rows.length!==2||rows[0]!.user_id===rows[1]!.user_id)throw new RankedError('INCOMPATIBLE');
   await this.lockUsers(c,rows.map(t=>t.user_id));rows=await this.tickets(c,[a,b]);const clock=await this.clock(c);
   if(!(await c.query('SELECT id FROM ranked_matchmaker_lease WHERE id AND token=$1 AND generation=$2 AND expires_at>clock_timestamp()',[fence.token,fence.generation])).rowCount)throw new RankedError('STALE_OWNER');
   for(const t of rows){if(t.state!=='SEARCHING'||!await this.ticketPresent(c,t,clock.at))throw new RankedError('INCOMPATIBLE');await this.eligible(c,t.user_id,clock);}
   if(await this.pairCount(c,rows[0]!.user_id,rows[1]!.user_id,clock.day)>=2)throw new RankedError('INCOMPATIBLE');
   const id=randomUUID();const offer=(await c.query<Offer>(`INSERT INTO ranked_offers(id,a_ticket,b_ticket,state,created_at,expires_at) VALUES($1,$2,$3,'PENDING',$4,$4::timestamptz+interval '10 seconds') RETURNING *`,[id,rows[0]!.id,rows[1]!.id,clock.at])).rows[0]!;
   for(const t of rows){await c.query("UPDATE ranked_tickets SET state='OFFER' WHERE id=$1",[t.id]);await c.query("INSERT INTO ranked_reservations(offer_id,user_id,state,lagos_date,reserved_at) VALUES($1,$2,'RESERVED',$3,$4)",[id,t.user_id,clock.day,clock.at]);await this.epoch(c,t.user_id,true);}
   return offer;
  });}catch(error){if(error instanceof RankedError&&['INCOMPATIBLE','RANKED_DAILY_LIMIT','RANKED_COOLDOWN','ALREADY_IN_MATCH','ALREADY_IN_QUEUE','RANKED_LOCKED'].includes(error.code))return null;throw error;}
 }
 private async releaseOffer(c:PoolClient,offer:Offer,rows:Ticket[],at:Date,fault?:string,penalize=true):Promise<void>{
  await c.query("UPDATE ranked_offers SET state=$2 WHERE id=$1 AND state='PENDING'",[offer.id,fault?'CANCELLED':'EXPIRED']);
  await c.query("UPDATE ranked_reservations SET state='RELEASED' WHERE offer_id=$1 AND state='RESERVED'",[offer.id]);
  for(const t of rows){const accepted=t.id===offer.a_ticket?offer.accepted_a:offer.accepted_b;
   if(penalize&&(fault?t.user_id===fault:!accepted))await this.noShow(c,offer.id,t.user_id,at);
   const requeue=t.user_id!==fault&&(fault!==undefined||accepted)&&await this.ticketPresent(c,t,at);
   await c.query('UPDATE ranked_tickets SET state=$2 WHERE id=$1',[t.id,requeue?'SEARCHING':'CANCELLED']);await this.epoch(c,t.user_id,requeue);
  }
 }
 async respond(connection:RealtimeConnection,offerId:string,accept:boolean):Promise<{matchId:string|null;state:string}>{
  if(!uuid.test(offerId)||typeof accept!=='boolean')throw new RankedError('INVALID_INPUT');
  const initial=(await this.pool.query<Offer>('SELECT * FROM ranked_offers WHERE id=$1',[offerId])).rows[0];if(!initial)throw new RankedError('INVALID_INPUT');
  return this.tx(async c=>{
   let rows=await this.tickets(c,[initial.a_ticket,initial.b_ticket]);if(!rows.some(t=>t.user_id===connection.userId))throw new RankedError('INVALID_INPUT');
   await this.lockUsers(c,rows.map(t=>t.user_id));await this.sessions.lockCurrent(c,connection);
   const offer=(await c.query<Offer>('SELECT * FROM ranked_offers WHERE id=$1 FOR UPDATE',[offerId])).rows[0]!;rows=await this.tickets(c,[offer.a_ticket,offer.b_ticket]);
   if(offer.state!=='PENDING')return {matchId:offer.match_id,state:offer.state};
   const clock=await this.clock(c);
   if(offer.expires_at<=clock.at){await this.releaseOffer(c,offer,rows,clock.at);return {matchId:null,state:'EXPIRED'};}
   const actor=rows.find(t=>t.user_id===connection.userId)!;
   if(actor.connection_id!==connection.connectionId)throw new RankedError('STALE_TICKET');
   if(!accept){await this.releaseOffer(c,offer,rows,clock.at,connection.userId);return {matchId:null,state:'CANCELLED'};}
   if(actor.id===offer.a_ticket)offer.accepted_a=true;else offer.accepted_b=true;
   await c.query('UPDATE ranked_offers SET accepted_a=$2,accepted_b=$3 WHERE id=$1',[offer.id,offer.accepted_a,offer.accepted_b]);
   if(!offer.accepted_a||!offer.accepted_b)return {matchId:null,state:'PENDING'};
   return this.startAccepted(c,offer,rows,clock);
  });
 }
 private async startAccepted(c:PoolClient,offer:Offer,rows:Ticket[],clock:{at:Date;day:string;reset:Date}):Promise<{matchId:string|null;state:string}>{
   const allowances:Allowance[]=[];let invalidUser:string|undefined;
   try{
    for(const t of rows){invalidUser=t.user_id;if(!await this.ticketPresent(c,t,clock.at))throw new RankedError('INCOMPATIBLE');allowances.push(await this.eligible(c,t.user_id,clock,offer.id));}
    if(await this.pairCount(c,rows[0]!.user_id,rows[1]!.user_id,clock.day,offer.id)>=2)throw new RankedError('INCOMPATIBLE');
   }catch(error){if(!(error instanceof RankedError))throw error;await this.releaseOffer(c,offer,rows,clock.at,invalidUser,false);return {matchId:null,state:'CANCELLED'};}
   const matchId=randomUUID();const state=createGame(APPROVED_WHOT_RULES,clock.at.getTime(),cryptoRandomInt);
   await c.query(`INSERT INTO game_matches(id,mode,rule_version,private_initial_state,private_state,status,version,started_at,updated_at) VALUES($1,'RANKED',$2,$3,$3,'ACTIVE',0,$4,$4)`,[matchId,state.rules.version,state,clock.at]);
   for(let i=0;i<rows.length;i++){
    const t=rows[i]!;await c.query('INSERT INTO game_players(match_id,seat,user_id,is_bot) VALUES($1,$2,$3,false)',[matchId,i,t.user_id]);
    await c.query("UPDATE ranked_reservations SET state='STARTED',lagos_date=$3,started_at=$4,slot=$5,match_id=$6 WHERE offer_id=$1 AND user_id=$2 AND state='RESERVED'",[offer.id,t.user_id,clock.day,clock.at,allowances[i]!.used+1,matchId]);
    await c.query("UPDATE ranked_tickets SET state='STARTED' WHERE id=$1",[t.id]);await this.epoch(c,t.user_id,false);
   }
   await c.query("UPDATE ranked_offers SET state='STARTED',match_id=$2 WHERE id=$1",[offer.id,matchId]);
   await c.query("INSERT INTO outbox_events(id,type,payload) VALUES($1,'RANKED_STARTED',$2)",[randomUUID(),{matchId,offerId:offer.id}]);
   return {matchId,state:'STARTED'};

 }
 private async noShow(c:PoolClient,offerId:string,userId:string,at:Date):Promise<void>{
  const receipt=await c.query('INSERT INTO ranked_no_shows(offer_id,user_id,occurred_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING user_id',[offerId,userId,at]);
  if(!receipt.rowCount)return;
  const prior=(await c.query<{misses:number;last_miss_at:Date}>('SELECT misses,last_miss_at FROM ranked_penalties WHERE user_id=$1',[userId])).rows[0];
  const misses=prior&&at.getTime()-prior.last_miss_at.getTime()<86400000?prior.misses+1:1;
  const minutes=misses===1?0:misses===2?2:misses===3?5:15;
  await c.query(`INSERT INTO ranked_penalties(user_id,misses,last_miss_at,locked_until) VALUES($1,$2,$3,$4)
   ON CONFLICT(user_id) DO UPDATE SET misses=EXCLUDED.misses,last_miss_at=EXCLUDED.last_miss_at,locked_until=EXCLUDED.locked_until`,[userId,misses,at,minutes?new Date(at.getTime()+minutes*60000):null]);
 }
 async requestRematch(connection:RealtimeConnection,targetId:string,key:string):Promise<string>{
  if(!/^tg_[1-9][0-9]{0,19}$/.test(targetId)||targetId===connection.userId||!/^[A-Za-z0-9._:-]{8,128}$/.test(key))throw new RankedError('INVALID_INPUT');
  return this.tx(async c=>{
   await this.lockUsers(c,[connection.userId,targetId]);await this.sessions.lockCurrent(c,connection);const clock=await this.clock(c);
   const old=(await c.query<{id:string;target_id:string}>('SELECT id,target_id FROM ranked_rematches WHERE requester_id=$1 AND request_key=$2',[connection.userId,key])).rows[0];
   if(old){if(old.target_id!==targetId)throw new RankedError('INVALID_INPUT');return old.id;}
   if(Number((await c.query("SELECT count(*) n FROM ranked_rematches WHERE requester_id=$1 AND created_at>$2::timestamptz-interval '1 hour'",[connection.userId,clock.at])).rows[0].n)>=3)throw new RankedError('REMATCH_LIMIT');
   if(!(await c.query(`SELECT 1 FROM ranked_results WHERE user_id=$1 AND opponent_id=$2 LIMIT 1`,[connection.userId,targetId])).rowCount)throw new RankedError('INCOMPATIBLE');
   for(const user of [connection.userId,targetId])await this.rematchEligible(c,user,clock);
   if(await this.pairCount(c,connection.userId,targetId,clock.day)>=2)throw new RankedError('INCOMPATIBLE');
   const id=randomUUID();await c.query(`INSERT INTO ranked_rematches(id,requester_id,target_id,request_key,state,created_at,expires_at) VALUES($1,$2,$3,$4,'PENDING',$5,$5::timestamptz+interval '15 seconds')`,[id,connection.userId,targetId,key,clock.at]);return id;
  });
 }
 private async rematchEligible(c:PoolClient,userId:string,clock:{at:Date;day:string;reset:Date},requestId?:string):Promise<string>{
  await this.eligible(c,userId,clock);
  if((await c.query("SELECT 1 FROM ranked_tickets WHERE user_id=$1 AND state IN('SEARCHING','OFFER')",[userId])).rowCount)throw new RankedError('ALREADY_IN_QUEUE');
  if((await c.query(`SELECT 1 FROM ranked_rematches WHERE state='PENDING' AND expires_at>$2 AND (requester_id=$1 OR target_id=$1) AND ($3::uuid IS NULL OR id<>$3)`,[userId,clock.at,requestId??null])).rowCount)throw new RankedError('ALREADY_IN_QUEUE');
  const session=(await c.query<{connection_id:string}>(`SELECT s.connection_id FROM realtime_sessions s JOIN users u ON u.id=s.user_id WHERE s.user_id=$1 AND s.expires_at>$2 AND s.token_version=u.token_version FOR SHARE OF s`,[userId,clock.at])).rows[0];
  if(!session)throw new RankedError('INCOMPATIBLE');return session.connection_id;
 }
 async respondRematch(connection:RealtimeConnection,requestId:string,accept:boolean):Promise<{matchId:string|null;state:string}>{
  if(!uuid.test(requestId)||typeof accept!=='boolean')throw new RankedError('INVALID_INPUT');
  const initial=(await this.pool.query<{requester_id:string;target_id:string}>('SELECT requester_id,target_id FROM ranked_rematches WHERE id=$1',[requestId])).rows[0];
  if(!initial||initial.target_id!==connection.userId)throw new RankedError('INVALID_INPUT');
  return this.tx(async c=>{
   await this.lockUsers(c,[initial.requester_id,initial.target_id]);await this.sessions.lockCurrent(c,connection);
   const r=(await c.query<{state:string;expires_at:Date;match_id:string|null}>('SELECT * FROM ranked_rematches WHERE id=$1 FOR UPDATE',[requestId])).rows[0]!;
   if(r.state!=='PENDING')return {matchId:r.match_id,state:r.state};
   const clock=await this.clock(c);
   if(!accept||r.expires_at<=clock.at){const state=r.expires_at<=clock.at?'EXPIRED':'DECLINED';await c.query('UPDATE ranked_rematches SET state=$2 WHERE id=$1',[requestId,state]);return {matchId:null,state};}
   const users=[initial.requester_id,initial.target_id].sort();const connectionIds:string[]=[];
   try{for(const user of users)connectionIds.push(await this.rematchEligible(c,user,clock,requestId));
    if(await this.pairCount(c,users[0]!,users[1]!,clock.day)>=2)throw new RankedError('INCOMPATIBLE');
   }catch(error){if(!(error instanceof RankedError))throw error;await c.query("UPDATE ranked_rematches SET state='CANCELLED' WHERE id=$1",[requestId]);return {matchId:null,state:'CANCELLED'};}
   const ids=[randomUUID(),randomUUID()];
   for(let i=0;i<2;i++)await c.query(`INSERT INTO ranked_tickets(id,user_id,connection_id,request_key,state,joined_at,last_seen_at,search_expires_at) VALUES($1,$2,$3,$4,'OFFER',$5,$5,$5::timestamptz+interval '120 seconds')`,[ids[i],users[i],connectionIds[i],'rematch:'+requestId,clock.at]);
   const offerId=randomUUID();const offer=(await c.query<Offer>(`INSERT INTO ranked_offers(id,a_ticket,b_ticket,state,accepted_a,accepted_b,created_at,expires_at) VALUES($1,$2,$3,'PENDING',true,true,$4,$4::timestamptz+interval '10 seconds') RETURNING *`,[offerId,ids[0],ids[1],clock.at])).rows[0]!;
   for(const user of users)await c.query("INSERT INTO ranked_reservations(offer_id,user_id,state,lagos_date,reserved_at) VALUES($1,$2,'RESERVED',$3,$4)",[offerId,user,clock.day,clock.at]);
   const result=await this.startAccepted(c,offer,await this.tickets(c,ids),clock);
   await c.query('UPDATE ranked_rematches SET state=$2,match_id=$3 WHERE id=$1',[requestId,result.matchId?'STARTED':'CANCELLED',result.matchId]);return result;
  });
 }

 async recover(limit=100,signal?:AbortSignal):Promise<void>{
  if(!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new RankedError('INVALID_INPUT');
  if(signal?.aborted)return;
  const offers=(await this.pool.query<Offer>("SELECT * FROM ranked_offers WHERE state='PENDING' AND expires_at<=clock_timestamp() ORDER BY expires_at,id LIMIT $1",[limit])).rows;
  for(const offer of offers){if(signal?.aborted)return;await this.tx(async c=>{const rows=await this.tickets(c,[offer.a_ticket,offer.b_ticket]);await this.lockUsers(c,rows.map(t=>t.user_id));
   const current=(await c.query<Offer>('SELECT * FROM ranked_offers WHERE id=$1 FOR UPDATE',[offer.id])).rows[0]!;const clock=await this.clock(c);
   if(current.state==='PENDING'&&current.expires_at<=clock.at)await this.releaseOffer(c,current,rows,clock.at);
  });}
  const stale=(await this.pool.query<Ticket>(`SELECT * FROM ranked_tickets WHERE state='SEARCHING' AND
   (search_expires_at<=clock_timestamp() OR last_seen_at<=clock_timestamp()-interval '45 seconds') ORDER BY joined_at,id LIMIT $1`,[limit])).rows;
  for(const t of stale){if(signal?.aborted)return;await this.tx(async c=>{await this.lockUsers(c,[t.user_id]);const r=await c.query(`UPDATE ranked_tickets SET state='EXPIRED' WHERE id=$1 AND state='SEARCHING' AND
   (search_expires_at<=clock_timestamp() OR last_seen_at<=clock_timestamp()-interval '45 seconds')`,[t.id]);if(r.rowCount)await this.epoch(c,t.user_id,false);});}
 }
 async cacheEntries(afterUser='',limit=100,userIds?:string[]):Promise<QueueCacheEntry[]>{
  const rows=(await this.pool.query<{user_id:string;ranked_epoch:string;id:string|null;connection_id:string|null;joined_at:Date|null;last_seen_at:Date|null;search_expires_at:Date|null;state:string|null}>(`SELECT a.user_id,a.ranked_epoch::text,t.id,t.connection_id,t.joined_at,t.last_seen_at,t.search_expires_at,t.state
   FROM player_admissions a LEFT JOIN ranked_tickets t ON t.user_id=a.user_id AND t.state IN('SEARCHING','OFFER')
   WHERE a.ranked_epoch>0 AND (a.ranked_queued OR a.ranked_changed_at>clock_timestamp()-interval '5 minutes') AND a.user_id>$1 AND ($3::text[] IS NULL OR a.user_id=ANY($3)) ORDER BY a.user_id LIMIT $2`,[afterUser,limit,userIds??null])).rows;
  return rows.map(r=>({userId:r.user_id,epoch:r.ranked_epoch,ticketId:r.id,connectionId:r.connection_id,joinedAt:r.joined_at?.getTime()??0,lastSeenAt:r.last_seen_at?.getTime()??0,expiresAt:r.search_expires_at?.getTime()??0,searching:r.state==='SEARCHING'}));
 }
 async cacheForOffer(offerId:string):Promise<QueueCacheEntry[]>{
  const rows=(await this.pool.query<{user_id:string}>(`SELECT t.user_id FROM ranked_offers o JOIN ranked_tickets t ON t.id IN(o.a_ticket,o.b_ticket) WHERE o.id=$1 ORDER BY t.user_id`,[offerId])).rows;
  return this.cacheEntries('',2,rows.map(r=>r.user_id));
 }
 async resume(connection:RealtimeConnection){return this.tx(async c=>{
  await this.sessions.lockCurrent(c,connection);const clock=await this.clock(c);const allowance=await this.allowance(c,connection.userId,clock);
  const ticket=(await c.query<Ticket>("SELECT * FROM ranked_tickets WHERE user_id=$1 AND state IN('SEARCHING','OFFER')",[connection.userId])).rows[0]??null;
  const offer=ticket?(await c.query<Offer>("SELECT * FROM ranked_offers WHERE state='PENDING' AND (a_ticket=$1 OR b_ticket=$1)",[ticket.id])).rows[0]??null:null;
  const game=(await c.query<{id:string;mode:'PRACTICE'|'RANKED';private_state:unknown;seat:0|1}>(`SELECT m.id,m.mode,m.private_state,p.seat FROM game_players p JOIN game_matches m ON m.id=p.match_id WHERE p.user_id=$1
   ORDER BY (m.status='ACTIVE') DESC,m.started_at DESC,m.id DESC LIMIT 1`,[connection.userId])).rows[0];
  const match=game?{id:game.id,mode:game.mode,view:projectGame(restoreGame(game.private_state),game.seat)}:null;
  const phase=match?.view.status==='ACTIVE'?'IN_MATCH':offer?'OFFER':ticket?'SEARCHING':match?'RESULT':'IDLE';
  const penalty=(await c.query<{misses:number;locked_until:Date|null;last_miss_at:Date}>('SELECT misses,locked_until,last_miss_at FROM ranked_penalties WHERE user_id=$1',[connection.userId])).rows[0];
  const rematches=(await c.query<{id:string;requester_id:string;target_id:string;expires_at:Date}>(`SELECT id,requester_id,target_id,expires_at FROM ranked_rematches WHERE state='PENDING' AND expires_at>$2 AND (requester_id=$1 OR target_id=$1) ORDER BY created_at LIMIT 1`,[connection.userId,clock.at])).rows.map(r=>({id:r.id,opponentId:r.requester_id===connection.userId?r.target_id:r.requester_id,incoming:r.target_id===connection.userId,expiresAt:r.expires_at.getTime()}));
  const recentOpponents=(await c.query<{opponent_id:string;first_name:string}>(`SELECT r.opponent_id,u.first_name FROM ranked_results r JOIN users u ON u.id=r.opponent_id WHERE r.user_id=$1 GROUP BY r.opponent_id,u.first_name ORDER BY max(r.finished_at) DESC,r.opponent_id LIMIT 10`,[connection.userId])).rows.map(r=>({id:r.opponent_id,name:r.first_name.slice(0,100)}));
  const result=match?(await c.query<{outcome:string;reason:string;lagos_date:string}>('SELECT outcome,reason,lagos_date::text FROM ranked_results WHERE match_id=$1 AND user_id=$2',[match.id,connection.userId])).rows[0]??null:null;
  const stats=(await c.query<{played:number;wins:number;losses:number;draws:number;taskDays:number;practice:number}>(`WITH bounds AS (SELECT date_trunc('month',$2::date)::date AS start, (date_trunc('month',$2::date)+interval '1 month')::date AS finish)
   SELECT count(*)::int AS played,count(*) FILTER(WHERE outcome='WIN')::int AS wins,count(*) FILTER(WHERE outcome='LOSS')::int AS losses,count(*) FILTER(WHERE outcome='DRAW')::int AS draws,
   (SELECT count(*)::int FROM (SELECT lagos_date FROM daily_task_state,bounds WHERE user_id=$1 AND lagos_date>=bounds.start AND lagos_date<bounds.finish AND status='CLAIMED' GROUP BY lagos_date HAVING count(*)=4)d) AS "taskDays",
   (SELECT count(*)::int FROM practice_completions,bounds WHERE user_id=$1 AND (completed_at AT TIME ZONE 'Africa/Lagos')::date>=bounds.start AND (completed_at AT TIME ZONE 'Africa/Lagos')::date<bounds.finish) AS practice
   FROM ranked_results,bounds WHERE user_id=$1 AND lagos_date>=bounds.start AND lagos_date<bounds.finish`,[connection.userId,clock.day])).rows[0]!;
  const publicTicket=ticket?{id:ticket.id,state:ticket.state,joinedAt:ticket.joined_at.getTime(),searchExpiresAt:ticket.search_expires_at.getTime()}:null;
  const publicOffer=offer?{id:offer.id,state:offer.state,expiresAt:offer.expires_at.getTime(),acceptedYou:ticket!.id===offer.a_ticket?offer.accepted_a:offer.accepted_b,acceptedOpponent:ticket!.id===offer.a_ticket?offer.accepted_b:offer.accepted_a}:null;
  return {protocolVersion:1 as const,serverTime:clock.at.getTime(),phase,match,ranked:{ticket:publicTicket,offer:publicOffer,allowance,penalty:{misses:penalty&&clock.at.getTime()-penalty.last_miss_at.getTime()<86400000?penalty.misses:0,lockedUntil:penalty?.locked_until&&penalty.locked_until>clock.at?penalty.locked_until.getTime():null},rematches,recentOpponents,result,stats:{...stats,month:clock.day.slice(0,7),eligible:stats.taskDays>=20&&stats.wins>=15&&(allowance.isPremium||stats.practice>=25)}}};
 });}
}
