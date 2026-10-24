# Render foundations inspection

Read-only inspection on 2026-10-24, using the user-confirmed My Workspace.

## Verified live state

- CASH-DEY-PLAY web service tracks main with automatic deploys enabled. Latest deployment reports live at commit cb5ca23dddee6fa68a404bd045a93db61afc4236. Deployment state alone does not prove application flows work.
- Backend root is cash-dey-play-backend/. Build uses npm ci --include=dev followed by npm run build; start uses npm run start. No health-check path is configured.
- Web service and PostgreSQL18 database are both on free plans in Oregon. The database reports available and an expiry of 2026-11-08T07:14:11Z. Renewal/upgrade or migration must precede expiry.
- The public schema contains the ten legacy application tables and no _prisma_migrations table. Foundations objects are not deployed.
- Inspected column types/defaults/nullability and constraints agree with the legacy baseline at this level. Index definitions, triggers, extensions, and other custom objects still require full comparison; this is not a complete drift certification.
- Read-only foundations preflight returned zero for invalid users, bare identity references and orphans across all seven checked reference columns, cross-window streak collisions, and conflicting idempotency responses. These are point-in-time observations, not a guarantee against subsequent writes.
- Database external IP allow list currently permits 0.0.0.0/0. Review legitimate external clients before restricting it; do not lock out required operators or integrations.

## Release gates still open

1. Secure logical export and a successful isolated restore, with recovery timing and reconciliation evidence recorded privately.
2. Full baseline drift comparison and migration rehearsal against the restored copy.
3. Maintenance/write-pause procedure, current preflight and backup, baseline registration, foundations migration, then backend and frontend rollout in runbook order.
4. End-to-end checks and a configured readiness/health route appropriate to the actual implementation.

The exposed Render connector supports read-only SQL and deployment inspection. It exposes no backup/export, shell execution, or arbitrary write-SQL tool. No production schema, environment variables, resource plans, or deployment settings were changed during inspection. No verified production backup or restore rehearsal is claimed.
