# Project continuation instructions

Start with `docs/specs/delivery/INTEGRATIONS-AND-AGENT-HANDOFF.md`, then inspect the
current remote branch/PR/CI state and `docs/specs/delivery/IMPLEMENTATION-SUMMARY.md`.
Do not infer acceptance from a written spec or a checked item covering a narrower slice.

- Reuse `feature-implementation` for planned work and `hot-fixes` for fixes; review
  into `development`. Production `main` release is separate. Never create a branch
  whose name contains `codex`. Preserve unrelated/untracked files; no hard reset,
  force push or bulk inclusion of temporary release plans.
- Current owner decisions in `docs/specs/delivery/RULEBOOK.md` supersede older
  conflicting PRD tables and historical recommendations. Design algorithms and
  transaction/recovery boundaries before changing money, entitlements or gameplay.
- Canonical authenticated actor, SQL Lagos time after locks, integer-kobo ledger,
  immutable source receipts, actor/payload idempotency, audit and outbox are existing
  conventions. External network calls do not belong inside SQL lock transactions.
  Acquire canonical user locks before wallet/source locks; sort multiple user locks.
- Never trust client dates, results, premium flags, reward amounts or ad-success
  callbacks. Do not add public test grants, timers as proof, fake provider success
  or dummy production data. Unsupported integrations remain unavailable.
- Default-off feature flags and a successful code merge do not authorize production
  activation, paid resource provisioning or main promotion. Follow the approved scope.
- Tests requiring PostgreSQL/Redis must use disposable databases. CI requires their
  integration suites; a local run that skips them is not integration acceptance.
  Run the owning checks in `.github/workflows/verify.yml`; preserve regression tests.
- Never commit credentials, private infrastructure identifiers, connection strings,
  provider payloads or player data. Use deployment secret stores and redacted evidence.
- After each slice update its numbered spec and the cumulative checklist with tested
  commit, actual CI evidence and remaining provider/device/release gates. Communicate
  what changed, how verified and what remains; never promise absolute security.

Stage08A persistence/claims design is in `08-persistent-claims-design.md` under the
delivery directory. Real ad recovery, referral reward consumer, frontend replacement
and provider/release acceptance are separate work; verify their latest status before
continuing. Do not reinterpret legacy automatic grace as authenticated ad evidence.
