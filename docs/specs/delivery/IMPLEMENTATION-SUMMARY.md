# Cumulative implementation summary

Updated26 October2026. Checked items certify only their named tested scope. Full-stage, provider, hosted and production acceptance are separate; no absolute security/launch certification is implied. Update this summary after every implementation.

## Build order and current status

- [x] 01 containment: production auth defaults, scoped JWT/Telegram validation, atomic streak claims, disabled client-authoritative rewards/wins/premium writes and build/deployment baseline fixes.
- [x] 02 core: canonical registered Telegram identities, collision/orphan migration checks, revocable sessions, Lagos calendar contracts, memory-only frontend sessions and versioned product/API rules.
- [ ] 02 rollout: validated backup/restore, migration baselining, ingress/proxy configuration and real Telegram/device sessions.
- [x] 03 ledger core: integer kobo, locked balances, actor/source idempotency, immutable ledger/audit, atomic source/outbox receipts, legacy opening import/old-writer freeze, paging, reconciliation and worker fencing.
- [ ] 03 operations: actual reward/payment/payout consumers, pending-funds contract, monitoring and hosted recovery.
- [x] 04 entitlements/tasks/referrals core: paid-order authority, expiry/revocation, explicit exempt-video claims, atomic task/bonus points, complete task-day counting, random referral codes, signed first-login attribution/retry and share-link APIs.
- [ ] 04 integrations: verified-ad/ranked-settlement/Stars source writers, scheduled attribution recovery and real-device invite verification.
- [x] 05 Whot engine: crypto shuffle, immutable authoritative legality/ownership/version/deadline transitions, own-hand bot/projections, private replay and transactional match/player/event/outbox storage.
- [x] 05 rule decision: owner-approved whot-v1 profile recorded25 October2026, including final-special-card wins,30-second forfeit timeout and500-action unawarded-draw bound.
- [x] 06 practice core: atomic/idempotent starts, five regular daily starts, paid premium/ad-free policy, shared practice/ranked admission locking, failure rollback and once-only authoritative normal completion.
- [x] 06 recovery: bounded operator command and opt-in repeated worker recovery for missed normal practice completions; no client completion/result writer.
- [ ] 06 full verified ads/practice: demonstrated provider authenticity/event/session/purpose contract, single-use credits and public practice frontend/API journey.
- [x] 07 durable game worker: server bot turns, persisted deadlines, post-lock database clock, stale-version checks, atomic replay/outbox and graceful shutdown.
- [x] 07 authenticated reads/reconnect: shared expiring JWT, durable newest-device generation, registration/revocation/expiry checks, compare-delete cleanup and participant-only SQL snapshots without timer resets.
- [x] 07 atomic moves: strict intentions, session locks retained through game commit, server time, actor/payload receipt replay, failure rollback and shared fail-closed mutation limits.
- [x] 07 committed delivery: game-only leased Redis relay, committed-source validation, redacted hints, authorized per-player snapshots, exact ACK cursors, duplicate/version suppression, bounded reads, slow-client isolation and SQL/reconnect catch-up.
- [x] 07 ranked admission/allowances: durable tickets/offers/reservations, two accepted humans create one match/charge transaction, three starts for both tiers, finish-based regular cooldown, Lagos start-day allocation, pair-count cap2, free prestart release and immutable started charges.
- [x] 07 Redis matchmaking: TTL presence, SQL epoch cache fencing, random owner token plus durable SQL generation, rotating/wrapping scan, advisory eligibility fallback, awaited final checks, SQL-first offer persistence and cache-loss/crash recovery.
- [ ] 07 acceptance implementation under review in PR15: automatic private offer/result/rematch snapshots, durable no-show warning/lockouts, consent-based rematches, authoritative result/task settlement and gated ranked frontend. Ninth migration, new adversarial/socket/load/browser tests and supervised worker deployment preparation; full validation pending.
- [ ] 07 external acceptance: physical Telegram devices, hosted worker deployment/restart/monitoring, target-scale load, verified-ad cooldown skip and audited technical incident compensation tooling.
- [ ] 08 rewards: actual streak milestone credits/ad-free grants and referral qualification/150-point awards.
- [ ] 09 Stars: verified orders, payment/refund events, entitlement lifecycle, support/terms and test-bot evidence.
- [ ] 10 airtime: provider delivery/requery, ambiguous-result reconciliation, once-only refunds, caps and float operations.
- [ ] 11 leaderboard/prizes: eligibility snapshots, finance/rounding policy, reviewed settlement and operator controls.
- [ ] 12 release: remaining frontend journeys/accessibility, real devices, load/security/recovery acceptance and reviewed promotion.
- [ ] Hosted staging/workers: not provisioned or enabled by these code integrations.
- [ ] Production promotion: main remains separate; backup/restore, migration rollout and integration release gates remain open.

## Latest implementation and validation

Ranked admission was implemented before Redis coordination. Owner selected on25 October2026: two starts per opponent per Lagos day, and a regular player's one-hour cooldown begins at the second chargeable finish and resets at Lagos midnight. Premium retains the same three-start limit. No rematch-request rate, no-show penalty or post-start technical refund policy was silently approved.

Runtime6fb09d4cbdc1f261e33efafadc6c41d67d188e40 passed **323 backend tests across38 suites** in [Verify run40232140327](https://github.com/Wisdom2788/CASH-DEY-PLAY/actions/runs/40232140327), using PostgreSQL18 and real Redis. Tests cover quota/pair/cooldown/midnight boundaries, session adoption, practice races, duplicate accepts, cancellation races, immutable charges, start rollback, cache epochs, stale-owner fencing, blocked/wrapping scans, ten competing workers, SQL/Redis crash gaps and two actual socket clients queueing/accepting/playing/resuming one game.

All eight migrations deployed twice; frontend checks/build, production dependency audit and both Vercel previews passed. Reconciliation had zero mismatches and the backend production dependency audit reported zero known advisories. Documentation-only follow-ups record this evidence; it is not a hosted deployment or complete production security certification.

ENABLE_RANKED defaults off and requires read/move gateways, Redis and an explicit environment namespace. Public realtime stays false. No new hosted service, paid resource, production environment change or main promotion was performed. Details/runbook: [07-ranked-admission-design.md](07-ranked-admission-design.md). Earlier slice evidence remains in its owning delivery specs and merged PRs5–13.

## Current full-ranked implementation (PR15, validation in progress)

Added SQL result receipts with server terminal-event checks, once-only ranked-win/all-complete task awards assigned to finish-day Lagos calendar, bounded recovery in the game worker, ready-check miss receipts and warning/2/5/15-minute lockouts, three rolling-hour rematch requests with15-second consent and shared atomic admission. Automatic session:update snapshots use fresh per-connection SQL authorization, bounded reads, exact ACK/retry and periodic catch-up without refreshing player presence. Ranked frontend uses strict private projections, server deadlines, intentions, resumption and gated Telegram lifecycle controls. One manual paid-worker manifest and combined supervisor are prepared; not deployed.

The first new CI run passed the ranked suite and all nine migrations twice; five older-fixture expectations failed (migration count and game-worker fixtures missing ranked migrations). Fixtures have been updated. Do not replace prior accepted323-test evidence or check new acceptance boxes until the final runtime passes. Browser tests use isolated local protocol fixtures, separate from real PostgreSQL/Redis socket tests; physical devices and hosted capacity remain open. See07-full-ranked-design.md and07-ranked-hosting-runbook.md.
