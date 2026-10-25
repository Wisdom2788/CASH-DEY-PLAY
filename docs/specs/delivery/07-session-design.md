# Authenticated realtime reads and reconnect snapshots

25 October 2026. Internal stage07 protocol slice. Public realtime remains disabled; this does not complete ranked gameplay.

## Identity and durable ownership

REST and sockets share `verifyAccessToken`: bounded JWT, HS256, fixed issuer/audience, positive safe Telegram ID and matching canonical user ID, nonnegative token version and mandatory bounded expiry. Legacy versionless tokens map to zero; tokens without expiry are rejected. Login already issues expiring versioned tokens. Socket authentication accepts only `auth: {token}`; no developer bypass, identity header, query token or client-selected player/room identity is accepted.

The seventh migration, `2026102505_realtime_sessions`, stores one generation per registered user: random connection UUID, token version, expiry and claim time. No bearer token or private cards are persisted there. Claim locks the user, validates registration/revocation and captures database time after locking. It atomically replaces the generation. Newest committed authenticated claim wins across nodes. The generation is independent of JWT version: replacing a socket does not revoke REST tokens. Concurrent callers serialize on the user row.

Reads take user then session SHARE locks and validate registration, token version, exact connection generation and expiry. Claim/revocation cannot pass those locks during the read transaction. Authorization is evaluated at that transaction boundary; a later revocation cannot retract a response already dispatched. Disconnect cleanup deletes only its own generation, with bounded transaction timeouts. A delayed disconnect from the old device cannot remove the replacement. A lost server process may leave a row until reconnect replaces it or its expiry rejects it; it cannot grant another connection access merely by claiming the old UUID.

## Read protocol

An explicitly enabled HTTP server attaches Socket.IO4.8.4 on the same port, WebSocket transport only. It requires the exact configured browser Origin and an authenticated token. Origin is a browser boundary, not a replacement for authentication. Native/test clients must supply that Origin. Built-in cached connection recovery is not enabled. No client may join a custom room or select a player identity.

- `session:resume`, strict payload `{}` plus acknowledgement: return `protocolVersion:1`, serverTime, IDLE/IN_MATCH/RESULT and latest stored participant projection. Active matches take priority; otherwise the latest finished match is shown. No match is IDLE.
- `match:view`, strict payload `{matchId: UUID}` plus acknowledgement: same shape for a stored human participant. Missing and unauthorized matches both return NOT_FOUND. Only `projectGame` produces outward game data; opponent cards, deck/discard history, entropy, private events and raw rows are never returned.
- Success acknowledgement: `{ok:true,data:snapshot}`. Failure: `{ok:false,error:{code}}`. No SQL, token or private state appears in error messages.
- Other event names, move/result/reward intentions and extra input fields are rejected. This slice has no action writer, room join, automatic broadcast or settlement path.

Every supported read rechecks JWT expiry plus SQL revocation/generation. A dedicated expiry timer closes idle expired sockets. A nonoverlapping five-second monitor checks idle revocation/replacement; a sensitive event is checked without waiting for that monitor. Reconnect claims a fresh generation and rereads SQL. It never changes match state/version/deadlines or trusts a client snapshot. A missed acknowledgement is recovered by another read; no exactly-once network delivery is claimed.

## Resource and failure bounds

Handshake:20 per authenticated player per60 seconds. Events:60 per player per60 seconds across reconnects using the supplied rate counter. Invalid acknowledged events consume that budget. A process-local per-connection30-frame/second ceiling and one in-flight event limit bound concurrent database requests. Packets are limited to8192 bytes. Database/state failures deny reads and disconnect with UNAVAILABLE. No private error details are logged.

The existing application's general-read limiter can degrade to bounded process-local limits if Redis fails. Consequently no claim of globally enforced limits during Redis loss is made. Future move/financial commands must supply their required shared/fail-closed policies. Pre-authenticated connection-flood/IP admission, distributed concurrent-connection caps and real load measurements remain release work; these event limits do not establish DDoS protection.

## Execution and rollout

Apply all seven migrations before enabling this slice. `ENABLE_REALTIME_READ=true` attaches the read gateway; any other value leaves it off. Existing frontend capabilities retain `features.realtime=false`, so the application does not advertise playable realtime or auto-open this test slice. No deployment/environment change is part of this implementation.

SEARCHING/OFFER/STARTING snapshots, ticket/offer ownership, allowances/cooldowns, commands with atomic session checks, Redis pairing, broadcasts from committed outbox, disconnect adjudication, frontend journeys and device/load acceptance remain open. Do not turn the public realtime flag on just because this read slice passes tests. Rehearse migration/backup rollout before main promotion.

## Verification plan

Real local Socket.IO clients cover token/origin/input rejection, unsupported events, per-player budget across reconnects, idle token expiry, revocation, old-device rejection and sanitized storage failures. PostgreSQL18 tests cover concurrent generations, compare-delete cleanup, registration/revocation, own-hand projections, unauthorized reads, reconnect without timer/event changes, expiry after waiting for a user lock, failed-claim rollback and two actual gateways sharing SQL ownership. Record actual CI evidence before marking acceptance complete.

Socket.IO references: https://socket.io/docs/v4/middlewares/ (connection middleware runs once); https://socket.io/docs/v4/server-options/ (transport, origin, size and recovery configuration); https://socket.io/docs/v4/delivery-guarantees/ (delivery is not made durable by reconnect alone).

## Dependency verification

Socket.IO server/test client are pinned4.8.4. Backend dependency inspection also found existing advisories in body-parser, proxy-addr, qs and Zod. Updates within allowed ranges resolve the reported findings: body-parser2.4.0, proxy-addr2.0.8, qs6.16.1 and Zod4.6.7. `npm audit --omit=dev` reported zero known advisories on25 October2026. CI now blocks high/critical production advisories. No application exploitability or universal security claim follows from a registry scan. References: https://github.com/advisories/GHSA-27r3-jxmh-p828 , https://github.com/advisories/GHSA-jqcg-44mw-7w3h , https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 .

## Recorded acceptance

PostgreSQL18 Verify run40218117090 passed on runtimef37120ca88e0a24b3bc37ab803fc78bc05ca860f. Real Socket.IO clients and two gateways sharing PostgreSQL passed generation replacement, unauthorized-match/privacy, revocation and unchanged-deadline checks. Concurrent claims, old-generation cleanup, failed-claim rollback, lock-wait expiry, idle expiry and malformed token/event checks passed. All seven migrations deployed twice; backend/frontend checks/builds, production dependency audit, reconciliation and both Vercel previews passed. Public gameplay, hosted/device/load acceptance and the remaining protocol phases are still open.
