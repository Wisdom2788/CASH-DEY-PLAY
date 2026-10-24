# Foundations migration runbook

This is a reviewable deployment procedure, not permission to alter production data from an unreviewed branch.

## Rehearsal and baseline

1. Take an encrypted database backup through the host's approved backup process. Restore it to an isolated staging database; record recovery point/time and operator. Never place the dump in Git or a public artifact.
2. Point a private server shell's DATABASE_URL at the restored copy. Run npm ci, npm run db:preflight and npm run db:status. Preflight prints counts only. Resolve any invalid users, orphans, cross-window streak collisions or conflicting idempotency responses explicitly; do not drop those rows to make a migration pass.
3. Compare the existing schema (columns, types, constraints, defaults, indexes and unexpected custom objects) against prisma/migrations/0_init/migration.sql. Prisma migrate deploy does not detect arbitrary schema drift. If the database is already populated and matches that baseline, record the baseline once with npm run db:baseline. Do NOT baseline an empty database: run db:migrate there so the baseline is actually applied.
4. Run npm run db:migrate against the restored copy, then db:status and db:preflight again. Test login, existing-user progress, new-user attribution, read APIs and JWT revocation. Verify all player references are canonical and claims remain claimed.
5. Rehearse recovery with writes paused. Do not assume restoring an earlier backup preserves writes made after it. Retain post-backup events and a reconciliation plan if production writes could resume before rollback.

## Production sequence

- Review the migration/code commit and rehearsal results. Schedule a quiet maintenance interval and pause affected application writes.
- Take and verify a current backup. Re-run preflight and schema comparison; fail the release if the production shape/data differs from the rehearsed copy.
- Baseline only if needed and already reviewed, then deploy migrations. They have lock and statement timeouts and a transaction; an exception must halt release. Never use prisma migrate reset or db push in production.
- Deploy backend code only AFTER the foundations migration. The new code requires token_version, lagos_date, first_login_attributions and the new FKs. Migration is intentionally not hidden in npm start.
- Deploy frontend afterward. Stage01 qualification response fields remain temporarily as aliases alongside {data}, and stage01 JWTs are accepted only when token_version is zero. The frontend removes the old cookie and obtains a new in-memory session.
- Configure TRUST_PROXY_HOPS to the verified ingress topology. Default0 trusts no forwarded address. Set frontend VITE_API_URL for each Vercel environment; never put server credentials into VITE_ settings.
- Verify signed login/progress, rules capabilities, account reads and requests with revoked/missing users. Re-enable writes and monitor 401/503, FK failures and transaction errors. Keep unimplemented game/payment/ad/redemption capabilities false.

## Recovery constraints

Roll forward or stop writes while investigating. A data-normalization migration is not blindly reversible: restoring a pre-migration backup can lose new activity. Reverting backend code alone restores bare-ID controller writes, which new FKs reject. Therefore do not roll back to the old backend after the canonical-ID migration without a rehearsed coordinated maintenance plan. Keep original backup plus secure migration counts and event/audit reconciliation evidence.

## Tooling boundaries

Prisma7.10.1 is pinned and owns SQL migration history; pg still owns runtime SQL. schema.prisma intentionally has only the datasource during this transition, and no unused Prisma Client is generated. Introspect the migrated database before introducing ORM models/AdminJS. src/db/schema.sql is a historical reference, not a deployment entrypoint. CI exercises migration deploy on an empty database twice and uses isolated schemas for collision/failure tests.
