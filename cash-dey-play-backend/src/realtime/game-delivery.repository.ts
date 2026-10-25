import { Pool } from 'pg';
import { z } from 'zod';
import { OutboxDelivery,OutboxRepository } from '../ledger/outbox.repository';
import { GameNotice,gameNoticeSchema } from './game-notifications';
const intentSchema=z.strictObject({matchId:z.string().uuid(),version:z.number().int().positive().max(2000)});
export class GameDeliveryRepository {
 constructor(private readonly pool:Pool){}
 /** A successful acknowledgement means relay publication, never browser receipt. */
 async publish(event:OutboxDelivery,publish:(notice:GameNotice)=>Promise<unknown>):Promise<boolean>{
  const owned=await this.pool.query<{payload:unknown}>(`SELECT payload FROM outbox_events
   WHERE id=$1 AND type='GAME_STATE_CHANGED' AND state='PROCESSING' AND lease_token=$2 AND lease_until>clock_timestamp()`,[event.id,event.lease_token]);
  if(!owned.rows[0])return false;
  const intent=intentSchema.parse(owned.rows[0].payload);
  const source=await this.pool.query<{event_id:string;user_ids:string[]}>(`SELECT e.event_id,
   ARRAY(SELECT p.user_id FROM game_players p WHERE p.match_id=e.match_id AND NOT p.is_bot ORDER BY p.user_id) AS user_ids
   FROM game_events e JOIN game_matches m ON m.id=e.match_id
   WHERE e.match_id=$1 AND e.sequence=$2 AND m.version>=e.sequence`,[intent.matchId,intent.version]);
  const row=source.rows[0];if(!row)throw new Error('Committed game event missing');
  const notice=gameNoticeSchema.parse({eventId:row.event_id,...intent,userIds:row.user_ids});
  await publish(notice);
  return new OutboxRepository(this.pool).acknowledge(event);
 }
}

export async function runGameDeliveryPass(pool:Pool,publish:(notice:GameNotice)=>Promise<unknown>,limit=100,signal?:AbortSignal):Promise<number>{
 if(!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new Error('Invalid batch limit');
 const outbox=new OutboxRepository(pool);const delivery=new GameDeliveryRepository(pool);let delivered=0;
 for(let i=0;i<limit&&!signal?.aborted;i++){
  const event=await outbox.claim(60,['GAME_STATE_CHANGED']);if(!event)break;
  try{if(await delivery.publish(event,publish))delivered++;}
  catch(error){await outbox.retry(event);throw error;}
 }
 return delivered;
}
