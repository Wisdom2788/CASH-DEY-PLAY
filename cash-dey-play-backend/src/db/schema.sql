-- Cash Dey Play — qualification persistence.
-- Indexes match §10: rolling-window and monthly-count queries must not
-- recompute from unindexed TO_CHAR() predicates.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT NOT NULL,
  avatar_url TEXT,
  is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  xp INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  monthly_rank INTEGER,
  monthly_trend INTEGER,
  matches_won_month INTEGER NOT NULL DEFAULT 0,
  matches_played_month INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT UNIQUE,
  active_task_days_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_streaks (
  user_id TEXT PRIMARY KEY,
  window_start_date DATE NOT NULL,
  last_login_date DATE NOT NULL,
  consecutive_login_days_count INTEGER NOT NULL,
  grace_days_used INTEGER NOT NULL,
  has_claimed_bonus BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_completions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  completed_on DATE NOT NULL,
  task_key TEXT NOT NULL,
  UNIQUE (user_id, completed_on, task_key)
);

CREATE INDEX IF NOT EXISTS task_completions_user_completed_on_idx
  ON task_completions (user_id, completed_on);

CREATE TABLE IF NOT EXISTS matches (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  winner_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS matches_user_created_at_idx
  ON matches (user_id, created_at);

CREATE TABLE IF NOT EXISTS reward_audit_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL,
  amount_kobo INTEGER,
  reason TEXT NOT NULL,
  triggering_rule TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS reward_audit_events_user_occurred_at_idx
  ON reward_audit_events (user_id, occurred_at);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, endpoint, idempotency_key)
);

-- Wallet: tracks user airtime balance
CREATE TABLE IF NOT EXISTS wallets (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  balance_ngn INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wallet transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,  -- MILESTONE_REWARD | AIRTIME_CASHOUT | LEADERBOARD_PRIZE | BOOST_EARN
  amount_ngn INTEGER NOT NULL,
  description TEXT NOT NULL,
  provider TEXT,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS',  -- SUCCESS | PENDING
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx
  ON wallet_transactions (user_id, created_at DESC);

-- Premium subscriptions
CREATE TABLE IF NOT EXISTS premium_subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES users(id),
  referred_id TEXT NOT NULL REFERENCES users(id),
  qualifying_task_days INTEGER NOT NULL DEFAULT 0,
  is_qualified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referrer_id, referred_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_id);
