# Stage06 admission and completion flow

25 October2026. This implements the admission core while the external rewarded-ad contract remains unverified. The existing provider verification gate in06-ads-practice.md is preserved. No provider callback schema, signature format or successful ad impression is invented.

## Start algorithm

1. Validate canonical player ID and bounded request key. The current internal request has no client-selected purpose, exemption, fallback reason, outcome or reward amount.
2. Begin a bounded PostgreSQL transaction; lock the registered user. All match creation shares this lock; ranked human locks are acquired in sorted ID order.
3. Return an existing persisted response for the same user/key before rechecking expiry or current activity. Retries after a committed start or completed game remain exact and do not spend another start.
4. Lock admission state; reject a ranked queue or any active human participation across game modes.
5. Lock existing paid orders/entitlements and ad-free rows, then capture PostgreSQL time. Derive the Lagos calendar day and recheck paid expiry/revocation.
6. Count all committed starts on that day. Regular players, including ad-free players, have five starts. Premium bypasses the video gate and cap. Downgrades count starts already spent that day, including premium starts. Forfeit/abandonment does not restore a start.
7. The default regular policy blocks pending verified ad evidence. An internal constructor policy can explicitly allow PROVIDER_UNAVAILABLE fallback. It is not an HTTP argument and creates no ad evidence/credit. Ad-free and premium use distinct admission reasons.
8. Construct the approved whot-v1 game. Persist private state, human/bot seats, admission receipt with actor-only initial projection and redacted outbox notification in this same transaction. Failure rolls back all writes; no partially created start or match escapes.

## Completion algorithm

A recovery-safe internal consumer reads the authoritative stored match, validates its private engine snapshot, human participant and corresponding admission, and accepts only a FINISHED/EMPTY_HAND outcome. A bot win and a human win both qualify as a normal completed practice game. Active games, forfeits, timeout forfeits and unawarded draws do not qualify. The unique completion row and its redacted outbox intent commit together; duplicate delivery does not count again. The completion date follows the server finish time in Lagos, not the start date. This consumer is not a client completion endpoint.

## Boundaries remaining

- No public practice endpoint or fake ad-credit issuer is enabled by this core.
- Verified callback adapter, event/session/purpose correlation and credit consumption await a demonstrated provider contract and sandbox account. The default policy continues to block regular video-gated starts.
- Provider-unavailable policy remains opt-in internal configuration. Actual no-fill proof/UX and verified credits require the provider integration.
- Completion consumer scheduling/recovery and downstream qualification/profile/streak/referral projections belong to their owning stages. New practice_completions is the authoritative source for those integrations; legacy matches must not be counted again.
- Post-commit technical void/refund policy remains an explicit stage07 decision; only failures inside the start transaction are automatically released here.
- Ranked queue writers must acquire the same user lock before changing player_admissions. There is no public queue writer yet.
- Practice frontend, bot scheduling, socket authentication, live timers and recovery remain stages06/07 exposure gates.

## Verification

PostgreSQL tests cover same-key concurrent replay, competing start keys, fifth/sixth daily start, forfeits, previous Lagos day, paid premium and expiry/revocation, ad-free limits, legacy premium rejection, ranked queue/match races, admission rollback, authoritative normal finish, duplicate completion deliveries and completion-outbox rollback. CI is required; local absence of a disposable PostgreSQL URL is not database acceptance.

## Completion recovery command

`npm run db:practice:recover` processes at most 100 candidates per invocation (internal method accepts 1–1000). It selects oldest finished EMPTY_HAND practice admissions without a completion receipt. Active games, forfeits and draws are excluded before the batch limit so they cannot starve eligible finishes. Each candidate passes the existing authoritative validator and commits its completion plus outbox atomically. Overlapping runs may scan the same candidate; the unique receipt prevents duplicate effects. Failures stop the run with a nonzero exit, retain earlier committed progress, and leave failed work eligible for retry. The CLI emits aggregate counts, never connection strings or private game state. Repeat until scanned is zero; investigate a persistent error rather than bypassing validation. A late concurrent finish may require another invocation even after an empty batch.

This is an operator command, not a scheduled consumer or task/reward/statistics projection. Scheduling remains open. Use only after the six existing migrations have been applied; no new migration is required. PostgreSQL acceptance passed in CI run40213911676 on runtime commit a92fda57b8816e9f7d863c5c98a9c31d4ed7e57d, including outbox rollback and concurrent recovery. Scheduling remains unimplemented.
