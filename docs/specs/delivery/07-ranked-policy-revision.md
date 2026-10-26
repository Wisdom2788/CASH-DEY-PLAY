# Ranked policy revision — 26 October 2026

Business approval replaces two same-opponent starts/day with one and removes ranked rematches entirely. This is a calendar day in Africa/Lagos, not a rolling 24 hours. Three overall starts/day, finish-based regular cooldown, premium cooldown exemption, no-show rules, authoritative turn deadlines and settlement remain unchanged.

## Flow and invariant

1. Join the existing queue. Candidate selection may propose any eligible ticket.
2. With sorted player locks, check authoritative SQL pair reservations for the current Lagos date before creating an offer. A RESERVED pair temporarily blocks competing offers; RELEASED offers do not consume the daily pairing.
3. At final mutual acceptance, repeat the check excluding this offer, using the actual start day. Charge once on STARTED. Forfeit/timeout/disconnection cannot restore pairing allowance.
4. After finish, resume queue for another opponent if allowance permits. No direct invitations, including across midnight; random matching may pair the same people again on a new Lagos day.
5. Reject old rematch request/accept commands with REMATCH_DISABLED before any repository read/write. Session snapshots expose an empty rematches array for protocol compatibility. Existing tables/receipts remain for audit.

No new service or destructive schema migration is needed. A low population may have no eligible opponent even with people online; do not bypass restrictions or add hidden bots. Frontend explains the restriction and possible longer waits.

## Acceptance

- Same-day second offer rejected after started forfeit, including premium.
- Concurrent acceptance remains once-only; three different opponents remain possible.
- Declined/expired unstarted offers remain free and existing priority/no-show handling remains.
- Lagos date reset permits normal matching again; final-start day is rechecked.
- Old request/accept commands reject without new matches/charges; historical pending invitation cannot surface or block ordinary queueing.
- Browser result screen has no invitation controls. Real two-browser SQL/Redis journey requeues both finished players and observes no second offer/match or extra charge.

## Next implementation

Daily tasks require a versioned published schedule per Lagos date, no repeat of the previous day's full set, shared selection across users, once-only trusted-event rewards, preserved historical claims and schedule-based daily qualification. Mandatory gameplay unlock conditions must remain separate from rotating optional reward tasks. No provider-dependent task should be scheduled before its integration works. This work is not included in the ranked-policy code change.

## Revised policy acceptance — 26 October 2026

Tested runtime `6c2b4a6baff3dbd1c463fa88fdb9e402f18a6848` passed [Verify 40414492210](https://github.com/Wisdom2788/CASH-DEY-PLAY/actions/runs/40414492210): 335 backend tests in 39 suites (no database/Redis skips), 36 frontend tests, typechecks/lint/builds, all nine migrations applied twice and zero ledger/opening reconciliation mismatches. Backend production dependency audit and the new full frontend dependency audit reported zero known vulnerabilities. Both Vercel previews and CodeRabbit checks passed.

Actual two-browser → authenticated gateway → PostgreSQL/Redis acceptance verified queue/offer/play/network reconnect with unchanged deadline, SQL result/task settlement and both players requeueing without a second offer/match/charge: one match, two result receipts, two started admissions, 50 task points and two committed events relayed. Chromium 412×839 and WebKit 390×664 fixture flows passed with no invitation controls or horizontal overflow; updated WebKit result screenshot was visually reviewed. No physical Telegram-device acceptance is implied.

The 100-socket/50-offer test recorded zero duplicate assignments, p95 1812ms/max 1821ms in this run. Earlier runs varied above two seconds; this does not certify a hosted two-second SLO or production capacity.

Frontend Vite was updated from 8.3.2 to 8.3.5 after npm audit identified advisories affecting the installed version; the declared lower bound and lockfile were updated. CI now audits frontend dependencies. Browser waits are bounded and acceptance progress is logged. The backend CI browser dependency install uses Ubuntu's primary archive after the hosted Azure mirror exhausted a job's time budget; required tests were retained.

No database migration, paid resource provisioning, production configuration or main promotion was performed for this revision. Rotating daily tasks remain next; the current fixed-task implementation has not been relabelled complete for that new requirement.
