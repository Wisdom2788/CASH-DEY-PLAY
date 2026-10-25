# Validated delivery checklist

Reviewed25 October2026 against runtime852b8cee8083342078ee91163a10a1d7c0b43b7a, the delivery specs and their test sources. A checked item means only the named scope has evidence. An unchecked parent stage may contain verified core work. No overall security/launch certification is implied.

## Workflow

- [x] Reusable feature-implementation and hot-fixes branches established.
- [x] Foundations, ledger and entitlement core integrated into development; main unchanged by those integrations.
- [ ] Separate hosted staging frontend/backend/database/Redis/test bot established.
- [ ] Production backup restored and migrations rehearsed against an isolated copy.

## Build order

- [x] 01: Unsafe paths contained; auth/streak atomicity/build baseline tested. This closes containment scope, not the disabled features themselves.
- [ ] 02: Foundations fully accepted and rolled out.
- [x] 02 core: canonical registered-user identity, token revocation, Lagos helpers/queries, SQL migrations, memory sessions and core contracts implemented/tested.
- [ ] 02 remaining: hosted backup/restore and baselining rehearsal, verified ingress/proxy configuration, real Telegram session flows, and broader legacy API/model cleanup with owning stages.
- [ ] 03: Ledger stage fully accepted and operational.
- [x] 03 core: bounded integer kobo, locked balances, request/source replay protection, linked audit/outbox transaction, opening import/old-writer freeze, paged reads and reconciliation checks implemented/tested.
- [ ] 03 remaining: real reward/payout source wiring, automatic external outbox consumers, scheduled operator alerts, pending-funds contract and hosted recovery/reconciliation evidence.
- [ ] 04: Entitlements/tasks/referrals fully accepted and operational.
- [x] 04 core: paid entitlement authority, exact expiry, exempt video Claim, atomic points/bonus, complete task-day counts, random referral codes, signed first-login resolution and configured share-link API implemented/tested.
- [ ] 04 remaining: real verified-ad/ranked/Stars source writers, admission limits/qualification policy integration, scheduled attribution retry, configured staging bot and two-device invite tests. Referral qualification/150-point awards belong to08.
- [ ] 05: Authoritative Whot engine and clearly labelled practice bot. Exact variant decisions are a prerequisite.
- [ ] 06: Verified ad integration, purpose-bound credits and practice admission/completion limits.
- [ ] 07: Durable realtime sessions, Redis flow, ranked matchmaking, reconnect/recovery and result settlement.
- [ ] 08: Real streak milestone credits/ad-free rewards and referral qualification/points.
- [ ] 09: Telegram Stars order/payment/refund lifecycle verified with staging bot.
- [ ] 10: Airtime delivery, ambiguous-result reconciliation, refunds, caps and float operations.
- [ ] 11: Eligible leaderboard snapshots, reviewed prize settlement and operational controls.
- [ ] 12: Remaining frontend completion, real-device journeys, accessibility/performance/load/security/recovery acceptance and release.

## Requirement validation

| Spec scope | Source/test evidence | Verdict and limits |
|---|---|---|
|01 containment|Auth/Telegram negative tests, retired endpoints, unsupported mutations and PostgreSQL streak transaction races/rollback|Pass for containment scope. A501 is a safe unavailable feature, not a working provider integration.|
|02 core|foundations.integration.test.ts; auth/rate-limit/time tests; frontend session contracts/store tests|Pass for tested core. Mixed identities preserve claims, conflicts abort, missing winners fail, first creation is atomic, migrations replay and tokens revoke. Full model/API cleanup and live rollout remain incomplete.|
|03 core|ledger.integration.test.ts; amount tests; wallet read-contract tests|Pass for tested core. Ten debits cannot overspend; changed request/source payloads conflict; failure at each insertion rolls back; source callback shares transaction; outbox lease recovery fences stale workers; immutable history and microsecond cursors are checked. No actual provider dispatch/delivery is demonstrated.|
|04 core|entitlements.integration.test.ts; task-claims HTTP tests; frontend task/session contracts|Pass for tested core. Legacy flags cannot authorize premium; expiry/refund is rechecked; duplicate/parallel claims and bonus serialize; history is not rewarded again; first-login/code-collision/retry behavior is covered. No payment-funded premium, actual ad/ranked event, automatic recovery job or two-device invite proof exists.|

CI evidence for the exact runtime: https://github.com/Wisdom2788/CASH-DEY-PLAY/actions/runs/40185969585 . All171 backend tests passed, including42 real PostgreSQL18 cases, with no skipped database tests in that run. All28 frontend tests passed. Typechecks, frontend lint, builds, repeated migration deploy (no pending migrations), zero-mismatch ledger reconciliation and both Vercel preview contexts passed. This review rechecked the existing exact-commit evidence; it did not represent those CI databases as the production database or a deployed staging environment.

Some older spec headers/evidence named stage branches or draft PRs. The runtime above is the integrated source of truth: PR5 is merged, PRs3/4 were superseded, and main remains cb5ca23. The ledger request model currently persists completed transaction responses; pending economic operations/funds are deferred to payout ownership. Broad spec phrases such as every API/socket schema and every sensitive gameplay allowance are not asserted complete while their owning modules remain unfinished.

## Staging meaning and blocker

Staging means a separately deployed app running development. It needs its own database so migrations, tests and test rewards cannot affect production records. It also needs separate Redis credentials, a test Telegram bot and provider sandbox configuration as those integrations arrive. Vercel frontend previews alone do not provide that full environment.

The confirmed Render workspace currently has the production backend tracking main and one free production PostgreSQL database. Attempting to create cash-dey-play-staging-db on free returned: cannot have more than one active free tier database. This is an account/plan limitation, not a schema or application error. No existing database was rejected or changed, and no paid resource was purchased. Options are an approved paid Render database, an approved separate provider, or local isolated testing while hosted staging remains pending. Never use the production database as a substitute staging database.

## Next action

Proceed to05 design and test planning while staging provisioning is resolved independently. Before production engine acceptance, record exact deck multiplicities, initial hand, special-card effects/openings/finishing, penalty stacking, draw/pass behavior, reshuffle/exhaustion, last-card declaration and timeout policy in RULEBOOK.md. Existing draft suggestions are not silently treated as those product decisions. Keep05 unchecked until the agreed rules and its engine tests exist. Hosted release of02–04 remains gated even if05 implementation proceeds.
