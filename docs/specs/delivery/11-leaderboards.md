# Monthly results, prizes and administrative review

Status: **Specified; not implemented**. Covers: H5, C5, M3/M9 and fraud/prize operations. Dependencies and sequence: [delivery index](README.md). Product decisions: [rulebook](RULEBOOK.md).

### Derivation and ranking

Use explicit Lagos month; task day requires all four tasks; ranked wins/played from authoritative settled results; regular25 completed practice in month, premium exemption at an agreed evaluation instant. Decide whether refund/expiry changes already-frozen qualification. Remove stored hand-maintained month counters after switching reads. Snapshot includes rule_version, inputs and freeze timestamp; no live leaderboard can mutate a paid result silently.

GET /leaderboards/game returns validated eligible rows, own standing/eligibility reasons and nullable rank; no hardcoded QUALIFIED. Preserve agreed uncapped wins/50 primary score, then PRD tie-breaks and stable final ID. Frontend must not rank a second divergent copy. Community Builder uses qualified referral timestamps and recorded referrer eligibility, not an unwritten referrals table.

### Finance and review

At month close, finance provides immutable net-revenue input and approved pool. Apply documented prize bands (1:8%,2–3:9%,4–10:14%,11–25:18%,26–50:24%,51–100:27%), integer rounding/remainder and unfilled-band policy. Community pool/50-30-20 allocation needs its own funding definition. Freeze top20 for fraud review; require recorded admin approval before settlement. prize_awards unique(month,board,player); settlement transaction inserts award, ledger/audit and outbox together. Job repeats/restarts never repay.

AdminJS or equivalent recorded admin tooling exposes read/review actions with separate authentication, role authorization, audit trail and least privilege. Inspect phone/device flags, same-opponent/win-trading patterns and anomalous rapid turns; do not treat client fingerprint as unforgeable proof. No unauthenticated admin route or hardcoded staff/test login.

### Acceptance

Boundary months/year, late results, eligibility matrix, >50-match formula case, ties, fewer than100 winners, all bands and total pool conservation, locked review status, duplicate month-close/settlement, failed credit rollback, withheld/disqualified result handling and immutable historical lookup. Simulated month with real DB snapshots, admin sign-off and wallet entries must reconcile to finance inputs before prizes are released.

## Implementation record

Record commit, schema version, commands/results, integration evidence, unresolved decisions and recovery rehearsal here before marking complete. An acceptance criterion written above is not evidence that it passed.
