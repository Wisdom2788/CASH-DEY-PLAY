# Critical-flow design: game, Redis, rewards, Stars and airtime

Engineering design proposal, 24 October 2026. These flows refine the ordered specifications; they do not mark any later feature implemented. Foundations and ledger tests gate their implementation. Open Whot, reward-cycle, provider and refund-policy decisions in RULEBOOK.md remain open.

## 1. The common economic boundary

Every operation follows: authenticate player/provider -> validate input and immutable business identity -> acquire database locks in a consistent order -> verify current state -> insert a unique business event -> update state + ledger/audit + durable outbox + idempotent response -> commit -> dispatch external work. Never call a payment/ad/airtime provider while holding a database transaction. Never grant money from a client callback, socket result, animation or local store.

Idempotency keys bind player, operation AND canonical payload hash. Repeating the same payload replays the saved response; reusing a key with different amount, destination, plan or match returns409. A business uniqueness constraint also prevents a second reward under a different request key. Request idempotency alone is insufficient.

Lock order: affected player/account rows in sorted canonical-ID order, then operation rows (offer/match/order/payout), then immutable source/award inserts. Document any exception to avoid deadlocks. Use bounded lock/statement timeouts and explicit retryable failure codes. All daily counters use the persisted Lagos admission date; durations/deadlines use actual instants.

## 2. Durable truth and Redis

The previous reference draft left a SQL/Redis dual-write gap. Resolve it before realtime code:

- PostgreSQL owns durable active-session ownership, offers, admission reservations, terminal results, private replay state/events and economic settlement.
- Redis accelerates queue ordering, live presence, rate limits and projected live state. Redis loss must not permit a second active game or duplicate prize. Rebuild cache from committed SQL state, not a player's report.
- A game action locks the durable match row, loads its state/version, checks player/turn/actionId/version, computes a pure transition and writes event+snapshot+outbox in one transaction. Only after commit may Redis/socket clients observe the next version. The outbox can deliver twice; receivers ignore duplicate/older versions.
- Do not claim atomicity between separate PostgreSQL and Redis writes. If performance later requires a Redis-first engine, it needs a separately reviewed durable-command/fencing protocol and failure proof; silently swapping authority is prohibited.

Snapshots, initial deck order and private events are restricted server data. Client projection includes only that player's hand and permitted public information. State recovery replays private events deterministically; no predictable32-bit seed or hidden-card dump is sent to the browser.

## 3. Ranked admission and pairing algorithm

1. queue:join authenticates session and queries current capabilities, daily allowance, cooldown, penalty and existing active ownership. Create a durable ticket/admission intent; add it to Redis with the original join instant. A unique player-active constraint prevents concurrent practice, queue, offer and rematch ownership.
2. A leader uses an unpredictable ownership token, compare-and-delete release and bounded renewable lease. It cleans expired tickets and scans compatible candidates with a rotating bounded cursor so a blocked first50 cannot starve everyone behind it. Await every asynchronous compatibility check.
3. Lua tentatively reserves/removes two current ticket versions. This is NOT yet a committed match. A SQL transaction locks the two player admission rows in canonical order and rechecks limits, cooldown, session ownership and per-pair count. Persist one offer, both reservations and an outbox event. If commit fails, restore still-owned tickets with their original join times; a recovery worker reconciles abandoned tentative pairs.
4. Offer acceptance is a conditional state transition with offerId, player, version and server deadline. Duplicate accepts replay. When both have accepted, exactly one transition creates the match and finalizes admission ownership. Decline/timeout releases the affected reservations once and requeues the nonfaulting player at their original position. An old timer cannot delete a newer ticket/session.
5. Maximum3 ranked starts/day for both tiers; regular cooldown after the second chargeable match. Reserve before starting, not after finishing. A normal forfeit counts; a verified infrastructure failure releases reservation once. Cross-midnight matches retain their admission date for quota accounting; completion/leaderboard timestamp policy must be written consistently.
6. Rematch requires mutual consent, current allowance/cooldown checks and the same ownership/admission path. The proposed2-meetings/day limit needs a COUNTER, not set-membership. Count all relevant random and rematch meetings. A rematch cannot bypass cooldown or double-register an active user.

Proposed UI waits: offer practice after30s and end search after120s; never hide a bot in ranked. Queue settings and no-show penalties require their recorded product decisions. Presence alone is neither authentication nor proof that someone is willing to play.

## 4. Actions, disconnects and recovery

All command messages contain matchId, actionId and expectedVersion. Server checks current session ownership and token expiry for every sensitive event, not just initial socket connection. A player cannot subscribe to another room or act as the opponent by choosing an ID.

Server-owned deadlines are persisted. Client timers are display-only. A turn action and timeout race for the same row/version; only one wins. A reconnect reads session:state and a projected current version; it does not reset the clock. Owner-token cleanup occurs on queue leave, decline, timeout, terminal match and device replacement. Renew TTLs through long matches so an expired Redis key cannot reopen admission.

Both clients disconnecting is NOT proof of server failure and must not automatically VOID an unfavorable game. Apply the agreed disconnect/forfeit policy using durable deadlines. Only evidence-backed infrastructure failure can void/refund. After restart, rebuild state from committed snapshot/events; if recovery is impossible, record the adjudication and compensation with a unique business reference.

## 5. Result settlement and daily tasks

Terminal game transition writes a single settled result per match. Settlement consumes that result identity to award XP/task progress, release active ownership and produce outbox notifications. The client cannot call a win endpoint. Practice never produces ranked wins; an abandoned practice does not count toward25. Technical start failure releases an admission reservation; voluntary abandonment does not grant unlimited retries.

Daily task completion serializes by user/Lagos date. Different task completions cannot each miss the other's uncommitted write and lose the all-complete bonus. Unique task/award identity gates each50-point award. Premium/ad-free tasks become AUTO_READY but require Claim; current entitlement is rechecked at the claim instant. Complete task days derive from all four CLAIMED rows, not any optional-video row.

Streak milestone identity is (player,cycle,day), without tier in the unique key. Tier switching cannot collect both variants. Claim, ledger/ad-free-day entry, audit, request response and source event commit together. Resolve elapsed30-day/grace and milestone-expiry semantics before changing cycle progression.

## 6. Ad verification and unavailable ads

Create a server session bound to player, purpose, placement and expiry before showing an ad. A provider adapter must prove callback authenticity AND stable impression identity AND correlation to that session/purpose. A static secret reward URL plus Telegram ID does not establish all three. Do not invent fields missing from the provider contract. Keep credits disabled until actual publisher/sandbox evidence supports the design.

Insert a verified provider event once and derive one short-lived, purpose-bound credit. Practice start or cooldown skip consumes it with a conditional update in the same admission transaction. Wrong purpose/player, expired credit and replay are rejected. Client SDK success only changes the display to waiting for server verification.

Latest business rule allows a normally completed practice match to count even when no ad is available. Model that as a distinct, reason-coded admission outcome, not a fabricated impression. Apply the regular daily start cap and anti-automation protections anyway. Premium/ads-free players skip the video path, not the admission/ownership checks.

## 7. Stars order/payment algorithm

1. Server selects an immutable versioned plan, exact integer XTR amount and30/90-day duration, creates an order and invoice payload. Weekly price changes affect only new orders.
2. App opens the invoice. cancelled/failed/paid frontend callbacks are presentation signals; none grants entitlement.
3. Webhook authenticates Telegram's secret header before parsing economic input. pre_checkout verifies payer, order, currency, amount and eligible state/deadline. successful_payment repeats validation and uses both a unique Telegram charge ID and a guarded order transition.
4. Only the winning transition inserts the paid entitlement contribution, audit, response/outbox in one transaction. Repeated messages or different update IDs for the same charge cannot extend the duration again. An already-refunded order cannot be resurrected by status != PAID logic.
5. An actual payment arriving after an order expires must go to an explicit paid-late reconciliation/refund path, not disappear silently or automatically grant an unrelated plan. Persist the real charge for support.
6. Renewals add purchased duration to the agreed current entitlement boundary. Define delayed webhook start-time semantics and per-order contribution accounting. Refund behavior when several purchases overlap is a product decision: do not revoke unrelated paid days or silently retain a refunded contribution. Store enough per-order history to recompute the entitlement deterministically.

Use a separate staging bot and Telegram test environment. Provide /paysupport, accessible terms/support and terms acceptance. Do not put bot/payment secrets into Vite variables, browser logs or CI artifacts.

## 8. Airtime algorithm and float operations

Validate whole-naira amount/network/normalized phone and idempotent payload. Lock account plus relevant risk-cap rows; reserve funds and daily/phone allowance, create PENDING payout, ledger debit, audit and outbox together. Return pending, never sent. Use integer kobo internally with checked conversion at provider/UI boundaries.

The worker persists a stable provider request ID before the first submission. Timeout after submission means UNKNOWN, followed by requery under the SAME request ID. It must not generate a fresh billable request to escape an ambiguous response. If provider date-prefix rules prevent safe cross-day resubmission, hold for reconciliation; do not guess that the original failed.

A definitive failure creates one refund/compensating entry and updates reservation/cap state by the agreed policy. Delivery marks the existing payout successful without another debit. Low float holds work as WAITING_FOR_FUNDING and alerts a named operator. Worker crash, duplicate queue delivery and repeated callbacks must all converge on one payout outcome. The daily provider-statement reconciliation is independent of “job completed” status.

## 9. Acceptance order

Foundations migrations and auth/time contracts -> ledger/idempotency/outbox failure tests -> entitlements/tasks/attribution -> agreed pure Whot engine -> verified practice admission -> durable realtime/ranked recovery -> milestone/referral credit -> Stars test purchase/refund -> airtime sandbox/funded delivery -> reviewed monthly settlement -> real-device/load/recovery beta.

Record an implementation/test/release artifact at each gate. A green Vercel static build does not certify database migration, gameplay, provider authenticity or a successful top-up. Do not merge production schema-dependent code before its backup/baseline/migration rollout is concretely rehearsed.
