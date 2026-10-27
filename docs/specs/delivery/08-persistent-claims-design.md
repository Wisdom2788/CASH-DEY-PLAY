# Stage 08A: persistent cycles and transactional claims

27 October 2026. Implements the approved calendar policy in a new versioned namespace. This slice excludes referral awards, real ad receipt ingestion/consumption and frontend replacement; those stay unchecked. Public routes require an explicit `ENABLE_STREAK_REWARDS=true` activation after coordinated migration and frontend acceptance; default off. No production activation is implied by merging code.

## Algorithm and locks

Every operation starts a bounded SQL transaction and locks the canonical users row first. Record-login then locks the open cycle and samples SQL clock after locks, deriving the Lagos date in PostgreSQL. First use creates a fresh versioned cycle and immutable actual-login date. Same-day retries do not advance. Consecutive dates advance to the calendar day; early misses, two misses, or a further miss after recovery reset into a fresh cycle. A single miss after completed Day 10 returns RECOVERY_REQUIRED without advancing completed progress. The actual return date is retained, but is not proof of a recovered date. Authentication is independent of recovery.

No production recovery writer is included: without authenticated, purpose-bound, single-use provider evidence there is no grace transition. This is an unavailable integration, not automatic forgiveness. The next slice must persist recovered-date evidence separately from actual logins and recheck the recovery deadline under the same user lock.

Cycle identity/start/rule and closed-cycle history cannot be mutated. A new cycle starts at the first observed login after a reset or elapsed end, rather than manufacturing missed cycles. Existing credits survive resets. Already unlocked milestones in an old reset cycle remain claimable until that cycle's fixed original end; reset does not extend eligibility or unlock later milestones. Claims require the cycle ID, preventing a delayed request from accidentally targeting a new cycle.

Claim validates actor, UUID/milestone and Idempotency-Key; locks user, cycle, wallet account and entitlement records in that order, then samples SQL clock. Check saved request response before new eligibility: retries after expiry return the committed receipt. Changed key payload conflicts. A different key for the same cycle/milestone returns the original receipt, with its original tier/amount. A tier change never creates another reward slot.

For a new claim: fixed end must not have passed; persisted completed day must meet milestone; recheck current paid entitlement; regular Day 30 requires 25 immutable normal-practice completions within the original cycle and no later than claim time. Credit uses the shared ledger transaction primitive, including financial request, audit and WALLET_ENTRY_POSTED outbox. Regular Day 20 inserts/retains that date's ad-free grant (never shortens an existing grant), creates audit/outbox and receipt in the same transaction. No external call inside locks. Any failure rolls back every write.

| Milestone | Regular | Premium |
|---|---|---|
| Day 10 | 5,000 kobo | 5,000 kobo |
| Day 20 | No-video-ad grant until next Lagos midnight | 10,000 kobo |
| Day 30 | 10,000 kobo; 25 cycle practice finishes | 20,000 kobo |

Eligibility expires at the original cycle end. Day 30 is claimable only during Day 30. A new request queued before expiry but evaluated after locks at/after expiry fails. A committed request retry remains successful. Ad-free never changes premium tier or practice quota.

## Legacy and compatibility

Migration snapshots legacy counters/claim flags without deleting or re-crediting historical records. New versioned eligibility begins with new server-observed logins; no old automatic-grace counter is monetary proof. Production cutover needs user communication and review of legacy reconciliation before activation. Old routes stay isolated while the new feature is off; when enabled, old automatic-grace record/claim routes return 410 to prevent parallel eligibility flows. Frontend replacement is a separate unchecked gate.

## HTTP contracts

`GET /api/streak/progress`: read-only persisted cycle/milestone eligibility. Does not invent logins. `POST /api/streak/login` with empty body: record server date; natural same-day deduplication. `POST /api/streak/cycles/:cycleId/milestones/:day/claim` with empty body and Idempotency-Key: immutable award receipt. No body/query user, tier, date, amount or ad-success flag. All use registered/revocable authentication and no-store responses. Recovery remains unavailable until its provider-backed consumer exists.

## Acceptance required for this slice

Disposable PostgreSQL: all migrations twice; snapshot preservation; concurrent first login/same-day recording; early reset; Day 10 recovery pending without progress; elapsed window; both tier tables; current tier expiry; Day 30 24/25 practice gate; same/different-key races; payload conflict; cross-user cycle denial; exact Lagos expiry and replay; ledger balance/reconciliation; ad-free expiry/tier isolation; injected failures at claim/audit/ledger/request/outbox writes; immutable history. HTTP tests cover authentication, strict payloads, actor binding and disabled/retired routes. Record actual results separately; this list is not a pass certificate.

## Accepted backend scope

Runtime `9e987124ab70aa39fdfc99674dc8667b68018aac` passed [Verify40561089985](https://github.com/Wisdom2788/CASH-DEY-PLAY/actions/runs/40561089985): 407 backend/37 frontend tests, 11 migrations twice, zero ledger mismatch counts, required dependency audits/typechecks/lint/build and existing ranked SQL/Redis/browser regressions. Streak SQL/HTTP acceptance covers the scenarios above, including real normal-practice sources and concurrent standalone ledger composition. API expiry timestamps are precise UTC ISO strings. Mutations select the shared limiter once, including case variants matching Express routing, and cannot fall back to a read-only local limiter.

This is backend-slice acceptance only. Frontend streak journey, verified-ad recovery, referral awards, production continuity/restore/rollout and provider/device checks remain gates. No live feature was enabled.
