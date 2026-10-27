# Stage08 reward decisions — draft for business selection

## Business correction recorded — 27 October 2026

The owner supplied the current business rule: before Day 10, any missed day fully resets streak progress to Day1; from Day 10, one missed day per window may be recovered only by watching a verified rewarded ad. Both regular and premium users start airtime milestone eligibility at Day 10. Automatic flat forgiveness anywhere in the cycle is rejected. These instructions supersede the earlier recommendation in this draft and conflicting checked-in PRD/rulebook wording. No premium waiver of the recovery-ad requirement has been approved.

Confirmed: early reset threshold, ad-required rather than automatic recovery, once-per-window recovery limit and shared Day 10 first-milestone threshold. Preserve one claim identity per cycle/milestone regardless of tier; remove the proposed regular Day14 first-reward identity. Existing later reward values are not re-priced by this correction.

Resolved by owner on 27 October 2026: recovery restores the missed calendar date, preserving the original 30-calendar-day end. It is allowed only on the immediately following Lagos day after a single miss, after completing Day 10, once per cycle. Two missed days reset. Unclaimed milestones expire at cycle end, not 30 days after unlock. Day 30 cannot be recovered on Day 31, because the cycle has ended. Day 30 rewards must be claimed on Day 30 before Lagos midnight. Existing credited wallet balances do not expire.

Retained reward table: regular Day 10 ₦50 / Day 20 ad-free until next Lagos midnight / Day 30 ₦100 plus 25 normal practice finishes inside the cycle; premium Day 10 ₦50 / Day 20 ₦100 / Day 30 ₦200. Tier at claim, one claim identity per cycle/milestone across tier changes. No premium recovery-ad waiver is approved.

Source finding: the existing backend login-streak-engine.ts also automatically forgives a miss at any count. Stage08 must replace that behavior with versioned cycle state and verified recovery; updating documentation alone does not enforce the new rule. Legacy streak counters/grace flags cannot be treated as proof of a verified recovery when importing credit eligibility. Earned historical payments/claims remain intact and ambiguous eligibility needs conservative reconciliation. Rewarded-ad verification remains an unfinished live integration: opening an ad, waiting, returning or pressing Recover cannot substitute for authenticated completion evidence. No airtime-credit implementation or live grace recovery is marked complete.

## Superseded proposal history

27 October 2026. Not an approval record and not implemented. Existing RULEBOOK.md explicitly leaves cycle/grace and unclaimed-milestone semantics open. 08-rewards.md requires resolving them before changing cycle progression or monetary claims.

1. Recommend 30 actual login days with one forgiven missing date, so a completed uninterrupted-valid cycle can span 31 calendar dates. The missed date is not a fake login. A second miss resets forward progress. Alternative: fixed 30-calendar-day window, which can leave only 29 actual logins after a grace miss and requires a different milestone definition.
2. Recommend earned milestone eligibility remains claimable for 30 days after unlock, with claims tied to the original cycle and eligibility evidence. A new cycle can start without forcing users to collect everything first. Practice completion for an old cycle must still have happened in that cycle; late processing is not permission to earn old-cycle practice afterwards. Ad-free benefit starts at actual claim and ends at next Lagos midnight, not a backdated exemption. Alternative: expiry at cycle end, simpler but users can lose unlocked unclaimed rewards.
3. Recommend one first-milestone reward slot per cycle: premium unlocks at login10 and regular at login14; claiming either consumes the same slot. Day 20 and Day 30 are separate slots. Recheck current paid tier at claim and retain the published tier amounts; a user cannot collect both first-slot rewards by switching tiers. Alternative: distinct login10/login14 reward identities can pay both after a tier switch; this changes maximum reward economics and needs explicit acceptance.

The proposed slot identity refines the older milestone_day uniqueness draft because the first threshold differs by tier. No payout amount or expiry is silently approved. Subsequent design must include legacy claim import/deduplication, exact Lagos timestamps, idempotency, user/cycle/account locks, ledger or ad-free-day grant plus audit/outbox in one transaction, and race/rollback/recovery tests.

Sponsored tasks are proposed as optional and excluded from stage08's qualifying task-day source. Existing verified complete-day records and normal practice-completion receipts remain authoritative for referral qualification. No sponsor callback can directly mark a referral qualified or write monetary milestone eligibility.
