> Historical reference. Current ordered implementation contracts and status: [delivery specifications](delivery/README.md). Conflicting instructions in this document are superseded there.

# Cash Dey Play — Build Order and Implementation Plan (v1.0)

*Prepared 20 October 2026. This document supersedes Sections 4, 7 and 9 of the Project Audit (decisions, build order and questions); the Audit remains the record of findings and is referred to by finding number (C1, H2 and so on). It contains: the final decisions, the v1.0 rulebook, the target architecture, the comparison with the Scrella engineering standard, the new design for ranked matchmaking and lobby states, and the step-by-step build plan with tests-first lists and acceptance criteria. Non-technical readers: Sections 1 to 3 and 9 are written for you. Engineers: every step in Section 7 lists files, data, events, tests and a finish line.*

## 1. Overview

**What changed since the Audit**

- The business answered the 17 questions. Section 2 records every answer as a decision, and flags nine assumptions we had to make where an answer was silent or ambiguous (A1 to A9).
- The Scrella repository zip arrived and was audited against Cash Dey Play (Section 5).
- The Telegram settings are confirmed (Appendix A). The referral bug is explained and the fix is known.
- **New findings** (below). The most important is **C8: there is no matchmaking at all.** A design for it is in Section 6.

**New findings since the Audit**

| ID | Level | Finding |
| --- | --- | --- |
| C8 | Critical | **No matchmaking, presence or ranked queue exists.** The server's start, move, draw and forfeit endpoints are all stubs that return nothing and say 'handled via Socket.io', but no Socket.io server exists. The app's lobby panel says 'Searching for opponent...' permanently, and its search timer (searchSeconds) is never connected to anything. There is no code that finds who is online, pairs two players, asks them to confirm, handles a no-show, or reconnects a dropped player. Ranked play, and therefore wins, the leaderboard and prizes, cannot work. |
| H12 | High | **The app's match model would leak hidden cards.** The MatchState type carries the full draw pile and discard pile as lists of cards. If the server sent that, a modified client could read the upcoming cards. The server must send counts only, plus each player's own hand. |
| H13 | High | **Hosting gap.** The app is deployed on Vercel (static hosting). Live matches need a backend that keeps long-lived WebSocket connections, which Vercel's serverless functions do not. The backend host is not yet chosen. Also, the app ships a Netlify-style redirects file but no Vercel rewrite file, so opening or refreshing a deep link such as /wallet will probably show a 404 on Vercel (to verify: open https://cash-dey-play-ckkt.vercel.app/wallet directly in a browser). |
| M14 | Medium | The frontend's TypeScript settings are not strict, there is no ESLint configuration and no lint script (the Scrella project has ESLint but is not strict either). The frontend tsconfig also carries scaffold leftovers (experimentalDecorators, allowJs, Jest types with no Jest installed). |
| Correction | n/a | Audit item L9 (camelCase hook file names) is withdrawn: the real Scrella project also uses camelCase hook files (useModalZIndex.ts). Cash Dey Play's useCountdown.ts matches the standard. |

**Scope of v1.0**

| In v1.0 | Deferred to v2.0 (business decision) |
| --- | --- |
| Practice matches against a bot; ranked matches between real players; daily tasks; login streak and rewards; monthly game leaderboard; Community Builder referrals; premium via Telegram Stars; airtime wallet and payouts; video and banner ads | Friends mode; a second premium tier (Premium+); data bundles; any per-referral cash; priority matchmaking (not in the business's list of premium differences) |

**How to read the labels.** D1 to D17 are Decisions. A1 to A9 are Assumptions (needing a yes or no). O1 to O15 are Open items (Section 9). C, H, M, L are findings from the Audit. Step 0 to Step 13 is the build order. R1 to R11 are the requirement numbers from the Audit.

## 2. Decisions (final) and assumptions

| ID | Decision | Status |
| --- | --- | --- |
| D1 | **Practice** is played against a bot and is unranked. **Ranked** is played between real players. **Friends** mode is deferred to v2.0 (hide it in v1). | Decided 20 Oct |
| D2 | Wins count for **ranked matches only**. | Decided |
| D3 | Premium players do **not** need the 25 practice matches, at any level (leaderboard, Day-30 claim, referee qualification). Regular players do. The business's position: this is the only difference that matters and it is not a large legal advantage. | Decided (see the note below) |
| D5 | Premium players' two video tasks complete automatically, but the player must still tap **Claim** to finish each task. | Decided |
| D6 | The reward tier that applies is the tier **at the moment of claiming**. | Decided |
| D7 | Everyone can play at most **3 ranked matches per day**. After the 2nd, regular players face a cooldown that they can skip by watching a video. Premium players have no cooldown. Premium does **not** get extra ranked matches. | Decided |
| D8 | Premium costs ₦1,000 per month or ₦2,700 for 3 months, each converted to a round number of Telegram Stars, **reviewed every week**. | Decided (mechanics in A3) |
| D9 | Every completed practice match counts toward the 25, **with or without an ad being available**. | Decided |
| D10 | A regular referee must complete the 25 practice matches (and the PRD's 3-task rule). A premium referee is exempt from the 25. | Decided (see A4) |
| D11 | Banner ads show for everyone, including premium players and on the ads-free day. In-match placement is the builder's call. | Decided (see A5) |
| D12 | No second premium tier in v1 (Premium+ is for v2.0). | Decided |
| D13 | Airtime only. No data bundles. | Decided |
| D14 | No cash per referral. Referrals earn points, and Community Builder prizes come from the monthly prize pool. | Decided |
| D15 | (Closed by D7.) Premium has no extra ranked matches. | Closed |
| D16 | **Ranked queue empty policy.** Recommended: never fill a ranked match with a bot. If no opponent is found, offer to keep waiting, play Practice, or try later. | **Recommended, needs confirmation** |
| D17 | **Rematch and same-opponent limits.** Mutual consent; normal allowance/cooldown; two starts per opponent per Lagos day; three requests per rolling hour. | **Owner approved25–26 October2026; RULEBOOK is authoritative** |
| Other | The airtime float is funded manually by the business. Wallet stays under the Profile tab. Minimum redemption ₦50, maximum ₦100,000. The Mini App short name and web address are recorded in Appendix A. | Decided |

**Note for the lawyer review (D3, D7).** The business describes premium's only difference as the 25-match requirement. The complete list of differences is in Section 3.1 and also includes: no ad before practice and unlimited practice; no cooldown after the 2nd ranked match; and larger streak airtime rewards (₦350 against ₦150 per 30 days). Counsel should review the complete list, because the PRD (Section 8) and the Profile screen currently say premium never changes who qualifies for a prize. This is not legal advice.

**Assumptions to confirm (reply yes or no to each)**

| ID | Assumption | Why we assumed it |
| --- | --- | --- |
| A1 | The ads-free day behaves like premium for the two video tasks: they become 'ready' automatically and the player taps Claim. | Answer 6 mentioned premium only. |
| A2 | The ranked cooldown is 1 hour (the PRD's figure), starts after the 2nd ranked match, and the daily count and cooldown reset at 00:00 Lagos time. | PRD Section 3; answer 3 gave no length. |
| A3 | Premium plans are one-time Stars purchases that add days; Star amounts are rounded up to the next 5 and re-checked weekly; the price is locked when the invoice is created. Today's estimate: 55 Stars (1 month) and 150 Stars (3 months). | Answer 10 did not confirm one-time versus recurring. |
| A4 | A premium referee must still satisfy the PRD's '3 tasks on 3 separate days' rule; only the 25 practice matches are waived. | Answer 13 covered regular referees only. |
| A5 | No banner during an active match, beside the wallet redeem form, or beside a payment button. | Answer 9 left in-game placement to the builder; the others were unanswered. |
| A6 | The ₦100,000 maximum is per redemption, and the provider's own per-transaction limit is also respected. | Answer 14 did not say per what. |
| A7 | The daily task 'Win 1 match' counts **ranked** wins only. | Follows D2. |
| A8 | A practice match is 'completed' when it reaches a normal end. A match abandoned or forfeited early does not count. | Answer 5 said 'completed'. |
| A9 | A 'task day' (for the 20-day leaderboard rule) is a Lagos day with at least one completed daily task. | PRD Section 4 and the current code. |

## 3. The v1.0 rulebook (one source of truth)

This section is what the build implements. It replaces the conflicting versions in the PRD, the engineering standards and the code (Audit Section 5.6). When PRD v2 is written, copy this section.

### 3.1 Regular and premium, side by side

| Topic | Regular | Premium |
| --- | --- | --- |
| Price | Free | ₦1,000 per month or ₦2,700 for 3 months, paid in Telegram Stars |
| Video ads | Before each practice match; to skip the ranked cooldown; the two daily video tasks | None |
| Banner ads | Yes | Yes |
| Practice matches (vs bot) | 5 per day, each starting after a video ad | Unlimited, no ad |
| Ranked matches (vs players) | 3 per day; cooldown after the 2nd, skippable with a video | 3 per day; no cooldown |
| 25 practice matches | Required (leaderboard, Day-30 claim, referee qualification) | **Not required** |
| Daily video tasks | Watch the video | Ready automatically; tap Claim |
| Streak rewards | Day 14: ₦50 airtime. Day 20: an ads-free day. Day 30: ₦100 airtime | Day 10: ₦50. Day 20: ₦100. Day 30: ₦200 |
| Cosmetics | Standard | Premium badge and exclusive card backs |
| Faster matchmaking queue | Not offered in v1 | Not offered in v1 |

### 3.2 Practice matches

- The opponent is a server-run bot, clearly labelled as a bot. Practice never counts toward wins.
- A regular player may **start** up to 5 per day. A rewarded video plays before each one. If no ad is available the player may still play (D9).
- A completed practice match counts toward the 25 (regular players) whether or not an ad played (D9, A8).
- The count resets at 00:00 Lagos time.

### 3.3 Ranked matches

- Played between two real players, with the server running the game.
- At most 3 per day for everyone (D7). Regular players: after the 2nd, a cooldown (A2) that a video skips. Premium players: none.
- A win or loss is recorded only by the game server. Leaving a match is a forfeit and counts as a loss. A match nobody finishes because of a technical fault is voided and does not use up the daily allowance (Section 6.11).
- Wins here are the 15 needed for the monthly leaderboard.

### 3.3b Daily tasks (four tasks, up to 200 points)

Watch the daily login video; watch the match-unlock video; win 1 ranked match (A7); complete all (bonus). Points are non-monetary. Premium players' video tasks are ready automatically and are completed by tapping Claim (D5, A1).

### 3.4 Login streak (personal window)

- A personal 30-day window starts on the player's first login, on any day, with 1 grace day. Logging in is enough to count.
- Rewards follow the table in 3.1 and are decided by the tier **when the player claims** (D6).
- Day 30 for regular players also needs 25 completed practice matches inside the same window.
- A claimed reward is credited to the wallet immediately and is never taken back. After Day 30, a new window starts at the next login.
- The ads-free day starts when claimed and ends at 23:59:59 Lagos time the same day. It removes video ads (not banners).

### 3.5 Leaderboards

- **Monthly game leaderboard (top 100).** Calendar month in Lagos time. To be eligible: 20 task days (A9), 15 ranked wins, and, for regular players, 25 completed practice matches in the month (D3). Rank by weighted score = win rate x (matches played / 50), as the PRD defines. No grace day.
- **Community Builder.** Prize tiers and qualification as in PRD Section 7, with the referee rules in 3.6.
- Prize pool, payout tiers (8/9/14/18/24/27%) and the 25%-of-net-revenue pool are as in PRD Section 6 and need finance inputs (O12). The top 20 are reviewed by an admin before payout.

### 3.6 Referrals

Link format: https://t.me/Cash\_dey\_play\_bot/Cash\_Dey\_Play?startapp=\<referral code>. A referral is recorded once, on a new player's first sign-in. It qualifies when the referee completes all three daily tasks on 3 separate days within 30 days (PRD), and, for regular referees, 25 completed practice matches (D10). A qualified referral gives +150 points to both players. There is no cash per referral (D14).

### 3.7 Premium

One tier (D12). Two durations (1 month, 3 months) bought with Stars; each purchase adds days to the expiry date (A3). Premium ends when the expiry date passes; a refund ends it immediately. States: none, active, expiring soon (3 days or fewer), expired.

### 3.8 Ads

Video ads are rewarded videos served by the ad network and **verified by our server**, never by the phone alone. Banners appear on every page except as limited by A5. Premium players see banners but no video ads.

### 3.9 Wallet and airtime

Airtime only (D13). Rewards credit instantly. A redemption is a minimum of ₦50 and a maximum of ₦100,000 (A6). Each redemption has a status: Pending (yellow), Success (green) or Failed (red, with a refund entry). Phone numbers are masked in the app. The business funds the provider float manually. There is no bank cash-out.

### 3.10 Time

Every day boundary, daily limit and monthly window uses Africa/Lagos time (00:00 to 23:59:59), in code and in database queries.

## 4. Target architecture

### 4.1 The system on one page

```
 Telegram app (the player's phone)
   |  opens the Mini App: https://t.me/Cash_dey_play_bot/Cash_Dey_Play
   v
 Frontend: React app, static files ---- Vercel: https://cash-dey-play-ckkt.vercel.app
   |  HTTPS requests (REST)                |  live connection (WebSocket, Socket.io)
   v                                       v
 Backend: Node + Express + Socket.io   <---- must run on a host that keeps long-lived connections (O1)
   |-- Postgres : users, matches, wallet ledger, payments, referrals, prizes
   |-- Redis    : ranked queue, who is online, live match state, rate limits, job queue
   |-- Worker   : payouts, referral and leaderboard jobs, reconciliation (BullMQ)
   |-- Telegram : bot webhook for Stars payments, /start, /terms, /paysupport
   |-- Ad network (Adsgram): calls our server after a video is watched
   '-- Airtime aggregator : payout API; float funded manually by the business
```

### 4.2 Hosting and deployment facts

- **Frontend:** already on Vercel. Add a rewrite file so every route falls back to index.html (H13), and keep the Telegram Web App URL in BotFather pointed at the production address.
- **Backend:** needs a host that supports always-on Node processes and WebSockets, Postgres, Redis and a second worker process. Choose a region close to Lagos. **This is open item O1.**
- **Separate bots per environment.** Create a second bot in BotFather for staging, with its own token and its own webhook, so test payments never touch production. Payments are first tested in Telegram's test environment.
- **Cross-origin settings.** The backend's allowed origin (for REST and for Socket.io) must be the Vercel address. The bot webhook address must be HTTPS and protected by a secret token.
- **Secrets** (bot token, JWT secret, provider keys) live only in the host's secret store, never in the repository or in chat.

### 4.3 Backend structure and rules

Every feature is a folder with the same layers: **controller or socket handler** (receives the request) calls a **service** (holds the rules) which calls a **repository** (the only place with SQL). No SQL in controllers. Inputs are validated at the edge with Zod. Errors are typed and return a stable error code. Anything that pays, credits or claims runs inside one database transaction together with its ledger entry, audit record and duplicate-protection record.

| Module | Owns |
| --- | --- |
| auth | Telegram sign-in check, tokens, dev shortcut (development only) |
| users | Profile and **entitlements** (one server answer to 'what can this player do?') |
| tasks | Daily tasks, Claim, ad-verified completion |
| streaks | Personal window, milestone claims, ads-free day |
| practice | Daily limit, ad gate, bot matches, counting toward the 25 |
| ranked | Daily allowance, cooldown, queue, pairing, ready check, penalties, rematch |
| game-engine | Whot rules and the bot, as pure code with no database or network |
| matches | Match records and the event log |
| realtime | Socket gateway, who is online, session state and resume |
| ads | Ad credits and the ad network callback |
| wallet | The append-only ledger (credits and debits) |
| payouts | Airtime provider adapter, payout states, worker, reconciliation |
| premium | Stars orders, bot webhook, expiry, refunds |
| referrals | Link capture, qualification |
| leaderboards | Eligibility, ranking, monthly close, prizes |
| admin | AdminJS screens: fraud review, pending payouts, flags |
| platform | Rules config, Lagos clock, idempotency, rate limits, logging, errors |

### 4.4 Data model overview

Counters such as 'wins this month' are **derived** from match records with indexed queries and frozen into a snapshot when the month closes, instead of being stored and maintained by hand (this is what went wrong in H5).

| Table | Purpose |
| --- | --- |
| users | One row per player; one ID format everywhere (Step 2) |
| premium\_orders, premium\_subscriptions | Stars purchases; expiry date (no yes/no flag) |
| ad\_free\_days | One row per ads-free day |
| daily\_task\_state | Per player per Lagos day per task: AVAILABLE, AUTO\_READY, CLAIMED |
| login\_streaks, streak\_milestone\_claims | Personal window; one claim row per milestone |
| matches, match\_players, match\_events | Every match (practice and ranked), who played, and an append-only move log for replay and disputes |
| ranked\_daily\_usage, ranked\_penalties | Allowance used today; cooldown end; no-show lockouts |
| ad\_credits | Verified video credits (purpose, expiry, used) |
| wallet\_ledger, airtime\_payouts | Money in and out; payout state machine |
| referrals | Referrer, referee, progress, qualified date |
| leaderboard\_results, prize\_awards | Month-end snapshots and prize credits |
| idempotency\_keys, reward\_audit | Duplicate protection and audit trail (exist today) |

### 4.5 One rulebook, served by the server

The app must never keep its own copy of a rule (M12). The server exposes **GET /config/rules** and the app reads it once at start:

```json
{
  "practice": { "regularDailyLimit": 5 },
  "ranked": { "dailyLimit": 3, "cooldownAfterMatch": 2, "cooldownMinutes": 60 },
  "streak": {
    "regular": [{ "day": 14, "airtimeNgn": 50 }, { "day": 20, "adFreeDay": true }, { "day": 30, "airtimeNgn": 100, "requiresPracticeMatches": 25 }],
    "premium": [{ "day": 10, "airtimeNgn": 50 }, { "day": 20, "airtimeNgn": 100 }, { "day": 30, "airtimeNgn": 200 }]
  },
  "premium": { "plans": [{ "id": "PREMIUM_1M", "stars": 55, "days": 30 }, { "id": "PREMIUM_3M", "stars": 150, "days": 90 }] },
  "wallet": { "minRedemptionNgn": 50, "maxRedemptionNgn": 100000 }
}
```

The values above are the rulebook in Section 3 (Star amounts are the A3 estimates). A test fails the build if the file and the rulebook disagree.

### 4.6 Settings (environment variables)

| Where | Setting | Notes |
| --- | --- | --- |
| Backend | NODE\_ENV, DATABASE\_URL, REDIS\_URL, JWT\_SECRET, TELEGRAM\_BOT\_TOKEN, ALLOW\_DEV\_AUTH\_BYPASS | Exist today. Production is the default; the secret must be 32+ characters; the bypass works only when NODE\_ENV is explicitly development (Step 1). |
| Backend (new) | TELEGRAM\_WEBHOOK\_SECRET, ADSGRAM\_REWARD\_TOKEN, provider keys, SENTRY\_DSN | Secret store only. |
| Frontend | VITE\_API\_URL, VITE\_ADSGRAM\_BLOCK\_ID, VITE\_ADSGRAM\_DEBUG | Exist today. The production build fails if the ad block ID is empty (H8). |
| Frontend (new) | VITE\_SOCKET\_URL, VITE\_TELEGRAM\_BOT\_USERNAME (Cash\_dey\_play\_bot), VITE\_TELEGRAM\_MINIAPP\_SHORT\_NAME (Cash\_Dey\_Play) | Used to build the referral link. |

### 4.6b Observability and operations

Structured logs with a request ID and the player ID (no phone numbers). Dashboards and alerts for: ranked queue depth and time-to-match (p50 and p95), matches started and completed, forfeits and reconnects, ad credits issued versus used, Stars orders, payout success rate, pending and failed payouts, and the provider float balance. Weekly: Star price review. Daily: float check and reconciliation sign-off.

## 5. Comparison with the Scrella engineering standard

The Scrella partners portal zip was read in full (138 files, no tests). Two cautions first.

**Three documents disagree, so the code is the standard.** The architecture document inside the Scrella repository describes the older Scrella Admin project (Redux, folders named containers/, data\_types/ and features/). The actual partners-portal code uses Zustand, container/, types/ and views/. The Cash Dey Play standards document says layouts/. As the project owner stated, **the partners-portal code is the standard**; documents that differ are corrected, not copied.

|  | Scrella Admin document | Scrella partners-portal code | Cash Dey Play code |
| --- | --- | --- | --- |
| Pages | features/ | **views/** (with PageFragments/) | features/ |
| Layout and routing | containers/ | **container/** | container/ (matches) |
| Types | data\_types/ | **types/interfaces, types/enums** | types/interfaces, types/enums (matches) |
| State | Redux Toolkit | **Zustand (stores/)** | Zustand (store/) |

### 5.1 Side-by-side

| Area | Scrella partners portal (actual) | Cash Dey Play | Verdict and action |
| --- | --- | --- | --- |
| Folders | api, assets, components, config, container, helpers, hooks, stores, types, views | api, assets, components, config, container, features, helpers, hooks, **qualification**, store, types | Rename features to views and store to stores. The qualification folder holds business rules that belong on the server; delete the frontend copy in Step 8. |
| Request helpers | api/methods.api.ts: getService, postService, postFormDataService, putService, deleteService, CustomDeleteService, patchService | api/client.ts: get, post, put, delete, patch | Rename to methods.api.ts. postFormDataService and CustomDeleteService are not needed yet; record that as intentional. |
| Axios client | config/client.config.ts; token from the session store; shows a global loading overlay on every request | Same file; adds the development sign-in header | Keep Cash's version. **Do not copy the global loading overlay**: a live game polls and updates constantly. |
| Endpoint constants | config/\<domain>.endpoints.ts with typed maps (for example IWalletEndpointMap) | One API\_ROUTES object with UPPER\_SNAKE keys inside constant.config.ts | Split into \<domain>.endpoints.ts typed maps. |
| Other constants | constant.config.ts: colours, token keys, NAIRA symbol, API\_BASE\_URL | API\_ROUTES lives there as well | Align. |
| Routes | routes.config.ts: MainNavLinks and routes | One default routes object | Acceptable; add typed helpers when routes take parameters. |
| Query hooks | XQueryKeys object; useGetX(params?, queryOptions, options); typed options; retry only for server errors, at most 2 | Same shape but no params and no retry rule | Add params, include them in the key, add the retry rule. |
| Mutation hooks | useX(mutationOptions?, options?) | Same | Matches. |
| Interfaces | I prefix (IWithdrawPayload, ILeaderboardOverview) in types/interfaces/\<domain>.types.ts | No prefix (WalletTransaction, TasksState); only the general types have I | Rename with the I prefix (mechanical). |
| Enums | One file, allEnum.types.ts; names end in Enum (TransactionStatusEnum) | whot.enums.ts; no suffix (MatchMode); server statuses written as loose strings ('SUCCESS' or 'PENDING') | Use XxxEnum names. Mirror server statuses as enums (string-valued, because our server sends strings; Scrella's sends numbers, a justified difference). |
| Stores | Session, layout and loading only | The auth store holds the user, the streak and **business logic** (claimStreakReward, upgradeToPremium, updateUserStats) | **Violation (M13).** Stores keep the session token and view state only. |
| Helpers | helpers/\*.helpers.ts | Same naming; whot-deck.helpers.ts is game logic | Naming matches. Game logic moves to the server engine in Step 5. |
| Pages | views/\<Domain>/\<Page>.tsx plus PageFragments/ for pieces | features/\<domain>/\<Page>View.tsx, no fragments; up to 446 lines; the lobby (277 lines) holds Recent Opponents inline | Extract fragments. Required before the lobby work in Section 6. |
| Components | Cards/, Loaders/, modals/ | shared/, ui/ | Align names or record as intentional. |
| Container | AppRoute.tsx with lazy pages and Suspense; layouts | AppRoute.tsx with 8 lazy pages and Suspense; AppLayout.tsx | Matches. |
| Hooks | camelCase files (useModalZIndex.ts) | useCountdown.ts | Matches. |
| Realtime | One singleton helper class plus a hook (SignalR in Scrella) | config/socket.config.ts singleton | Move to helpers/socketService.helpers.ts plus a hook; event names in constants. |
| Environment | VITE\_APP\_BASE\_URL | VITE\_API\_URL | Optional rename; keep .env.example in step. |
| Errors | Central handleAxiosError; a 401 logs out and goes to login | Same function; a 401 clears the session; also handles 429 and timeouts | Matches (the Telegram difference is justified). |
| TypeScript | Not strict; unused-variable checks off | Not strict; extra scaffold options | Go further than Scrella: turn on strict because this app handles rewards and money. |
| Lint | ESLint flat config (typescript-eslint, react-hooks, react-refresh); npm run lint | None; the lint script only type-checks | Add the Scrella ESLint config. |
| Tests | None | Engine tests only; no runner | Cash is ahead. Add Vitest and Testing Library for hooks, stores and screens. |
| Error tracking | Not installed in the partners portal (the Admin document mentions Sentry) | None | Add Sentry (our own addition, beyond the standard). |

### 5.2 What Cash Dey Play already mirrors well

The request helpers and their names, unwrapping of the server's response envelope, query-key objects, hook signatures, the cookie-persisted session store, lazy routes with Suspense, the container folder name, helper file naming, message helpers, and the shared general types (Iloader, IOnComplete, FormErrors and IBaseResponse are copied unchanged).

### 5.3 Where Scrella itself is inconsistent (so we copy with judgement)

Its documents drift from its code (message.helper.ts versus message.helpers.ts, containers versus container, Redux versus Zustand). Store files are named four different ways (auth.stores.ts, layout.store.ts, loadingStore.ts, walletStore.ts). Types use 'any' widely. There is no strict mode, no tests, and a global loading overlay. We copy the folder shape, the request helpers, the hook signatures and the naming, and we improve on strictness, tests and state rules.

### 5.4 The alignment work package (Step 2e)

Do this once, before the feature steps, as small no-behaviour-change changes, each with the type-check green:

1. Rename features to views and store to stores; rename api/client.ts to methods.api.ts.
2. Split API\_ROUTES into \<domain>.endpoints.ts typed maps.
3. Rename interfaces with the I prefix and enums with the Enum suffix; add server-mirrored status enums (wallet entry status, premium state, match phase).
4. Add params and the retry rule to the query hooks.
5. Remove business logic and derived truth from the auth store (claimStreakReward, upgradeToPremium, updateUserStats, loginStreak).
6. Extract page fragments (starting with the lobby and wallet).
7. Turn on strict TypeScript; add ESLint; remove scaffold leftovers (package name, scaffold packages, experimentalDecorators, allowJs, Jest types, the Gemini metadata file, the two one-off scripts, the duplicate lockfile).
8. Add a Vercel rewrite file and move fonts and the stock avatar image to self-hosted or generated assets (M11).

### 5.5 Rules for all new frontend code

1. Server data is read and changed only through hooks in api/. No requests inside components.
2. Stores hold the session and view state only, never rules or money.
3. Live events enter through one socket helper that updates a store and refreshes the relevant queries.
4. A page is a composition of fragments; keep files under about 250 lines.
5. Every number that is a rule comes from GET /config/rules.
6. Statuses show colour, text and an icon, never colour alone. Touch targets are at least 44 pixels.
7. Names: I-prefixed interfaces, XxxEnum enums, camelCase useX hooks, \*.helpers.ts, \*.endpoints.ts.
8. Every screen defines loading, empty, error and offline states.
9. No assets from other websites except an allow-list; fonts are self-hosted; avatars use the Telegram photo or generated initials.

## 6. Ranked matchmaking, lobby states and match flow

### 6.1 The gap, and the direct answer

**Question:** is there efficient logic, across the app and the server, to find active players who are ready to play each other? **Answer: no, none of it exists** (finding C8). What is there instead:&#32;

- The server's start, move, draw and forfeit endpoints return nothing and say they are 'handled via Socket.io'. No Socket.io server exists.
- The app calls those endpoints, then navigates to a game screen that has no match to show.
- The lobby's 'Searching for opponent... Estimated wait: under 10s' is a fixed panel. The search timer in the game store is never started or read.
- Nothing records who is online, who is waiting, who was paired, who accepted, who dropped, or whose turn it is.

**A note on 'scanning for online users'.** Efficient systems do not scan. Scanning every online user each time someone taps Ranked costs more as the player count grows and does not even say who wants a match. Instead, a player who wants a ranked match **joins a queue**, and the server **pairs players from the queue**. Joining costs almost nothing, and pairing only ever looks at the oldest few waiting players. 'Who is online' is tracked separately and is only used for the online dot and for rematches.

### 6.2 How established ranked systems work, and what we take from them

The pattern is the same across shooters and battle games such as Call of Duty, PUBG, Valorant and Counter-Strike. We copy the parts that suit a two-player card game.

| Stage in those games | What it does | Cash Dey Play v1.0 |
| --- | --- | --- |
| Checks before queueing | Rank, ban, party and limit checks | Daily allowance (3), cooldown, penalties, already in a match |
| Queue ticket with a timer | A running timer and a Cancel button; cancelling is free | Yes |
| Pairing by skill, region and wait | The search window widens as time passes | Oldest-first with fairness rules now; skill windows later (see 6.4) |
| 'Match found' ready check | Both players confirm within about 10 seconds | Yes, 10 seconds |
| Penalties for no-shows | Short queue lockouts that grow with repeats | Yes (6.11) |
| Server-run match | The server decides; phones only send intentions | Yes |
| Reconnect window | The match waits briefly for a dropped player | Yes, 30 seconds each time |
| Post-match summary and 'play again' | Result, rewards, and quick re-queue or rematch | Yes |
| Bots | Usually casual modes only | Practice only. **Never in ranked** (D16). |

The PRD asks for 'random matchmaking' and bans any favourable choice of opponent. Pairing the oldest compatible waiting player satisfies that: nobody can pick, buy or avoid an opponent.

### 6.3 End to end: from tapping Ranked to the result

```
 PLAYER A (app)                    SERVER (Redis + Postgres)                   PLAYER B (app)
     |  tap Ranked                          |                                          |
     |-- queue:join ----------------------->| checks: signed in, not in match,         |
     |                                      | allowance left, no cooldown, no lockout  |
     |<-- queue:joined {ticket} ------------| ticket added to the ranked queue         |
     |<-- queue:status every 5s ------------|              (B joins the same way) <----|
     |                                      | matchmaker tick: pairs A and B atomically|
     |<-- match:offer {opponent, 10s} ------|-------------- match:offer {opponent} --->|
     |-- match:accept --------------------->|<------------------------ match:accept ---|
     |<-- match:started {your view} --------|-------- match:started {your view} ------>|
     |-- match:action {play card} --------->| validates, applies, bumps version        |
     |<-- match:view {version, view} -------|-------------- match:view {version, view}->|
     |        ...turns continue; the server owns the clock and the cards...             |
     |<-- match:ended {WIN, rewards} -------|-------------- match:ended {LOSS} -------->|
     |-- rematch:request ------------------>|-------------- rematch:requested --------->|
```

If anything goes wrong the server answers with an error code (6.5), and the app shows the matching state (6.7).

### 6.4 The matchmaking algorithm

**Data in Redis** (all keys expire so nothing is left behind after a crash):

```
ZSET  mm:ranked:queue        score = time joined (ms)     member = userId        oldest = first
HASH  mm:ticket:{userId}     ticketId, joinedAt, socketId
STR   presence:{userId}      socketId        TTL 45s, refreshed every 15s (the online dot)
HASH  match:{matchId}        authoritative state + version      (copied to Postgres as events)
STR   user:active:{userId}   matchId or offerId               (one active thing per player)
SET   mm:recent:{userId}     opponents met today              (expires at Lagos midnight)
```

**Each second, one matchmaker loop does this:**

```ts
const oldest = await redis.zrange('mm:ranked:queue', 0, 49);          // only the oldest 50 are ever examined
for (let i = 0; i < oldest.length; i++) {
  for (let j = i + 1; j < oldest.length; j++) {
    const a = oldest[i], b = oldest[j];
    if (!isCompatible(a, b)) continue;                                   // see rules below
    if (await pairAtomically(a, b)) { await createOffer(a, b); break; } // one winner per pair even if two loops run
  }
}
```

```lua
-- pair_atomically.lua: remove both tickets or neither
if redis.call('ZSCORE', KEYS[1], ARGV[1]) and redis.call('ZSCORE', KEYS[1], ARGV[2]) then
  redis.call('ZREM', KEYS[1], ARGV[1], ARGV[2]); return 1
end
return 0
```

**Two players are compatible when:** they are different people; both are still connected; neither is locked out; both still have ranked allowance and no cooldown; and they have not exceeded the same-opponent limit today (D17, PRD Section 9). Among compatible players the oldest waiting ticket is served first. That keeps waits fair and the choice random with respect to who the opponent is.

**Why this is efficient.** Joining and leaving cost O(log N). Each tick examines at most the oldest 50 tickets, so the work per tick is fixed no matter how many players wait. Several backend servers can run safely because pairing is atomic; only one matchmaker loop needs to run at a time (a leader lock, or a single repeating job). Skill-based windows (a rating from past ranked results, widening with wait time) are a later improvement once the queue is regularly busy; with a small player base they would only lengthen waits.

**Wait estimate.** The server records how long recent matches waited, per hour of day. It sends the median as the estimate only when it has enough samples (proposed: at least 5); otherwise the app shows the elapsed time and no estimate. The estimate is never invented.

**Ready check.** An offer lasts 10 seconds. If both accept, the match starts. If one declines or times out, the other player goes **back into the queue with their original join time** (no lost place), and the decliner is penalised (6.11).

### 6.5 The live protocol (what the app and server say to each other)

**From the app to the server**

| Event | Payload | Purpose |
| --- | --- | --- |
| session:resume | none | 'Where am I?' on every connect and after a refresh; the server answers with session:state |
| queue:join | mode: RANKED | Enter the queue; acknowledged with a ticket or an error code |
| queue:leave | none | Cancel searching |
| match:accept, match:decline | offerId | Answer the ready check |
| match:action | matchId, actionId, type (play card, draw, choose suit), cardId, suit, expectedVersion | One move; actionId makes retries harmless; expectedVersion rejects stale moves |
| match:forfeit | matchId | Leave and lose |
| rematch:request, rematch:respond | opponentId, or requestId and accept | Rematch (6.10) |

**From the server to the app**

| Event | Payload | Purpose |
| --- | --- | --- |
| session:state | phase, ticket, offer, match view, allowance, cooldown, lockout | The truth after connect or refresh; the app draws exactly this |
| queue:joined, queue:status, queue:timeout, queue:left | ticket; elapsed and estimate; none | Searching feedback |
| match:offer, match:offer\_update, match:offer\_cancelled | opponent summary and deadline; who accepted; reason and whether you were re-queued | Ready check |
| match:started, match:view | your view only | The game. **Your own hand, card counts, the top card, whose turn it is, the turn deadline (a server time). Never the draw pile or the opponent's cards (H12).** |
| match:opponent\_connection | disconnected or reconnected, grace deadline | Disconnect handling |
| match:ended | WIN, LOSS or VOID, reason, rewards, allowance | Result |
| rematch:requested, rematch:declined, rematch:expired | requestId, opponent | Rematch |
| session:replaced | none | The same account opened on another device |
| error | code, message, retry-after | See below |

**Error codes:** NOT\_AUTHENTICATED, ALREADY\_IN\_QUEUE, ALREADY\_IN\_MATCH, RANKED\_DAILY\_LIMIT (with reset time), RANKED\_COOLDOWN (seconds left), QUEUE\_LOCKED (seconds left), OFFER\_EXPIRED, STALE\_MOVE, ILLEGAL\_MOVE, NOT\_YOUR\_TURN, REMATCH\_NOT\_ALLOWED (with reason), RATE\_LIMITED, MAINTENANCE.

### 6.6 States

**The player's phase (decided by the server, drawn by the app)**

```
            tap Ranked                          pair found                accepted by both
  IDLE ------------------> SEARCHING ---------------------> OFFER ---------------------> STARTING ---> IN_MATCH ---> RESULT
   ^   (allowance, cooldown, |  |                              |  | declined / timeout                       |            |
   |    lockout checked)      |  | cancel                       |  '--> back to SEARCHING (opponent) or IDLE (you)  | forfeit /  | rematch / lobby
   |                          |  '--> IDLE                      |                                           | disconnect |
   |                          '--> NO_OPPONENT (after the long timeout) --> IDLE                              '--> RESULT  |
   '---------------------------------------------------------------------------------------------------------------------'
```

**Match record states:** IN\_PROGRESS, COMPLETED (a winner exists), ABANDONED (a player forfeited or timed out for good: counts as a loss), VOID (technical fault, nobody's fault: no result and no allowance used).

**Overlay conditions** that can appear on top of any phase: RECONNECTING (my connection dropped), OPPONENT\_DISCONNECTED (with a countdown), CONNECTION\_FAILED, MAINTENANCE.

**Rule for refresh and recovery.** On every app start, and after every reconnect, the app asks the server for session:state and draws it. If the player was searching, they are still searching; if an offer is open, it is shown with the time left; if a match is running, the app goes straight back into it. Nothing is rebuilt from the phone's memory.

### 6.7 What the lobby looks like in each state

**Q: What happens when the player taps Ranked Match?** The app does not guess. It sends queue:join. The server checks (signed in, not already in a match, allowance left, no cooldown, no lockout) and answers with a ticket or an error code. The screen then shows exactly the state the server reports.

**Lobby, idle.** The new 'Ranked today' chip, the cooldown banner (regular players only, after the 2nd match), two mode cards (Friends is hidden in v1), Recent Opponents, Invite Friends, and a banner ad.

```
+-------------------------------------+
| <-   Matchmaking Lobby          :   |
+-------------------------------------+
| Ranked today  (o)(o)( )   2 of 3 left|   allowance chip: 3 dots
| Cooldown 42:10                       |   regular, after the 2nd match only
| [ Watch a video to play now ]        |
+-------------------------------------+
| PRACTICE vs BOT                      |   regular: 'Today: 3 of 5 left'
| Play a bot - does not count for wins |   premium: 'Unlimited'
+-------------------------------------+
| RANKED MATCH                         |
| Play a real player - counts for      |
| the leaderboard                      |
+-------------------------------------+
| RECENT OPPONENTS   (see 6.8)         |
+-------------------------------------+
| [ INVITE FRIENDS ]                   |
| [ banner ad ]                        |
+-------------------------------------+
```

**Searching.** A search card appears **above Recent Opponents**, as you suggested. The Ranked card shows 'Searching...' and is disabled; the Practice card stays tappable, but starting a practice match cancels the search, so the app asks the player to confirm first.

```
+-------------------------------------+
| RANKED MATCH     Searching...        |
+-------------------------------------+
|        ((  radar animation  ))       |
|    Searching for an opponent...      |
|    0:14      Estimated wait ~20s     |   estimate shown only when known
|    4 players searching now           |   real number, only when 2 or more
|        [ Cancel search ]             |
+-------------------------------------+
| RECENT OPPONENTS        (dimmed)     |   rematch buttons disabled
+-------------------------------------+
```

**Match found (ready check).** A full-screen sheet. Accept is the only primary action; there is no Cancel here (cancel only exists while searching).

```
+-------------------------------------+
|            MATCH FOUND               |
|   [avatar]  Chidi                    |
|   This month: 12 wins of 20          |
|             ( 10 )   ring countdown  |
|          [   ACCEPT   ]              |
|             Decline                  |
+-------------------------------------+
 after Accept:  'Waiting for Chidi...'   then   'Dealing cards...'  then the game
```

**Other states**

| State | What the player sees |
| --- | --- |
| No opponent found | Card: 'No opponent found right now. Fewer players are online at this hour.' Buttons: Search again, Play Practice vs bot. Shows busy times if the business configures them. |
| Allowance used up | 'You have played 3 of 3 ranked matches today. Resets at 00:00 Lagos time.' Button: Play Practice. |
| Cooldown (regular) | Banner with the countdown and 'Watch a video to play now'. Never shown to premium players. |
| Lockout (missed a match) | 'Ranked is paused for 2:00 because a match was missed.' |
| Reconnecting | Amber bar at the top: 'Reconnecting...'. The search or match continues on the server. |
| Opponent disconnected | Over the game: 'Chidi disconnected. Waiting 0:30...' then a win by forfeit if they do not return. |
| Playing elsewhere | If the player opens another page while searching, a small pill stays above the bottom bar: 'Searching... 0:14  Cancel'. If a match is running: 'Return to match'. |
| Same account on another device | 'You opened Cash Dey Play on another device.' |

**Components (Scrella naming: page fragments under views/Lobby/PageFragments/)**

| File | Purpose |
| --- | --- |
| Lobby.tsx | The page; only arranges fragments |
| RankedAllowanceChip.tsx, CooldownBanner.tsx | Allowance dots; cooldown and video skip |
| ModeCard.tsx | Practice and Ranked cards (one component, two uses) |
| SearchingCard.tsx, NoOpponentCard.tsx | Searching and timed-out states |
| MatchOfferSheet.tsx | Ready check |
| RecentOpponentsCard.tsx, RecentOpponentRow.tsx | Recent opponents |
| RematchRequestSheet.tsx | Incoming rematch request |
| container/SearchPill.tsx, container/ConnectionBanner.tsx | Always-visible search pill and reconnect bar |

Supporting files: stores/matchmaking.store.ts (phase, deadlines; written **only** by live events and session:state), api/ranked.api.ts and api/practice.api.ts (query hooks), helpers/socketService.helpers.ts (singleton), hooks/useMatchmakingSocket.ts, config/socketEvents.config.ts (event names), config/ranked.endpoints.ts.

### 6.8 Recent Opponents

**Q: should it say 'No recent opponents' until the player has played someone, and when does an opponent appear?** Yes. The card stays visible at all times, including while searching, and shows an empty state until the player has **finished a ranked match against a real player**. The opponent is added when the match ends (the list refreshes on match:ended). The player's current opponent is never listed; they appear in the ready-check sheet and the game.

- **Contents:** the last 5 different real players the player met in ranked matches, most recent first. Practice bots never appear. Data comes from GET /ranked/opponents/recent?limit=5.
- **Row:** avatar, username, the result of the last match (W or L from the player's side), 'time ago', an online dot, and a Rematch button.
- **Empty state:** title 'No ranked opponents yet'; text 'Finish a ranked match and your opponent will show up here so you can challenge them again.' (This replaces 'No recent opponents'.)
- **Rematch button disabled, with the reason shown:** opponent offline; opponent in a match; no ranked matches left today; cooldown active; you are searching; rematch limit reached for this opponent today.
- **Privacy:** usernames and avatars only; no exact last-seen times, only an online dot.

### 6.9 What if nobody is online?

**Q: do players then play bots?** **Not in ranked** (D16). Wins in ranked decide who qualifies for prizes. A bot hidden as a person would be deceptive, and a bot match labelled as a bot would not be a ranked win, which makes it Practice. So the fallback is Practice, which counts toward the 25.

| Time searching | What the player sees |
| --- | --- |
| 0 to 30 seconds | 'Searching for an opponent...' with the timer and, when known, an estimate |
| 30 seconds | The search continues, and two options appear under it: **Keep waiting** (default) and **Play Practice vs bot** (cancels the search after confirming) |
| 120 seconds | The search stops: the 'No opponent found' card with Search again and Play Practice |

These times are proposals to tune in the closed beta. **Expect thin queues at launch:** with only 3 ranked matches per player per day, the number of players searching at any moment is small. The business can help with levers that cost nothing in the code: announce a daily ranked prime time so players arrive together, and later (v1.1) send a bot message when an opponent is ready, which needs the player's permission to message them.

### 6.10 Rematch

**Q: the player taps a recent opponent to rematch; then what?**

```
 RESULT screen or Recent Opponents  -->  [Rematch]
    |
    v   REMATCH_REQUESTING  (button spinner: 'Waiting for Chidi... 15s')
    |
    |   Chidi sees a sheet on whatever page they are on:
    |   'Tolu wants a rematch.   [Accept]  [Decline]   (15s)'
    |
    |-- accepted: server re-checks both players (allowance, cooldown, limit) --> STARTING --> IN_MATCH
    |             (no second ready check, both already agreed)
    '-- declined or no reply: the requester sees 'Chidi declined' or 'No response'; no penalty to anyone
```

**Rules (D17, owner approved25–26 October2026):** both players must be online, not in a match, and have ranked allowance and no cooldown. A rematch counts as a normal ranked match for both players and uses up their daily allowance. At most **2 ranked matches against the same opponent per day** (so one rematch), and at most **3 rematch requests per hour** per player. A rematch cannot be used to skip a cooldown. Pairs who keep meeting and trading wins are reported to the admin (PRD Section 9: same-opponent rate limiting and win-trading detection).

### 6.11 Disconnects, timeouts and penalties (owner decisions25–26 October2026)

| Situation | Rule |
| --- | --- |
| Cancel while searching | Free |
| Decline or ignore the ready check | First time in 24 hours: a warning. Then Ranked is paused for 2 minutes, then 5, then 15. The count resets after 24 hours without a miss. The other player is put back in the queue with their original join time. |
| Connection drops during a match | The persisted turn clock continues. Reconnection resumes the current authoritative state without resetting the deadline. No disconnect pause was approved. |
| Turn timer runs out | Approved whot-v1:30-second timeout forfeits the match. |
| Player closes the app | The same as a dropped connection. |
| Forfeit | A loss. It counts as played and uses up the daily allowance. |
| Both players disconnect, or a server fault | Disconnects never automatically VOID/refund a match. A verified technical incident requires audited operator review; compensation tooling remains a separate gate. |
| Server restarts | Resume from durable PostgreSQL match snapshots/events; reconstruct Redis hints/queue state. An unrecoverable technical incident requires operator review, not an automatic refund inferred from missing Redis data. |
| Same account on two devices | The newest connection wins; the old one is told (session:replaced). |

### 6.12 Fairness and abuse

- Pairing is first-come and random with respect to the opponent; nobody can choose, buy or avoid one.
- Same-opponent limits and win-trading reports (D17); device fingerprinting and multi-account detection (PRD Section 9, not built yet).
- The PRD's automation check: our bot waits a random 1 to 3 seconds before each move, and humans who answer faster than half a second, repeatedly, are flagged.
- Rate limits on every live event (for example joining the queue and sending moves) and schema checks on every payload; too many requests return RATE\_LIMITED.
- **No hidden information leaves the server** (H12). Every move is logged as an event so a disputed match can be replayed from its shuffle seed.
- The top 20 of the monthly leaderboard are reviewed by an admin before prizes are paid.

### 6.13 Scale and infrastructure

Launch with one backend instance; it can hold thousands of live connections. When a second instance is needed, add the Socket.io Redis adapter and sticky routing, and keep a single matchmaker loop. The app uses the WebSocket transport only (as it does today) and reconnects with exponential back-off and jitter. **Proposed load-test targets (to agree before Step 13):** hold 5,000 simultaneous connections; time to pair under 2 seconds (95th percentile) whenever two compatible players are waiting; zero cases of one player paired twice across a million simulated pairing attempts.

### 6.14 Telegram-specific behaviour (availability checked against current documentation)

- **Closing confirmation** (enableClosingConfirmation, from Bot API 6.2) while searching, in the ready check and in a match, so an accidental close asks first.
- **Vertical swipes off** (disableVerticalSwipes, from Bot API 7.7) during a match so a swipe does not minimise the app mid-turn.
- **Activated and deactivated events** (from Bot API 8.0): when the app is minimised the app pauses its own timers, and when it returns it immediately asks the server for session:state.
- **Permission to message the player** (requestWriteAccess, from Bot API 6.9) is only needed for the v1.1 'opponent ready' notification.
- Check each feature's availability on the player's Telegram version before using it, and degrade quietly if it is missing.

### 6.15 Test plan for matchmaking and the match flow

1. **Pure functions first (unit):** compatibility check, penalty ladder, wait estimate, allowance and cooldown arithmetic at Lagos midnight.
2. **Pairing under concurrency (Redis integration):** 1,000 simultaneous pairing attempts never put one player in two pairs; a crashed matchmaker loses no ticket.
3. **Two real clients (socket integration):** join, offer, accept, start, play to the end, result, rematch, each error code.
4. **Chaos:** drop one or both connections at every phase (searching, offer, just started, mid-turn, result) and assert the state recovers or the match is VOID.
5. **Fairness simulation:** regular and premium players get the same average wait; nobody is paired twice in a day beyond the limit.
6. **Game engine:** every rule; no illegal move is accepted; ten thousand bot-versus-bot games always finish; replay from the event log reproduces the final state; the per-player view never contains hidden cards.
7. **Screens:** each phase renders the right fragment; every state has loading, empty, error and offline versions.
8. **Manual in Telegram on two phones** before beta.

### 6.16 Finish line for the ranked feature

Two real players on two phones can search, see the ready check, accept, play a full match, see the result, and rematch. Cancelling is free and instant. Closing and reopening the app at any step returns the player to the same state. A dropped player returns to the persisted turn deadline; the clock is not paused or reset. No match uses a bot. Nobody is paired twice at once. The daily allowance, cooldown and lockout are enforced by the server and shown correctly. The Recent Opponents card shows the right empty state, then real opponents, with correct Rematch reasons.

## 7. Build order, step by step

Sizes are **relative** (S, M, L, XL) because we do not know the team's capacity. Each step lists what the business will see, the tests that are written first, what changes in the backend and the app, and a finish line. A step is finished only when its finish line passes and the whole test suite is green.

### 7.1 The steps at a glance

| Step | Name | Size | Needs | What the business sees |
| --- | --- | --- | --- | --- |
| 0 | Close the decisions | S | none | One signed rulebook (PRD v2) and a chosen backend host |
| 1 | Close the loopholes | M | 0 | Free-premium and fake-win paths gone; points and claims cannot be repeated |
| 2 | Foundations | L | 1 | Same player has one identity; one clock; automatic checks on every change; the app follows the Scrella standard; false claims removed from screens |
| 3 | Entitlements and premium data | M | 2 | The server knows exactly what each player may do; premium expiry works as a date |
| 4 | Referrals | M | 2 | The referral link opens the app and records the referrer |
| 5 | Game engine and bot | XL | 2 | A full Whot match can be played to the end by a bot on the server |
| 6 | Realtime foundation and Practice | L | 3, 5 | Practice against a bot works: 5 a day with an ad for regular players, unlimited for premium |
| 7 | Ranked matchmaking and rematch | XL | 6 | Two real players find each other, accept, play and can rematch |
| 8 | Streak rewards, gates and ads-free day | L | 3, 6 | Milestone rewards by tier land in the wallet; 25-match gate; ads-free day |
| 9 | Stars payments and Premium screen | L | 3 | A player can really buy premium; it expires correctly |
| 10 | Wallet payouts and airtime | XL | 8 | Redeeming airtime really delivers airtime; pending, success and failed states |
| 11 | Leaderboards and prizes | L | 7, 8, 10 | Correct monthly ranking, month-end prizes and Community Builder |
| 12 | Banner ads | S | 2 | Banners on the agreed pages, switchable |
| 13 | Hardening and launch | L | all | Load-tested, reviewed, closed beta, go or no-go |

**Relation to the Audit's build order.** Audit Steps 1 to 5 keep their numbers. Practice moved to Step 6, ranked play (which the Audit left to the end) is now Step 7 because it is the core of the product, streak rewards moved to Step 8, Stars to Step 9, the wallet to Step 10, banners to Step 12. Leaderboards and prizes (Step 11) and launch hardening (Step 13) were added.

```
 0 -> 1 -> 2 --+--> 3 Entitlements ---+--> 6 Practice + realtime --> 7 Ranked ----------+
               |                     |                                                   |
               +--> 4 Referrals      +--> 9 Stars + Premium screen                      +--> 11 Leaderboards --> 13 Launch
               +--> 5 Engine + bot --^                                                  |
               +--> 12 Banners                       3 + 6 --> 8 Streak rewards --> 10 Wallet payouts
```

### Step 0. Close the decisions (S)

- Answer assumptions A1 to A9 and open items O1 to O15 (Section 9).
- Write PRD v2: copy Section 3 of this document over the old PRD sections 3, 4, 6, 7 and 8.
- **Whot rule set.** Nigerian Whot has house-rule variants. Sign off one written rule set: deck contents, the effect of each special card (Pick Two, Pick Three, General Market, Hold On, Suspension, Whot 20), whether penalties stack, the last-card call, how a round is won and scored, how the deck is reshuffled, and the turn timer. The game engine cannot start without it (O2).
- Choose the backend host (O1) and create the staging bot in BotFather (a second token).
- Schedule the lawyer review with the full premium-differences list (Section 2 note).
- **Finish line:** every item in Section 9 is marked decided.

### Step 1. Close the loopholes (M)

**Tests first:** the 26 tests in Appendix B of the Audit (13 fail today).

**Backend**

1. Settings: production is the default; the JWT secret must be 32 or more characters and never the word 'dev\_secret'; the developer shortcut works only when NODE\_ENV is explicitly development.
2. Delete POST /api/premium/subscribe and POST /api/tasks/record-match.
3. Task completion: insert the completion and add points in one transaction, only when the completion is new.
4. Streak claim: one conditional update ('mark claimed where not yet claimed', returning the row) inside a transaction with the audit and duplicate-protection records. Add the repository method and update the in-memory stand-in in the test.
5. Endpoints that pretend to work (skip-cooldown, update profile, and the match start, move, draw and forfeit stubs) return 501 Not Implemented, so the app can never show a false success.
6. Require login on GET /api/tasks/optional-video (the real callback arrives in Step 6).

**App:** stop calling the deleted endpoints; disable the Profile upgrade button ('Coming soon') without changing any local state; make the production build fail if the ad block ID is empty.

**Finish line:** all 82 tests pass (the 56 original and the 26 new); ten rapid completions of one task award 50 points; the two deleted endpoints return 404.

### Step 2. Foundations (L)

| Part | Work | Tests first |
| --- | --- | --- |
| 2a One identity | Make tg\_\<telegramId> the only player ID. Streak and eligibility use the same ID as everything else. Migrate rows stored under the bare number. Add foreign keys on matches, task completions and login streaks. | All rows for one player share one ID; eligibility reads the right history |
| 2b One clock | Use LagosCalendarClock everywhere. In SQL use the Lagos date (store a lagos\_date column where daily or monthly counts are needed). | 23:59 and 00:00 Lagos; month change; a task done at 00:30 Lagos counts for that Lagos day |
| 2c Migrations and checks | Decide the data layer: **Prisma** (agreed earlier, and needed for AdminJS) or raw SQL with a migration tool. Recommended: Prisma Migrate for the schema, with repositories moved over gradually. Add docker-compose (Postgres and Redis), automatic checks on every change (type-check, lint, tests with real Postgres and Redis), and real-database versions of the Step 1 transaction tests. | A fresh database builds from migrations; the Step 1 tests also pass on real Postgres |
| 2d Rules served by the server | Implement GET /config/rules (Section 4.5). | A test compares it with the rulebook values |
| 2e Conventions | Apply the alignment package in Section 5.4. | Type-check, lint and screenshots unchanged |
| 2f Remove false statements from screens | Delete the hard-coded 'QUALIFIED', 'Ready for Top-up' at ₦0 and the ₦30 label. Show '—' when rank is empty and hide the trend arrow when empty. Remove the Friends card. Replace the 'Regulatory compliance architecture' box and the 'Strict legal compliance guarantee' with a link to a Terms and Rules page whose wording counsel approves. | Each screen shows the empty state when the data is empty |
| 2g Deployment | Vercel rewrite file; allowed origin set to the Vercel address; backend hosted; Sentry in both apps. | Open /wallet directly and refresh: no 404 |
| 2h Server hardening | Rate limits keyed to the signed-in player (not only the internet address, because many players share one mobile address); Zod checks on every route; remove 'any' from files touched; reject a future timestamp in Telegram sign-in data; confirm the player exists on the sign-in-data path; 7-day token lifetime reviewed and the signing algorithm pinned. | Each has a failing test first |

**Finish line:** the automatic checks run on every change and pass with real Postgres and Redis; the Lagos and identity tests pass; the app has no item left on the Section 5.4 list.

### Step 3. Entitlements and premium data (M)

**Tests first:** an entitlement table test (none, active, expiring soon, expired, refunded, ads-free day) with boundaries at the expiry moment and at Lagos midnight; Claim is safe to repeat; premium players' video tasks appear as ready.

**Backend**

- entitlements.service computes: tier, expiry, isAdFreeToday, practice daily limit (5 or unlimited), ad required before practice, ranked cooldown applies. GET /users/me returns it.
- Tables premium\_orders and premium\_subscriptions (expiry date); drop users.is\_premium. GET /premium/status returns NONE, ACTIVE, EXPIRING\_SOON or EXPIRED plus the date.
- daily\_task\_state with AVAILABLE, AUTO\_READY and CLAIMED. For premium players (and on an ads-free day, A1) the video tasks are created as AUTO\_READY. New endpoint POST /tasks/{taskKey}/claim completes a task and awards its points once. For regular players a video task is completed by a server-verified ad (Step 6).

**App:** one useEntitlements hook reading /users/me; delete all local premium logic; the Tasks screen shows **Claim** where a task is ready.

**Finish line:** a premium player can complete both video tasks by tapping Claim and nothing else; a regular player cannot; the tier comes only from the server.

### Step 4. Referrals (M)

**Tests first:** read the start parameter from signed sign-in data; create the referral on first sign-in only; ignore self-referral, a second referrer, an unknown code and an existing player; link builder output.

**Backend:** random 8-character referral codes (migrate away from REF\_\<telegram id>); capture start\_param from the verified sign-in data; a referrals table with one referrer per player; GET /referrals/summary (counts and progress). The qualification rule is evaluated in Step 8, when the practice and task counts exist.

**App:** build the link as https://t.me/Cash\_dey\_play\_bot/Cash\_Dey\_Play?startapp=\<code> from two settings (VITE\_TELEGRAM\_BOT\_USERNAME, VITE\_TELEGRAM\_MINIAPP\_SHORT\_NAME); share with Telegram's share link through the Telegram app's own link-opening call rather than the clipboard; the Invite card shows referral points and progress, not cash (D14).

**Finish line:** on two phones, opening a referral link from Telegram opens the app, signs in, and creates exactly one referral row; the old 'user does not exist' message is gone.

### Step 5. Game engine and bot (XL)

**Needs the signed Whot rule set (Step 0).** A pure module with no database or network: createMatch(seed, players), legalActions(state, player), applyAction(state, action), viewFor(state, player), and the bot's chooseAction(publicView).

- The shuffle uses a recorded seed, so a match can be replayed from its event log for disputes.
- The bot uses only what a human would see. It never reads the human's hand or the draw pile. It waits a random 1 to 3 seconds per move (PRD).
- Tables matches, match\_players (with an is\_bot flag and a nullable user), and match\_events (Section 4.4).
- **Tests first:** each rule and special card; an illegal move is rejected; cards are conserved; ten thousand bot-versus-bot games always finish; replay from events equals the final state; **viewFor never contains the draw pile, the discard history or the opponent's hand** (H12); the bot never makes an illegal move.
- The app's game board is changed to draw from the per-player view; the card helper in the app becomes display-only.

**Finish line:** a bot can play a complete match against a scripted player on the server, with a replayable log.

### Step 6. Realtime foundation and Practice (L)

**Realtime foundation.** Socket.io gateway on the chosen host; sign-in at connection using the Telegram sign-in data or the token; online status with a 15-second heartbeat; session:state and session:resume; one active session per player; per-event rate limits; the app's socket helper, hook, matchmaking store and the reconnect bar (Section 6.7). The app calls enableClosingConfirmation while a match is in progress.

**Practice flow.**

- ad\_credits table. The ad network's reward callback is verified by the server (an unguessable token in the reward address, plus a signature check if the network offers one). The app asks POST /ads/session for an ad session, plays the ad, then polls GET /ads/status/{id}. A credit lasts about 10 minutes and is used once.
- practice.service: a regular player may start 5 per day; each start consumes one verified ad credit (if no ad is available, the start is allowed and still counts, D9); premium starts need nothing. POST /practice/start creates a bot match and the app joins it over the socket.
- Ranked allowance and cooldown service (no queue yet): 3 per day, cooldown after the 2nd for regular players (A2), a video skips it (credit purpose COOLDOWN\_SKIP), reset at Lagos midnight. GET /ranked/allowance.
- **App:** the Practice card (replaces Quick Match), the Tasks screen's 'Practice today: 2 of 5', the game screen wired to the server view.

**Tests first:** socket sign-in; resume after a dropped connection; online status expiry; the 5-per-day boundary at Lagos midnight; an ad credit is single-use and expires; a spoofed reward callback is refused; the cooldown skip; allowance arithmetic.

**Finish line:** a regular player cannot start a sixth practice match in a day; a premium player can start any number with no ad; closing and reopening the app returns to the running bot match; every completed practice match is recorded for the 25-match count.

### Step 7. Ranked matchmaking and rematch (XL)

The design is Section 6; this step builds it.

**Tests first:** Section 6.15 items 1 to 5 and 7 (pure rules, pairing under concurrency on real Redis, two real socket clients, chaos at every phase, fairness simulation, screen states).

**Backend (ranked module)**

- queue.service: join and leave with the checks in 6.3; one ticket and one active thing per player.
- Matchmaker loop (one at a time, protected by a leader lock) and the atomic pairing script (6.4).
- offer.service: 10-second ready check; re-queue the other player with their original join time; penalty ladder (6.11).
- Match lifecycle: create the match from the Step 5 engine; keep live state in Redis and write every move to match\_events; the server owns the turn timer and the 30-second reconnect window (deadlines are stored, so a server restart can restore them); results are written only by the server; VOID rules.
- Daily allowance is used when the match starts; ranked\_daily\_usage and ranked\_penalties.
- GET /ranked/opponents/recent (Section 6.8), the rematch service (6.10), the wait estimator, the online dot from presence, the same-opponent report for admins.

**App**

- Lobby fragments, matchmaking store, search pill, ready-check sheet, Recent Opponents, rematch sheet (Section 6.7).
- Game and result screens: Rematch button, allowance and cooldown after the result, 'Return to match' pill.
- Delete Quick Match; hide Friends; closing confirmation and vertical-swipe lock during a match.

**Risks and how they are handled:** thin queues at launch (Practice fallback and ranked prime time, 6.9); timers lost in a restart (deadlines stored, matches restorable, otherwise VOID); double pairing (atomic script, tested under concurrency).

**Finish line:** Section 6.16.

### Step 8. Streak rewards, gates and the ads-free day (L)

**Tests first:** each tier's table; boundaries around Day 14, 15, 20, 30 including the grace day; exactly 24 versus 25 practice matches **inside the personal window** (regular only); no gate for premium; the tier at the moment of claiming (D6); two simultaneous claims produce one reward (real database); a new window after Day 30; the ads-free day starts when claimed and ends at Lagos midnight; referral qualification (3 tasks on 3 days, plus 25 practice for regular referees, D10 and A4); monthly eligibility counts (20 task days, 15 ranked wins, 25 practice for regular players) using the one player ID.

**Backend**

- streak\_milestone\_claims (one row per player per window per milestone, unique). The engine reads its tables from the rules config by tier.
- POST /streak/claims with a duplicate-protection key: one transaction writes the claim, the **wallet ledger credit**, the audit record and the key. GET /streak returns the window, the day count and each milestone as LOCKED, CLAIMABLE, CLAIMED, or WAITING\_FOR\_PRACTICE (n of 25).
- wallet\_ledger (credit side) is built here so rewards visibly arrive; the debit side comes in Step 10.
- ad\_free\_days; the entitlement service reads it.
- Referral qualification and monthly eligibility services reading derived counts (no stored counters).

**App:** the Tasks and Streak screen shows the milestones for the player's tier, with the practice progress 'Practice matches 18 of 25' for regular Day 30, a Claim button, and 'Ads-free until midnight' after claiming Day 20; the Home streak card uses the server; the local streak engine is deleted.

**Finish line:** a regular player who completes 25 practice matches and reaches Day 30 can claim ₦100 once and sees it in the wallet; a premium player reaching Day 30 claims ₦200 with no practice requirement; nothing is claimable twice.

### Step 9. Stars payments and the Premium screen (L)

**Tests first:** the bot webhook rejects a wrong secret token; pre-checkout rejects a wrong amount, plan or player; a repeated 'payment successful' message is harmless (unique charge ID); extension arithmetic (buying while active adds to the current expiry; buying after expiry starts now); a refund revokes; an unpaid order expires; the invoice price is locked at creation; **the app's 'paid' callback can never grant premium**.

**Backend:** bot webhook endpoint (HTTPS, secret token); handlers for pre-checkout and successful payment; refunds through Telegram's refund call; bot commands /start (greeting and an Open app button), /terms and /paysupport; POST /premium/orders creates an order and a Stars invoice link (one price item, our order ID inside); price table with the current Stars per plan, edited weekly. Test first in Telegram's test environment with the staging bot.

**App:** the /premium page, as revised in the Audit (R4): one Premium with a 1-month and a 3-month choice, the price in Stars with an approximate naira value, the real benefits from Section 3.1, the words 'No video ads', a Terms link, a Payment support link and an agreement line; Profile has one button ('Upgrade to Premium', or 'Premium: N days left'); purchase states IDLE, CREATING\_ORDER, INVOICE\_OPEN, CONFIRMING, ACTIVE, CANCELLED, FAILED; the success message appears only after the server confirms; the PRO badge and the EXPIRING\_SOON and EXPIRED states.

**Weekly price review (runbook).** One named person, every week: take the current naira per US dollar rate; compute Stars = round up to the next 5 of (naira price / (naira per dollar x about 0.013 dollars per Star)); update the price table; check that the displayed naira estimate matches. At ₦1,410 per dollar this gives 55 Stars for ₦1,000 and 150 for ₦2,700 (A3). Record the rate used each week.

**Finish line:** a test-environment payment turns premium on and a refund turns it off; premium cannot be obtained any other way.

### Step 10. Wallet payouts and airtime (XL)

**Tests first:** a duplicate request with the same key creates one payout; a failure creates a refund entry; an unknown result is re-checked, never re-sent with a new request ID; low float holds payouts as WAITING\_FOR\_FUNDING; amount limits (₦50 to ₦100,000); phone and network validation; per-phone and per-account caps; the status shown matches the payout state.

**Backend**

- Ledger debit and refund entries; airtime\_payouts with the states in the Audit (R7), plus WAITING\_FOR\_FUNDING.
- POST /wallet/redemptions with a duplicate-protection key and Zod checks (network, Nigerian number format, whole-naira amount, balance). GET /wallet/summary and GET /wallet/entries?cursor= (paged).
- A background worker submits each payout through a provider adapter (a fake one for tests, a real one for the chosen aggregator). The provider request ID is derived from our payout ID. A reconciliation job re-checks anything unknown, and a daily job compares our records with the provider's statement. A float monitor raises an alert below the threshold (O5).
- **Provider choice:** run a short sandbox comparison of two or three aggregators on price, discount, success rate, limits and support before committing. The public VTpass documentation shows the pattern to require: unique request ID, then a status re-check.
- Admin screens (AdminJS) for pending, failed and manually refunded payouts. Wallet text shows masked numbers; the full number sits in a restricted column.

**App:** the redesigned Wallet (Audit R6) with the business decisions applied: no 'Buy Data'; one 'Get airtime' flow (network, number, amount); Recent activity with amounts in neutral colour and a +/− sign, and a status badge for Success (green), Pending (yellow) and Failed (red) with icon and text; a 'Referral points' card and a 'Community prizes' card instead of 'Referral Earnings' cash; a paged 'View all'; no banner beside the form; the 'Instant' and 'No bank KYC needed' claims removed until reviewed.

**Daily routine (named owner, O5):** check the float, top it up before the threshold, review pending and failed payouts, sign off the reconciliation.

**Finish line:** with a small real float, a redemption delivers airtime and turns green; a forced failure turns red and refunds the wallet; running out of float turns new requests yellow ('waiting for funding') instead of failing.

### Step 11. Leaderboards and prizes (L)

**Tests first:** the eligibility matrix (20 task days, 15 ranked wins, 25 practice matches for regular players); ranking order and tie-breaks; the month-end freeze at 00:00 Lagos on the 1st; prize settlement credits the ledger exactly once per player per month; Community Builder tiers.

**Backend:** derive every count from match and task records (delete the stored monthly counters); the weighted score win rate x (matches / 50); top 100; a month-close job that freezes leaderboard\_results; admin review of the top 20 (win-trading and multi-account flags) before payout; prize pool and tiers from PRD Section 6 with the finance inputs (O12); a settlement job that credits the ledger once; Community Builder results from the referral data.

**App:** real eligibility for the player ('Task days 12 of 20, ranked wins 9 of 15, practice matches 18 of 25'), the player's own rank or '—', prize information, and past results; no hard-coded status.

**Finish line:** a simulated month ends with the right players ranked, the admin review step, and prizes credited once.

### Step 12. Banner ads (S)

One AdBanner component in the shared layout; a placement list with an on/off switch served in the rules config; a fixed reserved height so pages do not jump; the ad script loads lazily; no banner during a match or beside the wallet form and payment button (A5); premium players see banners (D11); impressions and clicks recorded per placement; confirm with the ad network that banners are offered and what they pay (Adsgram's published units are Reward, Interstitial and Task). **Finish line:** banners show on the agreed pages on a low-end Android phone without layout jumps, and can be switched off without a release.

### Step 13. Hardening and launch (L)

- Load test to the agreed targets (Section 6.13). Security review (Section 8). Abuse tests: a win-trading simulation and an automation attempt.
- Backups, and a restore test. Dashboards and alerts live (Section 4.6b).
- Rehearse the runbooks: float low, payout stuck, Stars refund, ranked outage.
- Kill switches that need no release: ranked, payouts, premium purchase, banners.
- **Closed beta** with real Nigerian players: a real Stars purchase, a real airtime delivery with a small float, and ranked matches at the expected busy hour.
- Legal sign-off recorded; the BotFather description and in-app wording reviewed by counsel.
- Staged rollout: invite only, then public. A written go or no-go checklist signed by the business.

## 8. Rules that apply to every step

### 8.1 Definition of done (for every change)

1. A failing test was written first and now passes (for rules, money, claims, payments and matchmaking this is mandatory).
2. Type-check and lint pass; no new 'any'; names follow Section 5.5.
3. Database changes are backward compatible (add first, switch the code, remove later) and have a migration.
4. Anything risky sits behind a switch that can be turned off without a release.
5. Screens show loading, empty, error and offline states, with screenshots for each.
6. Docs and the rules config are updated if a rule changed.

### 8.2 Security checklist

- Telegram sign-in data is verified (signature and age); tokens have a short lifetime and a pinned algorithm; the developer shortcut cannot exist in production.
- Every route and every live event validates its input and checks that the player may touch that record.
- Rate limits are per player and per event type, with a separate limit per internet address for sign-in.
- Money, claim and payment endpoints require a duplicate-protection key and write a ledger and audit record in the same transaction.
- Webhooks (Telegram, ad network) are verified with a secret token or signature.
- No hidden game information is ever sent to a phone.
- Secrets live in the host's secret store; they are never in the repository, chat or logs. Rotate the bot token and the JWT secret if exposed.
- Phone numbers are masked in the app and logs; the full number is in a restricted column. Admin screens need sign-in and are logged.
- Dependencies are scanned; backups are encrypted and restores are tested.

### 8.3 Testing approach

Many fast unit tests for rules, a smaller set of real-database and real-Redis tests for transactions and pairing, socket tests with two real clients for matches, chaos tests for disconnects, property tests for the game engine, a load test before launch, and a manual run on two real phones in Telegram. Every money, claim, payment and matchmaking rule has a test written before the code.

### 8.4 Go-live checklist (Step 13)

- Legal review of the full premium differences and the in-app and BotFather wording is recorded.
- Float funded and the daily routine owner named; reconciliation signed off for a full week in beta.
- Stars: a real purchase and a real refund tested; the weekly price review owner named.
- Ranked: the busy-hour test passed; kill switches tested.
- Backups restored once; alerts reach a named person; runbooks rehearsed.
- No Critical or High finding from the Audit remains open.

### 8.5 Runbooks to write

Low float; payout stuck or unknown; Stars refund; weekly Stars price review; ranked outage or abuse spike; bot token or secret rotation; a player reports a wrong result (replay the match from its event log).

## 9. Open items

Please answer each with a decision, an owner and a date. Step 0 is finished when this list is empty.

| ID | Open item | Needed by |
| --- | --- | --- |
| O1 | **Backend host and region.** It must keep WebSocket connections, run Postgres, Redis and a worker, and be close to Lagos. | Step 2 |
| O2 | **Whot rule set** signed off in writing (Step 0 lists what it must cover). | Step 5 |
| O3 | Timers: ranked cooldown length (A2, 1 hour proposed), turn timer (30 seconds proposed), reconnect window (30 seconds each, 60 total), ready check (10 seconds), search timeouts (30 and 120 seconds). | Steps 6, 7 |
| O4 | Yes or no to assumptions A1 to A9 (Section 2). | Step 3 onward |
| O5 | **Float:** the named person, the low-float threshold, the per-phone and per-account daily and monthly caps, and the provider's own per-transaction limit compared with the ₦100,000 maximum. | Step 10 |
| O6 | Same-opponent limits (proposed: 2 ranked matches per opponent per day, 3 rematch requests per hour). | Step 7 |
| O7 | Confirm D16 (no bots in ranked; Practice is the fallback). | Step 7 |
| O8 | Star amounts (55 and 150 proposed) and the weekly price-review owner. | Step 9 |
| O9 | Banner placements (A5) and the ad network's banner availability and pay. | Step 12 |
| O10 | Confirm 'Win 1 match' counts ranked wins only (A7) and the task-day definition (A9). | Step 3 |
| O11 | Legal review: scope (the full list in Section 2's note), timing, and approval of the Terms and Rules page and the BotFather description. | Before Step 13; wording for Step 2f |
| O12 | **Finance inputs for prizes:** the net-revenue figure behind the 25% pool, confirmation of the PRD payout tiers, and the tie-break rule for the game leaderboard. | Step 11 |
| O13 | Optional: a daily ranked prime-time window to concentrate players (Section 6.9). | Beta |
| O14 | Create the staging bot, choose the webhook address, and set /start, /terms and /paysupport in BotFather. | Step 9 |
| O15 | Approve the one-time conventions alignment package (Section 5.4), including renaming features to views and store to stores. | Step 2 |

## Appendix A. Telegram settings (confirmed from your BotFather screenshots)

| Item | Value |
| --- | --- |
| Bot | @Cash\_dey\_play\_bot |
| Mini App short name | Cash\_Dey\_Play |
| Direct link to the app | https://t.me/Cash\_dey\_play\_bot/Cash\_Dey\_Play |
| Web App URL (production) | https://cash-dey-play-ckkt.vercel.app/ |
| Referral link format | https://t.me/Cash\_dey\_play\_bot/Cash\_Dey\_Play?startapp=\<referral code> |
| Bot token | Never shared. The backend's TELEGRAM\_BOT\_TOKEN must be this bot's token, or every sign-in check fails. |

**One bot, not two.** There is a single bot account (@Cash\_dey\_play\_bot) with the Mini App attached to it. The bot's chat side currently does nothing. In Step 9 it gains jobs: receive Stars payment messages, answer /start, /terms and /paysupport. The BotFather description currently says the game uses 'non-gambling reward tracks'; counsel should review that wording (O11). Create a second bot for staging (O14).

## Appendix B. New and changed endpoints

| Endpoint | Purpose | Step |
| --- | --- | --- |
| Removed: POST /premium/subscribe, POST /tasks/record-match | Loopholes C3 and C4 | 1 |
| Return 501 until built: POST /users/me, /tasks/skip-cooldown, /matches/start, /move, /draw, /forfeit | No fake success | 1 |
| GET /config/rules | The rulebook for the app | 2 |
| GET /users/me (adds entitlements), GET /premium/status | Tier, expiry, ads-free day, limits | 3 |
| GET /tasks/state (changed), POST /tasks/{taskKey}/claim | Task states and Claim | 3 |
| GET /referrals/summary | Referral progress | 4 |
| GET /session/state | First-paint twin of the live session:state | 6 |
| POST /ads/session, GET /ads/status/{id}, POST /ads/reward-callback | Server-verified ad credits | 6 |
| POST /practice/start, GET /ranked/allowance | Practice and ranked allowance | 6 |
| GET /ranked/opponents/recent | Recent Opponents | 7 |
| GET /streak, POST /streak/claims | Milestones and claiming | 8 |
| POST /premium/orders, POST /telegram/webhook | Stars purchase and bot messages | 9 |
| GET /wallet/summary, GET /wallet/entries, POST /wallet/redemptions, GET /wallet/redemptions/{id} | Wallet and airtime | 10 |
| GET /leaderboards/game, /community (changed), GET /leaderboards/me | Correct ranking and own progress | 11 |

Live events (queue, offer, match, rematch, session) are listed in Section 6.5.

## Appendix C. Sources and how far to trust them

(official) means Telegram or the vendor's own documentation; (third party) means a figure from another site that should be re-checked before the business relies on it.

- Telegram Mini Apps, including openInvoice, enableClosingConfirmation (Bot API 6.2), disableVerticalSwipes (7.7), the activated and deactivated events (8.0) and requestWriteAccess (6.9) (official): core.telegram.org/bots/webapps
- Telegram Bot Payments for digital goods, Stars (official): core.telegram.org/bots/payments-stars
- Mini App start parameter (startapp): docs.telegram-mini-apps.com/platform/start-parameter
- Stars payout rate of about $0.013 per Star, 1,000-Star minimum and 21-day hold (third party): axeetech.com/telegram-stars-to-usd/ and such.chat/blog/withdraw-telegram-stars-and-convert-them-to-ton
- VTpass airtime API, unique request ID and status re-check (official): vtpass.com/documentation/buying-services/
- Adsgram reward and interstitial integration (official): docs.adsgram.ai/publisher/reward-interstitial-integration
- Files read: the repository CASH-DEY-PLAY (backend and frontend, PRD and engineering standards), the uploaded scrella-partners-portal zip, the two BotFather screenshots, the Wallet and Premium mockups.
- The ₦1,410 per dollar rate is from the PRD, not a live rate. Recompute prices at the time they are set.

*End of document.*

# Part II. Implementation specifications

*Added 21 October 2026. Part I (above) is the plan: what to build and in what order. Part II is the specification a developer builds from: files, database changes, request and response contracts, types, algorithms, named tests, edge cases, deployment on Render and Vercel, and a finish line. Each step gets one specification, in the order of Section 7.*

**Backend host recorded:** Render (web service plus a Postgres instance) at https://cash-dey-play.onrender.com; frontend on Vercel at https://cash-dey-play-ckkt.vercel.app. This closes open item O1 for hosting platform; the Render-specific limits are in Spec 1 (Section II.1.7).

**Answers recorded (assumptions A1 to A9).** A1 yes. A2 yes. A3 the Stars purchase is one-time and the player chooses whether to renew (no auto-renew). A4 yes. A5 banner exclusions are at the developer's discretion, and the recommendation stands. A6 maximum ₦100,000 **per transaction and per day**. A7 yes. A8 a practice match counts when completed. **A9 changes the rulebook:** a task day is a day on which **all tasks on the task page are completed** (not just one). Consequences are listed in Section II.0.

**How each specification is laid out**

1. Objective and boundaries. 2. Preconditions. 3. Files. 4. Database changes (SQL). 5. Contracts (requests, responses, errors, events). 6. Types and function signatures. 7. Logic. 8. Tests first (named). 9. Edge cases and failures. 10. Rollout and rollback. 11. Finish line.

**Status**

| Spec | Step | Status |
| --- | --- | --- |
| II.1 | Close the loopholes | **Built** (patch attached to the conversation; 83 of 83 backend tests pass; 6 real-database tests pass) |
| II.2 | Foundations | Specified below |
| II.3 | Entitlements and premium data | Specified below |
| II.4 | Referrals | Specified below |
| II.5 to II.13 | Engine and bot; realtime and practice; ranked; streak rewards; Stars; wallet and payouts; leaderboards; banners; launch | To be specified next, in order |

## II.0 Effects of the A9 answer on the rulebook

A task day now means all four tasks on the task page completed on that Lagos day (the two videos, win 1 ranked match, and the all-complete bonus). Three consequences the business should know:

1. **Every task day needs a ranked win** (A7). With a daily maximum of 3 ranked matches, a player needs at least one win on each of 20 different days in a month, so the monthly leaderboard depends heavily on ranked matchmaking working at the hours players are online.
2. **Premium players** still need a ranked win each day for a task day; they only skip watching the two videos (they tap Claim, D5).
3. The Audit's finding H5 (any single task row counts as a task day) becomes a rule to implement: a task day is derived from the four task states for that Lagos day. The monthly counter column is deleted (Step 11).

Section 3.5 (leaderboards), the A9 row, Step 8 and Step 11 are read with this meaning from now on.

## II.1 Specification 1: Close the loopholes (built)

### II.1.1 Objective and boundaries

Remove every path that lets a player grant themselves rewards, harden the server's start-up settings, make the two reward writes atomic, and stop the server answering 'success' for work it does not do. Not in this step: wallet credits, real ad verification, user-ID unification, the Lagos clock (those are Steps 2, 6 and 8).

### II.1.2 What changed, loophole by loophole

| Loophole | Fix | Where | Proof |
| --- | --- | --- | --- |
| C1 forgeable login settings | Unknown or missing NODE\_ENV is production. In production the server refuses to start unless JWT\_SECRET is at least 32 characters and not 'dev\_secret'. The developer shortcut works only when NODE\_ENV is explicitly development or test. | src/config/env.config.ts; .env.example | env.config.test.ts (10 tests) |
| C2 repeatable points | completeTask runs in one transaction: it inserts the completion and adds the 50 points only if the insert created a new row. A repeat throws TaskAlreadyCompletedError (HTTP 409). An unknown task throws UnknownTaskError (HTTP 400). A missing player rolls back. | src/db/repositories/tasks.repository.ts; tasks.errors.ts; error handler | tasks.repository.points.test.ts (8); atomic-writes.integration.test.ts (2, real Postgres) |
| C3 player reports the winner | Route, controller method and repository method for record-match are deleted. The app no longer calls it. | tasks.routes.ts, tasks.controller.ts, tasks.repository.ts; app: tasks.api.ts, WhotGameBoard.tsx, constant.config.ts | retired-endpoints.test.ts |
| C4 free premium | Route and controller method for subscribe are deleted. The Profile button is disabled ('Premium coming soon') and no longer changes local state. | premium.routes.ts, premium.controller.ts; app: ProfileView.tsx, auth.store.ts, premium.api.ts (deleted) | retired-endpoints.test.ts |
| C6 double claim | The claim is one conditional UPDATE ('mark claimed where not yet claimed and at least 30 days', returning the row). Only one caller gets a row. Identical requests (same player, same Idempotency-Key) that overlap share one run. A login that was saved late can no longer un-claim the bonus inside the same window. | login-streak.repository.ts (tryMarkBonusClaimed, saveState), login-streak.service.ts | login-streak.service.concurrency.test.ts (5); login-streak.service.test.ts (+1); atomic-writes.integration.test.ts (4) |
| H11 fake success | Skip cooldown, update profile, and match start, move, draw and forfeit now answer HTTP 501 with a plain message. The app shows it as a toast. | NotImplementedFeatureError in http-errors.ts; controllers; app client.ts | covered by type-check and manual check |
| M7 unauthenticated callback | The public GET /api/tasks/optional-video route and its auth exception are removed. The only public route is sign-in. | tasks.routes.ts, auth.middleware.ts | manual check |
| H8 fake ads in production | The production build fails unless VITE\_ADSGRAM\_BLOCK\_ID is a real value, or VITE\_ALLOW\_MOCK\_ADS=true (staging only). | app: vite.config.ts | build run with and without the setting |

### II.1.3 Contracts that changed

| Request | Before | After |
| --- | --- | --- |
| POST /api/tasks/complete {taskId} | Always 200, points every time | 200 first time that day. 409 TaskAlreadyCompletedError on repeats. 400 UnknownTaskError for a task the client may not complete (win match, all complete, anything else). |
| POST /api/premium/subscribe | 200, premium granted | 404 (route removed) |
| POST /api/tasks/record-match | 200, win recorded | 404 (route removed) |
| GET /api/tasks/optional-video | 200 'acknowledged', no login | 404 (route removed) |
| POST /api/tasks/skip-cooldown, POST /api/users/me, POST /api/matches/start, /move, /draw, /forfeit | 200 with a success message | 501 NotImplementedFeatureError |
| POST claim of the streak bonus | Could succeed twice under concurrency | At most one success; the rest get 409 LoginStreakBonusAlreadyClaimedError (or the stored response when the same key is replayed) |

### II.1.4 What players and testers will notice

- The lobby cannot start a match until Steps 5 to 7: Quick Match, Ranked and the game screen show 'Starting a match is not available yet.'
- The daily task 'Win 1 match' cannot complete until Step 7, because nothing writes matches any more.
- Premium cannot be bought or faked.
- A second tap on a task shows 'Task already completed today' instead of adding points.

### II.1.5 Known limits after this step (nothing hidden)

- Optional-video credits are still reported by the phone and capped at 5 a day (real verification is Step 6).
- The streak claim still pays nothing into the wallet (Step 8).
- The same-key overlap guard works inside one server process. Two servers receiving the same key at the same instant could answer the second with 409 instead of the stored response; the reward is still paid once.
- The two player IDs (tg\_123 and 123), the UTC-versus-Lagos clock and the rate-limit weaknesses remain until Step 2.
- The idempotency record is saved after the claim is written. A crash between the two would show a repeat as 409, never as a second reward.

### II.1.6 How to apply and check

```bash
# from the repository root
git apply step1-loopholes.patch

cd cash-dey-play-backend
npm test                                   # 83 tests, integration tests are skipped without a database
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/cash_dey_play_test npx jest atomic-writes   # 6 real-database tests

cd ../cash-dey-play-frontend
npx tsc --noEmit
VITE_ADSGRAM_BLOCK_ID=your-real-id npx vite build
```

Suggested commit message: 'Step 1: close reward loopholes (safe settings, atomic task points and streak claim, remove free premium and client-reported wins, 501 for unbuilt features)'.

### II.1.7 Deploying to Render and Vercel

**Render backend: environment tab (all must be set before deploying, or the server will refuse to start, which is the intended safe behaviour)**

| Variable | Value |
| --- | --- |
| NODE\_ENV | production |
| DATABASE\_URL | The Internal Database URL of your Render Postgres |
| REDIS\_URL | The Internal URL of a Render Key Value instance in the **same region**. Production requires it (shared rate limits). |
| TELEGRAM\_BOT\_TOKEN | The token of @Cash\_dey\_play\_bot (BotFather, /mybots, API Token). It must be this bot's token or every sign-in fails. |
| JWT\_SECRET | A random value of at least 32 characters, for example the output of: openssl rand -hex 32 |
| CORS\_ORIGIN | https://cash-dey-play-ckkt.vercel.app (no trailing slash) |
| ALLOW\_DEV\_AUTH\_BYPASS | false (or remove it) |

**Vercel frontend:** VITE\_API\_URL = https://cash-dey-play.onrender.com/api; VITE\_ADSGRAM\_BLOCK\_ID = the real Adsgram block ID (or VITE\_ALLOW\_MOCK\_ADS=true on a staging project only). **The Vercel build now fails without one of these.**

**Render facts that affect this project** (from Render's free-tier documentation): a free web service spins down after about 15 minutes without traffic, so the first request after a quiet period is slow; a free Postgres database expires 30 days after creation, with a 14-day grace period to upgrade; a free Key Value instance is not backed by a disk and may restart and lose its data. Check the creation date of your Postgres now. A free Key Value instance is acceptable for rate-limit counters, but **not** for the ranked queue and live matches in Steps 6 and 7, and a free web service that sleeps cannot run live matches. Plan to move the web service, the database and Key Value to paid instances before the closed beta.

**Check your live server today, before deploying.** Run this from any terminal; it must answer 401. Any other answer means the developer sign-in shortcut is switched on in production and anyone can impersonate any player:

```bash
curl -i -H "X-Dev-Telegram-User-Id: 123456789" https://cash-dey-play.onrender.com/api/users/me
```

**Rollback:** revert the commit and redeploy; no database change is involved in this step. The environment variables can stay.

### II.1.8 Finish line (met)

All 83 backend tests pass; the 13 tests that failed before now pass; 6 real-Postgres tests pass; the frontend type-checks and builds; the build fails without a real ad unit; the patch applies cleanly to a fresh copy of the repository.

## II.2 Specification 2: Foundations

### II.2.1 Objective, order and boundaries

Give every later step one identity per player, one clock, safe database changes, automatic checks, one rulebook served by the server, an app that follows the Scrella standard, screens that tell the truth, a working deployment, and a hardened server. Eight parts, in this order because of dependencies:

```
 2c migrations + automatic checks  -->  2a one identity  -->  2b one clock  -->  2d rules endpoint
                                   '-->  2h server hardening (any time after 2c)
 2e conventions (app)  -->  2f truth fixes (app)         2g deployment (any time)
```

**Preconditions:** Step 1 merged and deployed with the Render settings from II.1.7; a backup of the Render database (see 2a); a decision on the data tooling (below).

### II.2.2 Part 2c: migrations, local services and automatic checks

**Decision.** Use **Prisma Migrate** for schema changes and keep the existing pg repositories during the transition (so nothing is rewritten at once). Prisma is the tooling already agreed for AdminJS (Step 11). Existing tables are adopted as a baseline.

**Files**

| File | Purpose |
| --- | --- |
| prisma/schema.prisma | Schema generated from the current database, then maintained by hand |
| prisma/migrations/0\_init/migration.sql | Baseline of today's tables |
| docker-compose.yml | Local Postgres 16 and Redis 7 |
| .github/workflows/ci.yml | Checks on every change |
| package.json scripts | db:migrate:dev, db:migrate:deploy, test:db |

**Baseline procedure (once)**

```bash
npm i -D prisma && npm i @prisma/client
npx prisma init --datasource-provider postgresql
npx prisma db pull                                   # reads the current tables into schema.prisma
mkdir -p prisma/migrations/0_init
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql
npx prisma migrate resolve --applied 0_init          # tells Prisma the live database already has this baseline
```

**Render:** run `npx prisma migrate deploy` before the server starts. If your Render plan offers a pre-deploy command use that; otherwise make the start command `npx prisma migrate deploy && node dist/server.js`. A failed migration must stop the deploy.

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment: { POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres, POSTGRES_DB: cash_dey_play }
    ports: ["5432:5432"]
  redis:
    image: redis:7
    ports: ["6379:6379"]
```

```yaml
# .github/workflows/ci.yml
name: ci
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: cash_dey_play_test }
        ports: ["5432:5432"]
        options: --health-cmd="pg_isready" --health-interval=5s --health-retries=10
      redis:
        image: redis:7
        ports: ["6379:6379"]
    defaults: { run: { working-directory: cash-dey-play-backend } }
    env:
      TEST_DATABASE_URL: postgres://postgres:postgres@localhost:5432/cash_dey_play_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: cash-dey-play-backend/package-lock.json }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm test
  frontend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: cash-dey-play-frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: cash-dey-play-frontend/package-lock.json }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint
      - run: VITE_ADSGRAM_BLOCK_ID=ci-placeholder npx vite build
```

**Tests first:** a fresh empty database builds from the migrations alone; the six real-database tests from Step 1 pass in CI; a deliberately broken migration fails the pipeline.

### II.2.3 Part 2a: one identity

**Rule.** A player's ID is always the users.id value, which has the form **tg\_\<telegram id>**. Today the streak and eligibility controllers use the bare Telegram number, so those records are stored under a different ID from everything else.

**Code**

- Add src/http/auth/require-user-id.ts with `requireUserId(req: Request): string`, which returns the same tg\_ ID for the signed-in player on both sign-in paths and throws the existing authentication error if missing.
- Add `userId?: string` to the Express request type next to the existing `auth` property, and replace every `(req as any).userId` (16 'any' shortcuts remain in the backend) with `requireUserId(req)`.
- login-streak.controller.ts and monthly-leaderboard.controller.ts call `requireUserId(req)` instead of using `telegramUserId`.

**Migration (run once, inside a transaction, after a backup)**

Take a backup first: `pg_dump "$EXTERNAL_DATABASE_URL" > before-identity.sql` (use the External Database URL from the Render dashboard).

```sql
-- 0. Report what will change (read-only)
SELECT 'login_streaks' AS t, COUNT(*) FROM login_streaks WHERE user_id ~ '^[0-9]+$'
UNION ALL SELECT 'reward_audit_events', COUNT(*) FROM reward_audit_events WHERE user_id ~ '^[0-9]+$'
UNION ALL SELECT 'idempotency_keys', COUNT(*) FROM idempotency_keys WHERE user_id ~ '^[0-9]+$'
UNION ALL SELECT 'task_completions', COUNT(*) FROM task_completions WHERE user_id ~ '^[0-9]+$'
UNION ALL SELECT 'matches', COUNT(*) FROM matches WHERE user_id ~ '^[0-9]+$';

BEGIN;
-- 1. login_streaks: if a player has both forms, keep the row with the later last_login_date
DELETE FROM login_streaks b USING login_streaks p
 WHERE b.user_id ~ '^[0-9]+$' AND p.user_id = 'tg_' || b.user_id AND p.last_login_date >= b.last_login_date;
DELETE FROM login_streaks p USING login_streaks b
 WHERE b.user_id ~ '^[0-9]+$' AND p.user_id = 'tg_' || b.user_id;
UPDATE login_streaks SET user_id = 'tg_' || user_id WHERE user_id ~ '^[0-9]+$';

-- 2. append-only and keyed tables: remove duplicates created by the rename, then rename
DELETE FROM idempotency_keys b USING idempotency_keys p
 WHERE b.user_id ~ '^[0-9]+$' AND p.user_id = 'tg_' || b.user_id AND p.endpoint = b.endpoint AND p.idempotency_key = b.idempotency_key;
UPDATE idempotency_keys   SET user_id = 'tg_' || user_id WHERE user_id ~ '^[0-9]+$';
UPDATE reward_audit_events SET user_id = 'tg_' || user_id WHERE user_id ~ '^[0-9]+$';

-- 3. defensive: the same for task_completions and matches (expected to be 0 rows)
UPDATE task_completions SET user_id = 'tg_' || user_id WHERE user_id ~ '^[0-9]+$' ; -- if this fails on the unique key, delete the bare duplicates first (same pattern as step 2)
UPDATE matches SET user_id = 'tg_' || user_id WHERE user_id ~ '^[0-9]+$';

-- 4. orphan check: this must return zero rows before adding links
SELECT 'login_streaks', user_id FROM login_streaks WHERE user_id NOT IN (SELECT id FROM users)
UNION ALL SELECT 'task_completions', user_id FROM task_completions WHERE user_id NOT IN (SELECT id FROM users)
UNION ALL SELECT 'matches', user_id FROM matches WHERE user_id NOT IN (SELECT id FROM users)
UNION ALL SELECT 'reward_audit_events', user_id FROM reward_audit_events WHERE user_id NOT IN (SELECT id FROM users)
UNION ALL SELECT 'idempotency_keys', user_id FROM idempotency_keys WHERE user_id NOT IN (SELECT id FROM users);

-- 5. foreign keys (wallets, wallet_transactions, premium_subscriptions and referrals already have them)
ALTER TABLE login_streaks       ADD CONSTRAINT login_streaks_user_fk       FOREIGN KEY (user_id)   REFERENCES users(id) NOT VALID;
ALTER TABLE task_completions    ADD CONSTRAINT task_completions_user_fk    FOREIGN KEY (user_id)   REFERENCES users(id) NOT VALID;
ALTER TABLE matches             ADD CONSTRAINT matches_user_fk             FOREIGN KEY (user_id)   REFERENCES users(id) NOT VALID;
ALTER TABLE matches             ADD CONSTRAINT matches_winner_fk           FOREIGN KEY (winner_id) REFERENCES users(id) NOT VALID;
ALTER TABLE reward_audit_events ADD CONSTRAINT reward_audit_events_user_fk FOREIGN KEY (user_id)   REFERENCES users(id) NOT VALID;
ALTER TABLE idempotency_keys    ADD CONSTRAINT idempotency_keys_user_fk    FOREIGN KEY (user_id)   REFERENCES users(id) NOT VALID;
ALTER TABLE login_streaks VALIDATE CONSTRAINT login_streaks_user_fk;
ALTER TABLE task_completions VALIDATE CONSTRAINT task_completions_user_fk;
ALTER TABLE matches VALIDATE CONSTRAINT matches_user_fk;
ALTER TABLE matches VALIDATE CONSTRAINT matches_winner_fk;
ALTER TABLE reward_audit_events VALIDATE CONSTRAINT reward_audit_events_user_fk;
ALTER TABLE idempotency_keys VALIDATE CONSTRAINT idempotency_keys_user_fk;
COMMIT;
```

*Note on step 3:* task\_completions has a unique key, so an UPDATE that would collide must be handled by deleting the bare duplicate first (same pattern as step 2). The report in step 0 shows whether any such rows exist; they are not expected.

**Tests first (real database):** after signing in and calling the streak, task and eligibility endpoints for one player, every row written for that player has the same tg\_ ID; eligibility reads the tasks and matches written by the task and match code; inserting a streak row for a player who does not exist is refused by the database.

### II.2.4 Part 2b: one clock

**Rule.** Every daily or monthly decision uses Africa/Lagos (UTC+1, no daylight saving). Today the tasks controller uses UTC, the streak uses Lagos, and match dates use the database's own timezone.

```ts
// src/time/lagos-calendar-clock.ts additions
export function lagosDateOfInstant(instant: Date): IsoCalendarDate;          // wraps formatIsoCalendarDateInTimeZone
export function lagosMonthKeyOfInstant(instant: Date): string;             // 'YYYY-MM'
export function secondsUntilNextLagosMidnight(now: Date): number;           // never negative
```

- TasksController receives a CalendarClock and uses `clock.todayIsoCalendarDate()`; the repository's own seconds-remaining arithmetic (which assumes +01:00 by hand) is replaced by secondsUntilNextLagosMidnight.
- Database: add a stored Lagos date to matches and use it for every daily or monthly count.

```sql
ALTER TABLE matches ADD COLUMN lagos_date DATE;
UPDATE matches SET lagos_date = (created_at AT TIME ZONE 'Africa/Lagos')::date;
ALTER TABLE matches ALTER COLUMN lagos_date SET NOT NULL;
ALTER TABLE matches ALTER COLUMN lagos_date SET DEFAULT ((now() AT TIME ZONE 'Africa/Lagos')::date);
CREATE INDEX matches_user_lagos_date_idx ON matches (user_id, lagos_date);
```

**Tests first (pure, no database):** 2026-10-20T22:59:59Z is the Lagos date 2026-10-20 and 23:00:00Z is 2026-10-21; 2026-10-31T23:00:00Z is month key 2026-11; secondsUntilNextLagosMidnight at 22:59:59Z is 1 and at 23:00:00Z is 86,400; a task completed at 00:30 Lagos time counts for that Lagos day, not the UTC day.

### II.2.5 Part 2d: the rules endpoint

**GET /api/config/rules** (signed in; cacheable for 5 minutes). One typed object that is the rulebook of Section 3, so the app never holds its own numbers.

```ts
// src/config/product-rules.config.ts
export const PRODUCT_RULES = {
  version: 1,
  timeZone: 'Africa/Lagos',
  tasks: { dailyTaskCount: 4, pointsPerTask: 50, taskDayRequiresAllTasks: true },
  practice: { regularDailyStartLimit: 5, qualificationMatchTarget: 25 },
  ranked: { dailyLimit: 3, cooldownAfterMatchNumber: 2, cooldownMinutes: 60, premiumHasCooldown: false },
  streak: {
    windowDays: 30, graceDays: 1,
    regular: [{ day: 14, airtimeNgn: 50 }, { day: 20, adFreeDay: true }, { day: 30, airtimeNgn: 100, requiresPracticeMatches: 25 }],
    premium: [{ day: 10, airtimeNgn: 50 }, { day: 20, airtimeNgn: 100 }, { day: 30, airtimeNgn: 200 }],
  },
  leaderboard: { topN: 100, requiredTaskDays: 20, requiredRankedWins: 15, scoreMatchesDenominator: 50, regularRequiresPracticeMatches: 25 },
  referral: { pointsEach: 150, qualificationTaskDays: 3, qualificationWindowDays: 30, regularRefereeRequiresPracticeMatches: 25 },
  premium: { plans: [
    { id: 'PREMIUM_1M', days: 30, stars: 55,  priceNgn: 1000 },
    { id: 'PREMIUM_3M', days: 90, stars: 150, priceNgn: 2700 },
  ] },
  wallet: { minRedemptionNgn: 50, maxRedemptionNgnPerTransaction: 100000, maxRedemptionNgnPerDay: 100000 },
  ads: { bannerEnabled: true },
} as const;
```

- The Star amounts move to a database table in Step 9 (weekly price review); the endpoint then reads the table.
- A Zod schema (`product-rules.schema.ts`) validates the object at start-up and in the endpoint's tests.
- **App:** config/rules.endpoints.ts, api/rules.api.ts (useGetRules with no refetching), types/interfaces/rules.types.ts (IProductRules). Every screen that shows a reward, a limit or a price reads it from here.

**Tests first:** each number in the object equals the rulebook in Section 3 (one assertion per rule, so changing a rule means changing a test on purpose); the endpoint requires sign-in; the response validates against the schema.

### II.2.6 Part 2e: the app follows the Scrella standard

The type-checker already passes with **strict mode on**: running it with strict across 54 source files gives 0 errors, so strict can be switched on at no cost. Steps, each its own small change with type-check and build green:

```bash
# 1. folders and file names
git mv src/features src/views
git mv src/store src/stores
git mv src/api/client.ts src/api/methods.api.ts
# 2. fix imports with the editor's 'rename' (or a find-and-replace), then:
npx tsc --noEmit && npx vite build
```

3. Split API\_ROUTES into config/\<domain>.endpoints.ts typed maps (tasks, wallet, matches, leaderboard, premium, rules), each with an interface such as ITasksEndpointMap.
4. Rename every exported interface in types/interfaces with the I prefix (use the editor's rename-symbol so references follow). Add string enums with the Enum suffix for server-defined values: TransactionStatusEnum, WalletEntryKindEnum, PremiumStateEnum, MatchModeEnum, MatchPhaseEnum.
5. Query hooks gain `params` and the retry rule (no retry for client errors, at most 2 for server errors) and put params into the query key.
6. Remove business logic and derived truth from the auth store: claimStreakReward, updateUserStats and the persisted loginStreak go; the store keeps the session token and the signed-in user summary.
7. Extract page fragments, lobby and wallet first (Step 7 and Step 10 depend on them).
8. In tsconfig: set strict to true; remove experimentalDecorators, allowJs and the Jest type. Add the Scrella ESLint flat config and an `npm run lint` script.

```bash
npm i -D eslint @eslint/js globals eslint-plugin-react-hooks eslint-plugin-react-refresh typescript-eslint
```

9. Clean-up: package name; remove express, dotenv, @google/genai, esbuild, tsx and @types/express from the app's dependencies; delete metadata.json, refactor-routing.cjs, remove-fc.cjs, the duplicate lockfile and public/\_redirects; replace the AI Studio README.
10. Add Vitest and Testing Library; move the existing frontend test files onto the runner.

**Tests first:** none of these change behaviour, so the proof is: type-check green, build green, the six screenshots from the review unchanged, and the existing frontend test files running.

### II.2.7 Part 2f: remove false statements from the screens

| Screen | Today | Change |
| --- | --- | --- |
| Leaderboard | 'QUALIFIED ✓' for every player; rank '#' empty | Remove the status badge until Step 11 supplies real progress. Show '—' when rank is empty. |
| Home | Rank '#' empty; trend arrow with no value | '—' for an empty rank; hide the arrow when there is no trend. |
| Wallet | 'Ready for Top-up' at ₦0; ₦500 pre-selected; 'Instant' and 'No bank KYC needed' | Remove all three. No amount is pre-selected. Amount buttons come from the rules (₦50 minimum). |
| Tasks | 'Complete all daily tasks' has a Start button; 'play Match' label; Day-14 label fixed at ₦30 | No button on the bonus task (it completes itself). Button text 'Watch video to unlock a practice match' until Step 6. Reward labels read from the rules. |
| Profile | 'Strict legal compliance guarantee' and 'Regulatory compliance architecture' boxes | Delete both. Add a 'Terms and Rules' link to a page whose wording counsel approves (O11). |
| Lobby | Friends card; permanent 'Searching for opponent...' panel | Remove the Friends card (D1). Remove the static panel; the real search card arrives in Step 7. |
| Leaderboard and Result | Avatar fallback is a stock photo from another website | Generate an initials avatar locally. |
| Everywhere | Google Fonts and the Telegram and ad scripts loaded from other hosts; three console.log calls | Self-host the fonts (@fontsource/bebas-neue and @fontsource/inter); keep only the two scripts that are required; delete the console.log calls. |

**Tests first (Vitest and Testing Library):** each screen renders its empty state when its data is empty; no screen contains the removed phrases.

### II.2.8 Part 2g: deployment

```json
// cash-dey-play-frontend/vercel.json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

- Delete public/\_redirects (it is a Netlify format).
- Add a public **GET /healthz** route that returns `{ "ok": true }`, exempt from sign-in and from the per-address limit, for Render's health check and an uptime monitor. It must reveal nothing else.
- Install Sentry in both apps (VITE\_SENTRY\_DSN, SENTRY\_DSN); redact tokens and phone numbers.
- The backend's allowed origin is exactly the Vercel address; no wildcard.
- **Check:** open https://cash-dey-play-ckkt.vercel.app/wallet directly and refresh: it must show the app, not a 404.

### II.2.9 Part 2h: server hardening

| Item | Change | Test first |
| --- | --- | --- |
| Rate limits | The per-address limit (120 a minute) wrongly blocks many players who share one mobile address. Apply a strict per-address limit (30 a minute) **only** to the public routes (sign-in, /healthz). Every other route is limited per signed-in player (60 a minute; money routes 10 a minute). If Redis is down, limits fail open with an alert, except money routes, which fail closed. 'Retry-After' reports the real time left. | Two players on one address do not block each other; a money route limit; Redis-down behaviour |
| Input checks | A Zod schema for every route's body, query and params, applied with the existing validate-request middleware. Example: `z.object({ taskId: z.enum(['task_login_video', 'task_unlock_video']) })`. | Wrong or extra fields are refused with 400 |
| Tokens | Sign and verify with the algorithm named (HS256). Token lifetime 24 hours (the app signs in again from Telegram each launch). | A token signed with another algorithm or an expired token is refused |
| Sign-in data | Reject a timestamp more than 60 seconds in the future. Keep the existing maximum age. | Future-dated sign-in data refused |
| Player exists | On the sign-in-data path, make sure the player row exists (one insert-if-missing, remembered for 5 minutes in memory) so a first call cannot hit a foreign-key error. | First call with new valid sign-in data succeeds |
| Dev shortcut | The developer ID header must be digits only, otherwise 400. | Non-numeric header refused |
| Type shortcuts | Remove the remaining 'any' casts with the typed request. | Type-check |

### II.2.10 Rollout and rollback

Order: 2c (tooling and baseline) then deploy; back up the database; 2a migration in a quiet hour; 2b migration; code for 2a, 2b and 2h; then 2d; the app parts 2e to 2g can ship independently. Rollback of a migration: restore from the backup taken before it (the rename in 2a is not reversible in place). Each migration runs in a transaction and stops on the first error.

### II.2.11 Finish line

The checks pass on every change with real Postgres and Redis; a database built from migrations alone matches production; every player-linked table has a link to users; the Lagos boundary and identity tests pass; the rules endpoint matches the rulebook; the app builds under strict mode and lint with the six reviewed screens unchanged apart from the removals in 2f; opening any route directly works on Vercel; the hardening tests pass.

## II.3 Specification 3: Entitlements, premium data and the daily task model

### II.3.1 Objective and boundaries

The server decides, in one place, what each player may do; premium becomes an expiry date; the four daily tasks get a proper state (including the premium **Claim**); a task day is derived as the A9 rule says. Not in this step: taking payment (Step 9), verified ads (Step 6), the ads-free day being granted (Step 8; the table and the check exist now).

**Preconditions:** Step 2 done (one identity, Lagos clock, migrations, rules endpoint).

### II.3.2 Files

| File | Purpose |
| --- | --- |
| src/entitlements/premium-state.ts | Pure function: expiry date and now give the premium state |
| src/entitlements/entitlements.service.ts, entitlements.types.ts, entitlements.repository.ts | Compute and return UserEntitlements |
| src/tasks/daily-task-state.repository.ts, daily-task.service.ts | Task rows per player per Lagos day; claim; bonus |
| src/http/controllers/tasks.controller.ts, routes | New claim route; changed state response |
| src/http/controllers/user.controller.ts | GET /users/me adds entitlements |
| src/http/controllers/premium.controller.ts | GET /premium/status |
| App: api/users.api.ts (useGetMe), hooks/useEntitlements.ts, types/interfaces/entitlements.types.ts, Tasks view fragments | Read-only use of the server's answer; Claim button |

### II.3.3 Database changes

```sql
-- Premium: expiry date only. Orders table for Step 9.
ALTER TABLE premium_subscriptions ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE premium_subscriptions ADD COLUMN IF NOT EXISTS source_order_id TEXT;

CREATE TABLE IF NOT EXISTS premium_orders (
  id                         TEXT PRIMARY KEY,
  user_id                    TEXT NOT NULL REFERENCES users(id),
  plan_id                    TEXT NOT NULL,
  stars_amount               INTEGER NOT NULL CHECK (stars_amount > 0),
  status                     TEXT NOT NULL CHECK (status IN ('CREATED','PAID','REFUNDED','FAILED','EXPIRED')),
  telegram_payment_charge_id TEXT UNIQUE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at                    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS premium_orders_user_idx ON premium_orders (user_id, created_at DESC);

-- Ads-free day (written in Step 8, read now)
CREATE TABLE IF NOT EXISTS ad_free_days (
  user_id    TEXT NOT NULL REFERENCES users(id),
  valid_on   DATE NOT NULL,
  source     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, valid_on)
);

-- The four daily tasks, one row per player per Lagos day
CREATE TABLE IF NOT EXISTS daily_task_state (
  user_id        TEXT NOT NULL REFERENCES users(id),
  lagos_date     DATE NOT NULL,
  task_key       TEXT NOT NULL CHECK (task_key IN ('MANDATORY_VIDEO_LOGIN','MANDATORY_VIDEO_UNLOCK','WIN_RANKED_MATCH','BONUS_ALL_COMPLETE')),
  status         TEXT NOT NULL CHECK (status IN ('AVAILABLE','AUTO_READY','CLAIMED')),
  source         TEXT CHECK (source IN ('VIDEO','AUTO_PREMIUM','AUTO_AD_FREE_DAY','RANKED_WIN','BONUS')),
  points_awarded INTEGER NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lagos_date, task_key)
);

-- Carry over completed mandatory videos
INSERT INTO daily_task_state (user_id, lagos_date, task_key, status, source, points_awarded)
SELECT user_id, completed_on,
       CASE task_key WHEN 'MANDATORY_VIDEO_LOGIN' THEN 'MANDATORY_VIDEO_LOGIN' ELSE 'MANDATORY_VIDEO_UNLOCK' END,
       'CLAIMED', 'VIDEO', 50
FROM task_completions
WHERE task_key IN ('MANDATORY_VIDEO_LOGIN','MANDATORY_VIDEO_UNLOCK')
ON CONFLICT DO NOTHING;

-- Every premium row so far came from the free endpoint (no payment path ever existed): revoke them.
-- If specific testers must keep premium, re-grant them by hand afterwards with a note.
DELETE FROM premium_subscriptions;
```

The column users.is\_premium is **no longer read** from this step on. It is dropped in a second migration after the code is live (add first, switch the code, remove later).

### II.3.4 Types and logic

```ts
export type PremiumState = 'NONE' | 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';

export function derivePremiumState(expiresAt: Date | null, now: Date): PremiumState {
  if (expiresAt === null) return 'NONE';
  if (expiresAt.getTime() <= now.getTime()) return 'EXPIRED';          // exactly at expiry is already expired
  return expiresAt.getTime() - now.getTime() <= 3 * 86_400_000 ? 'EXPIRING_SOON' : 'ACTIVE';
}

export interface UserEntitlements {
  tier: 'FREE' | 'PREMIUM';
  premiumState: PremiumState;
  premiumExpiresAt: string | null;
  isAdFreeToday: boolean;               // premium, or a row in ad_free_days for today's Lagos date
  showsVideoAds: boolean;               // !isAdFreeToday
  showsBannerAds: boolean;              // always true (D11)
  practice: { dailyStartLimit: number | null; requiresAdBeforeStart: boolean; qualificationGateApplies: boolean };
  ranked: { dailyLimit: number; cooldownApplies: boolean };
  videoTasksAutoReady: boolean;         // premium, or an ads-free day (A1)
  streakTable: 'REGULAR' | 'PREMIUM';
}

export function computeEntitlements(input: {
  premiumExpiresAt: Date | null; adFreeToday: boolean; now: Date; rules: ProductRules;
}): UserEntitlements;
```

Premium means state ACTIVE or EXPIRING\_SOON. A premium player: tier PREMIUM, unlimited practice with no ad, no cooldown, no qualification gate, video tasks auto-ready, premium streak table. A player on an ads-free day (not premium): no video ads and auto-ready video tasks only; all other rules stay regular.

**Task state rules (run when the app asks for GET /tasks/state, inside one transaction)**

1. Insert today's four rows if missing (ON CONFLICT DO NOTHING). Video rows start AUTO\_READY when videoTasksAutoReady, otherwise AVAILABLE. Win and bonus rows start AVAILABLE.
2. If the player became premium or got an ads-free day since the rows were made, flip AVAILABLE video rows to AUTO\_READY. If premium ended, flip unclaimed AUTO\_READY video rows back to AVAILABLE. (The tier at the moment of claiming decides, D6.)
3. **Claim** (POST /api/tasks/{taskKey}/claim, video keys only): one conditional UPDATE from AUTO\_READY to CLAIMED returning the row; if no row comes back the answer is 409 TaskNotClaimable with a reason (already claimed, not ready, no longer premium). Add 50 points to the player in the same transaction. Then, if the two video tasks and the win task are all CLAIMED and the bonus is not, mark the bonus CLAIMED and add its 50 points, in the same transaction.
4. A regular player's video task is completed through the existing endpoint (still reported by the phone until Step 6), which now writes a CLAIMED row with source VIDEO using the same transaction and the same bonus check.
5. The win task is completed by the game server in Step 7; the app can never complete it.
6. A **task day** is a Lagos date with all four rows CLAIMED. The monthly eligibility query changes to count those dates:

```sql
SELECT COUNT(*)::int FROM (
  SELECT lagos_date FROM daily_task_state
  WHERE user_id = $1 AND lagos_date >= $2 AND lagos_date < $3 AND status = 'CLAIMED'
  GROUP BY lagos_date HAVING COUNT(*) = 4
) AS task_days;
```

### II.3.5 Contracts

**GET /api/users/me** adds `entitlements` (the UserEntitlements object).

**GET /api/premium/status** returns `{ state, isPremium, expiresAt, daysLeft }`.

**GET /api/tasks/state** keeps its old fields so the current app still works and adds:

```json
{ "data": {
  "lagosDate": "2026-10-21",
  "taskDayComplete": false,
  "tasks": [
    { "id": "task_login_video", "key": "MANDATORY_VIDEO_LOGIN", "title": "Watch Daily Login Video", "points": 50,
      "status": "AUTO_READY", "action": "CLAIM", "isCompleted": false }
  ] } }
```

`action` is WATCH\_VIDEO, CLAIM or NONE, so the app never works the rule out itself.

**POST /api/tasks/{taskKey}/claim** returns 200 `{ task, pointsEarned, bonusAwarded, tasks }`. Errors: 400 UnknownTask; 409 TaskNotClaimable with reason.

### II.3.6 Tests first

- **Premium state table:** no row is NONE; one millisecond before expiry is EXPIRING\_SOON; exactly at expiry is EXPIRED; exactly 3 days left is EXPIRING\_SOON; 3 days and 1 ms left is ACTIVE.
- **Entitlement matrix:** none, active, expiring soon, expired, ads-free day only, premium plus ads-free day; every field of UserEntitlements for each.
- Rows are created once however often the state is fetched; buying premium mid-day flips video rows; premium ending flips unclaimed rows back; a claim after premium ended is refused.
- Claim awards 50 once; two simultaneous claims award once (real database); the bonus is awarded exactly once when the third task completes, and never when only two are done.
- A regular player cannot claim; a premium player can claim both videos and still needs a ranked win for a task day.
- The migration carries old completions over; existing premium rows are gone after it.
- Eligibility counts a date only when all four tasks are CLAIMED.
- /users/me includes entitlements; /premium/status for each state.

### II.3.7 Edge cases

Expiry at exactly Lagos midnight; the clock moving between two requests; a refund while a claim is in flight; premium bought on two devices at once; the ads-free day and premium together (no double effect); a player whose first request of the day is at 23:59:59 and whose next is at 00:00:01 (new rows for the new date, old rows untouched).

### II.3.8 Rollout and rollback

Expand first: run the migration (new tables, backfill, premium revoke), then deploy code that reads the new tables. Deploy the app after the backend (old apps ignore the new fields). Remove users.is\_premium and premium\_subscriptions.is\_active in a later migration once nothing reads them. Rollback: the old code still works against the new tables; the revoked premium rows can be restored from the backup taken before the migration.

### II.3.9 Finish line

GET /users/me returns the right entitlements for every case in the matrix; a premium player completes both video tasks by tapping Claim and nothing else; a regular player cannot; the bonus pays once; no screen decides premium by itself; the old free premium is gone.

## II.4 Specification 4: Referrals

### II.4.1 Objective and boundaries

The referral link opens the Mini App, the server records who referred a new player (once, on that player's first sign-in), codes stop revealing Telegram IDs, and the app shows progress. Qualification (3 task days, practice matches, +150 points) is evaluated in Step 8, when those counts exist.

**Preconditions:** Step 2 (migrations, strict types); Telegram settings from Appendix A.

### II.4.2 Files

| File | Purpose |
| --- | --- |
| src/http/telegram/verify-telegram-init-data.ts | Also return `startParam` (it is part of the signed data) |
| src/referrals/referral-code.ts | generateReferralCode(): 8 characters |
| src/referrals/referral.repository.ts, referral.service.ts | Look up, create, summarise |
| src/db/repositories/user.repository.ts | Upsert also reports whether the row was newly created |
| src/auth/auth.service.ts | After sign-in, capture the referral (never blocks sign-in) |
| scripts/regenerate-referral-codes.ts | One-off: replace REF\_\<telegram id> codes |
| App: config/telegram.config.ts, helpers/referral.helpers.ts, views/Profile/PageFragments/ReferralCard.tsx, api/referrals.api.ts | Link, share and progress |

### II.4.3 Database changes

The referrals table already has referrer\_id, referred\_id, qualifying\_task\_days, is\_qualified and a pair-unique key.

```sql
ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','QUALIFIED','EXPIRED')),
  ADD COLUMN IF NOT EXISTS completed_practice_matches INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days');
UPDATE referrals SET status = 'QUALIFIED' WHERE is_qualified;
CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_unique ON referrals (referred_id);   -- one referrer per player
ALTER TABLE referrals ADD CONSTRAINT referrals_no_self_referral CHECK (referrer_id <> referred_id);
```

Before the unique index, check there are no repeated referred\_id values (none are expected: nothing writes this table today).

### II.4.4 Logic

```ts
// referral-code.ts: no 0, O, 1, I, L, so codes survive being read aloud
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function generateReferralCode(): string {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

// user.repository.ts: newly created rows have xmax = 0
// INSERT ... ON CONFLICT (id) DO UPDATE SET ... RETURNING *, (xmax = 0) AS was_created
// Retry up to 5 times on a unique violation of referral_code.

// referral.service.ts
async captureOnFirstSignIn(input: { referredUserId: string; wasCreated: boolean; startParam: string | null }): Promise<void>;
```

**captureOnFirstSignIn rules:** do nothing unless wasCreated is true; accept the start parameter only if it matches `^[A-Za-z0-9_-]{4,64}$`; upper-case it; find the owner of that code; ignore an unknown code or the player's own code; insert with ON CONFLICT DO NOTHING (the unique index guarantees one referrer per player); wrap everything so an error is logged and **sign-in still succeeds**. Players who already have an account and open a referral link later are not referred (referrals are for new accounts only).

**GET /api/referrals/summary**

```json
{ "data": {
  "referralCode": "K7M2QX9P", "invitedCount": 3, "qualifiedCount": 1, "pointsEarned": 150,
  "referrals": [ { "username": "chidi", "status": "PENDING", "qualifyingTaskDays": 2, "taskDaysRequired": 3,
                   "practiceMatches": 10, "practiceMatchesRequired": 25, "expiresAt": "2026-11-20T10:00:00Z" } ] } }
```

practiceMatchesRequired is 25 for a regular referee and null for a premium referee (D10). Only the Telegram username (already public) or 'Player' is shown.

**App**

```ts
// helpers/referral.helpers.ts
export const buildReferralLink = (code: string): string =>
  `https://t.me/${TELEGRAM_BOT_USERNAME}/${TELEGRAM_MINIAPP_SHORT_NAME}?startapp=${encodeURIComponent(code)}`;
export const buildTelegramShareLink = (link: string, text: string): string =>
  `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
```

Settings: VITE\_TELEGRAM\_BOT\_USERNAME=Cash\_dey\_play\_bot and VITE\_TELEGRAM\_MINIAPP\_SHORT\_NAME=Cash\_Dey\_Play. Share by opening the share link through the Telegram app's own link call; fall back to copying with a message if that call is missing. The referral card shows the player's link, the counts, and each referral's progress; no cash is shown anywhere (D14).

### II.4.5 Tests first

- parseStartParam: accepts valid codes; refuses empty, 65 characters, spaces, punctuation and an injection string; the value comes from signed data (altering it breaks the signature).
- generateReferralCode: length 8; only the allowed characters; no collision in 100,000 draws.
- captureOnFirstSignIn: creates one referral; ignores an existing player, self-referral, unknown code, second referrer; an error inside never fails sign-in.
- Real database: two simultaneous first sign-ins with the same link produce exactly one referral row and one referrer.
- Summary: shape, privacy (only username), premium referee shows null for the practice target.
- Link builders produce exactly https://t.me/Cash\_dey\_play\_bot/Cash\_Dey\_Play?startapp=K7M2QX9P and the matching share link.
- App: the referral card renders empty, loading, error and populated states.

### II.4.6 Edge cases

A player opens the link, closes the app, then signs in later (still new: counted once); a deleted or renamed bot username (the link builder reads settings, so no release is needed to fix it); the same person with two accounts (device checks in Step 13; the daily-task and practice requirements raise the cost of farming); the old REF\_\<id> codes no longer resolve after the script runs (they never worked in links).

### II.4.7 Rollout and rollback

Run the migration; deploy the backend; run the regenerate script once; set the two Vercel settings and deploy the app; on two phones, open a link from Telegram and check one referral row appears. Rollback: revert the code; the new columns are harmless.

### II.4.8 Finish line

Opening a referral link on a real phone opens the app, signs the player in and creates exactly one referral; the old 'user does not exist' message cannot occur; the card shows progress with no cash anywhere.

*Specifications II.5 to II.13 follow in the same format.*
