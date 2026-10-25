# Whot rule decisions for stage05

25 October2026. This is a concrete proposal for owner review, not an approved Nigerian/official variant. Passing tests against it proves implementation consistency, not product approval. No default profile is selected by the application. Live game capabilities remain disabled.

| Decision | Proposed test profile | Status |
|---|---|---|
| Deck | Circle/Triangle:1,2,3,4,5,7,8,10,11,12,13,14 each; Cross/Square:1,2,3,5,7,10,11,13,14 each; Star:1,2,3,4,5,7,8; five20 wilds.49 numbered+5 wild=54 | Pending |
| Initial hand | Six cards each, dealt alternately; seat0 starts | Pending |
| Opening card | First non-action/non-wild in shuffled market; specials stay in market. No opening effects | Pending |
| Normal compatibility | Match suit or number; nominated suit after20 overrides ordinary number matching;20 remains wild | Pending |
| 1 and8 | Skip the opponent in a two-seat game; same player continues | Pending |
| 2 and5 | Pending draw2/draw3; victim draws and loses turn | Pending |
| Stacking | No stacking in proposed profile; engine also supports same-penalty-number stacking | Pending |
| 14 | Opponent draws1; player who played14 continues | Pending |
| 20 | Player must nominate one ordinary suit when playing; no separate nomination command | Pending |
| Drawing | Draw1 and pass; engine also supports draw1 then play only that drawn card, or pass | Pending |
| Voluntary drawing | Allowed even with a playable card; cannot draw twice in the same draw-then-play turn | Pending |
| Finishing | Any legal final card wins immediately; engine can forbid special-card finishes. No deferred last-card effect after terminal win | Pending |
| Last-card declaration | Disabled in proposal; optional declaration with the play reducing hand to1, otherwise draw configured penalty | Pending |
| Exhaustion | Keep top discard; cryptographically reshuffle older discards. If no cards remain drawable, finish as an unawarded draw | Pending |
| Deadlines |30seconds per turn; at deadline only server timeout may act. Proposal timeout forfeits; optional draw-and-pass available | Pending |
| Nontermination bound |500 accepted commands maximum in proposed profile; then unawarded draw. No silent winner or eligibility credit | Pending |

Keep existing frontend helper historical. It has49 numbered cards plus4 wilds (53 total), so its54-card comment is not evidence for a deck decision. The server engine never imports that helper, its Math.random shuffle or client game state.

Stage05 can accept the pure configurable mechanics and privacy tests independently. Full engine acceptance needs a dated owner decision on this matrix, persistence/replay verification and the remaining stage05 acceptance gates. Practice exposure additionally depends on06 admission rules. Ranked ownership, socket authentication, timers/workers and reward settlement remain07/08.
