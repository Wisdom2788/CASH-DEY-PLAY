# Realtime session, ranked queue and rematches

Status: **Durable worker and authenticated read/reconnect core implemented; public realtime/ranked flow incomplete**. Covers: C7/later C8, H3/H4/H11, hidden-card and anti-cheat boundaries. Dependencies and sequence: [delivery index](README.md). Product decisions: [rulebook](RULEBOOK.md).

### Model and protocol

Authenticated Socket.io gateway validates the same issuer/audience/algorithm and canonical player as REST, plus token expiry throughout long sessions. Events are schema-checked and rate-limited per player. session:resume returns server phase IDLE/SEARCHING/OFFER/STARTING/IN_MATCH/RESULT, version, ticket/offer, projected match, allowance and deadlines. Client emits intentions with unique actionId/expectedVersion; never result/reward. Only server settles terminal state using unique match reference.

### Queue correctness

Redis ZSET queue by joinedAt, ticket hash,45s presence refreshed15s, active-state ownership token, per-pair meeting COUNTER expiring at Lagos midnight, rate/penalty keys. Atomic enqueue checks one-active invariant. Matchmaker owner token has compare-and-delete release, lease renewal and fencing. Await compatibility checks; recheck cooldown, allowance, penalties, live presence and active state in the atomic reservation boundary. Pair removal and offer persistence/reservation are atomic or recoverable via durable intent. Offer failure restores original join times. Remove stale entries and scan beyond blocked prefix with a bounded rotating cursor to prevent starvation. Do not equate oldest-compatible selection with cryptographic random pairing.

Offer lasts10s; two accept starts match once; nonfaulting player returns to original place. Proposed same-opponent limit2/day and3 rematch requests/hour need recorded approval. Rematch rechecks both allowances/cooldowns, mutual consent, no second ready check. Three ranked starts/day for both tiers; regular cooldown after second chargeable match. Reserve allowance before match creation, finalize or release on recorded technical failure exactly once.

### Failure and security

Server clock owns turn/reconnect deadlines. Disconnect grace is persisted and bounded; both client disconnects do not automatically VOID a losing game. Only verified infrastructure failure can refund admission. Recover Redis state from private ordered events/snapshots or adjudicate by recorded policy. active keys are owner-checked and renewed through full match, then cleaned on every terminal path. Reconnect does not reset deadlines. User B cannot join/read/control A's room/match; newest authenticated device invalidates old session per policy.

### Acceptance

Two real clients complete/reconnect/rematch; one million simulated pair attempts never double-assign; multi-instance lease expiry; stale first50 tickets, worker crash before/after pair removal, duplicate accept/move, token expiry, malicious room IDs, multi-tab race, midnight reservation, failed DB settlement, user unplugging both clients. Proposed5,000 connections/p95 pairing targets must be measured, not assumed. Practice fallback at30s, stop search120s unless product changes; no hidden ranked bots.

## Implementation record

Record commit, schema version, commands/results, integration evidence, unresolved decisions and recovery rehearsal here before marking complete. An acceptance criterion written above is not evidence that it passed.


Internal worker design/runbook: [07-worker-design.md](07-worker-design.md). The worker discovers due/bot turns in SQL, rechecks version/time under the match lock, commits replayable transitions/outbox and recovers normal practice completions. No sockets, Redis queue, ranked admission or payout/reward settlement are enabled. Internal-worker PostgreSQL18 CI run40216621540 passed on runtime9c5a9ba05e009798fcc22d8360c124ea4d912171, with backend/frontend checks, repeated migration deployment and reconciliation passing. Full-stage acceptance remains open.

Authenticated read/reconnect design: [07-session-design.md](07-session-design.md). The gateway is opt-in and supports only session:resume/match:view. Seventh migration required; public realtime capability stays false. Internal read/reconnect acceptance passed PostgreSQL18 CI run40218117090 on runtimef37120ca88e0a24b3bc37ab803fc78bc05ca860f; two actual gateways shared durable session ownership correctly.
