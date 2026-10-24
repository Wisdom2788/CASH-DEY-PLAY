# Authoritative Whot engine and practice bot

Status: **Specified; not implemented**. Covers: C7, H3, later H12, game-rule authority. Dependencies and sequence: [delivery index](README.md). Product decisions: [rulebook](RULEBOOK.md).

### Preconditions

Record exact Whot variant decisions in RULEBOOK.md before production engine acceptance. Current frontend deck helper creates53 cards while claiming54: deck multiplicities need an explicit authoritative table. Do not infer approval from the reference draft. Engine implementation remains pure TypeScript, independent of sockets/database/clock, with random source and instant passed in.

### Data and commands

matches(id UUID,mode,status,rule_version,lagos_date,started_at,ended_at,version,reason), match_players(match_id,seat,user_id nullable only for labelled bot,is_winner), match_events(match_id,sequence,event_id UNIQUE,actor,command_type,private_event_payload,occurred_at). Unique participant per match; exactly two seats; ranked cannot include a bot. Private initial deck order is persisted for replay under restricted access. Cryptographic Fisher-Yates uses unbiased crypto.randomInt; never Math.random/32-bit seeded RNG for hidden information.

Commands: play(cardId,chosenSuit?), draw, pass only if rule allows, declare-last-card if required, forfeit, timeout. Server validates actor, ownership, turn, version, card compatibility, suit enumeration and actionId replay. A command returning a new immutable state preserves card conservation and cannot award rewards directly. Terminal result is settled separately once. Bot chooses only from its projected view and legal actions; latency is scheduled by server, not a blocking sleep.

### Projection

Player view includes own hand, public top/discards allowed by agreed rules, opponent count, draw count, server deadline and version. Never serialize hidden draw order, opponent hand or private event log. Result response contains only authorized public data. Refresh must restore the same server-owned state.

### Acceptance and rollout

Deck count/multiplicity/conservation; all special cards/openings/finishing/penalties/exhaustion; malicious card IDs, wrong actor/turn/version and duplicate action; random unbiased range contract; ten-thousand generated/bot games bounded to terminate under defined draw policy; replay equals final state; view leaks no secret keys/cards; timeout vs last move race. Server stores match_players/events transactionally. Expose practice only after stage06 implements allowance reservation and completed-match counting. Maintain rule_version so live matches finish under their starting rules.

## Implementation record

Record commit, schema version, commands/results, integration evidence, unresolved decisions and recovery rehearsal here before marking complete. An acceptance criterion written above is not evidence that it passed.
