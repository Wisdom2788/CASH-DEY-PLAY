# Ranked admission, allowances and SQL-first Redis matchmaking

25 October2026. Internal gated ranked flow; full stage07/public release is not accepted by this implementation alone.

## Recorded owner decisions

Owner selected two ranked starts against the same opponent per Lagos day, and a regular player's one-hour cooldown starts when the second chargeable match finishes (including forfeit/timeout). Cooldown resets at Lagos midnight. Premium bypasses cooldown only, never the three-start cap. Rematch requests/hour, no-show penalties and post-start technical compensation remain separate decisions/features.

## Durable admission algorithm

The eighth migration adds ranked tickets, offers, reservations and a durable matchmaker fencing row. PostgreSQL owns all economic and active-session decisions. A partial unique live-ticket index and live-reservation index protect one queue/offer per user. Deferred constraints require exactly two matching participant reservations for each offer; STARTED reservations are immutable and have unique daily slots1–3 and stored game-participant FKs.

1. Authenticate current session, lock user rows in canonical order (same root lock as practice), and lock existing paid entitlement/order rows. Queue join validates current registration/session, allowance, cooldown and absence of any active practice/ranked match. The request key identifies one ticket; an old key returns its existing ticket rather than minting another start.
2. SEARCHING tickets have a fixed120-second search deadline and45-second presence. Heartbeat (recommended15 seconds) may adopt the ticket into the newest authenticated session, preserving original join/search times. Old devices cannot heartbeat or accept. No client selects tier, day, amount, clock or quota.
3. A matchmaker holding Redis ownership plus a current SQL generation selects candidates. SQL rechecks its fencing generation after acquiring player locks, then ticket state, session ownership/expiry, presence, actual entitlement, allowance/cooldown and the two-per-pair daily counter. It commits a ten-second offer and two RESERVED allocations before removing Redis queue entries. Cancellation is free; an offer is not a played start.
4. Each acceptance is authorized against stored offer participants/current session and serialized under both player locks plus offer lock. One acceptance records readiness. The second rechecks both players and current time/entitlements/allowance. It creates one approved whot-v1 human-only game, both seats, STARTED daily allocations, ticket/offer state and redacted outbox together. Repeated accepts replay the same started match. Failure rolls back match, charges and the second acceptance.
5. Allowance counts committed starts and outstanding reservations. Maximum three starts/day applies to both tiers. Charge date is the actual SQL start day in Lagos; an offer crossing midnight revalidates and moves its reservation to that day before assigning slots. Started matches retain that admission date even when finishing on another day.
6. A regular player's current-day slot2 completion supplies cooldown end=min(finish+one hour,next Lagos midnight). Voluntary forfeits, timeouts and unawarded terminal draws still consume starts. Current premium waives cooldown; expiry/downgrade is rechecked before start. Ad-free status does not waive it. No fabricated ad skip or client refund is provided.
7. Decline requeues the nonfaulting still-present player with original priority. Expired offers release both reservations and requeue only accepted/still-present players. If final readiness fails eligibility, the failing player is cancelled and the eligible opponent can requeue. Recovery expires stale searches/offers under the same player locks. No automatic no-show penalty or post-start refund is inferred from a disconnect.

## Redis ordering, ownership and recovery

Redis stores ZSET queue order, short-lived ticket/presence keys, a per-player SQL epoch fence and a bounded rotating scan cursor. Scripts declare accessed keys explicitly. Epochs use decimal string comparison, preserving bigint ordering beyond JavaScript/Lua exact integer range. Newer cache snapshots cannot be overwritten by an older worker. Presence/ticket TTL never extends the120-second SQL search deadline. Epoch metadata expires after24 hours; SQL revalidation remains authoritative even if cache metadata is lost.

A lease uses an unpredictable UUID, SET NX PX5000, compare-and-renew and compare-and-delete. A SQL generation/expiry fence additionally prevents Redis loss or stale workers from granting an offer under an obsolete owner. Each candidate transaction rechecks that fence under lock; a new SQL owner cannot overtake an already guarded transaction. Renewal precedes each compatibility attempt.

Each pass examines at most100 candidates/100 pair attempts with a rotating cursor, including when the whole queue fits one window. Missing-presence entries are cleaned conditionally so a concurrent heartbeat cannot be deleted. Live-looking incompatible/blocked prefixes cannot permanently trap the first candidate. Compatibility calls are awaited. Selection is bounded oldest-candidate scanning with rotation, not cryptographic random pairing.

Offers commit in SQL first. Crash before Redis cleanup leaves harmless stale cache entries: a second SQL attempt rejects the already-offered tickets. SQL rollback leaves the Redis players available. Fresh snapshots remove offered tickets, and paged anti-entropy plus heartbeats rebuild Redis after loss. Recent tombstones are included for cleanup; historical idle users are not indefinitely refreshed. Redis caches queue ownership, while SQL active-game checks guard participation through the entire match, including after Redis expiry/restart.

## Wire protocol and execution

ENABLE_RANKED=true additionally requires ENABLE_REALTIME_READ=true, REDIS_URL and an explicit environment RANKED_QUEUE_NAMESPACE. Flags default off; public realtime remains false. Apply all eight migrations before enabling ranked.

- queue:join {requestKey}; queue:heartbeat {ticketId}; queue:cancel {ticketId}; offer:respond {offerId,accept}. Strict schemas reject extra identity/tier/time/result fields.
- Mutations use the shared fail-closed limiter,30 requests/minute in addition to the general event budget. SQL may commit before a Redis sync fails: retry/resume the durable ticket, never invent rollback of a committed reservation.
- session:resume returns an authorized composite phase IDLE/SEARCHING/OFFER/IN_MATCH/RESULT, private player projection and public ticket/offer/allowance. It omits connection generations/request keys and the other player's private ticket/state. Match/version/expiry are server-owned.
- This slice exposes offer state through explicit resume reads; automatic offer notifications and frontend integration remain open. Internal clients can poll resume while searching (for example every2 seconds), and heartbeat at15 seconds. No UI latency/load claim is implied.

Build and run npm run worker:ranked separately with DATABASE_URL, REDIS_URL and RANKED_QUEUE_NAMESPACE. Workers check shutdown between bounded work items, retain SQL tickets on errors and release only their own leases. No hosted worker, production configuration or main promotion is part of this work.

## Verification and remaining acceptance

PostgreSQL tests cover duplicate joins/accepts, practice races, free offer reservation/release, forfeits/cap3, premium expiry/downgrade, finish-based cooldown, pair count2, midnight reservation migration/reset, immutable starts and transactional start rollback. Redis tests cover stale/large epochs, owner replacement, missing-presence cleanup, rotating scans and SQL fencing across cache loss. Two actual socket clients must join/accept/resume/play one real human game across gateways without double charging. Record actual CI before checking acceptance.

This does not close full ranked stage07. Still open: automatic offer push, no-show lockout policy, rematches/approved request limits, verified-ad skips, infrastructure void/refund policy, trusted result settlement/qualification, production baseline/restore, frontend/device integration and measured load/recovery. The proposed million pair attempts and5,000 live connections are not claimed measured by these bounded tests.

Redis references: https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/ ; https://redis.io/docs/latest/develop/programmability/eval-intro/ . The SQL fence is the final ownership check; no distributed-lock fault-tolerance guarantee is inferred from one Redis instance.
