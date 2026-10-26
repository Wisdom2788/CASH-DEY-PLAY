# Full ranked acceptance design

26 October 2026. Owner approved: ready-check decline or expiry gives warning, then 2/5/15 minute lockouts; reset after 24 hours without a miss. Rematch requests: three per rolling hour, mutual consent within15 seconds, no penalty for refusal/expiry, normal quota/cooldown/pair checks. Existing30-second turn clock continues through disconnect; no automatic void/refund from disconnects. Technical compensation requires recorded operator review; no public compensation writer.

## Ordered implementation

1. Durable no-show receipts and per-player lockout. Attribute explicit decline only to the declining player, expired offers only to unaccepted seats. Technical eligibility cancellation never counts as a no-show. Every admission path checks lockout under the shared sorted user locks.
2. Durable result receipts keyed by match and participant, derived only from finished human ranked games with two started admission reservations and a committed terminal event. Lock users in canonical order before match; recover missed settlements in bounded batches. Win/loss includes forfeit/timeout; unawarded draws give neither win nor loss. Assign calendar date from authoritative finish, not recovery time. Award WIN_MATCH and all-complete bonus once in that same transaction; no cash/prize credit. Readers derive stats from receipts.
3. Automatic private session snapshots, bounded concurrent reads, per-connection single outstanding ACK, retry/catch-up and new-device authorization. Snapshot contains own hand only and public offer/request data. SQL recovery is authoritative; Redis notices are optional hints. No queue heartbeat is inferred from server polling.
4. Durable rematch request, exact actor/key retry, rolling hourly throttle under user lock; target must be a participant in a prior ranked game, online and eligible. Accept rechecks both users and creates a normal offer with both consents already recorded, then starts through the same admission transaction without a second ready check. Failed eligibility releases reservations. Race/duplicate accept creates at most one match.
5. Frontend uses strict schemas and current token, resumes after reconnect/activation, heartbeats only while searching/offered, uses server deadlines and intentions, never reports result. Real-device acceptance remains separately evidenced; desktop/socket tests cannot certify Telegram phones.
6. Worker deployment manifest/runbook: games, ranked matching and delivery loops supervised with graceful shutdown; no enablement until migrations/environment and backup gates pass. No paid service provisioned without budget approval.

## Acceptance evidence required

No-show attribution/idempotency/24-hour reset, concurrent settlements and rollback, finish-day recovery, malicious result input rejected, no cross-player projection leakage, dropped ACK/reconnect, rematch rate/cap/cooldown races; frontend contract/action tests and build; actual devices; measured socket/load targets and hosted restart/health checks. A checked core is not full-stage acceptance. Proposed5000 connections and1million pair attempts must be measured before certification.
