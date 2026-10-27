BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
-- Preserve old claims/counters as evidence, never reinterpret automatic grace as
-- verified recovery or replay legacy bonuses into the monetary ledger.
CREATE TABLE streak_legacy_snapshots (
 user_id text PRIMARY KEY REFERENCES users(id),snapshot jsonb NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO streak_legacy_snapshots(user_id,snapshot) SELECT user_id,to_jsonb(s) FROM login_streaks s;
CREATE TABLE streak_cycles (
 id uuid PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),
 rule_version text NOT NULL CHECK(rule_version='calendar-30-day10-ad-v1'),
 start_date date NOT NULL,last_completed_date date NOT NULL,
 ends_at timestamptz GENERATED ALWAYS AS ((start_date+30)::timestamp AT TIME ZONE 'Africa/Lagos') STORED,
 recovery_used boolean NOT NULL DEFAULT false,
 closed_reason text CHECK(closed_reason IN('RESET','ENDED')),closed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,user_id),UNIQUE(user_id,start_date),
 CHECK(last_completed_date>=start_date AND last_completed_date<start_date+30),
 CHECK(NOT recovery_used OR last_completed_date>=start_date+11),
 CHECK((closed_reason IS NULL)=(closed_at IS NULL))
);
CREATE UNIQUE INDEX streak_one_active_cycle ON streak_cycles(user_id) WHERE closed_at IS NULL;
CREATE TABLE streak_login_dates (
 user_id text NOT NULL REFERENCES users(id),lagos_date date NOT NULL,
 cycle_id uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,lagos_date),FOREIGN KEY(cycle_id,user_id) REFERENCES streak_cycles(id,user_id)
);
CREATE TABLE streak_claims (
 user_id text NOT NULL,cycle_id uuid NOT NULL,milestone integer NOT NULL CHECK(milestone IN(10,20,30)),
 tier_at_claim text NOT NULL CHECK(tier_at_claim IN('REGULAR','PREMIUM')),
 amount_kobo integer NOT NULL CHECK(amount_kobo IN(0,5000,10000,20000)),
 ledger_entry_id uuid UNIQUE REFERENCES wallet_entries(id),
 response jsonb NOT NULL CHECK(jsonb_typeof(response)='object'),
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,cycle_id,milestone),FOREIGN KEY(cycle_id,user_id) REFERENCES streak_cycles(id,user_id),
 CHECK((amount_kobo=0)=(ledger_entry_id IS NULL)),
 CHECK((milestone=10 AND amount_kobo=5000) OR
       (milestone=20 AND ((tier_at_claim='REGULAR' AND amount_kobo=0) OR (tier_at_claim='PREMIUM' AND amount_kobo=10000))) OR
       (milestone=30 AND ((tier_at_claim='REGULAR' AND amount_kobo=10000) OR (tier_at_claim='PREMIUM' AND amount_kobo=20000))))
);
CREATE TABLE streak_claim_requests (
 user_id text NOT NULL REFERENCES users(id),request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
 request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(user_id,request_key)
);
CREATE FUNCTION guard_streak_cycle_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable streak cycle history'; END IF;
 IF (NEW.id,NEW.user_id,NEW.rule_version,NEW.start_date,NEW.created_at)
 IS DISTINCT FROM (OLD.id,OLD.user_id,OLD.rule_version,OLD.start_date,OLD.created_at)
 OR OLD.closed_at IS NOT NULL OR NEW.last_completed_date<OLD.last_completed_date
 OR (OLD.recovery_used AND NOT NEW.recovery_used) THEN RAISE EXCEPTION 'Invalid streak cycle mutation'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER streak_cycle_guard BEFORE UPDATE OR DELETE ON streak_cycles FOR EACH ROW EXECUTE FUNCTION guard_streak_cycle_update();
CREATE TRIGGER streak_login_dates_immutable BEFORE UPDATE OR DELETE ON streak_login_dates FOR EACH ROW EXECUTE FUNCTION reject_financial_mutation();
CREATE TRIGGER streak_claims_immutable BEFORE UPDATE OR DELETE ON streak_claims FOR EACH ROW EXECUTE FUNCTION reject_financial_mutation();
CREATE TRIGGER streak_claim_requests_immutable BEFORE UPDATE OR DELETE ON streak_claim_requests FOR EACH ROW EXECUTE FUNCTION reject_financial_mutation();
CREATE TRIGGER streak_legacy_snapshots_immutable BEFORE UPDATE OR DELETE ON streak_legacy_snapshots FOR EACH ROW EXECUTE FUNCTION reject_financial_mutation();
COMMIT;
