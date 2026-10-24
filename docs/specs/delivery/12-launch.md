# Frontend completion, observability and launch verification

Status: **Specified; not implemented**. Covers: All findings, low hygiene, M11 and release readiness. Dependencies and sequence: [delivery index](README.md). Product decisions: [rulebook](RULEBOOK.md).

### Frontend completion

Server reads/mutations live in typed API hooks; stores contain session/view state only. Remove local stats/rewards/claims, fake login reset and unused duplicated engines after replacements. Loading/empty/error/offline states on each screen. Home rank/trend use meaningful empty state; Lobby uses actual server phases; Tasks displays rulebook amounts/actions; Premium has plan/expiry/cancel/fail/pending; Wallet honest delivery statuses and masked phones. No internal legal architecture or compliance guarantees in product UI. Preserve390x844 design tokens and bottom navigation, and test keyboard/safe-area/low-end device behavior.

Self-host optional fonts/avatar fallback; Telegram/ad SDK failures degrade explicitly. Remove scaffold packages/metadata/scripts/duplicate lockfiles/debug logs; consistent import paths and accepted camelCase hooks. Add actual ESLint, strict TS, runtime response schemas and meaningful component/contract tests. Test ad modal keyboard focus/escape/focus return. Browser routes refresh via Vercel rewrites. Do not change frameworks or copy another project's insecure practices merely for naming consistency.

### Operations

Structured logs with request ID, event identity and safe error codes, no tokens/initData/full phone. Track queue latency, disconnects, rejected/duplicate actions, ad credits vs usage, premium order state, ledger reconciliation, payout age/float and month-close status. Alerts have owner and runbook. Graceful shutdown drains sockets/workers and preserves pending events. Backups, restore rehearsal, key rotation, dependency vulnerability review and incident containment procedures are required.

### End-to-end evidence matrix

Real Telegram Android/iOS: first login/referral, session expiry/reopen, practice start/no-fill/cap, ranked two-client game/forfeit/reconnect, daily tasks, day milestones including premium changes, Stars test purchase/refund, wallet funded provider delivery/failure/refund, paged history and monthly reviewed prize. Negative tests cover cross-user IDs/rooms, malformed/injected bodies, duplicates/races, boundary clocks, Redis/DB/provider failure, crash recovery and unsupported feature paths. Load targets are agreed and measured under representative infrastructure; a successful bundle build is not user-flow validation.

### Go-live gate

Every owning spec has passed tests and attached integration evidence; no open Critical/High; account/legal/finance/provider decisions recorded; monitoring/recovery/float owners named; staging uses separate credentials/data; production deployment is pinned to the tested commit and verified from browser through API/data. Invite-only beta precedes public rollout. Security is ongoing, with review and incident response, not a100% guarantee. Production merge/promotion is a separate concrete release action after these gates.

## Implementation record

Record commit, schema version, commands/results, integration evidence, unresolved decisions and recovery rehearsal here before marking complete. An acceptance criterion written above is not evidence that it passed.
