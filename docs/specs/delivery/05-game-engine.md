# Authoritative Whot engine and practice bot

Status: **Core implemented; acceptance incomplete**. Covers: C7, H3, later H12, game-rule authority. Dependencies and sequence: [delivery index](README.md). Product decisions: [rulebook](RULEBOOK.md).

### Preconditions

Record exact Whot variant decisions in RULEBOOK.md before selecting a runtime rules profile or enabling play. Current frontend deck helper creates53 cards while claiming54: deck multiplicities need an explicit authoritative table. Do not infer approval from the reference draft. The engine is pure TypeScript, independent of sockets/database/clock, with random source and instant passed in. Proposed rules exist only in tests and remain unselected.

### Data and commands

The game tables bind a versioned rules profile to each private match snapshot and ordered action history. Participant uniqueness, exact two-seat cardinality and bot mode restrictions are enforced in PostgreSQL. Cryptographic Fisher-Yates uses unbiased crypto.randomInt; never Math.random or seeded randomness for hidden information.

The implemented storage uses the new `game_matches`, `game_players` and `game_events` tables rather than repurposing legacy per-player `matches`. Matches carry a generated Lagos date; events have unique UUIDs and ordered sequence numbers. Deferred PostgreSQL constraints require two seats and enforce one human plus one bot in PRACTICE and two humans in RANKED. Snapshots and initial private state stay server-side; immutable private event payloads preserve command, instant and reshuffle entropy; projections are persisted per actor for exact idempotent responses. Snapshot, event and redacted `GAME_STATE_CHANGED` outbox intent commit in one transaction. The repository is internal and no public route, match admission, socket, Redis flow, or settlement capability is enabled.

Commands: play(cardId,chosenSuit?), draw, pass only if rule allows, declare-last-card if required, forfeit, timeout. Server validates actor, ownership, turn, version, card compatibility, suit enumeration and actionId replay. A command returning a new immutable state preserves card conservation and cannot award rewards directly. Terminal result is settled separately once. Bot chooses only from its projected view and legal actions; latency is scheduled by server, not a blocking sleep.

### Projection

Player view includes own hand, public top/discards allowed by agreed rules, opponent count, draw count, server deadline and version. Never serialize hidden draw order, opponent hand or private event log. Result response contains only authorized public data. Refresh must restore the same server-owned state.

### Acceptance and rollout

Pure-engine tests cover the configured mechanics, invalid restored states, wrong turn/version/ownership, duplicate payload conflict, timeout/action boundaries, private projections, deterministic replay and10,000 generated bot games. PostgreSQL integration tests cover deferred seat/mode constraints, participant-only reads, action races/idempotency, replay drift detection and snapshot/event/outbox rollback; they must pass in CI on PostgreSQL18 before the core is marked verified. Full stage acceptance still requires written decisions for every item in [05-rule-decisions.md](05-rule-decisions.md), passing database CI, and the agreed variant tests. Expose practice only after stage06 implements allowance reservation and completed-match counting. Ranked/realtime and settlement remain later stages. Maintain rule_version so live matches finish under their starting rules.

## Implementation record

Implementation record (25 October 2026): configurable engine, crypto entropy adapter, projected-view bot, PostgreSQL migration/repository and adversarial tests are implemented on `feature-implementation` at c37671022378bd4c78413a2d78e3979bcb1ce81a. Verify run40199691573 passed all197 backend tests, including the PostgreSQL18 migration and repository integration suite; frontend typecheck, lint, tests and build passed. Local PostgreSQL tests skip because no disposable database URL is configured. Product decisions remain pending. No runtime rules profile or public play path is enabled. This is not a stage completion or deployment record.
