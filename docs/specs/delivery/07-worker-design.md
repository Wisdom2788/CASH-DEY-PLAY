# Durable game worker: bot turns, deadlines and completion recovery

25 October 2026. This is a stage07 internal worker slice, not public realtime/ranked acceptance.

## Algorithm and ownership

1. Discover at most100 active matches whose persisted deadline has elapsed, or whose current seat is a practice bot. Order by last transition time then match ID, so continuing bot turns move behind older work. Discovery is advisory and returns only match ID/version, never hands or deck data.
2. For each candidate, lock the PostgreSQL match row with bounded lock/statement timeouts. Recheck ACTIVE status and the exact discovered version. A stale candidate is a no-op; concurrent workers cannot execute two transitions from that version.
3. Read PostgreSQL clock time after acquiring the lock. A due deadline takes priority over a bot move. The existing approved timeout rule determines the result; restart/reconnect does not reset the deadline. Otherwise only the stored bot on the current practice turn may act, using its own projected hand view.
4. Persist one deterministic version-bound system action, private replay data/entropy, next snapshot and redacted outbox intent in the existing transaction. A failure rolls back all effects. No socket/cache publication occurs inside the transaction.
5. Run existing bounded practice-completion recovery. Only persisted normal EMPTY_HAND finishes qualify; forfeits/timeouts do not. This does not grant task points, airtime, XP or ranked wins.
6. The opt-in worker process repeats a bounded pass after a two-second pause. SIGTERM/SIGINT stops new work, lets the current operation finish and checks for shutdown between candidate transactions and closes the pool. Errors are logged without connection strings/private payloads and retried next pass; persistent errors require operator investigation. No hosted service or application startup enables it automatically.

## Limits and recovery policy

PostgreSQL row/version checks provide transition correctness across workers; this is not Redis matchmaking ownership or fencing. Work waiting on a lock may time out and retry. A database restart leaves committed state/events/outbox available for another pass. Expired bot turns obey the same stored timeout rules as other turns; infrastructure-failure adjudication/compensation remains an explicit later stage07 policy, never an automatic refund. The worker does not reset timers to conceal downtime.

Two-second polling is an initial internal execution cadence, not a measured UX latency target. Free hosting sleep or process suspension cannot guarantee timely turns. Hosted supervision, live transport, disconnect grace, Redis queue, admission settlement, downstream rewards and real-device/load tests remain open.

## Acceptance before integration

Use a disposable PostgreSQL database to test stale candidate after a human move, concurrent bot/timeout attempts, early human turn, due deadline precedence, terminal idempotency, transactional outbox failure and replay. Unit-test shutdown and retry behavior. Record actual CI evidence in the cumulative summary; an acceptance list alone is not a pass.

## Operator execution

Apply the six existing migrations, then `npm run build` and `npm run worker:games` in the backend with a securely configured DATABASE_URL. This long-running process is separate from the API and must use the same intended environment/database. The existing API start command is unchanged. Do not run it against production before release gates are met. No provider, Redis or new schema migration is needed for this internal worker; the actual public game flow still requires those owning integrations. Stop it using SIGTERM/SIGINT; completion recovery also observes shutdown between transactions. Supervising or deploying the worker is a separate operational task.
