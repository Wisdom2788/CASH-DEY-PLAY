# Airtime redemption, provider worker and reconciliation

Status: **Specified; not implemented**. Covers: C5, M1/M2/M6/M9/M10 and actual wallet functionality. Dependencies and sequence: [delivery index](README.md). Product decisions: [rulebook](RULEBOOK.md).

### Request transaction

POST /wallet/redemptions {amountNgn,network,phoneNumber} with Idempotency-Key; strict whole-naira minimum50/max100000 and Nigeria mobile normalization; network enum from actual provider catalogue, no prefix-only carrier inference. Lock wallet/account and relevant phone/account/day cap rows, compute available funds and current reservations with explicit Lagos boundaries, reject insufficient/cap excess, insert ledger debit + payout + audit + idempotent pending response + outbox in ONE transaction. A repeated key with changed body returns409. Respond PENDING, never sent/delivered until provider confirms.

### Delivery

payouts records stable provider_request_id, provider transaction ID, request hash, status, attempt history, reconciliation fields and redacted public description. Worker runs via BullMQ backed by appropriately durable Redis; outbox makes enqueue recoverable. Adapter methods purchase/requery/balance with bounded timeouts. States REQUESTED/WAITING_FOR_FUNDING/SUBMITTED/UNKNOWN/DELIVERED/FAILED; UNKNOWN never blindly sends a fresh purchase. Provider request ID is generated once at first valid submission using required Lagos prefix and retained on retries/requery. If provider disallows cross-day resubmission, requery/escalate instead of inventing a new billable request.

Failure with definitive non-delivery produces exactly one compensating refund ledger entry. Pending/unknown holds funds until outcome known. Manual low-float funding holds payouts; alert named operator without exposing phone/token. Daily provider statement reconciliation detects missing/double/mismatched payouts. Internal ops permissions are separate from player auth and audited.

### UI and acceptance

Summary separates available/pending; paged entries show neutral signed amount and SUCCESS/PENDING/FAILED text+icon+colour, masked number, reason and refund reference. No unsupported “instant” or KYC guarantee. Test amount/types, number/network, parallel last-balance/cap reservation, duplicate payload, provider timeout, crash around send and DB update, duplicate webhook, float exhaustion, failure/refund retry, daily reconciliation and operator repair. Complete real sandbox topup and a controlled funded delivery before enabling production redemption. No provider account/float means feature remains unavailable, not mocked.

## Implementation record

Record commit, schema version, commands/results, integration evidence, unresolved decisions and recovery rehearsal here before marking complete. An acceptance criterion written above is not evidence that it passed.
