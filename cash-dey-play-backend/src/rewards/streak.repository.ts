import { createHash, randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { loadEntitlements } from '../entitlements/entitlements';
import { LedgerRepository } from '../ledger/ledger.repository';
import { STREAK_RULE_VERSION, decideStreakLogin, milestoneWithinClaimWindow, type StreakCycle } from './streak-policy';

type Milestone = 10 | 20 | 30;
interface CycleRow {
  id:string; user_id:string; rule_version:typeof STREAK_RULE_VERSION;
  start_date:string; last_completed_date:string; ends_at:string; recovery_used:boolean;
  closed_reason:'RESET'|'ENDED'|null;
}
interface SqlTime { now:string; today:string }
export interface StreakClaim {
  cycleId:string; milestone:Milestone; tier:'REGULAR'|'PREMIUM';
  kind:'AIRTIME_CREDIT'|'AD_FREE'; amountKobo:string; entryId?:string;
  availableKobo?:string; expiresAt?:string;
}
export class StreakError extends Error {
  constructor(readonly code:'NOT_FOUND'|'CONFLICT'|'EXPIRED'|'NOT_UNLOCKED'|'PRACTICE_TARGET') { super(code); }
}
const columns=`id,user_id,rule_version,start_date::text,last_completed_date::text,
  to_char(ends_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ends_at,recovery_used,closed_reason`;
const asPolicy=(c:CycleRow):StreakCycle=>({ruleVersion:c.rule_version,startDate:c.start_date,
  lastCompletedDate:c.last_completed_date,recoveryUsed:c.recovery_used});

export class StreakRepository {
  private readonly ledger:LedgerRepository;
  constructor(private readonly pool:Pool) { this.ledger=new LedgerRepository(pool); }

  private async transaction<T>(userId:string, work:(c:PoolClient)=>Promise<T>):Promise<T> {
    const c=await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SET LOCAL lock_timeout='5s'");
      await c.query("SET LOCAL statement_timeout='10s'");
      const actor=await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
      if(!actor.rowCount)throw new StreakError('NOT_FOUND');
      const result=await work(c);await c.query('COMMIT');return result;
    } catch(error) { await c.query('ROLLBACK');throw error; }
    finally { c.release(); }
  }
  private async time(c:PoolClient):Promise<SqlTime> {
    // One clock sample supplies both instant and Lagos date, including midnight.
    const r=await c.query<SqlTime>(`SELECT t::text AS now,(t AT TIME ZONE 'Africa/Lagos')::date::text AS today
      FROM (SELECT clock_timestamp() AS t) sampled`);
    return r.rows[0]!;
  }
  private async active(c:PoolClient,userId:string):Promise<CycleRow|null> {
    return (await c.query<CycleRow>(`SELECT ${columns} FROM streak_cycles WHERE user_id=$1 AND closed_at IS NULL FOR UPDATE`,[userId])).rows[0]??null;
  }

  async recordLogin(userId:string) {
    return this.transaction(userId,async c=>{
      let cycle=await this.active(c,userId);const at=await this.time(c);
      const decision=cycle?decideStreakLogin(asPolicy(cycle),at.today):{kind:'NEW_CYCLE' as const,day:1};
      if(!cycle||decision.kind==='RESET'||decision.kind==='NEW_CYCLE') {
        if(cycle)await c.query('UPDATE streak_cycles SET closed_reason=$2,closed_at=$3 WHERE id=$1',
          [cycle.id,decision.kind==='RESET'?'RESET':'ENDED',at.now]);
        const created=await c.query<CycleRow>(`INSERT INTO streak_cycles(id,user_id,rule_version,start_date,last_completed_date)
          VALUES($1,$2,$3,$4,$4) RETURNING ${columns}`,[randomUUID(),userId,STREAK_RULE_VERSION,at.today]);
        cycle=created.rows[0]!;
      } else if(decision.kind==='CONTINUE') {
        cycle=(await c.query<CycleRow>(`UPDATE streak_cycles SET last_completed_date=$2 WHERE id=$1 RETURNING ${columns}`,[cycle.id,at.today])).rows[0]!;
      }
      await c.query('INSERT INTO streak_login_dates(user_id,lagos_date,cycle_id,recorded_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [userId,at.today,cycle.id,at.now]);
      return {cycle,decision,serverDate:at.today,recoveryAvailable:false};
    });
  }

  async progress(userId:string) {
    return this.transaction(userId,async c=>{
      const cycle=await this.active(c,userId);const at=await this.time(c);
      const previousCycles=(await c.query<CycleRow>(`SELECT ${columns} FROM streak_cycles
        WHERE user_id=$1 AND closed_at IS NOT NULL AND ends_at>$2 ORDER BY start_date DESC LIMIT 30`,[userId,at.now])).rows;
      if(!cycle)return {cycle:null,previousCycles,milestones:[],serverDate:at.today,recoveryAvailable:false};
      const entitlement=await loadEntitlements(c,userId,at.now);
      const completedDay=this.completedDay(cycle);
      const count=await this.practiceCount(c,userId,cycle,at.now);
      const claims=await c.query<{milestone:Milestone;response:StreakClaim}>('SELECT milestone,response FROM streak_claims WHERE user_id=$1 AND cycle_id=$2',[userId,cycle.id]);
      const milestones=([10,20,30] as const).map(day=>{
        const receipt=claims.rows.find(r=>r.milestone===day)?.response??null;
        const reason=receipt?'CLAIMED':!milestoneWithinClaimWindow(cycle.start_date,day,new Date(at.now))
          ?(new Date(at.now).getTime()>=new Date(cycle.ends_at).getTime()?'EXPIRED':'NOT_UNLOCKED')
          :completedDay<day?'NOT_UNLOCKED':day===30&&!entitlement.isPremium&&count<25?'PRACTICE_TARGET':null;
        return {day,claimable:reason===null,reason,receipt};
      });
      return {cycle,previousCycles,completedDay,milestones,practiceCompletions:count,serverDate:at.today,
        decision:decideStreakLogin(asPolicy(cycle),at.today),recoveryAvailable:false};
    });
  }
  private completedDay(cycle:CycleRow):number {
    return Math.round((Date.parse(cycle.last_completed_date)-Date.parse(cycle.start_date))/86_400_000)+1;
  }
  private async practiceCount(c:PoolClient,userId:string,cycle:CycleRow,at:string):Promise<number> {
    const r=await c.query<{n:number}>(`SELECT count(*)::int AS n FROM practice_completions WHERE user_id=$1
      AND completed_at>=$2::date::timestamp AT TIME ZONE 'Africa/Lagos' AND completed_at<$3 AND completed_at<=$4`,
      [userId,cycle.start_date,cycle.ends_at,at]);return r.rows[0]!.n;
  }

  async claim(userId:string,cycleId:string,day:Milestone,key:string):Promise<StreakClaim> {
    if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(cycleId)||![10,20,30].includes(day)||!/^[A-Za-z0-9._:-]{8,128}$/.test(key))throw new StreakError('CONFLICT');
    cycleId=cycleId.toLowerCase();
    const hash=createHash('sha256').update(JSON.stringify([userId,cycleId,day,STREAK_RULE_VERSION])).digest('hex');
    return this.transaction(userId,async c=>{
      const prior=(await c.query<{request_hash:string;response:StreakClaim}>(
        'SELECT request_hash,response FROM streak_claim_requests WHERE user_id=$1 AND request_key=$2',[userId,key])).rows[0];
      if(prior){if(prior.request_hash!==hash)throw new StreakError('CONFLICT');return prior.response;}
      const cycle=(await c.query<CycleRow>(`SELECT ${columns} FROM streak_cycles WHERE user_id=$1 AND id=$2 FOR UPDATE`,[userId,cycleId])).rows[0];
      if(!cycle)throw new StreakError('NOT_FOUND');
      const saved=(await c.query<{response:StreakClaim}>('SELECT response FROM streak_claims WHERE user_id=$1 AND cycle_id=$2 AND milestone=$3',[userId,cycleId,day])).rows[0];
      let response:StreakClaim;
      if(saved)response=saved.response;
      else {
        await c.query('INSERT INTO wallet_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING',[userId]);
        await c.query('SELECT user_id FROM wallet_accounts WHERE user_id=$1 FOR UPDATE',[userId]);
        // Future payment/refund writers must take the same canonical-user lock first.
        await c.query('SELECT id FROM premium_orders WHERE user_id=$1 ORDER BY id FOR SHARE',[userId]);
        await c.query('SELECT e.order_id FROM paid_entitlements e JOIN premium_orders o ON o.id=e.order_id WHERE o.user_id=$1 ORDER BY e.order_id FOR SHARE OF e',[userId]);
        const at=await this.time(c);
        if(new Date(at.now).getTime()>=new Date(cycle.ends_at).getTime())throw new StreakError('EXPIRED');
        if(this.completedDay(cycle)<day||!milestoneWithinClaimWindow(cycle.start_date,day,new Date(at.now)))throw new StreakError('NOT_UNLOCKED');
        const entitlement=await loadEntitlements(c,userId,at.now);
        if(day===30&&!entitlement.isPremium&&await this.practiceCount(c,userId,cycle,at.now)<25)throw new StreakError('PRACTICE_TARGET');
        const tier=entitlement.isPremium?'PREMIUM':'REGULAR';
        if(day===20&&!entitlement.isPremium) {
          const grant=await c.query<{expires_at:string}>(`INSERT INTO ad_free_days(user_id,valid_on,starts_at) VALUES($1,$2,$3)
            ON CONFLICT(user_id,valid_on) DO UPDATE SET starts_at=least(ad_free_days.starts_at,EXCLUDED.starts_at)
            RETURNING to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS expires_at`,[userId,at.today,at.now]);
          response={cycleId,milestone:day,tier,kind:'AD_FREE',amountKobo:'0',expiresAt:grant.rows[0]!.expires_at};
          await c.query('INSERT INTO reward_audit_events(user_id,event_type,amount_kobo,reason,triggering_rule) VALUES($1,$2,NULL,$3,$4)',
            [userId,'STREAK_AD_FREE_CLAIMED',`${cycleId}:${day}`,STREAK_RULE_VERSION]);
          await c.query('INSERT INTO outbox_events(id,type,payload) VALUES($1,$2,$3)',[randomUUID(),'STREAK_AD_FREE_CLAIMED',{userId,cycleId,milestone:day}]);
        } else {
          const amountKobo=day===10?5000:day===20?10000:entitlement.isPremium?20000:10000;
          const posting=await this.ledger.postInTransaction(c,{userId,operation:'STREAK_MILESTONE',idempotencyKey:`${cycleId}:${day}`,
            amountKobo,kind:'CREDIT',referenceType:'STREAK_MILESTONE',referenceId:`${cycleId}:${day}`,
            ruleVersion:STREAK_RULE_VERSION,sourcePayloadHash:hash});
          response={cycleId,milestone:day,tier,kind:'AIRTIME_CREDIT',...posting};
        }
        await c.query(`INSERT INTO streak_claims(user_id,cycle_id,milestone,tier_at_claim,amount_kobo,ledger_entry_id,response,claimed_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[userId,cycleId,day,tier,response.amountKobo,response.entryId??null,response,at.now]);
      }
      await c.query('INSERT INTO streak_claim_requests(user_id,request_key,request_hash,response) VALUES($1,$2,$3,$4)',[userId,key,hash,response]);
      return response;
    });
  }
}
