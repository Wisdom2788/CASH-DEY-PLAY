# Personal streak milestones and referral qualification

Status: **Policy component tested; persistence/claim slice under acceptance; full stage incomplete**. Covers: C5/C6, H2/H4/H6/H10, M12/M13. Dependencies and sequence: [delivery index](README.md). Product decisions: [rulebook](RULEBOOK.md).

### Data and rules

Personal cycles have explicit ID/start/end, login dates unique(user,lagos_date), grace usage and rule_version. Owner resolved 27 October: fixed 30 Lagos calendar dates; before completed Day 10 any miss resets; thereafter one verified-ad recovery for one missed date, only on the immediately following day. Recovery restores that date without extending the cycle. Two misses reset. Unclaimed eligibility expires at cycle end, exclusive midnight followingDay 30; claimed wallet credits remain intact. streak_claims UNIQUE(user_id,window_id,milestone_day) with tier_at_claim, amount_kobo and ledger reference. Milestone identity does not include tier, so switching tier cannot claim both variants. Practice completion counts use normal server-verified finishes inside that personal cycle; regular Day 30 needs25, premium exempt. New cycle begins on the first login after the fixed window ends; prior ledger credits remain intact.

POST /streak/milestones/:day/claim validates Idempotency-Key, locks cycle/account, rechecks milestone/tier/25 gate, inserts claim, credits ledger (or inserts Lagos ad_free_day), writes audit/idempotent response together. Errors differentiate not-unlocked, already-claimed and practice-target. GET /streak/progress returns server state and claim eligibility/reason; frontend does no eligibility math or local milestone mutation. Ads-free grant expires at next Lagos midnight; no premium reward-tier/allowance upgrade.

### Referrals

A scheduled/event-driven evaluator derives three complete task dates within30days and regular25 practice finishes; premium waives only practice gate. Lock referral before PENDING -> QUALIFIED; insert points awards with unique reference, +150 each, audit and outbox in one transaction. Expiry vs qualification uses persisted event timestamps, not delayed job execution time. No cash referral credit. Revoked/void match events trigger a documented review/adjustment policy, never silent deletion of historical money.

### Acceptance and rollout

Both tier tables, switch at claim time, expiry mid-claim, calendar boundary/grace/reset,24/25 practice, same/different key races and payload mismatch, rollback after each write, Day 20 ad-free effect, recurring cycle, queued evaluator retry, qualifying third task arriving just before expiry and processed later. Validate ledger balance after actual API claims; a toast alone is not evidence. Backfill old claim flags/audits conservatively to prevent duplicate payment. Retire duplicate frontend engines once read-only progress is wired.

## Implementation record

Record commit, schema version, commands/results, integration evidence, unresolved decisions and recovery rehearsal here before marking complete. An acceptance criterion written above is not evidence that it passed.


## Policy component — 27 October 2026

`src/rewards/streak-policy.ts` implements versioned calendar decisions and milestone time bounds. Pending recovery returns RECOVERY_REQUIRED without changing progress or granting a reward. This pure component is not wired to login, claims, database storage or provider callbacks yet; the legacy automatic-grace engine remains to be replaced.

Next sequence: persist cycles/login dates and conservative legacy reconciliation; bind single-use authenticated ad receipts to user/cycle/missed-date and consume under lock; wire server progress and atomic ledger/ad-free claims; implement referral qualification/reward evaluator and recovery; replace frontend eligibility math; run SQL race/rollback, HTTP and browser acceptance. Live recovery remains blocked on actual provider authentication, user/purpose/session correlation and replay verification.

Recheck SQL time after claim locks. A request received before midnight but acquiring locks after expiry must fail; a previously committed idempotent receipt retried after expiry returns its original response without another credit. Day 30 has only its calendar date to claim, including satisfying its practice gate. No Day 31 grace and no extension for delayed provider checks. Exact tier amounts are restated in the decision document.

Local policy verification:17 focused tests passed; backend typecheck result recorded in the cumulative summary. These are policy-unit checks, not SQL/provider/end-to-end acceptance.

Persistence algorithm and rollout: [08-persistent-claims-design.md](08-persistent-claims-design.md). Integration algorithms, provider prerequisites and agent continuity: [INTEGRATIONS-AND-AGENT-HANDOFF.md](INTEGRATIONS-AND-AGENT-HANDOFF.md). Do not treat written test matrices as acceptance evidence.
