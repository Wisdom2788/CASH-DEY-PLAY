BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE game_matches (
  id uuid PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('PRACTICE','RANKED')),
  rule_version text NOT NULL CHECK (length(rule_version) BETWEEN 1 AND 128),
  private_initial_state jsonb NOT NULL CHECK (jsonb_typeof(private_initial_state)='object'),
  private_state jsonb NOT NULL CHECK (jsonb_typeof(private_state)='object'),
  status text NOT NULL CHECK (status IN ('ACTIVE','FINISHED')),
  version integer NOT NULL DEFAULT 0 CHECK (version BETWEEN 0 AND 2000),
  started_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  ended_at timestamptz,
  CHECK ((status='ACTIVE' AND ended_at IS NULL) OR (status='FINISHED' AND ended_at IS NOT NULL)),
  CHECK ((private_state->>'version')::integer=version),
  CHECK ((private_state->>'status')=status)
);
CREATE INDEX game_matches_active_deadline_idx ON game_matches (((private_state->>'deadlineAt')::bigint), id) WHERE status='ACTIVE';

CREATE TABLE game_players (
  match_id uuid NOT NULL REFERENCES game_matches(id) ON DELETE CASCADE,
  seat smallint NOT NULL CHECK (seat IN (0,1)),
  user_id text REFERENCES users(id),
  is_bot boolean NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(match_id,seat),
  UNIQUE(match_id,user_id),
  CHECK ((is_bot AND user_id IS NULL) OR (NOT is_bot AND user_id IS NOT NULL))
);
CREATE INDEX game_players_user_idx ON game_players(user_id,match_id) WHERE user_id IS NOT NULL;

CREATE FUNCTION enforce_game_seats() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id uuid; target_mode text; seat_count integer; bot_count integer; human_count integer;
BEGIN
  target_id := CASE WHEN TG_TABLE_NAME='game_matches' THEN COALESCE(NEW.id,OLD.id) ELSE COALESCE(NEW.match_id,OLD.match_id) END;
  SELECT mode INTO target_mode FROM game_matches WHERE id=target_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*),count(*) FILTER(WHERE is_bot),count(*) FILTER(WHERE NOT is_bot)
    INTO seat_count,bot_count,human_count FROM game_players WHERE match_id=target_id;
  IF seat_count<>2 OR (target_mode='PRACTICE' AND (bot_count<>1 OR human_count<>1)) OR (target_mode='RANKED' AND (bot_count<>0 OR human_count<>2)) THEN
    RAISE EXCEPTION 'Game match must have exactly two seats matching its mode' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER game_match_seats_complete AFTER INSERT OR UPDATE ON game_matches
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_game_seats();
CREATE CONSTRAINT TRIGGER game_player_seats_complete AFTER INSERT OR UPDATE OR DELETE ON game_players
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_game_seats();

CREATE TABLE game_events (
  match_id uuid NOT NULL REFERENCES game_matches(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence BETWEEN 1 AND 2000),
  action_id text NOT NULL CHECK (action_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  actor_seat smallint CHECK (actor_seat IN (0,1)),
  actor_user_id text REFERENCES users(id),
  command_type text NOT NULL CHECK (command_type IN ('PLAY','DRAW','PASS','FORFEIT','TIMEOUT')),
  private_payload jsonb NOT NULL CHECK (jsonb_typeof(private_payload)='object'),
  projected_response jsonb NOT NULL CHECK (jsonb_typeof(projected_response)='object'),
  occurred_at timestamptz NOT NULL,
  PRIMARY KEY(match_id,sequence),
  UNIQUE(match_id,action_id),
  CHECK ((command_type='TIMEOUT' AND actor_seat IS NULL AND actor_user_id IS NULL) OR
         (command_type<>'TIMEOUT' AND actor_seat IS NOT NULL))
);
CREATE FUNCTION reject_game_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Game replay history is immutable'; END $$;
CREATE TRIGGER game_events_immutable BEFORE UPDATE OR DELETE ON game_events FOR EACH ROW EXECUTE FUNCTION reject_game_history_mutation();
CREATE FUNCTION reject_game_initial_state_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.private_initial_state IS DISTINCT FROM OLD.private_initial_state OR NEW.rule_version IS DISTINCT FROM OLD.rule_version OR NEW.mode IS DISTINCT FROM OLD.mode THEN
    RAISE EXCEPTION 'Game replay origin is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER game_initial_state_immutable BEFORE UPDATE ON game_matches FOR EACH ROW EXECUTE FUNCTION reject_game_initial_state_mutation();

COMMIT;
