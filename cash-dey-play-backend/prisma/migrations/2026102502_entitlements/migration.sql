BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
UPDATE users SET is_premium=false;
UPDATE premium_subscriptions SET is_active=false;
CREATE TABLE premium_orders (
 id uuid PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),plan_id text NOT NULL,
 duration_days integer NOT NULL CHECK(duration_days IN(30,90)),stars_amount integer NOT NULL CHECK(stars_amount>0),
 currency text NOT NULL CHECK(currency='XTR'),status text NOT NULL CHECK(status IN('PENDING','PAID','EXPIRED','REFUNDED','PAID_LATE')),
 charge_id text UNIQUE,created_at timestamptz NOT NULL DEFAULT now(),CHECK(status NOT IN('PAID','REFUNDED','PAID_LATE') OR charge_id IS NOT NULL)
);
CREATE TABLE paid_entitlements (
 order_id uuid PRIMARY KEY REFERENCES premium_orders(id), starts_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 revoked_at timestamptz,CHECK(expires_at>starts_at)
);
CREATE TABLE ad_free_days (
 user_id text NOT NULL REFERENCES users(id),valid_on date NOT NULL,starts_at timestamptz NOT NULL,
 expires_at timestamptz GENERATED ALWAYS AS ((valid_on+1)::timestamp AT TIME ZONE 'Africa/Lagos') STORED,
 PRIMARY KEY(user_id,valid_on),CHECK((starts_at AT TIME ZONE 'Africa/Lagos')::date=valid_on)
);
CREATE TABLE daily_task_state (
 user_id text NOT NULL REFERENCES users(id),lagos_date date NOT NULL,task_key text NOT NULL CHECK(task_key IN('MANDATORY_VIDEO_LOGIN','MANDATORY_VIDEO_UNLOCK','WIN_MATCH','BONUS_ALL_COMPLETE')),
 status text NOT NULL CHECK(status IN('AVAILABLE','AUTO_READY','CLAIMED')),source text,claimed_at timestamptz,
 points_awarded integer NOT NULL DEFAULT 0 CHECK(points_awarded IN(0,50)),PRIMARY KEY(user_id,lagos_date,task_key),
 CHECK((status='CLAIMED' AND claimed_at IS NOT NULL) OR (status<>'CLAIMED' AND claimed_at IS NULL))
);
CREATE TABLE task_claims (
 user_id text NOT NULL,lagos_date date NOT NULL,task_key text NOT NULL,source_event text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,lagos_date,task_key),UNIQUE(user_id,source_event),
 FOREIGN KEY(user_id,lagos_date,task_key) REFERENCES daily_task_state(user_id,lagos_date,task_key)
);
INSERT INTO daily_task_state(user_id,lagos_date,task_key,status,source,claimed_at,points_awarded)
SELECT user_id,completed_on,task_key,'CLAIMED','LEGACY',completed_on::timestamp AT TIME ZONE 'Africa/Lagos',0
FROM task_completions WHERE task_key IN('MANDATORY_VIDEO_LOGIN','MANDATORY_VIDEO_UNLOCK','WIN_MATCH','BONUS_ALL_COMPLETE');
-- Fail for ambiguous old referral ownership rather than deleting or guessing attribution.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM referrals GROUP BY referred_id HAVING count(*)>1) OR EXISTS(SELECT 1 FROM referrals WHERE referrer_id=referred_id) THEN
  RAISE EXCEPTION 'Referral ownership preflight failed';
 END IF;
END $$;
ALTER TABLE referrals ADD CONSTRAINT referrals_one_referrer UNIQUE(referred_id),ADD CONSTRAINT referrals_no_self CHECK(referrer_id<>referred_id);
ALTER TABLE referrals ADD COLUMN status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','QUALIFIED','EXPIRED')),
 ADD COLUMN expires_at timestamptz;
UPDATE referrals SET status=CASE WHEN is_qualified THEN 'QUALIFIED' WHEN created_at+interval '30 days'<=now() THEN 'EXPIRED' ELSE 'PENDING' END,expires_at=created_at+interval '30 days';
ALTER TABLE referrals ALTER COLUMN expires_at SET NOT NULL;
COMMIT;
