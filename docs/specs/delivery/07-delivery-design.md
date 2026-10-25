# Committed game notices and authorized snapshot delivery

25 October2026. Stage07 delivery slice; public gameplay remains disabled.

## Durable truth and relay algorithm

1. Game transitions already commit snapshot + private event + redacted GAME_STATE_CHANGED outbox together. No network publication happens inside that transaction.
2. The opt-in `worker:game-delivery` claims only GAME_STATE_CHANGED events, using the existing expiring token lease. It never claims wallet, task, payment or payout intents. It checks current lease ownership, parses the stored intent and verifies the committed game event at that match/version.
3. Derive human recipient IDs from stored participants. Publish only `{eventId,matchId,version,userIds}` on the explicitly configured environment-scoped Redis channel. No hands, private events, entropy, token or client outcome appears in the notice. Stable eventId is the immutable game_events UUID, not a newly minted retry identity.
4. After Redis publication succeeds, conditionally acknowledge the outbox lease. DELIVERED means published to the relay, not received by every browser. Zero subscribers is possible and does not make the source invalid. Publication failure schedules exponential retry; a crash before acknowledgement expires/reclaims the lease. Stale workers cannot acknowledge a newer lease. A lease may expire during a publication, so duplicate hints remain possible and safe.
5. Each gateway indexes only its own connected recipients by server-authenticated user ID. A validated Redis hint schedules those local recipients. It is a routing hint, not authorization or state. Every send rereads PostgreSQL with the same current-session/revocation/expiry guard used by reads, and projects only the stored human participant's current hand.

Redis pub/sub and Socket.IO do not by themselves make delivery durable. PostgreSQL remains the recovery source. A global outbox claim without a relay would miss clients on other gateways, which this design avoids.

## Snapshot and acknowledgement protocol

The server emits `match:update` with `{matchId,eventId,view}`. The view contains the authoritative version and private player projection. A version-zero initial snapshot has eventId:null; later versions require the corresponding committed immutable event. Snapshot/event pairing comes from one SQL query, never from the incoming relay payload.

The client acknowledges exactly `{matchId,eventId,version}`. The gateway advances its per-connection cursor only on a matching, strictly validated acknowledgement. Missing/malformed acknowledgements retry after a notice or catch-up pass. Acknowledged duplicate/older versions for the same match are suppressed. Dirty notices coalesce; up to8 recipient jobs run concurrently per gateway, in a bounded FIFO queue with one queued/running job per connection. Each socket acknowledgement waits at most2 seconds. A disconnected recipient is removed, and gateway close releases the timer/subscription/queue.

This is latest-state delivery. Several transitions can coalesce into one current snapshot; it does not promise replay of every intermediate animation/event. Clients must compare versions by match ID across action acknowledgements, resume responses and pushes, reject regressions, and acknowledge duplicate snapshots safely. Frontend integration of that behavior remains open; enabling the server flags alone does not complete the frontend journey.

## Recovery and authorization

New connections read SQL immediately. A five-second catch-up sweep rereads current state even when Redis notices were lost or the subscriber is offline. Server restart discards only the optimization cursor; reconnect starts from the current authorized SQL snapshot. No game deadline is reset. Old hints also fetch current SQL state rather than replaying an outdated view. A forged hint for a nonparticipant can only trigger their own authorized query; it cannot select another player's match/seat or reveal its cards.

Replacement/revocation is checked inside the snapshot read transaction, and an invalid recipient is disconnected without a new snapshot. As with authenticated reads, authorization is evaluated at that transaction boundary; a later revocation cannot retract an already-dispatched packet. No claim of instantaneous network-wide retraction is made. Client acknowledgements never write game state, counters or rewards.

## Execution and limits

No new schema migration or dependency is needed; all seven existing migrations are required. API delivery requires `ENABLE_REALTIME_DELIVERY=true`, `ENABLE_REALTIME_READ=true`, REDIS_URL and explicit GAME_RELAY_CHANNEL. The flags default off. Moves remain independently gated. Public `features.realtime` stays false.

Build the backend, then run `npm run worker:game-delivery` separately with securely configured DATABASE_URL, REDIS_URL and matching GAME_RELAY_CHANNEL. The worker checks shutdown between bounded event transactions and closes database/Redis connections on SIGTERM/SIGINT. Redis command timeout is5 seconds; database statements are bounded. No hosted worker, plan purchase, environment change or production deployment is part of this implementation.

Use separate environment channels and credentials. Redis database numbers do not isolate pub/sub channels. CI uses randomized channels on an isolated service. Polling/concurrency parameters are initial internal bounds, not measured throughput or5,000-connection acceptance. Live supervision, metrics, capacity/backpressure measurements, frontend acknowledgements, devices and hosted failure rehearsals remain open.

## Verification plan

Unit/socket tests cover invalid/missing ACK retries, duplicate/old-version suppression, recipient routing, bounded concurrency, cancellation, unauthorized read failure and timer-driven catch-up. PostgreSQL tests cover domain-filtered claims, batch/shutdown limits, uncommitted intents, publication retry, publish-before-ack crash, expired/stale leases, committed-source validation and per-player privacy/revocation. CI adds real Redis and two actual gateways to verify relay delivery, forged/duplicate/out-of-order hints, subscriber loss, SQL catch-up and disconnected-client recovery. Record CI evidence before checking acceptance.

References: https://redis.io/docs/latest/develop/pubsub/ ; https://socket.io/docs/v4/delivery-guarantees/ ; https://socket.io/docs/v4/server-api/ .
