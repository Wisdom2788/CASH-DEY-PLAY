# Branch and staging workflow

Approved25 October2026. No new branch name contains codex.

- feature-implementation holds the current focused implementation. One active integration PR targets development. After merging, bring the reusable feature branch forward from development before starting the next increment; never overwrite unrelated commits.
- development contains integrated code for the isolated staging app. Its initial consolidation preserves every foundations/ledger commit through15e5a3b. This fast-forward did not update main or production infrastructure.
- hot-fixes starts from main and is reserved for urgent fixes. Released fixes must also be integrated into development and the next implementation work.
- main is the production release branch. Promote a verified development commit only after migration/recovery and full-story staging checks.
- Preview is a deployment environment, not another permanent branch. Vercel PR builds do not by themselves establish a separate backend/database.

Superseded draft PRs3 and4 are closed with original test evidence retained. Their source refs remain historical until safely retired; they are not new work streams. No branch ref was deleted or force-pushed during consolidation. The existing development branch was fast-forwarded from the historical baseline after verifying ancestry.

## Staging prerequisites and current blocker

Required resources: a separate PostgreSQL18 database, separate Redis instance/namespace with separate credentials, backend tracking development, separate Telegram test bot and Mini App, frontend targeting only that backend, and provider sandbox credentials when those integrations are implemented. Keep NODE_ENV=production and development auth bypass disabled even on public staging. Use a separate random JWT secret. Never copy production tokens, live payment hooks or provider credentials into preview builds.

An account's managed-instance quota can prevent a second free database instance. This does not necessarily require a paid instance: PostgreSQL can host separate logical databases in one instance where permitted. Evaluate a separately owned logical staging database with restricted runtime credentials and verify production-data isolation. Shared resources and failure boundaries remain limitations. Separate instance/provider or local testing remain alternatives. Provisioning requires secure write-capable operator access; the SQL inspection connector is read-only. Do not share the production application database or its privileged credentials with staging.

Once provisioned: privately export production with pg_dump in custom format, restore into the isolated database, record recovery timing and counts, compare schema drift, baseline the restored legacy schema, and rehearse migrations. Separately test fresh empty deployment. Use a private shell for these commands and never put dumps/URLs/tokens in Git, chat or public CI artifacts. Required command order is in02-migration-runbook.md. New migrations must not be hidden in production npm start. Check backend /healthz plus real signed login/profile/task/ledger flows before wiring a staging frontend.

Staging is not live yet. The production backend still tracks main and its database is unchanged.
