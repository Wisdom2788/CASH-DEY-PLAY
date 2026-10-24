# Identity, clocks, migrations and contracts

Status: **Specified; not implemented**. Covers: H1–H4, H6, M1–M5/M8–M10/M12/M13. Dependencies and sequence: [delivery index](README.md). Product decisions: [rulebook](RULEBOOK.md).

### Data and implementation

Use users.id as canonical tg_<positive-safe-Telegram-ID>. Central requireUserId returns that value on JWT and signed-initData paths. Add explicit NOT NULL/FKs on streak, tasks, matches participants, audit and idempotency. Introduce a versioned migration runner (Prisma Migrate as the recorded tooling choice, pinned to an agreed version) while retaining pg repositories. An existing database is baselined only after schema comparison, backup and restoration rehearsal. CI applies migrations to an empty PostgreSQL instance before tests; schema.sql is not an alternative live migration system.

Identity migration builds a mapping, reports orphan/mismatch counts and aborts unresolved cases. Merge streak rows by a documented window/date rule while preserving any claimed flag/audit identity; deduplicate task/idempotency conflicts deterministically. Rewrite both matches.user_id AND winner_id. Verify no orphan winner IDs before adding FKs. Do not embed a SELECT-only “must be zero” instruction: assert and raise inside the migration. Dry-run report and backup precede data changes; pause writes during incompatible transition.

### Time, API and frontend

Inject a clock. All daily/monthly SQL uses explicit Africa/Lagos boundaries or indexed lagos_date; never depend on session timezone. GET /api/config/rules returns a runtime-validated, versioned public rulebook and feature capabilities. Standard envelope {data}, errors {error,message,requestId}; schemas validate every body/query/param/socket event with unknown-key policy. Nullable rank/trend/username/photo types match real responses. Controllers call services; repositories own SQL. Remove unsafe any casts.

User provisioning and signed first-login referral intent must be atomic; an initData convenience path cannot steal first creation before attribution. Replace script-readable persistent JWT/user cookies with an explicit memory-session policy; request fresh Telegram auth on reload. Remove cookie leftovers, local reward/stats mutations and fake streak initialization; load actual server progress. Define session revocation/token-version policy for compromised accounts.

### Tests and rollout

Lagos 22:59:59Z/23:00:00Z and month/year boundaries; mixed-ID collision, missing winner/orphan, repeated migrations; empty DB schema; forged JWT subject, new-user initial request, stale token, body-type errors; response contract validation. Add ESLint/strict frontend after correcting types. Redis counters report actual TTL; memory fallback evicts expired keys and has a bounded map. Authenticated NAT users do not share one budget; money routes fail closed. Trust-proxy setting must match deployment ingress. Expand/switch/contract migrations; do not promise old code can read new-only data. Restore recovery requires a recorded recovery point, maintenance window and write replay, not an unqualified backup restore.

## Implementation record

Record commit, schema version, commands/results, integration evidence, unresolved decisions and recovery rehearsal here before marking complete. An acceptance criterion written above is not evidence that it passed.
