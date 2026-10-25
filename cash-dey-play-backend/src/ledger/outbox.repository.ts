import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
export interface OutboxDelivery { id:string; type:string; payload:unknown; lease_token:string; attempts:number }
/** At-least-once delivery. Consumers must deduplicate on event.id; no provider dispatch is wired yet. */
export class OutboxRepository {
  constructor(private readonly pool:Pool) {}
  async claim(leaseSeconds=60,types?:readonly string[]):Promise<OutboxDelivery|null> {
    if(!Number.isInteger(leaseSeconds) || leaseSeconds<1 || leaseSeconds>3600) throw new Error('Invalid lease');
    if(types&&(!types.length||types.length>20||types.some(t=>!/^[A-Z_]{1,64}$/.test(t))))throw new Error('Invalid event types');
    const token=randomUUID();
    const result=await this.pool.query<OutboxDelivery>(`WITH candidate AS (
      SELECT id FROM outbox_events WHERE ((state='PENDING' AND available_at<=clock_timestamp())
        OR (state='PROCESSING' AND lease_until<=clock_timestamp())) AND ($3::text[] IS NULL OR type=ANY($3))
      ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1
    ) UPDATE outbox_events e SET state='PROCESSING',lease_token=$1,
      lease_until=clock_timestamp()+$2::integer*interval '1 second',attempts=attempts+1
      FROM candidate c WHERE e.id=c.id RETURNING e.id,e.type,e.payload,e.lease_token,e.attempts`,[token,leaseSeconds,types??null]);
    return result.rows[0] ?? null;
  }
  async acknowledge(event:OutboxDelivery):Promise<boolean> {
    const result=await this.pool.query(`UPDATE outbox_events SET state='DELIVERED',delivered_at=clock_timestamp(),lease_token=NULL,lease_until=NULL
      WHERE id=$1 AND state='PROCESSING' AND lease_token=$2 AND lease_until>clock_timestamp()`,[event.id,event.lease_token]);
    return result.rowCount===1;
  }
  async retry(event:OutboxDelivery):Promise<boolean> {
    // No raw provider errors/payloads are stored in generic retry metadata.
    const result=await this.pool.query(`UPDATE outbox_events SET state='PENDING',available_at=clock_timestamp()+$3::integer*interval '1 second',
      lease_token=NULL,lease_until=NULL WHERE id=$1 AND state='PROCESSING' AND lease_token=$2 AND lease_until>clock_timestamp()`,
      [event.id,event.lease_token,Math.min(3600,2**Math.min(event.attempts,12))]);
    return result.rowCount===1;
  }
}
