# Cumulative implementation summary

## Business policy revision — 26 October 2026

- [x] Implement one same-opponent ranked start per Lagos day, rechecked under player locks at offer reservation and final start; premium has no bypass.
- [x] Disable ranked invitations and acceptance at the repository boundary; return REMATCH_DISABLED to old clients, hide pending invitations and remove frontend controls. Historical records remain intact; no destructive migration.
- [ ] Complete CI acceptance for the revised policy (including real SQL/Redis/browser repeat-pair rejection); previous PR15 evidence does not certify this revision.
- [ ] Replace fixed daily tasks with versioned rotating daily schedules, trusted-event progress, controlled rewards and schedule-based completion/qualification.
- [ ] Hosted worker, real-device, provider and release gates below remain open. No paid resources or production changes in this revision.

The previous ranked runtime/evidence below is historical. See 07-ranked-policy-revision.md for the current flow and acceptance scope.

Updated 26 October 2026. Checked items certify their named tested scope. Provider, physical-device, hosted and production acceptance remain separate. No absolute security certification is implied.

## Build order and status

- [x] **01 containment:** production auth defaults, scoped JWT/Telegram validation, atomic streak claims, retired client-authoritative reward/win/premium writes and deployment/build baseline fixes.
- [x] **02 foundation core:** canonical Telegram identity, collision/orphan migration checks, revocable sessions, Lagos calendar contracts, memory-only frontend sessions and versioned product/API rules.
- [ ] **02 rollout:** verified backup/restore, production migration baselining and ingress/proxy/device acceptance.
- [x] **03 ledger core:** integer kobo, locked balances, actor/source idempotency, immutable ledger/audit, atomic source/outbox receipts, opening import/old-writer freeze, reconciliation and worker fencing.
- [ ] **03 operations:** payment/payout consumers, pending-funds contract, hosted monitoring and recovery.
- [x] **04 entitlements/tasks/referrals core:** paid-order authority/expiry, explicit exempt-video claims, atomic task/bonus points, complete task-day counting, random referral codes, signed first-login attribution/retry and share-link APIs.
- [ ] **04 remaining integrations:** verified ads, Stars-funded entitlement writers, scheduled referral recovery and real-device invite verification. Ranked-win task source is now implemented below.
- [x] **05 Whot:** owner-approved whot-v1, crypto shuffle, authoritative legality/ownership/version/deadlines, private projections/replay, conservation tests and transactional match/player/event/outbox storage.
- [x] **06 practice core:** idempotent admission, five regular starts, paid premium/ad-free policy, shared ranked/practice locking, rollback and once-only normal completion.
- [x] **06 recovery:** bounded/repeated worker recovery for missed normal completions; no client result writer.
- [ ] **06 full ads/practice:** real provider authenticity/session/purpose proof, single-use ad credits and public verified-practice journey.
- [x] **07 game worker:** durable bot turns and deadlines, post-lock clock/version checks, atomic replay/outbox and graceful shutdown.
- [x] **07 sessions/moves:** expiring/revocable JWTs, durable newest-device generations, participant-only reads, atomic intentions/receipts and fail-closed shared mutation limits.
- [x] **07 game delivery:** committed-source leased relay, redacted Redis hints, fresh authorized SQL snapshots, exact ACK/version recovery, bounded reads and slow-client isolation.
- [x] **07 ranked admission/Redis queue:** SQL tickets/offers/reservations, exactly two accepted humans, three starts for both tiers, finish-based regular cooldown, Lagos start-day allocation, pair cap2, immutable started charges, epoch/fenced Redis coordination and crash/cache-loss recovery.
- [x] **07 automatic ranked snapshots:** private offer/result/rematch updates, per-connection exact ACK/retry, bounded reads, SQL catch-up and token recheck before disclosure. Server polling never refreshes player queue presence.
- [x] **07 approved policies/rematches:** warning then2/5/15-minute no-show lockouts,24-hour quiet reset, three requests per rolling hour,15-second consent, repeated eligibility/online/pair/quota checks and no second ready check. Disconnects retain the approved turn clock; no automatic VOID/refund.
- [x] **07 result/task/stat core:** immutable per-match/player WIN/LOSS/DRAW receipts verified against terminal events; forfeit/timeout handling; no win for unawarded draws; once-only finish-day ranked-win/all-complete task points; atomic rollback/recovery; receipt-derived monthly ranked progress. This does not complete monthly prize ranking or payment settlement.
- [x] **07 gated frontend/automated acceptance:** queue/ready/game/wild suit/forfeit/result/rematch, strict own-hand/action-reply contracts, committed game-update ACKs, transport/explicit reconnect, old-reply connection fencing, foreground recovery and Telegram method/version guards, server-clock display and task-cache invalidation; Chromium/WebKit mobile-emulation flows and a100-socket regression load test.
- [x] **07 worker preparation:** one combined supervisor, bounded independent loops, per-role SQL health, graceful shutdown, schema-validated manual Render worker manifest and deployment runbook. Preparation is not a hosted deployment.
- [ ] **07 full acceptance:** physical Telegram devices/accessibility, hosted deployment/restart/monitoring, target-scale load/SLO evidence, verified-ad cooldown skip, wait estimates/recent-opponent availability reasons, antifraud/operator review tooling and audited technical compensation tooling.
- [ ] **08 rewards:** streak milestone/ad-free grants and referral qualification/150-point awards.
- [ ] **09 Stars:** verified orders, payments/refunds, entitlement lifecycle, support/terms and test-bot evidence.
- [ ] **10 airtime:** provider dispatch/requery, ambiguous-result reconciliation, once-only refunds, caps and float operations.
- [ ] **11 leaderboard/prizes:** authoritative full leaderboards/snapshots, finance/rounding policy, reviewed awards and operator controls. The legacy leaderboard/profile statistics paths are not certified by the new ranked progress panel.
- [ ] **12 release:** remaining journeys, physical devices/accessibility, target-scale security/load/recovery and reviewed promotion.
- [ ] **Hosted staging/workers:** no new service provisioned; paid worker budget and safe environment rollout remain gates.
- [ ] **Production promotion:** main remains separate; backup/restore, migration rollout and integration release gates remain open.

## Latest verified implementation

PR15: automatic ranked flow, durable no-show/rematch policy, authoritative result/task settlement, monthly ranked progress, gated frontend and supervised worker preparation. Owner selected the no-show/rematch/disconnect policies on26 October2026; earlier two-per-opponent and finish-based cooldown decisions remain in force. Offers keep their own full10-second window even when the original120-second search expires; a failed offer cannot restart an expired search. Timeout settlement validates both seat projections; ordinary moves validate the actor projection. Technical compensation and ad skips have no unverified client writer.

Runtime **cc3cb8b2f3013f9d758c720c0bac68e62bf9c34a** passed [Verify 40292856760](https://github.com/Wisdom2788/CASH-DEY-PLAY/actions/runs/40292856760): **336 backend tests across39 suites**, **36 frontend tests**, all nine migrations deployed twice on PostgreSQL18, real Redis7, backend build/reconciliation/dependency audit, frontend typecheck/lint/build and both Chromium/WebKit mobile-emulation component flows. No database/Redis tests were skipped. A real two-browser test also passed against the authenticated gateway, PostgreSQL and Redis: move, network reconnect with unchanged deadline, WIN/LOSS settlement, one50-point task award, rematch, exactly four admission charges and two relayed committed events. The source runtime is separate from documentation-only follow-ups.

100 authenticated sockets received50 offers with zero duplicate assignments. Continuous500ms matchmaker runs have measured p95 between1.835 and3.090 seconds before the final run; final measurement: **p95=2806ms, max=2812ms (100 clients/50 offers; zero duplicate assignments)**. Timing varies across CI runners. The proposed two-second SLO and5000 sockets/1million attempts are **not certified**. CI load uses in-memory gateway rate counters and a12-connection SQL pool; production Redis rate-counter latency and hosted capacity are not measured. Browser fixtures are supplemented by the real gateway/PostgreSQL/Redis browser flow; physical Telegram devices remain unverified. Browser screenshots are retained as CI artifacts; production assets contain no fixture token.

Implementation retains default-off release gates. No main update, production database migration, paid service purchase or hosted worker enablement occurred. The prepared combined worker is a separate$7/month compute resource at current listed pricing, subject to budget approval and environment/restore gates; API/database/Redis costs are separate. Configure shared Redis noeviction before ranked mutation/rate-limit enablement.

Design and evidence: [07-full-ranked-design.md](07-full-ranked-design.md). Hosting/rollback checks: [07-ranked-hosting-runbook.md](07-ranked-hosting-runbook.md). Earlier core evidence remains in owning specs and merged PRs5–14.
