# Ledger implementation design

Approved flow refinement, 25 October 2026. Stage03 precedes entitlement and gameplay writes.

## Transaction algorithm

Use bounded integer kobo (maximum 2,000,000,000 per entry and available balance, fitting the existing audit amount column). Derive balance from immutable entries; no mutable cached balance. Create the account with INSERT ON CONFLICT, then lock its row. Every posting uses that lock, including an accountless first write. Check request identity first; compare a canonical hash of explicitly selected, validated economic fields. A duplicate key with a changed payload conflicts. Next check the immutable business reference so a new request key cannot duplicate a reward. Conflicting reuse of that source also fails. Only then check the derived balance and insert entry, audit, completed request response and redacted outbox intent in one transaction. No provider work runs inside it.

Responses use decimal strings for kobo, including historical response balance at posting time. A replay returns that exact persisted response, rather than the current balance. Debit failures roll back the request and can be retried; insufficient balance is not a persisted success. API authentication and the owning source's eligibility are separate requirements; this internal repository is not an HTTP credit endpoint.

## Migration and activation

Lock legacy wallets and transactions during import. Reject negative/over-limit opening balances. Insert one OPENING_BALANCE entry per positive existing wallet, never sum old history into balance again. Import zero accounts too. Freeze legacy wallet/transaction INSERT/UPDATE/DELETE with triggers in this same migration; old read routes remain compatible by avoiding account creation on GET. Remove unused legacy mutation methods so new code cannot accidentally call them. The new ledger stays internal until owning reward routes have durable eligibility and source transitions in the same transaction. No production feature flag is enabled by this change.

Entries and audit events reject UPDATE/DELETE. A foreign-key link binds each ledger entry to its audit record. Wallet notification payload contains only entry identity and canonical player ID. The transactional outbox is durable intent; external dispatch/retry/reconciliation is not claimed implemented until a worker and crash tests exist. Ledger read pagination uses (created_at,id) descending and bounds limit to100. A missing account reads zero, but any posting requires an existing registered user via FK.

## Verification

Exercise real PostgreSQL with isolated schemas: ten-way debit cannot overspend; first-write race; identical/different request and source replay; audit/outbox failure rolls back all writes; immutable-entry constraints; opening import and legacy freeze; stable page boundary; checked amount conversions. Run all prior backend checks and migration-history replay with the additional migration. Production rollout still requires the foundations backup/rehearsal gates.
