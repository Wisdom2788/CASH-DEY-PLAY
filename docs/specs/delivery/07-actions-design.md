# Atomic session-guarded game intentions

25 October2026. Stage07 move-acceptance slice; public gameplay remains gated.

## Wire contract and gates

`match:action` requires an acknowledgement and a strict payload `{matchId, actionId, expectedVersion, command}`. Command is the engine's bounded PLAY/DRAW/PASS/FORFEIT schema. Client identity, clock, timeout, outcome, reward and extra fields are rejected. The gateway derives the connection from its authenticated server state and maps actionId to the engine receipt ID.

`ENABLE_REALTIME_MOVES=true` additionally requires `ENABLE_REALTIME_READ=true`. Without configured action dependencies the event remains rejected. Both flags default off; the public rules capability stays false. No production/environment change is included. Existing seven migrations suffice; no new migration is required.

## Atomic algorithm

1. Apply packet/frame/in-flight limits and the existing shared per-player event budget. Verify the original signed token again. Validate the strict move schema.
2. Charge the dedicated per-player move budget of60 requests/minute using the shared Redis counter directly. Counter errors deny the move with UNAVAILABLE; no read fallback is used for mutations. Retries also consume request budget. Local development without Redis uses the existing single-process memory counter; that is not distributed acceptance evidence.
3. Begin a bounded SQL transaction. Take player SHARE lock, verify registered canonical identity/current token version, then current-session SHARE lock and verify generation/token expiry. Session claim uses the same player-first order with UPDATE locking. Retain these locks until commit/rollback.
4. Lock the match for UPDATE; map the stored human participant to its seat. Read existing action receipt. Capture PostgreSQL clock after the locks/queries and recheck token expiry, including retries. No timestamp argument is accepted by actForConnection.
5. A matching previously committed actor/payload receipt replays its original projection. Changed payload or actor under that action ID conflicts. This check precedes current game version/terminal/deadline validation, but never precedes current authorization. A new action passes authoritative version, turn, ownership, legality and persisted deadline checks.
6. Write the private replay event/entropy, next state and redacted GAME_STATE_CHANGED outbox in the same transaction. Commit before acknowledging. A failure rolls back all three and permits a later exact retry. Only the actor projection is acknowledged; no hidden opponent/deck data is returned.

A game timer races on the same match lock/version. Expired client actions do not reset deadlines or beat a due timeout. Bot/timer workers never acquire player/session locks after the match lock, avoiding an inverted lock order. Trusted-clock act remains an internal engine/test adapter; the socket gateway uses only actForConnection.

## Replacement, revocation and retries

A replacement/revocation committed before the move guard rejects that move, even if it replays an old receipt. If a move already holds the guard locks, replacement/revocation waits for that transaction: the authorized move commits first, then ownership changes. This is a serializable authorization boundary for these conflicting row operations, not a claim that the whole transaction isolation level is SERIALIZABLE. Expiry is additionally checked after a match-lock wait because time advances while locks are held.

If the acknowledgement is lost after commit, reconnect with a valid token and resubmit the same actionId/payload. Its original projection may have an older version than the latest match. Clients must not overwrite a newer state with an older receipt; use session:resume for current state. Duplicate network delivery is not another game event, task award or settlement.

Wrong-turn/stale/illegal/conflicting/expired actions return bounded engine codes without raw errors. Storage/corrupt-state failures are UNAVAILABLE. No actions are accepted during shared-limiter failure. This does not claim load/DDoS protection or real Redis outage acceptance beyond the tested dependency-failure boundary.

## Acceptance and remaining work

PostgreSQL tests cover ten duplicate writes, actor/payload conflicts, wrong turns/versions/nonparticipants, revoked/replaced receipt access, replay after reconnect/later turns, token expiry and game deadlines after a lock wait, retained guard locks during competing session replacement, outbox rollback/retry and private replay. Two actual gateways/clients exercise authenticated moves, reconnect retry, opponent turns and revocation. Gateway tests cover disabled actions, spoofed fields, mapped connection, bounded engine errors and fail-closed shared-limit errors. Record CI results before acceptance.

Committed-event delivery/broadcast/recovery is the next slice. Opponents currently retrieve state through authorized reads; no automatic room fanout is claimed. Redis queue/ownership, ranked admission/quota, result settlement, frontend version handling, real devices and measured load/recovery remain open. This implementation cannot make the public realtime checkbox complete.

## Recorded acceptance

PostgreSQL18 Verify run40219993548 passed280 backend tests across32 suites on runtimec69a5fbf2cb6b536c10ccd646a2307fed06350c2. This includes the replacement/expiry/rollback/idempotency/private-replay cases and actual two-gateway moves, reconnect retries, opponent turns and revocation. Gateway/configuration cases verify disabled-by-default actions, strict fields and limiter failure denial. All seven migrations deployed twice; frontend checks, production dependency audit, reconciliation and both Vercel previews passed. No production flag/environment changed, and delivery/full ranked/real-device/load acceptance remains open.
