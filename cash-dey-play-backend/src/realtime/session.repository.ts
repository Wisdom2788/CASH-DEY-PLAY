import { randomUUID } from 'node:crypto';
import { Pool,PoolClient } from 'pg';
import { AccessIdentity } from '../auth/access-token';
import { PlayerView,projectGame,restoreGame } from '../game-engine/engine';
import { Seat } from '../game-engine/model';

export class RealtimeError extends Error {
 constructor(readonly code:'UNAUTHORIZED'|'SESSION_REPLACED'|'NOT_FOUND'|'INVALID_INPUT'|'UNAVAILABLE'|'RATE_LIMITED'|'BUSY'){super(code);}
}
export interface GameUpdate {matchId:string;eventId:string|null;view:PlayerView}
export interface RealtimeConnection extends AccessIdentity {connectionId:string}
export interface ResumeSnapshot {
 protocolVersion:1;phase:'IDLE'|'IN_MATCH'|'RESULT';serverTime:number;
 match:null|{id:string;mode:'PRACTICE'|'RANKED';view:PlayerView};
}
/** Session generation is SQL-authoritative; disconnect cleanup is compare-and-delete. */
export class RealtimeSessionRepository {
 constructor(private readonly pool:Pool){}
 async claim(identity:AccessIdentity):Promise<RealtimeConnection>{
  const connectionId=randomUUID();
  return this.transaction(async client=>{
   await this.checkUser(client,identity,true);
   const at=await this.now(client);if(identity.expiresAt<=at)throw new RealtimeError('UNAUTHORIZED');
   await client.query(`INSERT INTO realtime_sessions(user_id,connection_id,token_version,expires_at,claimed_at)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET connection_id=EXCLUDED.connection_id,
    token_version=EXCLUDED.token_version,expires_at=EXCLUDED.expires_at,claimed_at=EXCLUDED.claimed_at`,
   [identity.userId,connectionId,identity.tokenVersion,new Date(identity.expiresAt),new Date(at)]);
   return {...identity,connectionId};
  });
 }
 async assertCurrent(connection:RealtimeConnection):Promise<void>{
  await this.transaction(client=>this.lockCurrent(client,connection));
 }
 async release(connection:RealtimeConnection):Promise<void>{
  await this.transaction(async client=>{await client.query('DELETE FROM realtime_sessions WHERE user_id=$1 AND connection_id=$2',[connection.userId,connection.connectionId]);});
 }
 async resume(connection:RealtimeConnection,matchId?:string):Promise<ResumeSnapshot>{
  if(matchId!==undefined&&!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(matchId))throw new RealtimeError('INVALID_INPUT');
  return this.transaction(async client=>{
   await this.lockCurrent(client,connection);
   const result=await client.query<{id:string;mode:'PRACTICE'|'RANKED';private_state:unknown;seat:number}>(`
    SELECT m.id,m.mode,m.private_state,p.seat FROM game_players p JOIN game_matches m ON m.id=p.match_id
    WHERE p.user_id=$1 AND NOT p.is_bot AND ($2::uuid IS NULL OR m.id=$2)
    ORDER BY (m.status='ACTIVE') DESC,m.started_at DESC,m.id DESC LIMIT 1`,[connection.userId,matchId??null]);
   const row=result.rows[0];if(matchId&&!row)throw new RealtimeError('NOT_FOUND');
   const serverTime=await this.now(client);if(serverTime>=connection.expiresAt)throw new RealtimeError('UNAUTHORIZED');
   if(!row)return {protocolVersion:1,phase:'IDLE',serverTime,match:null};
   const view=projectGame(restoreGame(row.private_state),row.seat as Seat);
   return {protocolVersion:1,phase:view.status==='ACTIVE'?'IN_MATCH':'RESULT',serverTime,match:{id:row.id,mode:row.mode,view}};
  });
 }
 /** Fresh committed state; no Redis payload or private event projection is trusted. */
 async deliverySnapshot(connection:RealtimeConnection):Promise<GameUpdate|null>{
  return this.transaction(async client=>{
   await this.lockCurrent(client,connection);
   const result=await client.query<{id:string;version:number;private_state:unknown;seat:number;event_id:string|null}>(`
    SELECT m.id,m.version,m.private_state,p.seat,e.event_id FROM game_players p JOIN game_matches m ON m.id=p.match_id
    LEFT JOIN game_events e ON e.match_id=m.id AND e.sequence=m.version
    WHERE p.user_id=$1 AND NOT p.is_bot
    ORDER BY (m.status='ACTIVE') DESC,m.started_at DESC,m.id DESC LIMIT 1`,[connection.userId]);
   if(await this.now(client)>=connection.expiresAt)throw new RealtimeError('UNAUTHORIZED');
   const row=result.rows[0];if(!row)return null;
   const view=projectGame(restoreGame(row.private_state),row.seat as Seat);
   if(view.version!==row.version||(row.version>0&&!row.event_id))throw new RealtimeError('UNAVAILABLE');
   return {matchId:row.id,eventId:row.event_id,view};
  });
 }
 private async checkUser(client:PoolClient,identity:AccessIdentity,exclusive=false):Promise<void>{
  const result=await client.query<{telegram_id:string;token_version:number}>(
   `SELECT telegram_id,token_version FROM users WHERE id=$1 FOR ${exclusive?'UPDATE':'SHARE'}`,[identity.userId]);
  const row=result.rows[0];
  if(!row||String(row.telegram_id)!==String(identity.telegramId)||identity.userId!==`tg_${identity.telegramId}`||row.token_version!==identity.tokenVersion)throw new RealtimeError('UNAUTHORIZED');
 }
 /** Caller owns the transaction and must retain these user/session locks through its write. */
 async lockCurrent(client:PoolClient,connection:RealtimeConnection):Promise<void>{
  await this.checkUser(client,connection);
  const result=await client.query<{connection_id:string;token_version:number;expires_at:Date}>(
   'SELECT connection_id,token_version,expires_at FROM realtime_sessions WHERE user_id=$1 FOR SHARE',[connection.userId]);
  const row=result.rows[0];
  if(!row||row.connection_id!==connection.connectionId)throw new RealtimeError('SESSION_REPLACED');
  if(row.token_version!==connection.tokenVersion||row.expires_at.getTime()!==connection.expiresAt||connection.expiresAt<=await this.now(client))throw new RealtimeError('UNAUTHORIZED');
 }
 private async now(client:PoolClient):Promise<number>{
  return Number((await client.query<{ms:string}>("SELECT floor(extract(epoch FROM clock_timestamp())*1000)::text AS ms")).rows[0]!.ms);
 }
 private async transaction<T>(work:(client:PoolClient)=>Promise<T>):Promise<T>{
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s'");await client.query("SET LOCAL statement_timeout='10s'");
   const result=await work(client);await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
}
