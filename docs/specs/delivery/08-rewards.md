# Personal streak milestones and referral qualification

Status: **Specified; not implemented**. Covers: C5/C6, H2/H4/H6/H10, M12/M13. Dependencies and sequence: [delivery index](README.md). Product decisions: [rulebook](RULEBOOK.md).

### Data and rules

Personal cycles have explicit ID/start/end, login dates unique(user,lagos_date), grace usage and rule_version. Resolve elapsed-window/grace semantics first. streak_claims UNIQUE(user_id,window_id,milestone_day) with tier_at_claim, amount_kobo and ledger reference. Milestone identity does not include tier, so switching tier cannot claim both variants. Practice completion counts use normal server-verified finishes inside that personal cycle; regular Day30 needs25, premium exempt. New cycle begins by agreed post-Day30 rule; prior ledger credits remain intact.

POST /streak/milestones/:day/claim validates Idempotency-Key, locks cycle/account, rechecks milestone/tier/25 gate, inserts claim, credits ledger (or inserts Lagos ad_free_day), writes audit/idempotent response together. Errors differentiate not-unlocked, already-claimed and practice-target. GET /streak/progress returns server state and claim eligibility/reason; frontend does no eligibility math or local milestone mutation. Ads-free grant expires at next Lagos midnight; no premium reward-tier/allowance upgrade.

### Referrals

A scheduled/event-driven evaluator derives three complete task dates within30days and regular25 practice finishes; premium waives only practice gate. Lock referral before PENDING -> QUALIFIED; insert points awards with unique reference, +150 each, audit and outbox in one transaction. Expiry vs qualification uses persisted event timestamps, not delayed job execution time. No cash referral credit. Revoked/void match events trigger a documented review/adjustment policy, never silent deletion of historical money.

### Acceptance and rollout

Both tier tables, switch at claim time, expiry mid-claim, calendar boundary/grace/reset,24/25 practice, same/different key races and payload mismatch, rollback after each write, Day20 ad-free effect, recurring cycle, queued evaluator retry, qualifying third task arriving just before expiry and processed later. Validate ledger balance after actual API claims; a toast alone is not evidence. Backfill old claim flags/audits conservatively to prevent duplicate payment. Retire duplicate frontend engines once read-only progress is wired.

## Implementation record

Record commit, schema version, commands/results, integration evidence, unresolved decisions and recovery rehearsal here before marking complete. An acceptance criterion written above is not evidence that it passed.
