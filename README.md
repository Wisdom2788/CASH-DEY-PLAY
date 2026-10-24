# Cash Dey Play

Nigeria-focused Telegram Mini App: React/Vite frontend and Express/PostgreSQL backend.

**Work in progress.** Real-time matches, verified ad rewards, Stars payments and airtime delivery are not complete. Unsupported money/reward mutations stay disabled. Do not interpret a successful build as launch approval.

## Delivery source of truth

Start at [the implementation specifications](docs/specs/delivery/README.md). Every audited finding has an owner stage, acceptance tests and an explicit implementation status. Older planning documents are historical reference.

## Local setup

Use Node.js 24 and npm. From each app directory run `npm ci`.

- Backend: copy `.env.example` to `.env`, configure local PostgreSQL, run `npm run db:migrate` on a fresh empty development database, then `npm run dev`. Existing databases require the baseline/rehearsal procedure below.
- Frontend: configure `VITE_API_URL` and run `npm run dev`.
- Optional disposable services: `docker compose up -d`. The compose database is for tests only.

## Validation

```sh
cd cash-dey-play-backend
npm run typecheck
npm test -- --runInBand
npm run build
# Real database tests require a disposable database, not your production database:
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/cash_dey_play_test REQUIRE_DB_TESTS=true npm test -- --runInBand
cd ../cash-dey-play-frontend
npm run typecheck
npm test
npm run build
```

GitHub Actions supplies disposable PostgreSQL and requires the integration tests. Without TEST_DATABASE_URL, local output explicitly reports skipped database tests. Database tests use an isolated schema and never truncate public tables.

## Vercel frontend

Set **Root Directory** to `cash-dey-play-frontend`, framework Vite, Node 24, install `npm ci`, build `npm run build`, output `dist`. Root Directory is a project setting, not a vercel.json property. The frontend vercel.json supplies SPA rewrites, including /wallet refreshes. Public VITE_API_URL must point to the backend with /api suffix. Preview and Production environments each need their own value.

Missing Adsgram configuration no longer fails the static build or triggers fake ads. Ad rewards are intentionally unavailable until their server verification contract is implemented. Do not put TELEGRAM_BOT_TOKEN, database credentials, JWT secrets or provider keys in VITE_ variables.

The two original failed Vercel deployments have not been diagnosed from authenticated build logs in this workspace. A locally reproduced ad-setting build failure was removed safely; do not claim this proves every hosted failure is resolved.

## Backend deployment

The backend runs as an always-on Node process with PostgreSQL and Redis. Build `npm ci && npm run build`; start `npm start` (dist/app.js). Production requires explicit database, Redis, Telegram bot token and a random JWT secret of at least 32 characters. Configure CORS_ORIGIN to the exact frontend origin. Developer auth is honored only with NODE_ENV=development and an explicit flag; test and production cannot use it.

GET /healthz returns a minimal liveness response. It does not certify database readiness. Migration/deployment readiness is specified in delivery stage 02 and is not implemented yet.

## Operational boundary

This branch changes JWT lifetime/claims; existing tokens must be replaced by reopening the app in Telegram. Claim transaction changes require no schema migration. Existing insecure premium grants, identity migration, money ledger and payout reconciliation remain assigned work. Roll forward or disable affected routes during an incident; do not revert to known unsafe reward endpoints.

## Foundations migration (stage02)

Read [the design](docs/specs/delivery/02-foundations-design.md) before [the deployment runbook](docs/specs/delivery/02-migration-runbook.md). Runtime PostgreSQL access remains pg; Prisma7.10.1 manages versioned SQL migrations. New code requires the foundations schema first. Never run migration reset against live data. Production migration/backup access is not assumed from repository access.

The frontend now uses a memory-only session and real server login progress. TypeScript is pinned to the stable6.x JavaScript-API compiler supported by typescript-eslint; the previous7.x compiler was incompatible with the lint toolchain. npm run lint now runs ESLint separately from typecheck.
