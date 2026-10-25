# Cumulative implementation summary

Updated 25 October 2026. Checkboxes describe the named implementation scope; full-stage and production gates remain explicit in DELIVERY-CHECKLIST.md. This summary must be updated after each implementation.

- [x] 01 containment: production authentication defaults, scoped JWT validation, Telegram signature/time checks, atomic streak claims, disabled client-authoritative rewards/wins/premium mutations, and build/deployment baseline fixes.
- [x] 02 core: canonical registered Telegram identities, migration collision checks, revocable sessions, Lagos calendar helpers/queries, memory-only frontend sessions and versioned product/API contracts.
- [ ] 02 full acceptance: production backup/restore, migration baseline rehearsal, real Telegram sessions and ingress configuration.
- [x] 03 core: bounded integer-kobo ledger, locked balances, request/source idempotency, immutable entries/audit, atomic source/outbox writes, legacy balance import/freeze, paged reads, reconciliation and worker lease fencing.
- [ ] 03 operational acceptance: provider/source consumers, pending payout funds, monitoring and hosted recovery.
- [x] 04 core: paid-order entitlement authority, expiry/revocation, explicit exempt-video claims, atomic task points/bonus, complete task-day counting, random referral codes, signed first-login attribution/retries and share-link APIs.
- [ ] 04 integrations: real ad/ranked/Stars writers, scheduled attribution retry and real-device invite verification.
- [x] 05 engine core: crypto shuffle, configurable immutable Whot transitions, legality/ownership/version/deadline validation, private views, projected-view bot, replay and transactional match/player/event/outbox storage.
- [x] 05 owner decision: Whot matrix approved 25 October 2026; immutable whot-v1 runtime profile records the approved variant.
- [x] 05 follow-through validation: approved profile and two-human ranked-storage correction passed PostgreSQL18 CI run40201787923; all199 backend tests and frontend checks passed.
- [ ] 06 full verified ads and practice admission: provider authenticity/session evidence, purpose-bound credits, five regular daily starts, premium bypass, safe fallback and completion accounting.
- [ ] 07 realtime/ranked: websocket authentication, Redis ownership/recovery, matchmaking, reconnect, timers and authoritative result settlement.
- [ ] 08 rewards: streak milestone/ad-free grants and referral qualification/points.
- [ ] 09 Stars: verified orders, payment/refund events and entitlement lifecycle with staging bot.
- [ ] 10 airtime: provider delivery, ambiguity/reconciliation, refunds, caps and float operations.
- [ ] 11 leaderboard/prizes: eligibility snapshots, finance policy, reviewed settlements and operator controls.
- [ ] 12 release: frontend journeys, accessibility, real devices, performance/load/security/recovery acceptance.
- [ ] Hosted staging: isolated database/Redis/test bot and provider sandboxes.
- [ ] Production promotion: reviewed development release after backup/restore and integration gates.

Most recent runtime CI:213 backend tests passed on PostgreSQL18, with frontend checks passing and zero ledger reconciliation mismatches (run40204197673). Passing automated tests is evidence for tested behavior, not completion of external integrations.

- [x] 06 admission core: atomic starts/completions, exact response replay, paid/ad-free policy, five regular daily starts, shared ranked/practice locking and failure rollback verified in PostgreSQL18 CI run40204197673 (213 backend tests passed). Provider adapter, credits, public API/UI and recovery scheduling remain open.

- [x] 06 recovery command implemented: bounded oldest-first discovery of unrecorded normal practice finishes, authoritative validation, per-game atomic completion/outbox recording and safe repeated/concurrent runs. Run `npm run db:practice:recover` against the intended migrated database. No automatic scheduler or production deployment enabled.
- [ ] 06 recovery PostgreSQL acceptance: updated integration case covers crash recovery, outbox rollback and ten concurrent recovery runners; must pass on a disposable PostgreSQL database before promotion. Local typechecking/unit checks are not database evidence.
- [ ] Backup restore validation: owner reports a 24 October SQL export; successful local restoration, schema/data checks and a fresh pre-migration export remain unverified. A dump file or a DBeaver connection alone does not establish recovery.
