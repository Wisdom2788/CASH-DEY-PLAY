# Product rulebook v1 — recorded requirements and open decisions

> Policy revision — 26 October 2026: one ranked START per opponent per Lagos calendar day, for all tiers. Ranked rematch invitations/acceptance are disabled, including old clients and historical pending invitations. Started forfeits/timeouts count; unstarted offers do not. Three total starts/day and the existing cooldown remain unchanged. This supersedes earlier two-per-opponent and rematch policies below. Daily task rotation is the next separate implementation; current fixed tasks remain until that migration is tested.


Source: repository build-plan Part II, which supersedes its earlier tables and the October 19 audit. This records the available decisions; it does not claim independent proof of the original business answers.

| Rule | Required behavior |
|---|---|
| Scope | Nigeria-first Telegram Mini App; free-to-play Whot; airtime rewards, no bank cash-out |
| Modes | Practice vs clearly labelled server bot; ranked vs real players. Friends deferred |
| Ranked | Maximum three starts/day for both tiers. Regular cooldown after second completed/chargeable match, one hour, skippable by verified video. Premium no cooldown. No bots in ranked |
| Practice | Regular five starts/day; premium unlimited. An unavailable ad may allow play, and every normal finish counts toward the regular 25-practice gate. Forfeit/abandonment does not count |
| Daily tasks | Two video tasks, one ranked-win task, all-complete bonus; 50 non-monetary points each, 200/day. Premium/ads-free video tasks AUTO_READY and require Claim. All four CLAIMED defines one task day |
| Qualification | Calendar month in Lagos; 20 complete task days and 15 ranked wins; regular also 25 completed practice matches in that month; premium gate waived. Twenty task days already implies at least twenty wins: this redundancy must be acknowledged in product copy |
| Personal streak | Login consistency, one grace day; regular day14 ₦50, day20 no-video-ad day, day30 ₦100 plus 25 practice in the personal window. Premium day10 ₦50, day20 ₦100, day30 ₦200. Tier determined when claimed |
| Personal reset | New cycle after Day30; prior earned credits retained. Whether a grace miss extends the elapsed cycle to 31 days is OPEN; do not settle this by guessing |
| Ads-free day | Removes videos, not banners; starts at claim and ends at Lagos midnight. Does not change practice limit or premium reward tier |
| Premium | One tier, one-time 30-day or 90-day Stars purchase; renew adds to max(now,expiry). ₦1,000 / ₦2,700 targets, initial estimates 55 / 150 Stars rounded to five, weekly review. Actual price locked on order |
| Referrals | Signed start parameter on first account creation; three complete task days within 30 days; regular referee needs 25 practice matches, premium referee exempt. +150 points each, exactly once. No per-referral cash |
| Wallet | Integer accounting unit defined in stage03; minimum ₦50, maximum ₦100,000 per transaction and day; phone/account additional risk caps require recorded values. Manual provider float funding |
| Leaderboards | Calendar-month top100 of eligible players; score and prize-band policy below; top20 manual review before awards |
| Ads | No client-asserted reward or timer simulation. Banners for both tiers, excluding active game, redemption form and payment control. Banner provider/format must be confirmed |
| Exclusions | Premium+, data bundles, per-referral cash, priority queue and friends mode are not v1 features |

## Ranking decisions to preserve or resolve

Existing PRD primary formula is (wins/played)*(played/50), which simplifies to wins/50 without a cap. Do not quietly import the frontend's capped formula. Tie-breaks: wins, fewest losses, earliest timestamp of fifteenth ranked win, stable internal ID only as final deterministic ordering. Prize pool: 25% of agreed net revenue; bands: rank1 8%, ranks2–3 9%, 4–10 14%, 11–25 18%, 26–50 24%, 51–100 27%. Define rounding and undistributed shares when a band is not full before settlement.

## Decisions that block their owning implementation/release

1. RESOLVED 2026-10-25: owner approved the complete Whot matrix in05-rule-decisions.md. Runtime version whot-v1 records54 cards, six-card hands, no penalty stacking, draw-and-pass, final-special-card wins, no last-card declaration,30-second forfeit timeout and500-action unawarded-draw bound. Existing matches retain their persisted rules.
2. Streak grace/window and unclaimed-milestone expiry; tier switches must not pay both free and premium variants of the same milestone.
3. Match void policy: two client disconnects alone cannot establish an infrastructure fault. Define allowance reservation, forfeit and refund boundaries.
4. Ad provider authentication, event identity, user/purpose/session correlation, replay protection and low-volume publisher availability. The public GET callback example alone does not prove all required capabilities.
5. Airtime provider/network catalogue, sandbox account, fees, float threshold/owner, per-phone/month risk limits and reconciliation source.
6. Prize finance: net revenue definition, period, taxes/fees, band rounding and unfilled bands, community pool, review sign-off.
7. Terms/payment support/privacy wording, appropriate local review, staging bot and real-device test access. Never put bot tokens in documentation or chat.

Each resolution needs a dated decision entry, affected spec links and acceptance tests. Recommendations in historical documents are not approvals.

## Ranked decisions recorded25 October2026

Owner selected: maximum two ranked starts against the same opponent per Lagos day; regular one-hour cooldown starts at the finish of the second chargeable match, including forfeit/timeout, and resets at Lagos midnight. Current premium bypasses cooldown but retains the three-start daily cap. See07-ranked-admission-design.md. Rematch requests/hour, no-show lockouts and post-start technical compensation remain unresolved/deferred.

## Ranked policy decisions — 26 October2026

Owner approved warning then2/5/15 minute lockouts for ready-check decline/expiry, resetting after24 hours without a miss; three rematch requests per rolling hour with mutual consent and15-second expiry, obeying normal quota/cooldown/pair cap; existing30-second authoritative turn clock continues during disconnects, with no automatic void/refund. Verified technical compensation requires audited operator review. These decisions supersede the old proposed disconnect-pause/automatic-double-disconnect VOID defaults in build-plan6.11. See07-full-ranked-design.md.
