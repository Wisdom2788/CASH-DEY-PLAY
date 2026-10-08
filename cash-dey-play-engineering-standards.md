# Cash Dey Play — Engineering Standards & Implementation Guide

This document is the standing reference for any agent (or human) implementing
this codebase. It captures confirmed product rules, architecture, and
engineering standards agreed on for this project. Follow it as you would a
CONTRIBUTING.md — deviations should be deliberate and justified, not
accidental.

---

## 1. Project Overview

**Cash Dey Play** — a free-to-play Telegram Mini App built around Whot,
Nigeria's national card game. Nigeria-only launch. Users play matches,
complete daily tasks, and earn through non-gambling reward tracks (rewarded
video, login streaks, a skill-ranked monthly leaderboard, referrals).

**Critical legal design constraint — do not violate this while implementing
anything:** every mechanic is deliberately structured to avoid the
**consideration + chance + prize** combination that triggers Nigerian
gambling/lottery regulation. Concretely:

- Premium subscription may **never** affect odds, RNG, or leaderboard
  eligibility — convenience and cosmetics only.
- No purchasable odds-boosting, no "guaranteed card" mechanics, no paid
  extra chances at a prize.
- No withdrawal KYC / cash payouts anywhere — airtime/data top-up only.
- If an implementation task seems to require breaking any of the above to
  "make the feature work," stop and flag it — don't silently implement a
  workaround. This constraint is the single most important product
  guardrail in the whole system.

---

## 2. Confirmed Business Rules

### 2.1 Daily Login Streak

- **Personal, per-user window** — not calendar-anchored. Starts whenever a
  given user first logs in (or restarts after a reset).
- Window length: **30 days**.
- Only **logging in** counts as an active day — daily task completion is
  irrelevant to this specific bonus.
- **1 grace day** per window: exactly one missed calendar day is forgiven
  and does not break the streak.
- A **second** missed day (or any single gap of 2+ days at once) **resets**
  forward progress — the window restarts from the day of that login.
- Rewards already claimed before a reset are **never** clawed back — only
  forward progress resets.
- Implemented and fully tested in
  `src/qualification/login-streak/login-streak-engine.ts` — see §7 for
  current status.

### 2.2 Monthly Leaderboard

- **Calendar-month anchored** (resets each real month) — distinct from the
  login streak's rolling personal window. Do not conflate the two.
- Open to **all users**, top 100 ranked.
- Eligibility: complete daily tasks on **20 non-consecutive days** within
  the month, **and** win at least **15 matches** within that month.
- **No grace day** on this track — hard count, no forgiveness.
- Implemented and fully tested in
  `src/qualification/monthly-leaderboard/monthly-leaderboard-eligibility.ts`.

These are **two genuinely different rules**, not two configurations of one
shared engine — do not attempt to unify them into a single "qualification
engine" abstraction. That was tried conceptually earlier in design and
explicitly abandoned once the rules were confirmed to differ (grace-day
handling, calendar vs. rolling window, task-completion relevance).

---

## 3. Tech Stack

**Backend:** Node.js + Express + Socket.io, **TypeScript** (strict mode,
not plain JS), PostgreSQL, Redis, AdminJS for admin/fraud review.

**Frontend:** React + Vite + **TypeScript**, Telegram WebApp SDK
(`@twa-dev/sdk`), TanStack Query for server state, **Zustand** for local UI
state (chosen over Redux Toolkit — see §9.2 for reasoning).

**Why this stack:** matches the team's existing Node/Express/React
experience, avoids running two backend stacks at this budget/team size, and
Socket.io covers the real-time turn-based match requirement without needing
Go-level raw concurrency this team doesn't need yet.

---

## 4. Backend Architecture (Hybrid: Domain-Colocated + Thin HTTP Layer)

```
src/
├── qualification/
│   └── login-streak/
│       ├── login-streak.types.ts
│       ├── login-streak-engine.ts        ← pure logic, ZERO I/O, zero Express
│       ├── login-streak-engine.test.ts   ← colocated, no mocking needed
│       ├── login-streak.service.ts       ← ONLY file here allowed to touch the DB;
│       │                                    loads state via repository, calls the
│       │                                    engine, persists the result
│       ├── login-streak.service.test.ts  ← tests orchestration, mocks the repository
│       └── index.ts                      ← barrel file: exports ONLY what the
│                                             controller may call. The engine's raw
│                                             recordLogin()/claimLoginStreakBonus()
│                                             stay private to this folder.
│   └── monthly-leaderboard/  (same shape)
│
├── game/  rewards/  referrals/  payments/  payout/  admin/   (same shape as needed)
│
├── http/
│   ├── routes/            (maps URLs → controller functions)
│   ├── controllers/       (translates req/res ↔ domain calls — controllers are
│   │                        "dumb": glue only, never business logic)
│   └── middleware/
│       ├── auth.middleware.ts        (verifies Telegram initData HMAC)
│       ├── rate-limit.middleware.ts  (Redis-backed, per-user + per-IP)
│       ├── validate-request.middleware.ts  (Zod schema check, before controller)
│       └── error-handler.middleware.ts     (catches thrown domain errors → HTTP status)
│
├── db/
│   ├── models/          (pure data shape + ORM schema — nothing else)
│   └── repositories/    (query functions the domain calls through an interface —
│                          domain code never writes raw SQL)
│
└── app.ts               (Express app assembly + app.listen(...))
```

### 4.1 Hard boundary rule

**Domain folders (`qualification/`, `game/`, `rewards/`, etc.) never import
anything from Express.** No `Request`, `Response`, `req.body` inside them.
Only `http/` is allowed to know Express exists. This is what let the login
streak engine hit 100% test coverage with zero mocking — preserve it.

### 4.2 Why not a flatter `controllers/services/repositories/models/dto/exceptions`
split (horizontal layering)

Considered and rejected for this project's scale. It's the right call for a
larger team needing enforced boundaries and an API contract that evolves
independently of internal types — not for a 1–2 dev MVP. At this scale it
means touching 6+ top-level folders to ship one feature, and a flat
top-level `tests/` folder drifts out of sync with source over time. Domain
colocation (this doc's structure) keeps a feature's types, logic, tests,
and orchestration in one place, discoverable at a glance.

### 4.3 Why `service.ts` exists alongside the pure engine, not merged into it

A "service" in most Node codebases means business logic **and** I/O
together. Keep them split: `*-engine.ts` is pure (no DB, no framework),
`*.service.ts` is the only place in a domain folder allowed to call a
repository. Merging them loses the property that makes the engine trivial
to unit test exhaustively.

---

## 5. Frontend Architecture

```
src/
  api/            → one file per domain (auth.api.ts, matches.api.ts) — never one
                    giant api.ts. Builds on the existing axios service layer
                    (getService/postService/etc.) and toast-based message helpers.
  components/
    ui/           → Button, Card, EmptyState — no domain knowledge
    shared/       → things that know a bit about domain data (MatchResultBadge)
  config/         → routes.config.ts, env.config.ts, client.config.ts
  layouts/        → app/auth layouts, AppRoutes.tsx (NOT "container" — that name
                    collides with the container/presentational pattern term)
  hooks/          → reused-across-features hooks only (see §5.1) — promote a hook
                    here only once a second feature actually needs it
  helpers/        → status.helpers.ts, validation.helpers.ts — plural, never
                    "utils.ts" or "helpers.ts" as a dumping ground
  types/
    interfaces/
    enums/
  store/          → Zustand — one slice/file per domain (auth.store.ts, wallet.store.ts)
  features/       → one folder per feature, bundling its own components/hooks/api
                    calls used ONLY there; promote to /components or /hooks on reuse
```

### 5.1 `hooks/` — what belongs here vs. what doesn't

Belongs in `hooks/`: reused across ≥2 features, or wraps real lifecycle
concerns (subscriptions, timers, socket connections).

```
use-telegram-user.ts          → wraps Telegram WebApp SDK user/initData access
use-match-socket.ts           → owns Socket.io connection lifecycle: connect on
                                 mount, reconnect-and-resync from SERVER on remount
use-qualification-progress.ts → wraps the TanStack Query call for streak/leaderboard
                                 progress, shared by Home/Tasks/Leaderboard
use-debounced-value.ts        → generic utility, no domain knowledge
```

Naming: `use-` prefix, kebab-case filename, camelCase exported function.

### 5.2 State management split

- **TanStack Query** — all server-derived state (leaderboard data,
  qualification progress, match history). Never duplicate this into Zustand.
- **Zustand** (not Redux Toolkit) — local UI state only: auth session shape,
  active modal/toast state, wallet-balance display cache, theme prefs.
  Chosen over Redux Toolkit because once TanStack Query owns everything
  server-derived, the remaining UI-state surface is small enough that
  RTK's boilerplate (action types, slices, `configureStore`) buys process
  discipline this team doesn't need yet. Migrating a thin Zustand layer to
  RTK later, if the team or state surface grows, is a contained refactor —
  not a rewrite.

---

## 6. Engineering Principles (applied concretely, not just named)

- **DRY** — reuse only where two things are *actually the same rule*, not
  just similarly shaped. (This is why login-streak and monthly-leaderboard
  are NOT forced into one shared engine — see §2.)
- **YAGNI** — no message queue, no microservices split, no multi-region
  deploy, no i18n scaffolding (India/Pakistan are explicitly cut from
  scope), no empty abstraction layers "for later." Empty domain folders may
  exist as placeholders for planned work; empty *files* with no logic should
  not.
- **Clean code** — a name should tell you what it is without opening the
  function body. `utils.ts`, `helpers.ts` (as a dumping ground), `temp`,
  `data`, `handleStuff()` are banned. See §8 for the full naming table.

---

## 7. Testing Standards (TDD, non-negotiable)

**Workflow:** write the failing test first (red), confirm it fails for the
*expected* reason (module/function doesn't exist yet — not a typo or syntax
error), then write the minimum implementation to make it pass (green).

**Coverage bar:** pure domain logic (engines) should reach ~100% coverage —
they have no I/O, so there's no excuse for gaps. Service-layer
tests (with mocked repositories) and controller-level integration tests
(via `supertest`) are a different tier — see below.

**Test tiers, and what each one is allowed to know about:**

| Tier | File | Tests | Mocks |
|---|---|---|---|
| Domain engine | `*-engine.test.ts` | Business rules, pure logic, edge cases | None — pure functions need none |
| Service | `*.service.test.ts` | Orchestration (load → call engine → save) | Repository only |
| Controller | `*.controller.test.ts` | HTTP wiring: status codes, response shape, auth rejection | Service layer |

**Do not re-test business rules at the controller tier** — that's the
engine test's job. Duplicating it there is wasted maintenance surface for
no extra safety.

**Test placement:** colocated next to the file under test
(`login-streak-engine.ts` beside `login-streak-engine.test.ts`), never a
separate mirrored `tests/` tree — colocation means a file move/rename takes
its test with it, and a missing test file is visually obvious in the
explorer.

**Every test suite must cover:** the happy path, at least one boundary
condition (exactly-at-threshold, one-below-threshold), at least one
negative/invalid-input case (and assert the *specific* error class thrown,
not just "it throws"), and any documented edge case from the business rule
itself (e.g. "does a second isolated 1-day gap reset, even though each gap
alone was within grace?" — this exact ambiguity was caught by writing the
test before the implementation, and should be treated as the model case for
why test-first matters here).

---

## 8. Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Variables/params | camelCase, intention-revealing, no abbreviations | `qualifyingWindowStart`, not `qws` |
| Booleans | prefixed `is`/`has`/`can`/`should` | `hasUsedGraceDay`, `isWithinQualifyingWindow` |
| Functions | verb + object, describes what it does | `calculateWeightedLeaderboardScore()` |
| Classes/Interfaces/Types | PascalCase, domain nouns | `QualificationWindow`, `LoginStreakState` |
| Constants | SCREAMING_SNAKE_CASE, true constants only | `MAX_OPTIONAL_VIDEOS_PER_DAY = 5` |
| Files | kebab-case, named for contents | `login-streak-engine.ts`, not `utils.ts` |
| Folders | by domain/feature, not by type | `qualification/`, not a type-only `services/` spanning unrelated domains |
| DB tables/columns | snake_case, plural tables | `task_completions`, `reward_payouts` |
| React hook files | `use-` prefix, kebab-case | `use-match-socket.ts` |

**Banned outright:** `x`, `data`, `temp`, `utils.ts`/`helpers.ts` as
dumping grounds, `handleStuff()`, any name requiring the reader to open the
function body to know what it does.

---

## 9. Security Standards

- **Auth:** verify Telegram `initData` HMAC signature server-side on
  *every* request. Never trust a client-supplied user ID.
- **Rate limiting:** Redis-backed (not in-memory — in-memory limiters
  silently stop working once you run more than one Node instance), keyed
  per-user and per-IP.
- **Input validation:** Zod schema validation on every request
  body/param, before it reaches business logic.
- **Idempotency keys** on any endpoint that can trigger a payout (milestone
  claim, leaderboard settlement) — prevents double-claiming via retry,
  double-tap, or replay.
- **Audit log table** for every reward/payout event: who, when, amount,
  reason, triggering rule. This is the fraud-review and dispute-resolution
  evidence trail — non-negotiable given real money (airtime) is involved.
- **Server-authoritative game state:** every Socket.io event is
  re-validated server-side exactly like a REST call. A WebSocket is not a
  trusted client any more than an HTTP request is.
- **Standard hardening:** Helmet, CORS locked to the Telegram webview
  origin only, parameterized queries/ORM (never raw string SQL), secrets
  via env vars/secret manager, never committed.

---

## 10. Performance & Optimization Standards

- **Indexing:** composite indexes on `task_completions(user_id,
  completed_on)`, `matches(user_id, created_at)` — the rolling-window and
  monthly-count queries depend on these.
- **Incremental counters over full recompute:** maintain
  `active_days_count`/`grace_used`-style fields updated on write, rather
  than recalculating from 30 days of raw rows on every qualification check.
- **No N+1 queries** — one query per qualification check, not one per
  day-in-window.
- **Leaderboard reads from Redis ZSETs**, never recomputed live from
  Postgres per-request.
- **Horizontal scaling:** stateless Express instances behind a load
  balancer + `socket.io-redis-adapter` (Socket.io does not scale
  horizontally without a shared adapter — without it, users in the same
  match can land on different server instances and never see each other's
  moves).
- **PgBouncer** in front of Postgres — many Node instances hitting Postgres
  directly exhausts connections before CPU becomes the bottleneck.
- **Background jobs** (monthly leaderboard settlement, payout batches) via
  a queue (BullMQ on Redis) — never inline in a request handler. Keeps the
  API responsive and gives retries instead of a lost payout on a mid-request
  crash.
- **Circuit breakers** on ad-network callbacks — an Adsgram/Monetag outage
  should not cascade into failing unrelated user requests.
- **Frontend:** code-split by screen, lazy-load Leaderboard/Premium/Profile
  so the core game loop (first screen most users hit, often on a low-end
  Android device on Nigerian mobile data) loads fast. Bundle size matters
  more here than on a typical Western-market webapp.
- **Deliberately NOT doing yet (YAGNI):** Kafka, microservices split,
  multi-region deployment, premature caching layers beyond Redis. Revisit
  only once real DAU data justifies it.

---

## 11. State Persistence Strategy (frontend)

A Telegram Mini App is a webview Telegram can suspend or kill at any time —
do not assume the JS runtime survives between sessions.

1. **Auth/session** — persist via Telegram `CloudStorage` (per-account,
   survives device switches), falling back to `localStorage` for local dev
   outside Telegram. Client-persisted token is never a trust boundary —
   every request is still re-verified server-side against `initData`.
2. **In-progress match state** — do NOT persist and replay game state
   client-side. Persist only `matchId`/`roomId` locally; on reconnect, ask
   the server for current state — the server is already the authoritative
   source (§9), so reuse that instead of building a second, riskier
   client-side persistence path.
3. **Qualification/leaderboard progress** — TanStack Query's persister
   plugin may cache this for instant-on-reopen UX, but it is a read cache
   only. Mark it stale and refetch in the background. **Never** let a
   payout, milestone claim, or leaderboard rank be decided from cached
   client state — that decision always round-trips to the server.

**General rule:** persist *identifiers and UX conveniences* (session token,
matchId, cached-for-display data) — never persist *derived truth* (win
counts, qualification status, points balance) client-side as authoritative.

---

## 12. Error Handling Pattern

Custom error classes, using TypeScript parameter properties
(`constructor(public readonly x: T)` auto-declares and assigns a class
field from a constructor parameter — no manual `this.x = x` needed).
Message is built *inside* the class from raw data, and that same raw data
is also exposed as a typed public property — this gets both a guaranteed
consistent message across every throw site AND structured data an error
handler/logger can use without string-parsing:

```typescript
export class InvalidLoginDateError extends Error {
  constructor(public readonly providedDate: string) {
    super(`Invalid login date "${providedDate}". Expected strict ISO calendar format YYYY-MM-DD.`);
    this.name = "InvalidLoginDateError";
  }
}

export class BackdatedLoginError extends Error {
  constructor(
    public readonly providedDate: IsoCalendarDate,
    public readonly lastLoginDate: IsoCalendarDate,
  ) {
    super(`Login date "${providedDate}" is earlier than the last recorded login "${lastLoginDate}".`);
    this.name = "BackdatedLoginError";
  }
}

export class LoginStreakNotYetQualifiedError extends Error {
  constructor(public readonly state: LoginStreakState) {
    super(
      `Cannot claim login streak bonus: only ${state.consecutiveLoginDaysCount} of ${LOGIN_STREAK_WINDOW_LENGTH_DAYS} required days completed.`,
    );
    this.name = "LoginStreakNotYetQualifiedError";
  }
}

export class LoginStreakBonusAlreadyClaimedError extends Error {
  constructor() {
    super("Login streak bonus has already been claimed for this window.");
    this.name = "LoginStreakBonusAlreadyClaimedError";
  }
}
```

Always set `this.name` explicitly — stack traces and logs then show the
specific error class, not generic `Error`, which matters when grepping
production logs for a specific failure type. Always throw a specific error
class, never a bare `Error` or `null`/`false` return on failure — callers
should be able to `error instanceof SpecificError` rather than parse a
message string.

**Known pending update:** `LoginStreakNotYetQualifiedError` was changed to
take the full `state` object instead of just `currentDaysCount` — the
throw site in `login-streak-engine.ts`
(`claimLoginStreakBonus`) needs updating from
`throw new LoginStreakNotYetQualifiedError(state.consecutiveLoginDaysCount)`
to `throw new LoginStreakNotYetQualifiedError(state)` to match.

---

## 13. Backend Project Setup (from zero)

```bash
mkdir cash-dey-play-backend && cd cash-dey-play-backend
npm init -y

# Pin TypeScript explicitly — installing "typescript" unpinned can pull a
# version newer than what ts-jest officially supports (peer range <7).
npm install --save-dev typescript@5.6.3 ts-node ts-jest jest @types/jest @types/node
```

**Run all commands from inside `cash-dey-play-backend/`** — `npx` resolves
local binaries relative to your current directory; running from a parent
folder makes it silently fall back to downloading unrelated packages
(including a joke package literally named `tsc` that is NOT the TypeScript
compiler) instead of using your project's installed tools.

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "rootDir": "src",
    "outDir": "dist",

    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,

    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "coverage"]
}
```

`jest.config.js` (plain JS, not TS — deliberate exception: Jest reads its
own config before TS tooling is bootstrapped, so a `.ts` config adds
complexity for a file with no application logic in it):

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.test.ts"],
  coverageDirectory: "coverage",
  clearMocks: true,
};
```

`package.json` scripts:

```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "build": "tsc",
  "typecheck": "tsc --noEmit"
}
```

**Note:** `tsc --noEmit` will report "No inputs were found" until at least
one real `.ts` file exists under `src/` — this is expected, not a config
bug, and resolves itself once real files are added.

---

## 14. Current Implementation Status

**Done, tested, 100% coverage:**
- `src/qualification/login-streak/login-streak.types.ts`
- `src/qualification/login-streak/login-streak-engine.ts` + test suite (13 tests)
- `src/qualification/monthly-leaderboard/monthly-leaderboard.types.ts`
- `src/qualification/monthly-leaderboard/monthly-leaderboard-eligibility.ts` + test suite (11 tests)

**Not yet built (next slices, in suggested order):**
1. Update `LoginStreakNotYetQualifiedError` call site per §12.
2. `login-streak.service.ts` + `index.ts` barrel (orchestration layer per §4).
3. `db/models` + `db/repositories` for login-streak persistence.
4. `http/controllers/login-streak.controller.ts` + route + middleware wiring.
5. Repeat the service/repository/controller slice for monthly-leaderboard.
6. Frontend project init (Vite + React + TS), mirroring §13's setup discipline.

**Explicitly out of scope for this build:** India/Pakistan markets, any
paid odds-boosting mechanic, cash/crypto withdrawal, full KYC.

---

## 15. Open Items Requiring Non-Engineering Follow-Up

Not implementation blockers, but should not be forgotten:

1. Monthly Game Leaderboard mechanic needs sign-off from a Lagos-based
   gaming/tech lawyer before scaling its payout pool beyond a small initial
   size.
2. Live ad network integration (Adsgram/Monetag/Tads.me) needed to validate
   real eCPM/fill-rate assumptions before committing to payout rates at
   scale.
3. Premium subscription revenue does not currently appear anywhere in the
   financial model, despite Premium users being exempt from ad views and
   still collecting milestone airtime — this needs a real conversion-rate
   assumption before launch economics can be trusted.
