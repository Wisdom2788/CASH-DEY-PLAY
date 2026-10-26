# Rotating daily tasks — design and acceptance

27 October 2026. Business approved different daily selections with server-verified progress, once-only rewards and schedule-based qualification. This supersedes fixed daily task requirements after the migration's recorded cutover.

## Product flow

Every Lagos date has one immutable published schedule shared by all players. Four catalogue sets rotate by Gregorian day ordinal; neighbouring days always have different objective sets. Repetition after a cycle is intentional, not an unlimited promise of never repeating any task. Three objectives pay 50 points each, followed by a once-only 50-point all-complete bonus: maximum 200 task points/day. No premium advantage or new currency/payout is introduced.

Catalogue: finish one/two ranked matches; win one ranked match; play three/five cards in finished ranked matches; play two/three different ordinary suits in finished ranked matches. Sets: finish1/win1/cards3; finish2/cards5/suits2; win1/cards3/suits2; finish1/win1/suits3. No ads, Stars, referrals or practice tasks are scheduled while those integrations/public journeys remain unfinished. Gameplay admission/unlock policies remain separate.

WIN_MATCH preserves authoritative win receipt semantics, including opponent forfeit/timeout. Finish/card/suit progress excludes the player's own forfeit/timeout loss; normal empty-hand finishes and unawarded exhaustion/action-limit draws qualify. WHOT is not an ordinary suit. A user's distinct suits aggregate across their qualifying matches. Only committed PLAY events count, never draws, repeated requests, opponent actions, active/unsettled games, practice, client counters or claimed wins.

## Algorithm and authority

1. Migration records the next Lagos midnight as an immutable cutover. Pre-cutover dates retain legacy tasks/claims/points. Reject ambiguous existing future task rows before changing anything.
2. On state read or verified result settlement, determine the event's Lagos finish date using SQL/committed timestamps, never client date. Publish that date's deterministic versioned JSON schedule once via INSERT ON CONFLICT; subsequent reads use stored definitions. No new cron or paid service required for publication.
3. Under the existing user lock, materialize only scheduled task rows plus bonus. Aggregate immutable ranked result receipts and committed player PLAY events for that day. Clamp progress to each published target. Recovery can process results out of order; use authoritative source completion times, not recovery wall-clock date.
4. Award newly completed objectives, point increment, claim receipt, task state, completion history, audit and outbox in the same transaction as settlement. Evaluate all-complete using scheduled membership, not a fixed row count. Unique per-user/date/key receipts and locks prevent duplicate rewards. API exposes no client gameplay claim/progress writer.
5. State reads also reconcile already-settled receipts idempotently; settlement recovery remains the crash-recovery path for unsettled games. Both winners and losers reach the consumer; pre-cutover legacy wins retain their old writer.
6. One qualified_task_days view checks every required scheduled key and bonus, ignoring unrelated extra rows. Legacy dates require the exact four legacy keys. Ranked progress, monthly qualification and referral progress share the view. Referral windows retain first-claim and completion-time boundaries; 20 task days, 15 ranked wins and existing tier/practice gates remain unchanged. Monthly win input changes from legacy matches to immutable ranked_results.
7. Frontend renders server titles, progress/targets, schedule date/version and maximum points; objective buttons navigate to ranked play without awarding locally. Midnight and foreground refresh load the current schedule. No timed ad modal can complete these tasks.

## Rollout and failure handling

Publish backend/frontend contracts before cutover and run the new worker/runtime consistently. An insert guard rejects old fixed-task writers for dates on/after cutover. Downgrading to old code after cutover fails closed rather than issuing alternate rewards. Never edit published schedules or historical claims; a future catalogue change needs a new version and migration/design. No production migration or activation is part of development merge. Backup/restore, worker health, device/provider and release gates still apply.

## Required evidence

Deterministic/shared/nonrepeating-adjacent schedules; simultaneous publication; midnight and calendar rollover; preserved legacy points and claims; malicious claim refusal; active/unsettled/opponent/practice/forfeit-loss exclusion; progress target/suit semantics; duplicate/concurrent/out-of-order settlement and reads; atomic rollback on audit failure; bonus once; schedule immutability/old-writer rejection; delayed historical result; exact required-key qualification and referral windows; real result-to-task browser refresh; ten migrations twice, reconciliation and build/test/audit checks.

## Rotating task acceptance — 27 October 2026

Runtime `26d3b05c4fa4ddf45582f24a616e120b1c989b6b` passed [Verify 40420751951](https://github.com/Wisdom2788/CASH-DEY-PLAY/actions/runs/40420751951): **351 backend tests / 40 suites**, **37 frontend tests**, no PostgreSQL/Redis test skips, ten migrations deployed twice, zero ledger/opening reconciliation mismatches, backend production and full frontend dependency audits reporting zero known vulnerabilities, typechecks/lint/builds, both Vercel previews and CodeRabbit checks.

Covered: deterministic shared daily sets across 800 calendar dates and leap-year/Lagos midnight boundaries; concurrent publication and claims; immutable schedules/policy/receipts; rejected old writers and client claims; active/unsettled/opponent/practice/own-forfeit exclusions; real multi-suit/card progress; historical recovery; out-of-order two-match settlement; atomic audit-failure rollback/retry; once-only 200-point full completion; exact required-key day qualification; referral windows; monthly wins from ranked_results rather than legacy matches. Existing historical claims are preserved without re-awarding points.

The actual browser journey uses three independently authenticated browser contexts, the production task router/auth middleware and real PostgreSQL/Redis/gateway/worker loops in an isolated disposable fixture. It first proves the original pair cannot be offered a second game, then finishes against a different opponent. Evidence: two games, four result receipts, four charged starts, four committed relay events and **50 automatically awarded points** for the published finish-two objective. The task screen shows 2/2 and Earned, bonus 1/3 and the authoritative 50-point balance. Signed progress spoof, unsigned claim and old video claim are rejected. The normal-play database scenario independently proves the 200-point complete-day maximum and bonus exactly once.

Chromium 412×839 and WebKit 390×664 component journeys passed. The actual mobile Chromium journey also asserts no horizontal overflow; its final task/progress/balance screenshot was visually inspected. The combined browser fixture is not physical Telegram-device or production acceptance. No fixture token is a production credential.

The 100-socket/50-offer run had zero duplicate assignments, p95 2772ms/max 2776ms on CI localhost. Hosted capacity, the proposed two-second SLO, physical devices, remaining providers and launch acceptance remain open. No paid resource, production migration/cutover or main promotion was performed.

### Deployment boundary

Migration 2026102701_rotating_tasks records the next Lagos midnight as immutable rotating_from. Inspect that date and coordinate backend/frontend/worker versions before allowing the cutover. Ambiguous existing future task rows abort the migration for reconciliation. Old fixed-task writers fail closed on/after cutover. Do not downgrade to old task code after cutover or edit published schedules/receipts. Existing release/backup/restore gates still apply. Daily publication itself is lazy and durable; no additional cron/service purchase is required. Ranked live result processing still depends on the separately pending hosted worker.

### Next in build order

Stage08: streak milestones/ad-free grants and referral qualification/reward consumption. Telegram Stars payments/refunds, verified ads, airtime delivery/reconciliation, full prize/leaderboard operations and end-to-end release gates remain separate unfinished stages. This task updates qualification progress readers; it does not award referral cash/points or pay prizes.
