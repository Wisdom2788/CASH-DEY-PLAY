# Entitlements, daily tasks and durable referrals

Status: **Core implemented on feature-implementation in PR5; staging and external source integrations pending**. Covers: H6/H7/H10, H11, M9/M12/M13. Dependencies and sequence: [delivery index](README.md). Product decisions: [rulebook](RULEBOOK.md).

### Tables and rule authority

premium_orders(id,user_id,plan_id,duration_days,stars_amount,currency,status,charge_id UNIQUE); premium_subscriptions expiry derived from paid entitlement records; no independent premium boolean authority. Legacy free grants must be revoked or migrated to explicit tester grants outside production. daily_task_state PK(user_id,lagos_date,task_key), status AVAILABLE/AUTO_READY/CLAIMED, source,claimed_at,points_awarded; task_claims with unique source event; ad_free_days(user_id,valid_on) PK. Entitlements service computes tier, expiry, videos, practice/ranked limits and qualification gates on every sensitive mutation.

### Tasks

GET /tasks/state creates day rows idempotently and returns action WATCH_VIDEO/CLAIM/NONE. Exempt videos become AUTO_READY; they are not completed until Claim. POST /tasks/:key/claim accepts only an eligible task, locks user/day task aggregate, rechecks expiry/ad-free eligibility at the transaction timestamp, awards once and evaluates all-complete bonus after each source update. Normal video claims require verified ad credit from stage06, never client proof. WIN_RANKED_MATCH comes only from settlement. All four CLAIMED defines a task day; queries index player/date. Serialize different task completions to avoid a lost bonus race.

### Referrals

Generate eight-character cryptographically random codes with unique DB constraint and bounded collision retry. Parse start_param only from verified signed initData. Persist pending attribution in the SAME first-user-create transaction, and resolve safely or outbox-retry without failing login. Existing players/self/unknown codes do not create an attribution. referrals has UNIQUE(referred_id), no-self constraint, canonical referrer/referred FKs, status PENDING/QUALIFIED/EXPIRED and expires_at. Link builder reads bot/miniapp settings; Vite configuration changes require a rebuild. A summary returns username/progress only. Qualification and150-point credits are stage08.

### Acceptance and deployment

Expiry exactly now and three-day threshold; premium upgrade/refund during task claim; ad-free plus premium overlap; two task claims finishing together award bonus once; legacy revocation stays effective under rollback; simultaneous first logins, database outage during attribution and retry after creation; forced random-code collision; genuine Telegram share link on two devices. Backfill old video completions without awarding points twice. Deploy backward-compatible envelopes first, migrate with reconciliation, then switch frontend reads; do not leave users.is_premium authorizing old clients.

## Implementation record

Record commit, schema version, commands/results, integration evidence, unresolved decisions and recovery rehearsal here before marking complete. An acceptance criterion written above is not evidence that it passed.

## Core implementation record (25 October 2026)

Migration2026102502_entitlements revokes legacy premium flags/subscriptions, establishes paid order/contribution authority, imports recognized legacy task claims without points, and rejects ambiguous referral ownership. Profile/status read paid unrevoked records; the old boolean cannot authorize new code. Task state/claims lock the player and entitlement records, then evaluate an exact PostgreSQL timestamp. Requests accept no player-supplied ad or ranked-win proof. Unique claim identity, points, completion, audit and outbox persist together. Completing different tasks in parallel cannot lose or duplicate the automatic bonus. Four CLAIMED rows define a task day in monthly reads.

New accounts receive random eight-character codes with bounded savepoint retries. Signed first-login intents resolve after releasing the login connection, avoiding pool starvation. Resolver failure retains durable intent without undoing the committed login. db:referrals:resolve retries bounded private batches. The authenticated referral summary contains username/progress/status, and a configured Telegram Mini App link; missing configuration returns null. Frontend copying waits for success and handles unavailable clipboard/configuration. Exempt task buttons call the real claim API and refresh profile from the server; no local points increment occurs.

Runtime5fcd496 passed PostgreSQL18 CI run40185792652, including the exact-expiry and parallel login/claim regressions. Subsequent HTTP contract, runtime frontend schema and task-outbox additions require their own recorded PR5 CI result. The older SQL-mocking task tests and obsolete award repository were replaced by the real entitlement/claim tests, rather than retaining an alternate unverified award path.

Still pending: staging backup/restore and migrations; actual verified ads/ranked settlement writers; paid Stars purchase/refund lifecycle; scheduled attribution recovery; referral qualification/150-point credit in stage08; exact qualification-tier/three-day policies at the owning stage; configured staging bot/miniapp and two-device share test. No premium payment, ad credit, ranked match or referral reward is claimed operational.
