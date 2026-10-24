> Historical reference. Current ordered implementation contracts and status: [delivery specifications](delivery/README.md). Conflicting instructions in this document are superseded there.

# Validation of the agent's `implementation-specs.md`

Checked on 21 Oct 2026 against: the Project Audit findings, the Build Order and Implementation Plan (Part I and Part II), the real repository (`src/db/schema.sql`, auth, repositories), and the PRD.

## Verdict

**Do not implement from this file as written.** It is a good architectural summary, and its matchmaking and anti-cheat sections follow the plan. But:

- it covers only part of the Audit (7 of 37 findings fully, 17 partly, 11 not at all, 2 specified incorrectly),
- several SQL and code blocks would fail or misbehave on the real database,
- it states business decisions the business never made,
- it has no tests-first lists, finish lines, migrations or rollback for any step.

Use **Part I + Part II of the plan document** as the source of truth. Treat the agent's file as a reference draft only.

## A. Errors that would break the build or the business

| # | Where in the agent file | Problem | Correct approach |
|---|---|---|---|
| E1 | 2.2 C (referral capture) | SQL inserts into `referrals (referrer_id, referee_id, referral_code, ...)` and uses `ON CONFLICT (referee_id)`. The real table has **`referred_id`**, no `referee_id`, no `referral_code`, and no unique index on `referred_id`. The statement fails. It also tests `startParam.startsWith("ref_")`, but codes are `REF_<id>` today and random 8-character codes after Step 4, so nothing would ever match. New users get a NULL `referral_code`, so no code is ever generated. "Is new user" is a SELECT before the INSERT, which is racy. | Spec II.4: add the missing columns and the unique index by migration, generate random codes, detect creation with `(xmax = 0)` on the upsert. |
| E2 | 2.2 C | Re-implements Telegram signature verification inside `AuthService`. A correct, tested version already exists (`verify-telegram-init-data.ts`, with tests). It reads `process.env` inside a service. It renames the JWT payload to `sub`, but the existing middleware reads `decoded.userId`, so every current token and test would break. It does not fix the real cause of C1 (`env.config.ts` defaults). | Extend the existing function (add `startParam`, reject future `auth_date`). Keep the token payload or change middleware, tokens and tests together. Fix `env.config.ts` as in Step 1 (already built). |
| E3 | 8.2 (Stars webhook) | The paid-order SQL always adds **30 days**, so a 3-month purchase would give one month. Telegram can repeat a payment message; the SQL has no unique charge-ID guard, so a repeat extends premium again. Column and status names (`charge_id`, `PENDING`) differ from the plan (`telegram_payment_charge_id`, `CREATED`). Webhook secret-token verification appears only in the roadmap, not in the handler. No refund handling. | Spec II.3 and Step 9: unique `telegram_payment_charge_id`; days come from the plan; update only `WHERE status <> 'PAID'`; verify the secret header first; refunds revoke. |
| E4 | 10.2 and O12 (prize bands) | Maps the PRD's percentages to individual ranks: "1st 27%, 2nd 24%, 3rd 18% ...". The PRD table is **bands**: rank 1 = 8% of the pool; ranks 2-3 share 9%; 4-10 share 14%; 11-25 share 18%; 26-50 share 24%; 51-100 share 27%. The agent's version would pay rank 1 more than three times too much. | Implement the PRD table exactly (per-person share = band % divided by winners in the band). Pay only qualified players; do not pad to 100. Tie-breaks: total wins, then fewest losses, then earliest date the 15th win was reached (all in PRD Section 6). |
| E5 | 10.1 (task days) | Defines a task day as at least one task. Business answer A9: **all tasks on the task page completed**. | Spec II.3: a task day is a Lagos date with all four task rows CLAIMED. |
| E6 | 12 (open items) | Presents business decisions as resolved that nobody decided: Whot rule set ("no penalty stacking"), float threshold ₦50,000 and **₦10,000 per user per day** (the business said ₦100,000 per transaction and per day), prize finance, "double points" prime time, "Approved" for the Scrella package, "YES to all" for A1-A9 (A3, A6 and A9 were answered differently), alternative hosts (the backend is already on Render). | Remove. These stay **open** until the business answers. The Whot rule set in particular must be signed by the business. |
| E7 | 3.4 (matchmaker) | The lock is released with an unconditional `DEL` (a slow tick can delete another instance's lock); the lock value is a process ID, not unique across hosts; the compatibility check ignores ranked allowance, cooldown and lockout; the "met today" test refuses **any** earlier meeting, contradicting its own 2-per-day rule; if creating the offer fails after the atomic removal, both players are lost from the queue. | Owner-token lock released with compare-and-delete; full compatibility check; count meetings per day; put both tickets back if offer creation fails. |
| E8 | 4.2 (shuffle) | Seeds a 32-bit generator (mulberry32 or splitmix32) from a 128-bit seed. The state is only 32 bits, so a player could try all 2^32 seeds against their own hand and the top card and learn the opponent's hand and the draw pile. | Shuffle with a cryptographically secure generator at match start and record the resulting deck order in the event log. (The plan's earlier wording, 'recorded seed', is corrected in the plan document.) |
| E9 | 6.2 (Adsgram) | Invents a callback as a POST with a JSON body containing `session_id` and `user_id: "tg_..."`. Adsgram's documented reward URL is a callback carrying the player's Telegram ID. The link between an ad session and a credit is not specified. | Check the current Adsgram documentation and the dashboard before building; use an unguessable token in the URL; define the session-to-credit link explicitly. |
| E10 | 7.3 (streak claims) | `streak_milestone_claims` uses `window_index` (the real schema keys windows by `window_start_date`) and has no unique key, so duplicate claims are allowed; no eligibility gate, duplicate-protection key, or tier-at-claim check. | Spec II.8 (to be written): unique (user, window start date, milestone day); one transaction with the ledger credit. |

## B. Coverage of the Audit findings

Status: Covered, Partial, Missing, Wrong.

| ID | Finding | Status | Note |
|---|---|---|---|
| C1 | Forgeable login settings | Partial | Identified; Step 1 line only; default-to-production and dev-shortcut rules not specified |
| C2 | Repeatable task points | Partial | One line, no transaction spec or tests |
| C3 | Client reports the win | Covered | Line item |
| C4 | Free premium | Covered | Line item |
| C5 | Money loop disconnected | Partial | Ledger and payouts yes; caps invented (E6) |
| C6 | Double claim race | **Missing** | Not mentioned |
| C7 | No game | Covered | |
| C8 | No matchmaking | Covered | Follows the plan; has bugs E7 |
| H1 | Two user IDs | Partial | No data migration, merge rule or foreign keys |
| H2 | App streak is fiction | Partial | Store cleanup yes; fake sync endpoint, relaunch reset not covered |
| H3 | Matches table cannot hold a match | **Missing** | No `matches` or `match_players` schema |
| H4 | Three clocks | Partial | Utility named; no SQL or `lagos_date` |
| H5 | Leaderboard mismatches | Partial | Task-day rule wrong (E5); no counter removal, formula or app duplicate handling |
| H6 | Referrals broken | **Wrong** | E1 |
| H7 | Premium never ends | Partial | Derived entitlement yes; old free premium rows and `is_premium` not handled |
| H8 | Ads not server-verified | Partial | Callback invented (E9); no build guard against fake ads |
| H9 | No payments | **Wrong** | E3 |
| H10 | Premium cannot complete tasks | Covered | |
| H11 | Fake-success endpoints | Partial | Only match stubs |
| H12 | Hidden-card leak | Covered | |
| H13 | Hosting and Vercel gap | Partial | Vercel rewrite yes; host options wrong |
| M1 | Rate limiting | **Missing** | |
| M2 | Input validation | **Missing** | No Zod |
| M3 | Two code styles | Partial | |
| M4 | Prisma, migrations, compose, CI | **Missing** | |
| M5 | Token storage and lifetime | Partial | Algorithm pinned; 7 days kept; cookie not addressed |
| M6 | Kobo versus naira | **Missing** | |
| M7 | Optional-video race, public callback | **Missing** | |
| M8 | Sign-in details | Partial | Future timestamp only |
| M9 | App and server shapes differ | **Missing** | |
| M10 | Privacy | Partial | Masking mentioned |
| M11 | Outside services at run time | Partial | Fonts only |
| M12 | Duplicated rule engines | Partial | Endpoint named, contents not specified |
| M13 | Truth stored on the phone | Covered | |
| M14 | Strict TypeScript, ESLint | **Missing** | |
| Hygiene | Scaffold packages, lockfiles, scripts, README, test runner, console.log | **Missing** | |
| Screens | False 'QUALIFIED', internal legal text, wallet claims, empty ranks | **Missing** | |

**Totals (35 numbered findings + 2 groups):** 7 covered, 17 partial, 11 missing, 2 wrong.

## C. What the agent file does well (reuse)

The topology diagram; the client and server event tables; the ready-check and penalty ladder text; the projection function for hidden information; the lobby fragment folder layout; the ledger-and-refund flow idea; the roadmap list of steps.

## D. Missing from every step in the agent file

Named tests written first; the migration SQL; request and response contracts; edge cases; Render and Vercel settings; rollback; a finish line. These exist in Part II of the plan for Steps 1 to 4.

## E. Corrections made to the plan document as a result

- Prize bands are written out explicitly (rank 1 = 8% of the pool, and so on).
- Open item O12 no longer asks for a tie-break rule: the PRD already defines it.
- The shuffle requirement says 'cryptographically secure shuffle, recorded deck order' instead of 'recorded seed'.
