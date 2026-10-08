# Cash Dey Play — Nigeria Market PRD (Final)

**Platform:** Telegram Mini App
**Game Type:** Whot-style card game with skill-ranked, non-gambling reward layers
**Market:** Nigeria only (single-market launch)
**Target Audience:** Casual gamers, 18–35, seeking extra income
**Starting Budget:** ~$1,500 (~₦2.1M)

---

## 0. Executive Assessment (Desirability / Feasibility / Viability)

**Desirability:** The underlying need — supplementary income via mobile gaming — is large and proven in Nigeria. But this product's earning potential has been deliberately reduced at every step to stay legally clean (no cash Daily Earn, hard 20-day/win-15 gates for real payouts). That's the correct tradeoff for this budget, but it means the product no longer matches what users searching "games that pay real money in Nigeria" are actually looking for — see Section 1.1 for direct competitors already meeting that demand with real cash and lower friction.

**Feasibility:** Not achievable in full at the ~$1,500 starting budget. Six interlocking reward systems, real-time server-authoritative multiplayer, a rolling-window streak engine, and payout/ad integrations are realistically a $15,000–40,000+ build if done properly, or many months of high-risk solo work. Build order matters more than feature completeness — see Section 15.

**Viability:** Revenue projections (Section 11) are rate-card estimates, not observed data — treat as directional until one ad network is live. No defensible moat exists (Whot is public domain, mechanics are cloneable in a weekend); the real edge is Telegram-native distribution and trust, not payout size, which an entrenched, better-capitalized competitor already wins on. Not currently investor-fundable as a venture-scale story — better framed as a deliberately bootstrapped small business until real retention/revenue data exists.

**Bottom line:** Build the free-to-play core loop first, prove retention, get real ad data, and be honest in marketing that this is a "fun free Whot game with real but modest rewards," not "earn money playing cards" — the gap between that promise and what the legally-safe mechanics can actually deliver is the single biggest risk to user trust identified in this document.

---

Cash Dey Play is a free-to-play Telegram Mini App built around Whot, Nigeria's national card game. Users play matches, complete daily tasks, and earn through three deliberately separated reward systems — a fixed-rate ad-watching program, a skill-ranked monthly leaderboard, and a referral/community-builder track — funded by ad revenue and premium subscriptions.

Every mechanic in this document has been structured to avoid the **consideration + chance + prize** combination that triggers gambling/lottery regulation. This is a design constraint applied from the start, not a retrofit — see Section 2.

### 1.1 Competitive Landscape

| Competitor | What they do better | Our actual edge |
|---|---|---|
| MPL Naija (operated by Carry1st — carry1st.com/games/mpl-naija-pro) | Real cash, direct bank/OPay withdrawal, claims 100,000+ players and ₦500M+ paid out to date, 18+ gated, free practice mode before real-money play | None on the money axis. Telegram-native, zero-install distribution only |
| Ludo Star, Chess Cash, Gamee Prizes, other "games that pay" apps | Real cash via direct bank transfer, simpler games (lower skill floor = faster time-to-earn) | Whot's cultural specificity, if that resonates with a niche these under-serve |
| Hamster Kombat, Catizen, PAWS (tap-to-earn) | Zero-friction mechanic, viral scale, no legal exposure at all | Real card-game depth vs. a tap button — thin edge, matters only if users value gameplay over speed |
| Smaller/unverified Whot-branded apps (Waje Whot, WhotKing Naija, etc.) | Unclear — several read as low-quality SEO-bait, legitimacy unverified | Being visibly more trustworthy and legally careful than a sketchy clone is a real, if narrow, edge |

**Strategic recommendation:** Don't compete with MPL Naija head-on for "real money Whot" — they have capital, licensing, and scale this budget cannot match. Compete instead on the thing MPL doesn't natively own: social play within existing Telegram friend groups, with modest-but-real loyalty rewards layered on top, rather than positioning as a cash-earning app first.

---

## 2. Legal Positioning Summary

| System | Consideration? | Chance? | Category | Confidence |
|---|---|---|---|---|
| Daily Tasks (points, cosmetics) | No | No | Non-monetary loyalty rewards | High |
| Daily Earn (paid video views) | No | No — fixed payout | Rewarded-ads model | High |
| Cooldown-Skip video | No | No — pays in time, not money | Standard F2P monetization | High |
| Monthly Game Leaderboard (skill-ranked) | No | No — ranked by weighted win rate | Skill-based competition | Medium — needs local counsel sign-off before scaling payout size |
| Community Builder (Invite) Leaderboard | No | No — pure count, zero luck | Referral/affiliate contest | High |
| Influencer Commissions | N/A (contractor payment) | N/A | Standard marketing expense | High |
| Premium Subscription | Yes (payment) | **Must never touch odds or leaderboard eligibility** | Cosmetic/convenience SaaS | High, conditional on Section 8 rules being followed |

**Not legal advice.** This is a structural design position based on general consideration/chance/prize analysis, not a filed legal opinion. Confirm the Game Leaderboard mechanic (Section 6) with a Lagos-based gaming/tech lawyer before scaling its pool beyond a small initial size — this is the one open item in the entire design.

**Scope note:** India and Pakistan are excluded from this version. India's 2026 Online Gaming Act bans real-money games outright regardless of skill/chance distinction; Pakistan has no viable licensing pathway for this model. Nigeria-only for now.

---

## 3. Core Game Loop

1. **Login** → watch 1 mandatory video → claim daily login bonus (points).
2. **Tasks page** → watch 1 mandatory video → unlocks the day's matches.
3. **Play 2 free matches.**
4. **3rd match** gated behind a 1-hour cooldown — OR watch 1 video to skip the wait instantly (no cash payout for this one; the reward is time itself, pure ad margin).
5. **Up to 5 additional optional videos/day** → 1 practice match unlocked per video watched (non-monetary — no airtime payout).
6. **Daily video ceiling: 8 max** (2 mandatory + 1 skip + 5 optional) — above the earlier 6–7/day fatigue guideline; monitor completion/drop-off closely post-launch since these no longer carry a cash incentive.

Whot card rules unchanged from original design: number cards (3,4,6,7,9,10,11,12,13) standard play; action cards (1,2,5,8,14,20) special effects, excluded from any "guaranteed card" mechanic.

**Explicitly removed from original scope:** Lucky Start (paid odds-boosting), paid extra matches tied to prize eligibility, withdrawal KYC, cash/crypto payouts, and any RNG-boosting purchase of any kind. Telegram Stars purchases are limited to cosmetics, ad-removal, and unranked practice mode only.

---

## 4. Daily Tasks System

| Task | Points |
|---|---|
| Watch 1 mandatory video (login) | 50 |
| Watch 1 mandatory video (unlock tasks) | 50 |
| Win 1 match | 50 |
| Bonus: all complete | 50 |
| **Daily max** | **200** |

Points are non-monetary: cosmetics, badges, profile flair, priority matchmaking speed. Points never affect leaderboard rank or match odds.

**Activity Qualification — Unified Rule (applies as the baseline gate for Game Leaderboard, Free-tier rewards, Premium rewards, and Community Builder eligibility):**

- **Window:** rolling 30 days, not tied to calendar months. Starts when a user begins (or restarts) their qualifying period.
- **Requirement:** 20 active days within that window (an active day = completing ≥1 daily task).
- **Grace:** 1 forgiven missed day per window — doesn't break the count. A **second** missed day in the same window resets progress toward the *next* unearned milestone back to zero. **Already-collected rewards are never clawed back** — only forward progress resets.

**Per-track additional requirements:**

| Track | Baseline | Additional requirement |
|---|---|---|
| Game Leaderboard (Section 6) | 20 active days | Must **win** ≥15 of up to 50 matches played in the window |
| Free tier | 20 active days | 25 optional videos watched in the window (the up-to-5/day practice-match videos only — the 2 mandatory + 1 cooldown-skip video don't count toward this) |
| Premium tier | 20 active days | None — exempt from the video requirement, consistent with the ad-free perk (Section 8) |
| Community Builder referrer (Section 7) | 20 active days | None additional |

**Milestone rewards along the way** (kept as stepping-stone rewards, not replaced by the 20-day gate):

| Milestone | Free tier reward | Premium tier reward |
|---|---|---|
| Day 7 | Small cosmetic or +1 bonus optional video slot | Small cosmetic |
| Day 14 | ₦20–30 airtime | ₦100 airtime |
| Day 20/30 (full qualification) | ₦100 airtime + Game Leaderboard/Community Builder eligibility (if applicable) | ₦300 airtime + eligibility |

---

## 5. Daily Earn & Cooldown-Skip (Rewarded Video)

**Daily Earn (Optional Videos)**
- Reward: **1 practice match per video watched** — non-monetary, no airtime payout
- Cap: 5 optional videos/day
- Revenue: 100% of ad revenue retained per view (no payout offset)
- Feeds Day 30 milestone eligibility — see Section 4

**Cooldown-Skip**
- Unlocks the 3rd daily match instantly instead of a 1-hour wait
- No payout — reward is time, not money
- Pure margin: 100% of ad revenue retained per view

---

## 6. Monthly Game Leaderboard (Top 100, Skill-Ranked)

**Qualification:** 20 active days within a rolling 30-day window (Section 4's unified rule, 1 grace day allowed) AND winning ≥15 of up to 50 matches played in that window.

**Ranking formula:** `weighted_score = win_rate × (matches_played ÷ 50)`, calculated only among players who've cleared the ≥15-wins qualification bar above.

Weights toward players who win consistently *and* play deep into the band — prevents small-sample streak gaming (e.g., a player who barely clears 15 wins in few matches shouldn't outrank one who wins consistently across a much larger match count).

**Tiebreakers, in order:** total wins → fewest losses → earliest date the 15th win was reached.

**Payout tiers (% of monthly pool):**

| Rank | Winners | % of pool |
|---|---|---|
| 1 | 1 | 8% |
| 2–3 | 2 | 9% |
| 4–10 | 7 | 14% |
| 11–25 | 15 | 18% |
| 26–50 | 25 | 24% |
| 51–100 | 50 | 27% |

**Pool sizing:** 25% of that month's net revenue (ads + subscriptions + cosmetics) — not a fixed ₦ promise, until revenue reliably supports one. Pay only players who actually qualify; do not pad to 100. Lower the qualifying-match threshold for Month 1 only if fewer than 100 players would otherwise qualify.

**Payout method:** airtime/data top-up only.

---

## 7. Community Builder (Invite) Leaderboard

Separate monthly ranking for **ordinary users only** (influencers excluded — see Section 8). Ranked purely by qualifying-invite count — no randomness, no skill component, the cleanest mechanic in the product legally.

**Eligibility:** Referrer must meet the unified 20-active-day requirement (Section 4) within their rolling 30-day window.

**Ranking:** Simple count of qualifying invites, highest first. Tiebreaker: earliest date the count was reached.

**Payout tiers:**

| Rank | % of pool |
|---|---|
| 1st | 50% |
| 2nd | 30% |
| 3rd | 20% |

**Pool sizing:** same % logic as Section 6, scaled to DAU stage (see Section 10).

**Unified referral qualification rule (applies to base points, this leaderboard, and Influencer commissions alike):** A referral only registers as valid once the referred user completes all 3 daily tasks on **3 separate calendar days within a 30-day window** of joining. No single-day burst qualifies for any reward tier. Referrers see live progress ("Your friend has completed 1/3 days, 12 days left") to soften the deadline into a nudge rather than a silent miss.

**Base referral reward:** +150 points to both referrer and referred user, awarded under the same qualification rule above. Non-monetary, feeds the Section 4 points economy.

---

## 8. Influencer Track & Premium Subscription

**Influencers** — excluded from Community Builder, compensated as marketing contractors instead:
- Commission per 100 qualifying invites (same unified qualification rule as Section 7)
- Bonus for reaching 1,000 qualifying invites
- Paid directly, cash/bank transfer acceptable — this is a marketing services payment, not a user-facing prize, so it doesn't carry the same legal analysis as anything above.

**Premium Subscription** — ₦1,000/month, or ₦2,500 for 3 months (~₦833/month effective). Rebuilt to remove every pay-for-advantage element from the original spec:

| Included | Explicitly excluded |
|---|---|
| Ad-free experience (skip the 2 mandatory videos) | Any RNG/odds boost |
| Unlimited *unranked* practice matches (never count toward Game Leaderboard qualification — Section 6) | Any extra *ranked* matches |
| Cosmetics: card backs, badges, titles, avatar frames | Free daily "Lucky Start" or any guaranteed-card mechanic |
| Faster matchmaking *queue time* only | Favorable opponent selection of any kind |
| More optional Daily Earn video slots (more than free tier's 5) | Anything that improves odds in the daily/monthly reward systems |

The rule to hold permanently: premium can sell convenience, cosmetics, and cost savings — never anything that changes who wins or who qualifies for a prize.

**Premium retention-milestone total: ₦400 cumulative** — split ₦100 at Day 14, ₦300 at the Day 20/30 full-qualification milestone (Section 4). Update Section 4's table to reflect this if it still shows ₦50/₦150.

---

## 9. Anti-Cheat / Anti-Fraud

- Server-authoritative match logic — server validates every move, never trusts client-reported wins
- Random matchmaking + same-opponent rate-limiting (win-trading detection)
- Device fingerprinting (multi-accounting detection)
- Randomized 1–3 second turn delay; flag sub-0.5s responses
- Phone-number verification at signup (via Telegram) — no full KYC needed anywhere in the product
- Manual/statistical anomaly review of top 20 Game Leaderboard entries before monthly payout
- The 20-active-day rolling window with a win-≥15-of-50 requirement (Sections 4 & 6) caps the advantage of bot-driven volume grinding harder than a simple match-count band — raw play volume alone no longer qualifies for anything; sustained genuine wins over time are required
- The single-grace-day reset mechanic (Section 4) adds cost to sustaining a fake account, since a bot/farm operator must maintain near-perfect daily activity across many accounts simultaneously to avoid resets
- Unified 3-separate-days-in-30 referral qualification is the primary defense against fake/bot invites across all referral reward tiers

---

## 10. Ad Networks & Revenue Data

**Recommended networks** (Telegram Mini App-native, rewarded-video-first):
- **Adsgram** — purpose-built for Telegram Mini Apps, strong rewarded-video support
- **Monetag** — rewarded interstitial format, simple JS integration
- **Tads.me** — Telegram-focused, fast integration
- Secondary fill: RichAds, OnClicka, PropellerAds

Don't rely on a single network — fill rate (whether a network has an ad to serve at all) caps revenue as much as eCPM does. Consider an ad-mediation layer once past initial testing to blend multiple networks for higher effective fill and eCPM.

**eCPM reference points (rewarded video):**

| Source | eCPM (USD) | Per-view (₦, at ₦1,410/$1) |
|---|---|---|
| Monetag | ~$4 | ₦5.64 |
| Adsgram | ~$5 | ₦7.05 |
| TADS | ~$12 | ₦16.92 |
| **Blended average** | **~$7** | **~₦9.87** |
| Conservative planning floor | — | **₦4.5** |

Treat rate-card figures as directional. Real revenue depends on fill rate, seasonality (Q4 typically runs meaningfully higher), and network mix — confirmed only by integrating and watching live dashboard data for the first 2–3 weeks.

---

## 11. Financial Model — First 3 Months at 1,000 DAU

Engagement ramp assumption: avg videos/user/day rises from 3.0 (Month 1) to 5.0 (Month 3) as habit forms. Optional videos (up to 5/day) now reward practice matches, not airtime — no payout offset against ad revenue.

| | Month 1 | Month 2 | Month 3 |
|---|---|---|---|
| Total monthly views | 90,000 | 120,000 | 150,000 |
| **Net margin — worst case (₦4.5/view)** | ₦405,000 | ₦540,000 | ₦675,000 |
| **Net margin — expected case (₦9.87/view)** | ₦888,300 | ₦1,184,400 | ₦1,480,500 |

**Quarter total, expected case: ~₦3.55M (~$2,520) net margin** — all ad revenue converts directly to margin since Daily Earn no longer carries a cash payout. Day 14/30 retention-milestone airtime (Section 4) is a separate, smaller cost line, paid only to users who reach those milestones.

**Longer-run DAU stages** (worst-case ₦4.5/view basis, conservative planning):

| Stage | Est. DAU | Monthly Daily-Earn margin | Game Leaderboard pool | Community Builder pool |
|---|---|---|---|---|
| Launch (M1–2) | 300–800 | ₦63,000–588,000 | ₦20,000–150,000 | ₦10,000–30,000 |
| Growth (M3–4) | 1,500–3,000 | ₦315,000–2,205,000 | ₦100,000–550,000 | ₦40,000–120,000 |
| Established (M6+) | 8,000–15,000 | ₦2.1M–7.35M | ₦500K–1.8M | ₦150,000–400,000 |

---

## 12. Monetization Streams

- Rewarded video ads (Daily Earn + cooldown-skip) — primary revenue driver
- Banner/interstitial ads
- Telegram Stars: cosmetics, ad-removal, unranked practice mode only
- Premium subscription (Section 8)
- Sponsor-funded giveaways — run as a separate marketing layer, not part of the core app economy

---

## 13. Go-To-Market (Nigeria Only)

**Phase 1 — Launch:** Free-to-play core loop, Daily Tasks, Daily Earn, cooldown-skip, base referral points. Small personal/brand social giveaways (X/Instagram "follow + RT to win") as a separate marketing spend, unconnected to in-app eligibility.

**Phase 2 — Growth:** Introduce Game Leaderboard once legal consult is complete, plus Community Builder Leaderboard. Scale qualifying thresholds and pool sizes with real DAU/revenue.

**Phase 3 — Established:** Sponsorship deals, expanded prize pools, consider NLRC promotional-permit filing if pool size grows enough to warrant it.

---

## 14. Tech Stack

**Recommended: Node.js + Express + Socket.io, single language front-to-back.**

| Layer | Choice | Why |
|---|---|---|
| Frontend | Telegram Mini App (HTML5/CSS/JS) | Platform requirement |
| Backend/game server | Node.js + Express + Socket.io | Real-time matchmaking and turn-based play need WebSocket support; sharing JS across front and back reduces context-switching and hiring cost for a solo/two-person team |
| Database | PostgreSQL | Relational integrity matters — cannot afford double-paid airtime or corrupted match history bugs |
| Cache/real-time state | Redis | Matchmaking queues and leaderboard ranking map directly onto Redis sorted sets (ZSET) — dramatically faster than recomputing rankings from Postgres on every read |
| Admin/fraud review | Lightweight embedded tool (e.g. AdminJS) inside the same Node app, not a separate stack | A full custom ops dashboard or a second framework (e.g. Django) isn't affordable at this budget yet |
| Push | Telegram Bot API | Platform requirement |
| Ad networks | Adsgram, Monetag, Tads.me (+ mediation layer once scaling) | See Section 10 |
| Payout | Direct telecom airtime API | No crypto, no bank withdrawal, no KYC anywhere in the product |

**Why not the alternatives:** Go offers better raw concurrency for the game server but demands a steeper learning curve and a smaller, pricier local talent pool — not the bottleneck at this team size. Spring Boot is enterprise tooling for large teams and complex domain logic this project doesn't have yet. Django is excellent for data-heavy apps and gives a free admin panel, but real-time multiplayer isn't its strength, and running two stacks (Django + Node) doubles operational complexity a $1,500 budget can't absorb. One language, one runtime, one deploy target.

---

## 15. Team Requirements

| Role | Responsibility |
|---|---|
| Project Lead | Product strategy, partnerships, compliance follow-through |
| Backend Developer | Telegram Mini App API, database, matchmaking, server-authoritative match logic |
| Frontend Developer | UI/UX (HTML/CSS/JS) |
| Community Manager | Moderation, support, influencer relations |
| Ad Ops | Network integration, eCPM/fill-rate optimization |

At the $1,500 starting budget, this is realistically a solo or two-person build for the MVP — prioritize Sections 3–5 (core loop + Daily Earn) first; Sections 6–7 (leaderboards) can follow once the legal item in Section 2 is closed and DAU justifies the payout infrastructure.

---

## 16. Open Items Before Scaling

1. **Confirm the Game Leaderboard mechanic (Section 6)** with a Lagos-based gaming/tech lawyer before increasing its pool beyond a small initial size. This is the single item standing between "structurally sound" and "confirmed."
2. **Integrate one ad network live** and validate real eCPM/fill-rate against the Section 10 estimates before committing to payout rates at scale.
3. Everything else in this document — Daily Tasks, Daily Earn, cooldown-skip, Community Builder, Influencer track, Premium — is structurally outside gambling/lottery regulation as designed and can proceed without further legal review.
