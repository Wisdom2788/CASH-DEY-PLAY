BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE ranked_no_shows (
 offer_id uuid NOT NULL REFERENCES ranked_offers(id),user_id text NOT NULL REFERENCES users(id),occurred_at timestamptz NOT NULL,
 PRIMARY KEY(offer_id,user_id)
);
CREATE TABLE ranked_penalties (
 user_id text PRIMARY KEY REFERENCES users(id),misses integer NOT NULL CHECK(misses>0),last_miss_at timestamptz NOT NULL,locked_until timestamptz
);
CREATE TABLE ranked_results (
 match_id uuid NOT NULL,user_id text NOT NULL,opponent_id text NOT NULL REFERENCES users(id),
 outcome text NOT NULL CHECK(outcome IN('WIN','LOSS','DRAW')),reason text NOT NULL CHECK(reason IN('EMPTY_HAND','FORFEIT','TIMEOUT','EXHAUSTED','ACTION_LIMIT')),
 finished_at timestamptz NOT NULL,lagos_date date NOT NULL,terminal_event_id uuid NOT NULL REFERENCES game_events(event_id),
 PRIMARY KEY(match_id,user_id),FOREIGN KEY(match_id,user_id) REFERENCES game_players(match_id,user_id),CHECK(user_id<>opponent_id)
);
CREATE INDEX ranked_results_player_date ON ranked_results(user_id,lagos_date,outcome);
CREATE FUNCTION protect_ranked_result() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Ranked result is immutable'; END $$;
CREATE TRIGGER ranked_results_immutable BEFORE UPDATE OR DELETE ON ranked_results FOR EACH ROW EXECUTE FUNCTION protect_ranked_result();
CREATE TRIGGER ranked_no_shows_immutable BEFORE UPDATE OR DELETE ON ranked_no_shows FOR EACH ROW EXECUTE FUNCTION protect_ranked_result();
CREATE TABLE ranked_rematches (
 id uuid PRIMARY KEY,requester_id text NOT NULL REFERENCES users(id),target_id text NOT NULL REFERENCES users(id),
 request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
 state text NOT NULL CHECK(state IN('PENDING','STARTED','DECLINED','EXPIRED','CANCELLED')),
 created_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,match_id uuid REFERENCES game_matches(id),
 UNIQUE(requester_id,request_key),CHECK(requester_id<>target_id),CHECK(expires_at>created_at),CHECK((state='STARTED')=(match_id IS NOT NULL))
);
CREATE INDEX ranked_rematch_pending ON ranked_rematches(expires_at) WHERE state='PENDING';
CREATE INDEX ranked_rematch_rate ON ranked_rematches(requester_id,created_at);

-- Operational heartbeats contain no user payload or connection credentials.
CREATE TABLE ranked_worker_health (
 instance_id uuid NOT NULL,role text NOT NULL CHECK(role IN('games','matchmaker','delivery')),
 last_success_at timestamptz,last_failure_at timestamptz,failures bigint NOT NULL DEFAULT 0 CHECK(failures>=0),
 PRIMARY KEY(instance_id,role)
);
COMMIT;
