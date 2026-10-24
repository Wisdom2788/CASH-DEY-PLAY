# Telegram Stars purchases and premium lifecycle

Status: **Specified; not implemented**. Covers: C4/C5, H7/H9, payment support and refunds. Dependencies and sequence: [delivery index](README.md). Product decisions: [rulebook](RULEBOOK.md).

### API and data

POST /premium/orders {planId} with Idempotency-Key creates immutable order: player, plan_version,30/90duration_days, integer Stars price, XTR, CREATED state, expiry and payload nonce. Server calls createInvoiceLink with one price item and an opaque order payload. The frontend opens invoice and treats its paid callback as display-only; poll GET /premium/status for confirmed entitlement. Never calculate authoritative price/expiry on client.

Bot webhook verifies Telegram secret header before processing, bounded body and update_id dedupe. pre_checkout_query checks order, player, currency, exact amount, eligible state/expiry and answers within provider deadline. successful_payment validates all fields again, performs eligible unpaid -> PAID conditional transition with UNIQUE charge_id; only winner inserts purchased entitlement/expiry extension, audit and outbox in the same transaction. Reject unexpected payment for expired/refunded order into explicit reconciliation state; do not use status != PAID as a universal grant guard.

### Refunds and support

Implement refundStarPayment and refund-event reconciliation, unique refund reference and idempotent entitlement adjustment. Multiple paid purchases need per-order entitlement accounting so refunding one order cannot erase unrelated paid time. Agree product refund semantics before release. Reply to /paysupport, provide accessible terms/support, obtain terms acceptance before purchase. Price review updates only new orders; lock historical invoice price. No direct naira/crypto premium checkout inside Telegram digital purchase flow.

### Acceptance

Real Telegram test-environment payment and refund, wrong webhook secret, wrong user/currency/amount, duplicate updates/charge, concurrent30/90 purchases, renew active/expired, timeout after invoice creation, out-of-order refund/paid event, crash before/after transaction, cancelled/failed invoices and polling recovery. Production uses separate bot/webhook from staging; no credentials in frontend/logs. Existing free premium authority must already be revoked. Disable sales on mismatch; never grant via invoice callback or manual test endpoint.

## Implementation record

Record commit, schema version, commands/results, integration evidence, unresolved decisions and recovery rehearsal here before marking complete. An acceptance criterion written above is not evidence that it passed.
