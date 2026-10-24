# Ledger, audit and idempotency foundations

Status: **Specified; not implemented**. Covers: C2/C5/C6, M3/M6 and all reward/payout writes. Dependencies and sequence: [delivery index](README.md). Product decisions: [rulebook](RULEBOOK.md).

### Model

Choose integer kobo as the single database accounting unit; public whole-naira amounts convert with checked integer arithmetic. Values must be safe integers, positive for requested amounts, divisible by100 when whole-naira only, bounded by configured caps; overflow/NaN/fraction/string coercion is rejected. Keep signed append-only entries, not an inaccurate “double-entry” label unless balanced debit/credit accounts are actually implemented.

Tables: wallet_accounts(user_id PK FK), wallet_entries(id UUID,account_id FK,amount_kobo BIGINT,kind,reference_type,reference_id,created_at), unique business reference per credit/debit; financial_requests(user_id,operation,key,request_hash,status,response,UNIQUE(user_id,operation,key)); reward_audit_events with canonical amount_kobo and versioned rule; outbox_events(id,type,payload,state,attempts). Amount bounds and reference constraints enforced in DB. Redaction excludes phone/token from generic payload/logs.

### Transaction protocol

Acquire stable account row FOR UPDATE before balance/cap check; same lock used by every credit/debit path. Idempotency binds the canonical payload hash: identical key+payload replays persisted response, same key+different payload returns409. Claim/prize/payment transition, ledger entry, audit, idempotent response and durable outbox intent commit together. Rollback all on any failure. No external provider call inside a DB transaction. Outbox dispatch uses stable event IDs and can repeat safely. Balance derives from ledger; any cached balance is reconciled against it.

### Migration and contracts

Import old wallet balances as explicitly labelled opening entries without double-crediting old transaction history. Reconcile total opening liabilities before enabling writes; freeze old wallet mutations first. API returns availableKobo/pendingKobo as bounded serialized numbers or decimal strings according to contract. GET /wallet/entries?cursor&limit has a stable (created_at,id) cursor and capped limit. Full phone values are restricted to payout processing.

### Tests/finish line

Real PostgreSQL ten-way debit with insufficient total balance never overspends; duplicate reference and same/different idempotency payload; rollback after each insert; two credits different sources; import rerun; outbox crash before/after dispatch; accountless first write; currency conversion and max limits; reconciliation mismatch alarms. A reward can be credited and queried exactly once before any payout feature is enabled. Corrections are compensating entries, never edits.

## Implementation record

Record commit, schema version, commands/results, integration evidence, unresolved decisions and recovery rehearsal here before marking complete. An acceptance criterion written above is not evidence that it passed.
