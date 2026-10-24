BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE wallets, wallet_transactions IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM wallets WHERE balance_ngn < 0 OR balance_ngn::bigint * 100 > 2000000000) THEN
    RAISE EXCEPTION 'Ledger opening balance preflight failed';
  END IF;
END $$;
CREATE TABLE wallet_accounts (
  user_id text PRIMARY KEY REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE wallet_entries (
  id uuid PRIMARY KEY,
  account_id text NOT NULL REFERENCES wallet_accounts(user_id),
  amount_kobo bigint NOT NULL CHECK (amount_kobo <> 0 AND amount_kobo BETWEEN -2000000000 AND 2000000000),
  kind text NOT NULL CHECK (kind IN ('OPENING_BALANCE','CREDIT','DEBIT','COMPENSATION')),
  reference_type text NOT NULL CHECK (length(reference_type) BETWEEN 1 AND 64),
  reference_id text NOT NULL CHECK (length(reference_id) BETWEEN 1 AND 128),
  rule_version text NOT NULL CHECK (length(rule_version) BETWEEN 1 AND 64),
  audit_id bigint NOT NULL UNIQUE REFERENCES reward_audit_events(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, reference_type, reference_id),
  CHECK ((kind = 'DEBIT' AND amount_kobo < 0) OR (kind IN ('CREDIT','OPENING_BALANCE') AND amount_kobo > 0) OR kind = 'COMPENSATION')
);
CREATE INDEX wallet_entries_page_idx ON wallet_entries(account_id,created_at DESC,id DESC);
CREATE TABLE financial_requests (
  user_id text NOT NULL REFERENCES wallet_accounts(user_id),
  operation text NOT NULL CHECK (length(operation) BETWEEN 1 AND 64),
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,operation,idempotency_key)
);
CREATE TABLE outbox_events (
  id uuid PRIMARY KEY,
  type text NOT NULL,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','PROCESSING','DELIVERED','DEAD')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX outbox_pending_idx ON outbox_events(available_at,id) WHERE state IN ('PENDING','PROCESSING');
INSERT INTO wallet_accounts(user_id) SELECT user_id FROM wallets;
-- Generate UUIDs in PostgreSQL; do not reinterpret transaction history as new credit.
WITH opening AS (
  INSERT INTO reward_audit_events(user_id,event_type,amount_kobo,reason,triggering_rule)
  SELECT user_id,'LEDGER_OPENING',balance_ngn*100,'Legacy wallet opening balance','ledger-opening-v1'
  FROM wallets WHERE balance_ngn > 0 RETURNING id,user_id,amount_kobo
)
INSERT INTO wallet_entries(id,account_id,amount_kobo,kind,reference_type,reference_id,rule_version,audit_id)
SELECT gen_random_uuid(),user_id,amount_kobo,'OPENING_BALANCE','LEGACY_WALLET',user_id,'ledger-opening-v1',id FROM opening;
CREATE FUNCTION reject_financial_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Immutable financial history; use compensating entries'; END $$;
CREATE TRIGGER wallet_entries_immutable BEFORE UPDATE OR DELETE ON wallet_entries FOR EACH ROW EXECUTE FUNCTION reject_financial_mutation();
CREATE TRIGGER reward_audit_immutable BEFORE UPDATE OR DELETE ON reward_audit_events FOR EACH ROW EXECUTE FUNCTION reject_financial_mutation();
CREATE TRIGGER financial_requests_immutable BEFORE UPDATE OR DELETE ON financial_requests FOR EACH ROW EXECUTE FUNCTION reject_financial_mutation();
CREATE TRIGGER legacy_wallets_frozen BEFORE INSERT OR UPDATE OR DELETE ON wallets FOR EACH ROW EXECUTE FUNCTION reject_financial_mutation();
CREATE TRIGGER legacy_wallet_transactions_frozen BEFORE INSERT OR UPDATE OR DELETE ON wallet_transactions FOR EACH ROW EXECUTE FUNCTION reject_financial_mutation();
COMMIT;
