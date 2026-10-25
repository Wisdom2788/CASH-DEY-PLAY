import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Pool, PoolClient } from 'pg';
import { applyCommand, applyTimeout, createGame, projectGame, restoreGame, PlayerView } from './engine';
import { chooseBotCommand } from './bot';
import { cryptoRandomInt, recordRandom, replayRandom } from './crypto-random';
import { Action, actionSchema, GameError, GameState, RandomInt, Rules, rulesSchema, Seat } from './model';

type Mode = 'PRACTICE' | 'RANKED';
interface Player { userId: string | null; isBot: boolean }
interface MatchRow { id: string; mode: Mode; rule_version: string; private_state: unknown; private_initial_state: unknown; version: number; status: 'ACTIVE' | 'FINISHED' }
interface EventRow { sequence: number; action_id: string; request_hash: string; actor_seat: number | null; actor_user_id: string | null; command_type: string; private_payload: any; projected_response: any; occurred_at: Date }
interface PrivatePayload { kind: 'ACTION' | 'TIMEOUT'; seat: Seat; action?: Action; at: number; entropy: { max: number; value: number }[] }
const accountId = /^tg_[1-9][0-9]{0,19}$/;
const actionId = /^[A-Za-z0-9._:-]{1,128}$/;
function canonical(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record=value as Record<string,unknown>;
  return `{${Object.keys(record).sort().map(key=>`${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}
function hash(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
function safeRule(input: Rules): Rules { const parsed = rulesSchema.safeParse(input); if (!parsed.success) throw new GameError('INVALID_INPUT'); return parsed.data; }
function parseId(id: string): void { if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new GameError('INVALID_INPUT'); }

/**
 * Internal PostgreSQL game store. It is deliberately not wired to HTTP routes,
 * matchmaking, Redis, sockets, settlement, or an enabled product rules profile.
 */
export class GameRepository {
  constructor(private readonly pool: Pool, private readonly random: RandomInt = cryptoRandomInt) {}

  async createMatch(input: { id?: string; mode: Mode; rules: Rules; players: readonly [Player, Player]; at: number }): Promise<{ id: string; state: GameState }> {
    const rules = safeRule(input.rules); const id = input.id ?? randomUUID(); parseId(id);
    if (!Number.isSafeInteger(input.at) || input.at < 0 || input.players.length !== 2 ||
      (!['PRACTICE','RANKED'].includes(input.mode)) ||
      (input.mode === 'RANKED' && input.players.some(p => p.isBot)) ||
      (input.mode === 'PRACTICE' && input.players.filter(p => p.isBot).length !== 1) ||
      input.players.some(p => p.isBot ? p.userId !== null : typeof p.userId !== 'string' || !accountId.test(p.userId)) ||
      (input.players[0].userId !== null && input.players[0].userId === input.players[1].userId)) throw new GameError('INVALID_INPUT');
    const entropy = recordRandom(this.random); const initial = createGame(rules, input.at, entropy.random);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN'); await client.query("SET LOCAL lock_timeout='5s'"); await client.query("SET LOCAL statement_timeout='10s'");
      // Share the admission lock with practice; sort multi-player locks to avoid deadlocks.
      const humans=input.players.filter(p=>!p.isBot).map(p=>p.userId!).sort();
      const locked=await client.query('SELECT id FROM users WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[humans]);
      if(locked.rowCount!==humans.length) throw new GameError('INVALID_INPUT');
      const busy=await client.query("SELECT 1 FROM game_players p JOIN game_matches m ON m.id=p.match_id WHERE p.user_id=ANY($1::text[]) AND m.status='ACTIVE' LIMIT 1",[humans]);
      if(busy.rowCount) throw new GameError('INVALID_STATE');
      await client.query(`INSERT INTO game_matches(id,mode,rule_version,private_initial_state,private_state,status,version,started_at,updated_at)
        VALUES($1,$2,$3,$4,$4,'ACTIVE',0,$5,$5)`, [id,input.mode,rules.version,initial,new Date(input.at)]);
      for (const [seat, player] of input.players.entries()) await client.query('INSERT INTO game_players(match_id,seat,user_id,is_bot) VALUES($1,$2,$3,$4)',[id,seat,player.userId,player.isBot]);
      await client.query('COMMIT'); return { id, state: initial };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async view(matchId: string, userId: string): Promise<PlayerView> {
    parseId(matchId); if (!accountId.test(userId)) throw new GameError('INVALID_INPUT');
    const result = await this.pool.query<{ private_state: unknown; seat: number }>(`SELECT m.private_state,p.seat FROM game_matches m
      JOIN game_players p ON p.match_id=m.id WHERE m.id=$1 AND p.user_id=$2 AND NOT p.is_bot`,[matchId,userId]);
    if (!result.rows[0]) throw new GameError('INVALID_INPUT');
    return projectGame(restoreGame(result.rows[0].private_state), result.rows[0].seat as Seat);
  }

  async act(matchId: string, userId: string, action: Action, at: number): Promise<PlayerView> {
    const parsed = actionSchema.safeParse(action); if (!parsed.success || !accountId.test(userId)) throw new GameError('INVALID_INPUT');
    return this.transition(matchId, parsed.data.id, userId, at, (state, seat, entropy) =>
      ({state:applyCommand(state, seat, parsed.data, at, entropy),command:parsed.data.command}), hash(['ACTION',userId,parsed.data]));
  }

  async botAct(matchId: string, at: number, id = `bot-${randomUUID()}`): Promise<PlayerView> {
    if (!/^bot-[A-Za-z0-9._:-]{1,124}$/.test(id)) throw new GameError('INVALID_INPUT');
    return this.transition(matchId,id,null,at,(state,seat,entropy)=>{
      if (state.turn !== seat) throw new GameError('WRONG_TURN');
      const command = chooseBotCommand(projectGame(state,seat));
      return {state:applyCommand(state,seat,{id,expectedVersion:state.version,command},at,entropy),command};
    }, null, true);
  }

  async timeout(matchId: string, at: number, id?: string): Promise<{ seat0: PlayerView; seat1: PlayerView }> {
    parseId(matchId); const client = await this.pool.connect();
    try {
      await client.query('BEGIN'); await client.query("SET LOCAL lock_timeout='5s'"); await client.query("SET LOCAL statement_timeout='10s'");
      const row = await this.lockMatch(client,matchId); const state=restoreGame(row.private_state); const timeoutId=id??`sys-timeout-${state.version}`;
      if(!/^sys-timeout-[A-Za-z0-9._:-]{1,115}$/.test(timeoutId)) throw new GameError('INVALID_INPUT');
      const fp=hash(['TIMEOUT',state.version]); const prior=await client.query<{request_hash:string;projected_response:any}>('SELECT request_hash,projected_response FROM game_events WHERE match_id=$1 AND action_id=$2',[matchId,timeoutId]);
      if(prior.rows[0]) { if(prior.rows[0].request_hash!==fp) throw new GameError('ACTION_CONFLICT'); const response=prior.rows[0].projected_response; await client.query('COMMIT'); return response; }
      const entropy=recordRandom(this.random); const next=applyTimeout(state,timeoutId,state.version,at,entropy.random);
      const response={seat0:projectGame(next,0),seat1:projectGame(next,1)};
      await this.persistTransition(client,row,next,timeoutId,fp,null,null,{kind:'TIMEOUT',seat:state.turn,at,entropy:entropy.choices},response,at);
      await client.query('COMMIT'); return response;
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  /** Rebuilds state exclusively from private origin and append-only command/entropy records. */
  async replay(matchId: string): Promise<GameState> {
    parseId(matchId);
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const match=await client.query<MatchRow>('SELECT * FROM game_matches WHERE id=$1',[matchId]); if(!match.rows[0]) throw new GameError('INVALID_INPUT');
      const players=await client.query<{seat:number;user_id:string|null;is_bot:boolean}>('SELECT seat,user_id,is_bot FROM game_players WHERE match_id=$1 ORDER BY seat',[matchId]);
      if(players.rows.length!==2 || players.rows.some((p,i)=>p.seat!==i || (p.is_bot?p.user_id!==null:!p.user_id))) throw new GameError('INVALID_STATE');
      const events=await client.query<EventRow>('SELECT * FROM game_events WHERE match_id=$1 ORDER BY sequence',[matchId]);
      let state=restoreGame(match.rows[0].private_initial_state);
      for(const event of events.rows) {
        if(event.sequence!==state.version+1) throw new GameError('INVALID_STATE');
        const payload=event.private_payload as PrivatePayload; const rng=replayRandom(payload.entropy);
        if(!payload || !Number.isSafeInteger(payload.at) || payload.at!==new Date(event.occurred_at).getTime()) throw new GameError('INVALID_STATE');
        const expectedHash=payload.kind==='TIMEOUT' ? hash(['TIMEOUT',state.version]) :
          event.actor_user_id===null ? hash(['BOT_ACTION',event.action_id]) : hash(['ACTION',event.actor_user_id,payload.action]);
        if(event.request_hash!==expectedHash || (payload.kind==='ACTION' && (event.actor_seat!==payload.seat || !payload.action || event.command_type!==payload.action.command.type ||
          event.actor_user_id!==players.rows[payload.seat]!.user_id || players.rows[payload.seat]!.is_bot!==(event.actor_user_id===null))) ||
          (payload.kind==='TIMEOUT' && (event.actor_seat!==null || event.actor_user_id!==null || event.command_type!=='TIMEOUT' || payload.seat!==state.turn))) throw new GameError('INVALID_STATE');
        state=payload.kind==='TIMEOUT' ? applyTimeout(state,event.action_id,state.version,payload.at,rng.random) :
          applyCommand(state,payload.seat,payload.action!,payload.at,rng.random);
        if(!rng.complete() || state.version!==event.sequence) throw new GameError('INVALID_STATE');
        const response=payload.kind==='TIMEOUT'?{seat0:projectGame(state,0),seat1:projectGame(state,1)}:projectGame(state,payload.seat);
        if(!isDeepStrictEqual(response,event.projected_response)) throw new GameError('INVALID_STATE');
      }
      if(state.version!==match.rows[0].version || state.status!==match.rows[0].status || state.rules.version!==match.rows[0].rule_version ||
        !isDeepStrictEqual(state,restoreGame(match.rows[0].private_state))) throw new GameError('INVALID_STATE');
      await client.query('COMMIT'); return state;
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  private async transition(matchId:string,id:string,userId:string|null,at:number,
    transition:(state:GameState,seat:Seat,random:RandomInt)=>{state:GameState;command:Action['command']},requestHash:string|null,bot=false):Promise<PlayerView> {
    parseId(matchId); if(!actionId.test(id) || (!bot&&(id.startsWith('bot-')||id.startsWith('sys-timeout-'))) || !Number.isSafeInteger(at) || at<0) throw new GameError('INVALID_INPUT');
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN'); await client.query("SET LOCAL lock_timeout='5s'"); await client.query("SET LOCAL statement_timeout='10s'");
      const row=await this.lockMatch(client,matchId); const seatResult=bot
        ? await client.query<{seat:number}>('SELECT seat FROM game_players WHERE match_id=$1 AND is_bot ORDER BY seat',[matchId])
        : await client.query<{seat:number}>('SELECT seat FROM game_players WHERE match_id=$1 AND user_id=$2 AND NOT is_bot',[matchId,userId]);
      if(!seatResult.rows.length || seatResult.rows.length>1) throw new GameError('INVALID_INPUT'); const seat=seatResult.rows[0]!.seat as Seat;
      const state=restoreGame(row.private_state); const fp=requestHash??hash(['BOT_ACTION',id]);
      const prior=await client.query<{request_hash:string;actor_user_id:string|null;actor_seat:number|null;projected_response:PlayerView}>('SELECT request_hash,actor_user_id,actor_seat,projected_response FROM game_events WHERE match_id=$1 AND action_id=$2',[matchId,id]);
      if(prior.rows[0]) { if(prior.rows[0].request_hash!==fp || prior.rows[0].actor_user_id!==userId || prior.rows[0].actor_seat!==seat) throw new GameError('ACTION_CONFLICT'); const response=prior.rows[0].projected_response; await client.query('COMMIT'); return response; }
      const entropy=recordRandom(this.random); const applied=transition(state,seat,entropy.random); const next=applied.state; const response=projectGame(next,seat);
      const payload:PrivatePayload={kind:'ACTION',seat,action:{id,expectedVersion:state.version,command:applied.command},at,entropy:entropy.choices};
      const command=applied.command;
      await this.persistTransition(client,row,next,id,fp,seat,userId, payload,response,at,command?.type);
      await client.query('COMMIT'); return response;
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  private async lockMatch(client:PoolClient,id:string):Promise<MatchRow> {
    const result=await client.query<MatchRow>('SELECT * FROM game_matches WHERE id=$1 FOR UPDATE',[id]);
    if(!result.rows[0]) throw new GameError('INVALID_INPUT'); return result.rows[0];
  }

  private async persistTransition(client:PoolClient,row:MatchRow,next:GameState,id:string,requestHash:string,seat:number|null,userId:string|null,
    payload:PrivatePayload,response:unknown,at:number,commandType?:string):Promise<void> {
    if(next.version!==row.version+1 || next.version>next.rules.maxActions) throw new GameError('INVALID_STATE');
    const type=payload.kind==='TIMEOUT'?'TIMEOUT':commandType;
    if(!type || !['PLAY','DRAW','PASS','FORFEIT','TIMEOUT'].includes(type)) throw new GameError('INVALID_STATE');
    await client.query(`INSERT INTO game_events(event_id,match_id,sequence,action_id,request_hash,actor_seat,actor_user_id,command_type,private_payload,projected_response,occurred_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[randomUUID(),row.id,next.version,id,requestHash,seat,userId,type,payload,response,new Date(at)]);
    await client.query(`UPDATE game_matches SET private_state=$2,status=$3,version=$4,updated_at=$5,ended_at=CASE WHEN $3='FINISHED' THEN $5::timestamptz ELSE NULL::timestamptz END WHERE id=$1`,[row.id,next,next.status,next.version,new Date(at)]);
    await client.query('INSERT INTO outbox_events(id,type,payload) VALUES($1,$2,$3)',[randomUUID(),'GAME_STATE_CHANGED',{matchId:row.id,version:next.version}]);
  }
}
