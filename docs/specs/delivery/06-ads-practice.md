# Verified ads, practice admission and counters

Status: **Specified; not implemented**. Covers: C2, H8/H11, M7, practice requirements. Dependencies and sequence: [delivery index](README.md). Product decisions: [rulebook](RULEBOOK.md).

### Provider contract gate

Before implementing credits, confirm provider publisher access at expected traffic, HTTPS callback method, authenticity proof, stable event ID, user ID, ad unit, purpose and correlation to a server-issued session. Adsgram's public GET Telegram-ID callback example is insufficient proof of session identity or replay rejection. Do not invent POST JSON fields. Use adapter capability tests against provider sandbox. If provider cannot satisfy these requirements, select a compatible integration or record an alternative architecture; no client success callback may mint a credit.

### Data and lifecycle

ad_sessions(id UUID,user_id,purpose,ad_unit,nonce_hash,status,expires_at); provider_ad_events(provider,event_id UNIQUE,session_id,payload_hash,verified_at); ad_credits(id,session_id UNIQUE,user_id,purpose,expires_at,consumed_by nullable). Verify authenticity before parsing economic claims; insert provider event once. A static secret URL alone does not prove a unique ad impression. Redact callback credentials from logs.

POST /ads/sessions returns public session/placement data, not provider secrets. POST /practice/start takes Idempotency-Key and an optional credit/session reference. One transaction locks the user admission row, checks premium/ads-free state, daily starts and active session, consumes a valid credit conditionally, reserves a practice start and creates match/outbox intent. On unavailable-ad fallback, normal completion still counts toward25 per latest D9; issue an explicit reason-coded admission rather than forged ad evidence. Premium has no video gate and no daily practice cap. Five regular STARTS per Lagos day, not completions; early abandonment does not restore a spent start. Technical start failure releases reservation/credit once.

### Acceptance

Invalid signature/source/user/purpose/unit; replayed and out-of-order callbacks; expired credit, two starts same credit, last available daily slot races, midnight, premium expiry between session/start, no-fill fallback, active ranked queue conflict, process crash after DB commit. UI has real no-fill/error/waiting states. Ad-free tasks and cooldown skips use purpose-bound credits. No timer, local points increment or debug SDK view ever counts as a rewarded event. Enable the public flow only after these tests and provider evidence pass.

## Implementation record

Record commit, schema version, commands/results, integration evidence, unresolved decisions and recovery rehearsal here before marking complete. An acceptance criterion written above is not evidence that it passed.
