# Whot rule decisions for stage05

25 October 2026: the owner explicitly approved this matrix in the implementation conversation. The approved product profile is whot-v1 in src/game-engine/approved-rules.ts. It defines this app’s variant; it does not claim to be an official universal Whot standard. Public play remains subject to the admission and realtime integration gates.

| Decision | Approved product profile | Status |
|---|---|---|
| Deck | Circle/Triangle:1,2,3,4,5,7,8,10,11,12,13,14 each; Cross/Square:1,2,3,5,7,10,11,13,14 each; Star:1,2,3,4,5,7,8; five20 wilds.49 numbered+5 wild=54 | Approved 2026-10-25 |
| Initial hand | Six cards each, dealt alternately; seat0 starts | Approved 2026-10-25 |
| Opening card | First non-action/non-wild in shuffled market; specials stay in market. No opening effects | Approved 2026-10-25 |
| Normal compatibility | Match suit or number; nominated suit after20 overrides ordinary number matching;20 remains wild | Approved 2026-10-25 |
| 1 and8 | Skip the opponent in a two-seat game; same player continues | Approved 2026-10-25 |
| 2 and5 | Pending draw2/draw3; victim draws and loses turn | Approved 2026-10-25 |
| Stacking | No stacking in proposed profile; engine also supports same-penalty-number stacking | Approved 2026-10-25 |
| 14 | Opponent draws1; player who played14 continues | Approved 2026-10-25 |
| 20 | Player must nominate one ordinary suit when playing; no separate nomination command | Approved 2026-10-25 |
| Drawing | Draw1 and pass; engine also supports draw1 then play only that drawn card, or pass | Approved 2026-10-25 |
| Voluntary drawing | Allowed even with a playable card; cannot draw twice in the same draw-then-play turn | Approved 2026-10-25 |
| Finishing | Any legal final card wins immediately; engine can forbid special-card finishes. No deferred last-card effect after terminal win | Approved 2026-10-25 |
| Last-card declaration | Disabled in proposal; optional declaration with the play reducing hand to1, otherwise draw configured penalty | Approved 2026-10-25 |
| Exhaustion | Keep top discard; cryptographically reshuffle older discards. If no cards remain drawable, finish as an unawarded draw | Approved 2026-10-25 |
| Deadlines |30seconds per turn; at deadline only server timeout may act. Proposal timeout forfeits; optional draw-and-pass available | Approved 2026-10-25 |
| Nontermination bound |500 accepted commands maximum in proposed profile; then unawarded draw. No silent winner or eligibility credit | Approved 2026-10-25 |

Keep existing frontend helper historical. It has49 numbered cards plus4 wilds (53 total), so its54-card comment is not evidence for a deck decision. The server engine never imports that helper, its Math.random shuffle or client game state.

Stage05 can accept the pure configurable mechanics and privacy tests independently. Owner sign-off is recorded above; persistence/replay evidence is recorded in05-game-engine.md. Practice exposure additionally depends on06 admission rules. Ranked ownership, socket authentication, timers/workers and reward settlement remain07/08.
