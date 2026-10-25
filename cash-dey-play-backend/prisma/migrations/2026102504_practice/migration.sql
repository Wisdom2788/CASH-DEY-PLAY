BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE player_admissions (
 user_id text PRIMARY KEY REFERENCES users(id),
 ranked_queued boolean NOT NULL DEFAULT false
);
CREATE TABLE practice_starts (
 id uuid PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),
 request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
 request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
 match_id uuid NOT NULL UNIQUE REFERENCES game_matches(id),
 reason text NOT NULL CHECK(reason IN('PREMIUM','AD_FREE','PROVIDER_UNAVAILABLE')),
 started_at timestamptz NOT NULL,
 lagos_date date GENERATED ALWAYS AS ((started_at AT TIME ZONE 'Africa/Lagos')::date) STORED,
 response jsonb NOT NULL CHECK(jsonb_typeof(response)='object'),
 UNIQUE(user_id,request_key)
);
CREATE INDEX practice_starts_daily_idx ON practice_starts(user_id,lagos_date);
CREATE TABLE practice_completions (
 match_id uuid PRIMARY KEY REFERENCES practice_starts(match_id),
 user_id text NOT NULL REFERENCES users(id),
 completed_at timestamptz NOT NULL,
 lagos_date date GENERATED ALWAYS AS ((completed_at AT TIME ZONE 'Africa/Lagos')::date) STORED
);
CREATE INDEX practice_completions_user_date_idx ON practice_completions(user_id,lagos_date);
CREATE TRIGGER practice_starts_immutable BEFORE UPDATE OR DELETE ON practice_starts FOR EACH ROW EXECUTE FUNCTION reject_game_history_mutation();
CREATE TRIGGER practice_completions_immutable BEFORE UPDATE OR DELETE ON practice_completions FOR EACH ROW EXECUTE FUNCTION reject_game_history_mutation();
COMMIT;
