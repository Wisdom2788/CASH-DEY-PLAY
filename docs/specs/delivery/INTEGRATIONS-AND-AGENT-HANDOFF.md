# Integration readiness and agent handoff

Updated 27 October 2026, Africa/Lagos. Read this alongside IMPLEMENTATION-SUMMARY.md, RULEBOOK.md and each numbered delivery spec. This is an execution guide, not a certificate that every test passed or that the app is fully secure. The cumulative summary holds acceptance results; unchecked requirements remain open.

## Start here: preserve the working agreement

Repository: https://github.com/Wisdom2788/CASH-DEY-PLAY. Use the existing `feature-implementation` branch for planned work, `hot-fixes` for fixes, then reviewed `development`; production `main` promotion is separate. Never create branches containing `codex`. Do not invent approvals from old recommendations. Do not enable partially integrated features, buy resources or publish secrets as part of a code merge.

Before editing: fetch remote refs, inspect `git status`, branch heads, open PR18 and its latest checks; check for AGENTS.md instructions. Preserve unrelated/untracked user files, including TEMPORARY-RELEASE-PLAN.md; it is not an approved release policy and must not be swept into a commit. Do not hard reset or force push. Connector publication must use an expected-head lease. Do not duplicate this git-backed repository into file storage.

PR18: https://github.com/Wisdom2788/CASH-DEY-PLAY/pull/18. Last accepted development runtime before this work: PR17, commit26d3b05c4fa4ddf45582f24a616e120b1c989b6b, Verify40420751951 (351 backend/37 frontend tests). Development docs head before PR18: b6cddc40c4411239fe89970228496712b567c5a3. Main remained at stage01 baseline cb5ca23dddee6fa68a404bd045a93db61afc4236 when this guide was written; verify current refs, do not assume these hashes are forever current. The stage08 policy-only commit was cc4416be587b9a472b7a2d7c6b1d0c2c4123a765; subsequent persistence acceptance belongs in the summary/PR checks, not inferred from that commit.

## Actual obstacles: connectors versus integrations

An assistant connector operates accounts; the running app integrates using server-side APIs, credentials and callbacks. A missing connector does not prevent writing algorithms, migrations, adapters, contract tests or retry logic. It does prevent claiming that a remote action/test happened when it did not. Never replace a missing provider with client-success callbacks, timers, hardcoded paid flags, fake deliveries or public test reward endpoints.

Read-only Render inspection on27October found one free web API tracking main and an available free Key Value instance with allkeys_lru and persistence off. No hosted background worker was listed. Account IDs, internal endpoints and connection strings intentionally omitted. No settings changed. This proves resource configuration only, not that new development runtime ran there. Recheck before deployment. Existing API start command does not execute migrations.

| Integration | Already implemented | Remaining code/decisions | External prerequisite/evidence |
|---|---|---|---|
| Redis and ranked workers | SQL-owned matchmaking, Redis coordination, replay/leases, authorized snapshots, combined worker entrypoint | Hosted configuration, monitoring and complete load/device/restart acceptance; noeviction review; no accepted2-second offer SLO | Actual worker running correct commit with same DB/namespace; Redis access/config, bounded outage and memory-pressure exercise |
| Telegram Stars | Paid-order/entitlement read model; retired free premium writer | Invoice/order lifecycle, webhook ingestion, payment/refund consumer, support, refund allocation policy, frontend polling | Bot/test environment, webhook secret configuration, real test purchase/refund and actual client devices; no third-party digital-payment provider token required |
| Rewarded ads | Admission policy, normal completion and quotas; no fabricated credit path | Ad session/evidence/credit lifecycle, recovery/cooldown/practice consumers, adapter | Publisher/placement access and documented authenticated per-event, per-user/session/purpose evidence; real completion/replay tests |
| Airtime | Integer-kobo accounting and immutable audit/outbox core | Provider adapter, payout/reservation states, caps/float policy, reconciliation, pending UI | Selected provider, approved account/sandbox, credentials, actual catalogue/requery/idempotency contract, float and controlled delivery |
| Sponsored tasks | Design only; core daily gameplay tasks already rotate | Editorial publication, budgets, verification/dedup, receipt consumer, UI | Approved action/provider policy and evidence; Telegram channel bot-admin access or signed sponsor backend callback; campaign funds |
| Referral rewards | First-login attribution and qualifying-day reader | Scheduled/event consumer, once-only150 noncash points each, delayed-source expiry recovery, frontend | Real-device invitation and first-login tests; not a separate payout provider |
| Release/operations | CI SQL/Redis/browser coverage for named completed slices | Restore rehearsal, production migration plan, real devices, alerts, runbooks, legal/support and prize finance decisions | Verified restore and operator ownership; physical Telegram tests; provider and funding evidence |

This is more than a hosting-plan issue. Development and contract/SQL tests can continue now. Live payments, ad recoveries and top-ups cannot be accepted from mocks. No midnight completion guarantee: prioritize tested code and a trustworthy handoff, then account onboarding and evidence collection in parallel by the owner.

## Stage08A current implementation and next steps

Read08-persistent-claims-design.md before changing code. Stage08A adds migration2026102702_streak_rewards, isolated versioned cycle/login/claim/request records, actor-scoped progress/login/claim HTTP routes, default-off ENABLE_STREAK_REWARDS, legacy-route retirement when enabled, and a reusable ledger transaction primitive. Check current CI before calling this accepted. Frontend, referrals and live recovery are separate unfinished slices.

Approved rules:30 Lagos calendar dates; first airtime milestoneDay10 for both tiers; any miss before completedDay10 resets; after that, one single missed date can be restored by a verified ad only on the immediately following Lagos day. Two missed dates reset. Recovery does not extend the end. Unclaimed milestones expire at cycle end. Day30 must be claimed before Lagos midnight that day. Premium does not waive recovery-ad proof. Tier at claim, one reward slot per cycle/milestone. RegularDay30 requires25 normal practice completions in that personal window; premium waives that practice gate. Retained amounts: bothDay10₦50; regularDay20 no-video-ad day/premium₦100; regularDay30₦100/premium₦200. See versioned rulebook for precedence over stale PRD tables.

New monetary eligibility starts with new observed logins; snapshot legacy state, never treat old automatic grace as verified recovery. Preserve all credited history. Before production activation review continuity/reconciliation and explain cutover to users. Use ledger compensation if required; never rewrite money history.

Next stage08 slices, one at a time:

- [ ] Provider-backed recovery: separate actual/recovered dates; server-issued intent bound to user/cycle/missed date; one verified event/credit can recover once; hold user/cycle/ad-credit locks, sample SQL time, ensure completedDay>=10, one miss, within deadline, cycle still active, consume proof and advance to current calendar day atomically with receipt/audit/outbox. If no proof, remain pending/unavailable. No public boolean-success bypass.
- [ ] Referral evaluator: derive third complete task-day timestamp from qualified_task_days and25 normal practice times within original referral window, premium practice waiver only when backed by qualifying paid entitlement. Lock affected users in deterministic ID order, then referral; conditional PENDING/eligible -> QUALIFIED and insert unique awards150points each, audit/outbox and receipt in one transaction. Never convert points to wallet cash. Evaluate persisted timestamps, not job execution time; do not mark an expired-looking referral irreversibly ineligible before examining late persisted source events. Resolve premium-at-qualification/refund semantics explicitly where needed; historical paid rows must not be guessed from current premium boolean.
- [ ] Frontend: strict progress/receipt contracts; record actual login via new API; render server eligibility only; exact pending/recovery/unavailable/expiry/practice messages; no local eligibility engine or reward balance mutation; invalidate wallet/entitlement/tasks after committed claims. Surface old unlocked-cycle claims until original expiry. Test real HTTP→SQL→ledger result in browser. Keep feature off until this is done.
- [ ] Full stage08 recovery/release acceptance and update numbered checklist; do not mark the entire stage complete for Stage08A backend alone.

## Telegram Stars execution algorithm

1. Choose immutable versioned30/90-day plan prices in integer Stars; old naira estimates are not authoritative conversion rates. Record support/terms acceptance and refund rules. Existing premium_orders has PENDING/PAID/EXPIRED/REFUNDED/PAID_LATE: extend/migrate it deliberately; do not write a consumer expecting a nonexistent CREATED enum.
2. Authenticated order request plus Idempotency-Key creates actor/plan/price/currency/expiry/payload nonce record. Commit order before external invoice call. Call createInvoiceLink with XTR, one price item and empty provider_token. Persist invoice result/retry identity without creating another economic order on timeout.
3. Dedicated bot webhook is excluded from player-JWT middleware only at its exact path; authenticate Telegram secret header first, bound body, validate schema, deduplicate update ID. Never exempt a whole API subtree.
4. pre_checkout_query: validate actor/order nonce, XTR, exact price, order state and expiry; reply using answerPreCheckoutQuery within10seconds. Payment is not granted here. A slow durable queue alone cannot meet the pre-checkout deadline.
5. successful_payment: revalidate all identities/amounts; lock canonical user first, order/entitlements next; sample SQL time and conditionally transition the eligible unpaid order. UNIQUE telegram charge prevents cross-order reuse. Insert that order's paid interval, audit and outbox atomically. Renewal adds duration to max(now,current valid paid end). Current invoice UI callback is display-only.
6. Mismatched, expired or unexpected successful payment enters explicit reconciliation/late-payment handling without silently granting twice or losing the customer's charge. Store charge ID securely for refund/reconciliation.
7. Refund request and provider call use stable identity and explicit uncertain outcome. Reconcile refund update/API result once; adjust only affected purchase allocation, preserving unrelated paid time. Never implement refund as isPremium=false for all purchases. Resolve allocation policy before sales. /paysupport and terms must work.
8. UI opens invoice then polls authoritative premium status; cancelled/failed/pending outcomes remain honest. Separate test bot/webhook from production. Run Telegram's dedicated test environment and retain redacted evidence before production sales.

| Stars test ID | Scenario / required invariant |
|---|---|
| ST01 | Missing/wrong webhook secret, malformed/oversize payload: no order or entitlement changes |
| ST02 | Wrong actor/payload/currency/price/expired order: checkout rejected; no paid grant |
| ST03 | Pre-checkout deadline: answer observed within10seconds, not assumed from handler execution |
| ST04 | Duplicate update/charge, different order using same charge, concurrent callbacks: one grant |
| ST05 | Active/expired renewals and simultaneous30/90 purchases: exact non-overlapping purchased duration |
| ST06 | Invoice request timeout before/after provider creation: stable order, recoverable status, no grant |
| ST07 | Failed/cancelled UI invoice and forged paid callback: no entitlement |
| ST08 | Real test payment and refund; duplicate/out-of-order refund/payment; timeout around refund: exactly one appropriate adjustment |
| ST09 | Refund one of several purchases: unrelated paid time remains; tier reads reflect expiry/revocation |
| ST10 | Inject failure after each SQL write; retry after commit/crash: receipt, entitlement, audit/outbox agree |

## Redis, workers and gameplay execution algorithm

Use existing SQL-owned ranked/games/delivery architecture, not a replacement queue implementation. Read07-full-ranked-design.md and07-ranked-policy-revision.md. Entry point `worker:ranked-all`; blueprint deploy/render-ranked-workers.yaml is prepared but provisioning is not accepted. Redis only coordinates; economic starts, games, results and reward facts remain durable SQL. Never broadcast private hands or identify players from unauthenticated socket payloads.

Before activation, API and worker must agree on commit/rules, database, environment namespace/channel, TLS/private network access and feature flags. Use noeviction for queue-like/shared control state; memory exhaustion must return handled errors, not silently evict jobs/limits. Paid persistence is not sufficient authority for money; SQL/outbox recovery remains required. A free cache can be used in controlled development recovery tests, but is not an accepted durable financial queue. Upgrades/restarts may erase free Key Value data; plan SQL rebuild and outage behavior first.

| Redis/game test ID | Scenario / required invariant |
|---|---|
| RG01 | Two matcher instances compete: one offer/reservation/start per source, no duplicate opponent/day |
| RG02 | Redis restart/flush, worker crash before/after SQL commit: recover from SQL; no double start/award |
| RG03 | Lease expiry/stale worker ACK and delayed hints: fencing rejects stale mutation; bounded catch-up |
| RG04 | API/worker Redis unavailable or OOM: mutating admission fails closed, existing SQL facts retained, no fake success |
| RG05 | Forged/stale/revoked socket token, wrong participant/session/actor: no read or write disclosure |
| RG06 |30-second deadlines, offers/no-shows/disconnect/forfeit/midnight: approved quota, cap and cooldown exactly |
| RG07 | Result settlement replay and rollback: exactly two immutable human result receipts, task progress once |
| RG08 | Slow client, reconnect/manual retry, ACK loss: own latest state, bounded backlog, no opponent hand |
| RG09 | Real mobile Telegram iOS/Android/Web clients: compatibility and complete journeys, not just desktop emulation |
| RG10 | Hosted representative load: measure offer/event latency, pool/CPU/memory/backlog and failures; previous100-socket test did not meet2-second offer target and is not5000-client proof |

## Rewarded-ad execution algorithm

Select the provider only after checking its actual contract: authenticity proof, stable unique event, correct user, placement/unit, server session/nonce and purpose correlation. A public GET callback containing Telegram ID alone is insufficient. Do not invent undocumented signature fields. Start a server-side ad session with purpose, unit, user, nonce hash and expiry. Pass only documented public correlation data to SDK. Browser return triggers status polling, never grant.

Authenticate callback before economic processing; deduplicate provider/event ID, validate unit/session/user/purpose/expiry and insert immutable proof plus at most one credit. In a separate owning operation transaction consume the valid credit once, atomically with practice start, cooldown skip or streak recovery. No-fill is not completion. Existing explicit practice-unavailable fallback can permit play by policy without forging a reward or restoring a streak.

| Ad test ID | Scenario / required invariant |
|---|---|
| AD01 | Forged signature/secret, wrong provider/unit, altered payload: no proof/credit |
| AD02 | Wrong actor/session/purpose/nonce, unknown or expired session: no grant |
| AD03 | Replayed event ID, changed payload for same event, out-of-order callbacks: once-only or conflict |
| AD04 | Two concurrent consumers of one credit: only one practice/skip/recovery transition |
| AD05 | SDK success without callback, navigation return, timer, no-fill, provider outage: pending/unavailable, never award |
| AD06 | Streak beforeDay10, second recovery, two misses, post-midnight callback, cycle ended: deny recovery |
| AD07 | Valid Day10+ single-miss recovery before next Lagos midnight: missed date restored once, original end unchanged |
| AD08 | Crash/failure after proof/consumption/state/audit/outbox writes: safe retries and no partial credit use |

## Airtime provider execution algorithm

Provider remains unselected/unaccepted. Choose against the actual purchase/requery/balance/catalogue/webhook/statement contract. Confirm stable idempotency request IDs, cross-day retry rules, mobile-number normalization, network identifiers, definitive versus uncertain failure responses and duplicate prevention. Obtain sandbox/account access and agree fees/float owner, low-float threshold, per-phone/account/day/month risk caps. Never guess a network from number prefix alone.

1. Strict authenticated redemption request, actor-bound Idempotency-Key and validated whole-naira amount/catalogue/network/Nigerian number. Lock canonical user, wallet and cap rows in consistent order. Sample Lagos time after locks; check funds and caps including existing reservations.
2. Atomic ledger debit plus payout/reservation, audit, pending receipt and outbox. SQL is recovery authority; an enqueue failure cannot lose a committed payout. UI says pending, not delivered.
3. Worker claims fenced work and checks float; low float -> WAITING_FOR_FUNDING with funds held. Generate stable provider request ID once before first transmission using documented format/date; retain across retries/requery. External HTTP outside SQL locks, bounded timeouts, redact credentials and phone numbers.
4. Definitive provider success -> DELIVERED once. Timeout/network ambiguity -> UNKNOWN. UNKNOWN re-queries the same provider identity; never issue a new purchase merely because a timeout occurred. If cross-day submission is forbidden, requery/escalate rather than regenerate ID.
5. Definitive non-delivery -> FAILED plus exactly one immutable compensating refund. UNKNOWN/pending is not definitive failure and does not auto-refund. Duplicate callback/poll/worker races converge on one outcome.
6. Reconcile daily provider statements versus SQL payout IDs/amounts/outcomes. Missing, doubled or mismatched records enter operator review with audit trail. Manual correction uses ledger compensation, not history deletion. Enable only after real sandbox and a controlled funded delivery.

| Airtime test ID | Scenario / required invariant |
|---|---|
| AT01 | Bad amount/type/range, number/network mismatch, unsupported catalogue: reject before debit |
| AT02 | Parallel last-balance/last-cap requests and same key changed payload: no overspend/cap breach |
| AT03 | Retry same/different key for same request, enqueue failure, duplicate outbox delivery: one economic request |
| AT04 | Crash immediately before send, after provider accepted but before SQL update, or after SQL commit: stable requery, no second purchase |
| AT05 | Timeout/unknown/cross-day retry and reordered callback: retain funds and request identity until definitive outcome |
| AT06 | Float exhaustion/replenishment: honest waiting state, no double debit or fabricated delivered status |
| AT07 | Definitive failure/refund duplicate/retry and competing webhook/worker: one compensation |
| AT08 | Bad callback signature/provider ID/amount, wrong recipient: quarantine, no delivery state from untrusted data |
| AT09 | Statement missing/double/mismatched records: reconciliation detects each, audited operator repair |
| AT10 | Actual sandbox top-up plus controlled funded delivery, masked receipt and wallet/pending balance checks |

## Sponsor verification and other launch gates

Read04-sponsored-task-campaigns-design.md. Server-controlled weekly drafts are not a promise of infinitely unique tasks. Core gameplay rotation is already implemented; paid campaigns are separate. Rewarded YouTube engagement is excluded by the documented platform policy, including the app's own YouTube channel. Telegram membership needs appropriate bot privileges and does not prove a new join without baseline evidence. Other social actions require action-specific API permission/policy review; no generic return-to-app verifier.

Test campaign immutability/date boundaries/budget reservations and refunds, expired attempts, replayed external identity across campaigns, provider outage and delayed verification, membership baseline/rejoin, callback authenticity/nonce binding, capped once-only reward, and rollback/recovery. Optional sponsor economics and core qualification separation remain proposals until approved.

Stage11 still needs authoritative remaining stats/leaderboard paths, agreed net-revenue/prize rules, rounding/unfilled-band policy, freezes, review and audited awards. Stage12 needs full auth→game→tasks→streak→payment→airtime journeys, operational restore, abuse/load/device checks, support/privacy/terms and rollback planning. Never mark them complete because a single component or CI build passed.

## Validation and evidence protocol for the next agent

Use disposable local/CI PostgreSQL only for destructive fixtures. Set TEST_DATABASE_URL to a database whose name includes test, TEST_REDIS_URL to a disposable instance/database, REQUIRE_DB_TESTS=true and REQUIRE_REDIS_TESTS=true in acceptance CI. Never reuse the production URL pasted in earlier chat. No tokens/connection strings/raw user data in code, docs, fixtures output or PR descriptions.

Backend: `npm ci`, `npm audit --omit=dev --audit-level=high`, `npm run typecheck`, `npm run db:migrate` twice, `npm test -- --runInBand`, `npm run db:ledger:reconcile`, `npm run build`. Frontend: `npm ci`, full `npm audit --audit-level=high`, typecheck, lint, tests, build; then existing Chromium/WebKit ranked browser acceptance and actual SQL/Redis browser journey. The Verify workflow runs service-backed acceptance. A local run with skipped SQL suites is unit evidence only.

For each implementation record tested commit, migration count/version, exact CI run link, suites/tests/skips, ledger mismatch counts, browser artifact and what the evidence does NOT cover. Investigate failed checks; never hide a failure by disabling tests or widening assertions. Update IMPLEMENTATION-SUMMARY.md and the owning spec. Review diff for unrelated files and secrets. Merge only accepted intended scope to development; keep remaining integrations unchecked and feature flags off. No production/main release until its gates are actually satisfied.

## Inputs the owner can obtain now, without waiting for another coding session

- Telegram: confirm bot ownership and a separate test-environment setup; provide credentials through deployment secrets, never chat. Prepare terms/support/refund-policy decisions and a real tester on Android/iOS. Confirm final Stars plan prices before invoice implementation.
- Ads: publisher approval/placement IDs plus the provider's official authenticated callback and session-correlation documentation. Do not accept a demo callback as security evidence.
- Airtime: shortlist/select a provider, obtain sandbox access and catalogue/requery/idempotency/refund/statement docs; name the person funding float and approving risk caps. Controlled live delivery costs are separate from server compute.
- Operations: perform a fresh protected database dump and restore into a disposable database; record restore success/count/integrity evidence. A DBeaver connection or a small dump file by itself does not prove recovery. Rotate any previously exposed database secret through the provider and update dependent secret stores.
- Sponsors: identify first supported action, verified target/account, budget and reward unit; obtain platform access/policy approval. Avoid promising unsupported social verifications to paying sponsors.

## Official references checked27October2026

- Telegram Stars requirements/testing/checkout/support: https://core.telegram.org/bots/payments-stars
- Telegram invoice/payment/refund/webhook objects: https://core.telegram.org/bots/api
- Render Key Value persistence/eviction/restart behavior: https://render.com/docs/key-value
- Existing sponsor design records official YouTube/Telegram action-specific sources. Recheck current official docs when implementing adapters; never infer undocumented provider fields from this handoff.
