import { Pool, PoolClient } from 'pg';
export const PREMIUM_SQL = `EXISTS(SELECT 1 FROM premium_orders o JOIN paid_entitlements e ON e.order_id=o.id
 WHERE o.user_id=u.id AND o.status='PAID' AND o.charge_id IS NOT NULL AND e.revoked_at IS NULL
 AND e.starts_at<=clock_timestamp() AND e.expires_at>clock_timestamp())`;
export interface EntitlementState {isPremium:boolean;adFree:boolean;expiresAt:Date|null}
export async function loadEntitlements(client:Pick<PoolClient,'query'>|Pool,userId:string,at:Date):Promise<EntitlementState> {
 const r=await client.query<{expires_at:Date|null;ad_free:boolean}>(`SELECT
 (SELECT max(e.expires_at) FROM paid_entitlements e JOIN premium_orders o ON o.id=e.order_id
 WHERE o.user_id=$1 AND o.status='PAID' AND o.charge_id IS NOT NULL AND e.revoked_at IS NULL AND e.starts_at<=$2 AND e.expires_at>$2) AS expires_at,
 EXISTS(SELECT 1 FROM ad_free_days WHERE user_id=$1 AND starts_at<=$2 AND expires_at>$2) AS ad_free`,[userId,at]);
 const row=r.rows[0]!;return {isPremium:row.expires_at!==null,adFree:row.expires_at!==null||row.ad_free,expiresAt:row.expires_at};
}
