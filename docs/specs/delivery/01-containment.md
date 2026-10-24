# Containment and deployment baseline

Status: **Implemented and automated acceptance passed on e526b8d; production and end-to-end provider flows are out of scope**. Covers: C1–C6, H8/H11, M1/M5/M7/M8 and initial hygiene. Dependencies and sequence: [delivery index](README.md). Product decisions: [rulebook](RULEBOOK.md).

### Required behavior

No anonymous or client-asserted money/win/premium grants. Keep record-match and subscribe retired. Until real integrations land, video completion, optional video credits and airtime redemption return 501 without repository mutation. UI displays coming soon; no timers masquerade as ads. Optional provider configuration must not stop static builds.

Streak login and claim use one PostgreSQL client/transaction, transaction-scoped per-user lock, claim state, audit and idempotent response. Same-key requests from independent instances replay the same response. Audit/idempotency failure rolls back the flag. No nontransactional production fallback. This stage still records no monetary streak credit; that is stage08 after the ledger.

Auth defaults to production unless explicitly development/test; bypass only in development with flag. JWT HS256, issuer cash-dey-play, audience cash-dey-play-mini-app, 24-hour expiry and canonical userId/telegramId consistency. Reject invalid/future signed timestamps beyond 60s clock skew, malformed/duplicate initData and nonnumeric dev IDs. Public health is liveness only. IP limiter applies to sign-in; authenticated limits use player identity.

### Files and contracts

Implemented in env.config, auth service/middleware, Telegram verifier, streak-unit-of-work and service, task/wallet controllers, React ad modal, Vite/vercel config, package cleanup and GitHub verify workflow. GET /healthz -> 200 {ok:true}; disabled mutations -> 501 {error,message}; old retired endpoints -> authenticated 404. No schema change. Existing JWTs must be replaced on app reopen.

### Acceptance and current evidence

Backend typecheck/build and **105 tests including all eight PostgreSQL cases** passed in [GitHub Verify run 40129750572](https://github.com/Wisdom2788/CASH-DEY-PLAY/actions/runs/40129750572), commit e526b8d. Frontend typecheck,23 engine tests and Vite build passed. Both Vercel preview deployment contexts succeeded on that commit. Include claim races, audit failure rollback/retry, missing-user task rollback and same-key multi-instance replay. CI must reject a missing required DB URL, use isolated schemas, and never truncate public tables. Hosted preview build success does not certify runtime backend/provider functionality.

### Deployment and recovery

Vercel Root Directory cash-dey-play-frontend, Vite, Node24, npm ci/build, output dist, SPA rewrites. Verify both Vercel projects and commit logs before closing the deployment incident. Keep backend on its existing host. No production promotion or merge is part of local validation. Roll forward or retain disabled routes; reverting to unsafe endpoints is not a safe rollback.

## Implementation record

Record commit, schema version, commands/results, integration evidence, unresolved decisions and recovery rehearsal here before marking complete. An acceptance criterion written above is not evidence that it passed.
