BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE users, login_streaks, task_completions, matches, reward_audit_events, idempotency_keys IN SHARE ROW EXCLUSIVE MODE;

CREATE FUNCTION pg_temp.canonical_id(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN value ~ '^[1-9][0-9]*$' THEN 'tg_' || value ELSE value END
$$;

DO $$
DECLARE item record; invalid_count bigint;
BEGIN
  SELECT count(*) INTO invalid_count FROM users WHERE telegram_id < 1 OR telegram_id > 9007199254740991 OR id <> 'tg_' || telegram_id::text;
  IF invalid_count > 0 THEN RAISE EXCEPTION 'Foundations preflight: % users have invalid canonical identity', invalid_count; END IF;
  FOR item IN SELECT * FROM (VALUES
    ('login_streaks','user_id'), ('task_completions','user_id'), ('matches','user_id'), ('matches','winner_id'),
    ('reward_audit_events','user_id'), ('idempotency_keys','user_id')
  ) AS refs(table_name,column_name) LOOP
    EXECUTE format('SELECT count(*) FROM %I t WHERE %I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = pg_temp.canonical_id(t.%I))',item.table_name,item.column_name,item.column_name) INTO invalid_count;
    IF invalid_count > 0 THEN RAISE EXCEPTION 'Foundations preflight: %.% has % unresolved references',item.table_name,item.column_name,invalid_count; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM login_streaks b JOIN login_streaks p ON p.user_id = 'tg_' || b.user_id
             WHERE b.user_id ~ '^[1-9][0-9]*$' AND b.window_start_date <> p.window_start_date) THEN
    RAISE EXCEPTION 'Foundations preflight: cross-window streak collision needs manual resolution';
  END IF;
  IF EXISTS (SELECT 1 FROM idempotency_keys b JOIN idempotency_keys p ON p.user_id = 'tg_' || b.user_id
    AND p.endpoint=b.endpoint AND p.idempotency_key=b.idempotency_key
    WHERE b.user_id ~ '^[1-9][0-9]*$' AND b.response_body IS DISTINCT FROM p.response_body) THEN
    RAISE EXCEPTION 'Foundations preflight: conflicting idempotency responses need manual resolution';
  END IF;
END $$;

INSERT INTO login_streaks (user_id,window_start_date,last_login_date,consecutive_login_days_count,grace_days_used,has_claimed_bonus,updated_at)
 SELECT 'tg_' || user_id,window_start_date,last_login_date,consecutive_login_days_count,grace_days_used,has_claimed_bonus,updated_at
 FROM login_streaks WHERE user_id ~ '^[1-9][0-9]*$'
 ON CONFLICT (user_id) DO UPDATE SET
   consecutive_login_days_count = CASE WHEN EXCLUDED.last_login_date > login_streaks.last_login_date THEN EXCLUDED.consecutive_login_days_count ELSE login_streaks.consecutive_login_days_count END,
   last_login_date=GREATEST(EXCLUDED.last_login_date,login_streaks.last_login_date),
   grace_days_used=GREATEST(EXCLUDED.grace_days_used,login_streaks.grace_days_used),
   has_claimed_bonus=EXCLUDED.has_claimed_bonus OR login_streaks.has_claimed_bonus,
   updated_at=GREATEST(EXCLUDED.updated_at,login_streaks.updated_at);
DELETE FROM login_streaks WHERE user_id ~ '^[1-9][0-9]*$';

DELETE FROM task_completions b USING task_completions p WHERE b.user_id ~ '^[1-9][0-9]*$'
 AND p.user_id='tg_' || b.user_id AND p.completed_on=b.completed_on AND p.task_key=b.task_key;
DELETE FROM idempotency_keys b USING idempotency_keys p WHERE b.user_id ~ '^[1-9][0-9]*$'
 AND p.user_id='tg_' || b.user_id AND p.endpoint=b.endpoint AND p.idempotency_key=b.idempotency_key;
UPDATE task_completions SET user_id=pg_temp.canonical_id(user_id);
UPDATE idempotency_keys SET user_id=pg_temp.canonical_id(user_id);
UPDATE reward_audit_events SET user_id=pg_temp.canonical_id(user_id);
UPDATE matches SET user_id=pg_temp.canonical_id(user_id), winner_id=pg_temp.canonical_id(winner_id);

ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0 CHECK (token_version >= 0);
ALTER TABLE users ADD CONSTRAINT users_canonical_identity CHECK (telegram_id > 0 AND telegram_id <= 9007199254740991 AND id = 'tg_' || telegram_id::text);
ALTER TABLE login_streaks ADD CONSTRAINT login_streaks_user_fk FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE task_completions ADD CONSTRAINT task_completions_user_fk FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE matches ADD CONSTRAINT matches_user_fk FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE matches ADD CONSTRAINT matches_winner_fk FOREIGN KEY (winner_id) REFERENCES users(id);
ALTER TABLE reward_audit_events ADD CONSTRAINT reward_audit_events_user_fk FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE idempotency_keys ADD CONSTRAINT idempotency_keys_user_fk FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE matches ADD COLUMN lagos_date DATE GENERATED ALWAYS AS ((created_at AT TIME ZONE 'Africa/Lagos')::date) STORED;
CREATE INDEX matches_user_lagos_date_idx ON matches(user_id,lagos_date);

CREATE TABLE first_login_attributions (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  start_param TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
COMMIT;
