# Validated delivery checklist

Reviewed25 October2026 against stage05 runtime c37671022378bd4c78413a2d78e3979bcb1ce81a, the delivery specs and their test sources. A checked item means only the named scope has evidence. An unchecked parent stage may contain verified core work. No overall security/launch certification is implied.

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
- [ ] 05: Full authoritative Whot and practice flow acceptance. Whot rules approved 25 October 2026; practice admission/limits remain a stage06 gate.
- [x] 05 core: configurable authoritative engine, crypto shuffle, projected-view bot, private replay and transactional PostgreSQL persistence implemented. Verify run40199691573 passed197/197 backend tests on PostgreSQL18, including two migration deploys; frontend typecheck/lint/tests/build also passed. No rule profile or public game endpoint is enabled.
- [ ] 06 full: Verified ad integration, purpose-bound credits and public practice flow.
- [x] 06 core: atomic/idempotent practice starts, five regular daily starts, paid premium/ad-free policy, shared ranked/practice admission locks and authoritative once-only normal completion records. PostgreSQL18 CI run40204197673 passed213 backend tests; provider verification/credits, public API/UI, processing jobs and downstream qualification remain open.
- [ ] 07: Durable realtime sessions, Redis flow, ranked matchmaking, reconnect/recovery and result settlement.
- [x] 07 internal worker implemented: database-clock bot turns/deadlines, row/version rechecks and practice completion recovery; opt-in process with graceful shutdown.
- [x] 07 internal worker CI acceptance: PostgreSQL18 run40216621540 passed concurrency, stale discovery, clock-after-lock, rollback, replay, lifecycle and shutdown checks on runtime9c5a9ba05e009798fcc22d8360c124ea4d912171. Hosted worker and full realtime/ranked acceptance remain open.
- [x] 07 authenticated read/reconnect core implemented: durable session generation, shared expiring JWT, current-session and participant-only SQL snapshots; gateway opt-in/public capability off.
- [x] 07 read/reconnect CI acceptance: PostgreSQL18 run40218117090 passed real Socket.IO/two-gateway, ownership/privacy/revocation/reconnect/rollback and seven-migration replay checks on runtimef37120ca88e0a24b3bc37ab803fc78bc05ca860f. Public gameplay remains gated.
- [x] 07 atomic moves implemented: strict intentions, SQL session guard held through game commit, post-lock database time and actor-bound replay; move flag off by default.
- [ ] 07 move CI acceptance: concurrency/replacement/expiry/rollback/private replay, two-gateway moves and fail-closed limit checks pending.
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
|05 core|game-engine/engine.test.ts; game-engine/repository.integration.test.ts; migration deploy and PostgreSQL18 CI|Pass for configurable engine mechanics and persistence. Tests cover invalid state/actions, conservation, privacy, replay, timeout/action races, bot-view decisions, reshuffle/exhaustion and atomic event/snapshot/outbox behavior. Owner rule decisions approved 25 October 2026; there is no public practice admission, websocket/Redis path or result settlement.|

CI evidence for stages01–04: https://github.com/Wisdom2788/CASH-DEY-PLAY/actions/runs/40185969585 . All171 backend tests passed, including42 real PostgreSQL18 cases, with no skipped database tests in that run. All28 frontend tests passed. Stage05 CI evidence: https://github.com/Wisdom2788/CASH-DEY-PLAY/actions/runs/40199691573 . All197 backend tests passed across25 suites, the five migrations deployed twice on PostgreSQL18, and frontend typecheck/lint/tests/build passed. These CI databases are not the production database or a deployed staging environment.

Some older spec headers/evidence named stage branches or draft PRs. The runtime above is the integrated source of truth: PR5 is merged, PRs3/4 were superseded, and main remains cb5ca23. The ledger request model currently persists completed transaction responses; pending economic operations/funds are deferred to payout ownership. Broad spec phrases such as every API/socket schema and every sensitive gameplay allowance are not asserted complete while their owning modules remain unfinished.

## Staging meaning and blocker

Staging means a separately deployed app running development. It needs its own database so migrations, tests and test rewards cannot affect production records. It also needs separate Redis credentials, a test Telegram bot and provider sandbox configuration as those integrations arrive. Vercel frontend previews alone do not provide that full environment.

An instance quota rejection means another managed instance could not be created under that plan. It does not establish that a paid instance is mandatory. Render documents additional logical databases within an existing PostgreSQL instance: https://render.com/docs/postgresql-creating-connecting#adding-multiple-databases-to-a-single-instance . A logical staging database requires a separate owner and restricted runtime credentials, with grants checked to prevent access to production application data. Resources and failures remain shared, so this offers less isolation than a separate instance. Separate instance/provider or local testing remain alternatives.

Provisioning and backup/restore require a secure write-capable operator connection. The available SQL inspection connector is read-only. No infrastructure was created during this validation. Private operational inspection details are intentionally excluded from this public checklist.

## Next action

Owner sign-off for whot-v1 is recorded in05-rule-decisions.md and RULEBOOK.md. Next implement verified practice admission/limits in06, followed by07 realtime/Redis delivery and result settlement. No rule suggestion has become a product decision. Hosted release of02–04 remains gated by backup/restore and provider integration evidence.

Cumulative implementation details: [IMPLEMENTATION-SUMMARY.md](IMPLEMENTATION-SUMMARY.md).

Latest stage06 core evidence: runtime35bf29b7940b575630b9fb0c94c8e3393ea96df9, https://github.com/Wisdom2788/CASH-DEY-PLAY/actions/runs/40204197673 . Six migrations deployed twice,213 backend tests and all frontend checks passed; ledger reconciliation reported zero mismatches.
