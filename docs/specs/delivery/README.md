# Delivery specifications and implementation ledger

Updated 25 October 2026. Base: step-1-loopholes at 275a2e1. Scope: close C1–C7, H1–H11, M1–M13 and frontend hygiene, then deliver a functional v1. This directory supersedes conflicting implementation instructions in the older build-plan, audit and reference draft. Preserve those documents as historical evidence.

Current checkbox tracker and requirement validation: [DELIVERY-CHECKLIST.md](DELIVERY-CHECKLIST.md).

## What done means

A spec is not an implementation. “Implemented locally” is not a passing hosted deployment. “Contained” means an unsafe path is disabled, not that its feature works. A finding is closed only when its acceptance tests pass at the relevant layer and the required integration is verified. No claim of absolute security is made.

| Order | Specification | Dependency | Current status |
|---|---|---|---|
| 01 | [Containment and deployment baseline](01-containment.md) | Existing Step 1 | Implemented; unit/HTTP/PostgreSQL tests and both Vercel preview builds passed on e526b8d |
| 02 | [Identity, time, migrations and contracts](02-foundations.md) | 01 | Core implemented and CI verified (122 backend /26 frontend); production rehearsal pending |
| 03 | [Ledger, audit and idempotency](03-ledger.md) | 02 | Core integrated into development; production rehearsal and reward-owner wiring pending |
| 04 | [Entitlements, tasks and referrals](04-entitlements.md) | 02–03 | Core implemented in PR5; source integrations and staging verification pending |
| 05 | [Whot engine and practice bot](05-game-engine.md) | 02 and agreed game rules | Core implemented; PostgreSQL CI and owner rule decisions pending |
| 06 | [Verified ads and practice limits](06-ads-practice.md) | 04–05 and provider contract | Specified; external provider capability unresolved |
| 07 | [Realtime and ranked matchmaking](07-ranked.md) | 04–06 | Specified; not implemented |
| 08 | [Streak milestones and referral qualification](08-rewards.md) | 03–07 | Specified; not implemented |
| 09 | [Stars premium payments](09-payments.md) | 03–04 and staging bot | Specified; not implemented |
| 10 | [Airtime payout delivery](10-payouts.md) | 03,08 and provider account | Specified; not implemented |
| 11 | [Leaderboards, prizes and operations](11-leaderboards.md) | 07–10 | Specified; finance inputs unresolved |
| 12 | [Frontend completion and launch gates](12-launch.md) | All prior stages | Specified; not implemented |

Branch policy: [approved reusable workflow and staging prerequisites](BRANCH-WORKFLOW.md).

Implementation proceeds in this order. Independent UI cleanup can accompany a stage, but cannot change unimplemented features to “done”. Keep each stage reviewable; never merge a partial financial protocol merely because its happy path works.

## Requirements precedence

[Rulebook](RULEBOOK.md) records the latest repository decisions from build-plan Part II. Original business answer messages were not supplied. Open business/game/provider items stay open; recommendations are not silently approvals. Requirements change by an explicit versioned decision entry with affected tests and migration implications.

## Traceability: every original finding

| Finding | Owning specifications | Required closure evidence |
|---|---|---|
| C1 | 01,02,12 | Production defaults, dev-only bypass, token/identity negative tests and production configuration check |
| C2 | 01,03,04,06 | Repeated/concurrent task insert yields one award; ad proof authenticated and replay-safe |
| C3 | 01,05,07 | Retired client win endpoint; only trusted game settlement writes results |
| C4 | 01,04,09 | No free upgrade; sanitize legacy grants; verified paid order changes entitlement once |
| C5 | 01,03,08–11 | Real reward credit, delivery, refunds, caps and reconciliation |
| C6 | 01,03,08 | Real PostgreSQL races/fault injection prove claim/ledger/audit/idempotency atomicity |
| C7 | 05–07,12 | Two real clients finish server-authoritative matches |
| H1 | 02 | Collision/orphan-tested identity migration, one canonical ID and foreign keys |
| H2 | 02,08,12 | Real streak API, correct window restart, no local claim authority |
| H3 | 02,05,07 | Match/participants/events schema and real recent-opponent query |
| H4 | 02,04,06–11 | Lagos midnight/month-boundary tests in both SQL and application |
| H5 | 02,04,11 | Eligible monthly snapshots, agreed score/tie-breaks, prize settlement |
| H6 | 02,04,08 | Verified start parameter, durable first-login attribution, working share link |
| H7 | 04,09 | Expiry-derived premium and revoked historical free flags |
| H8 | 01,06 | No simulated rewards; authenticated provider event with replay/correlation evidence |
| H9 | 09 | Test-environment Stars purchase, webhook verification and refund |
| H10 | 04,08 | Auto-ready video tasks plus Claim for exempt players; complete-day tests |
| H11 | 01,04,06,07 | No fake success; real allowance, cooldown and profile writes or disabled control |
| M1 | 01,02,07,10 | Shared-IP fairness, Redis outage policy, TTL cleanup, accurate retry time |
| M2 | 01,02,12 | Edge schemas on every route/event, strict TS without unsafe type assertions |
| M3 | 02–12 | Controllers delegate business logic; repositories own SQL; feature tests |
| M4 | 01,02,07,10,11 | Executable CI/migrations, compose, game sockets, payout worker and review tooling |
| M5 | 01,02,12 | Scoped short JWTs, session policy, storage/XSS and revocation strategy |
| M6 | 03,10,11 | One integer money unit and checked provider/display conversion |
| M7 | 01,06 | Retired fake callback; single-use concurrent ad-credit consumption |
| M8 | 01,02,04 | Future/invalid signed data rejection, safe provisioning and referral consistency |
| M9 | 02,04,10,11,12 | Runtime-validated shared contracts; nullable empty states; paged status history |
| M10 | 02,10,12 | Masked phone/UI/logs; sensitive fields have authorized access only |
| M11 | 12 | Self-host optional assets; essential provider SDK failure states |
| M12 | 02,04,08,11 | Single server authority; remove duplicate client rule engines |
| M13 | 02,08,12 | Stores retain session/view state only; no local money/stats/claim mutation |
| Low: package/scaffold | 01,12 | Rename package, remove unused packages/metadata, one lockfile and real README |
| Low: scripts/logging/imports | 01,12 | Delete one-offs; remove sensitive/debug logs; consistent imports and labels |
| Low: tests/lint/types | 01,02,12 | Frontend runner, strict mode, ESLint and UI contract tests |
| Low: hook names | 12 | camelCase useX is accepted; do not rename based on withdrawn finding |

Later-plan findings C8/H12/H13/M14 map to 07/05/01+12/02+12 respectively. Reference-draft errors are addressed in the owning specifications; the reference draft must never be executed as source code.

## Stage evidence ledger

Stage 01 code at commit e526b8d419a029fc60a5e932c60d52e9e6658af9 passed **105/105 backend tests, including all eight real PostgreSQL cases**, in [GitHub Verify run 40129750572](https://github.com/Wisdom2788/CASH-DEY-PLAY/actions/runs/40129750572). The frontend passed23 tests, typecheck and build in the same run. Both Vercel contexts cash-dey-play and cash-dey-play-ckkt reported success for that commit. Local default build works without an ad ID and cannot play simulated ads. CI fails when required DB validation is unconfigured. These are preview/build and automated-test results, not real-device gameplay or provider delivery evidence. This later documentation update changes no runtime code.

## Release policy

Before production: all stages accepted, no unresolved Critical/High findings, data migrations rehearsed on a restored copy, real provider sandbox and real Telegram flows passed, operational owners named, account access/counsel/finance decisions recorded, dependency/security review completed, and a staged rollback/recovery exercise passed. New evidence can reopen a finding. Do not label a disabled capability functional.

## Foundations evidence and next designs

[Verify run40135745497](https://github.com/Wisdom2788/CASH-DEY-PLAY/actions/runs/40135745497) passed122 backend tests including all15 PostgreSQL cases, strict frontend typecheck, ESLint,26 frontend tests and build. Both Vercel previews passed on d746cab. [The next critical-flow design](03-12-critical-flow-design.md) defines authority, queue reservation, SQL/Redis consistency, game command ordering, idempotent reward settlement, Stars payment and payout recovery before those features are implemented. These later capabilities are not delivered yet.
