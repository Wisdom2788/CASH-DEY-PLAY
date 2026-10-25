BEGIN;
-- One durable socket generation per registered player. No bearer token or hidden game state is stored here.
CREATE TABLE realtime_sessions (
 user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 connection_id uuid NOT NULL UNIQUE,
 token_version integer NOT NULL CHECK(token_version>=0),
 expires_at timestamptz NOT NULL,
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(expires_at>claimed_at)
);
COMMIT;
