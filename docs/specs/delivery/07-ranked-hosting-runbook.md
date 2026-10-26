# Ranked worker deployment and acceptance

Prepared26 October2026; **not deployed**. Uses Render Background Workers and Blueprints skill guidance and current Render deploy, health-check, free-instance and Blueprint references. `deploy/render-ranked-workers.yaml` passed Render's published JSON Schema validation locally. Platform-aware provisioning validation remains pending. The supplied connector can create web services but exposes no background-worker creation operation.

## Concrete deployment unit

One paid0.5c-512mb worker, explicitly manual deployment, runs `npm run worker:ranked-all`: three independent bounded loops for game deadlines/practice and ranked settlement, ranked matching, and committed game delivery. This reduces service count; it does not certify512MB capacity. No HTTP listener, idle-prevention traffic or extra database/Redis is provisioned. Each loop writes per-instance operational health. SIGTERM stops new work, awaits bounded transactions, releases lease ownership and closes connections. Shutdown allowance120 seconds.

The Render free tier does not offer dedicated background workers. The manifest creates a billed resource if applied. Render currently lists this worker size at$7/month (compute only); confirm the Dashboard's displayed charge and budget before applying it. This is an additional service charge, not an all-in hosting bundle. Neither a new paid service nor a main/API production migration has been created by preparing this file.

## Gates before deployment

1. Verify a fresh backup by restoring into a disposable database. Confirm production preflight and baseline; apply all nine migrations to the intended database using the migration operator. Runtime workers must never migrate automatically. Do not point development workers at a production database merely to make a preview pass.
2. Set DATABASE_URL and REDIS_URL privately to the intended environment's internal connections. Use an environment-specific RANKED_QUEUE_NAMESPACE and GAME_RELAY_CHANNEL, identical on API and workers; never reuse preview namespace/channel with production. Keep total pool budgets within the database connection limit (supervisor5, API and other services additional).
3. Deploy the tested commit to API and workers with realtime read/moves/delivery/ranked gates enabled only for the reviewed environment. Frontend requires VITE_ENABLE_RANKED=true and matching VITE_API_URL; both default off for unreleased builds. Public capability remains false until release approval. Do not deploy the worker while the API still runs an incompatible schema/build.
4. In Render, New → Background Worker (or review this Blueprint at its explicit path), link the intended tested branch/commit, disable automatic deploys initially, configure the manifest's build/start/environment. Confirm the resulting deploy reaches live. A live worker is not proof that loops are healthy.
5. Run two authenticated clients through search → pushed offer → mutual acceptance → moves → forfeit/timeout → pushed settled result → rematch. Confirm exactly two result receipts, one start per player, no private opponent hand and correct task/day points. Probe duplicate accept/action, another account's IDs, expiry and replacement session.
6. Restart the worker during search, offer and active game. Check unexpired ownership fences, SQL reconstruction, deadlines not reset, latest projection recovery and once-only settlement. No started admission is automatically refunded.

## Operational queries (read-only)

```sql
SELECT role,max(last_success_at) AS last_success,max(last_failure_at) AS last_failure,
       sum(failures) AS failures
FROM ranked_worker_health GROUP BY role;

SELECT count(*) AS unsettled FROM game_matches m
WHERE m.mode='RANKED' AND m.status='FINISHED'
AND EXISTS(SELECT 1 FROM ranked_reservations r WHERE r.match_id=m.id)
AND NOT EXISTS(SELECT 1 FROM ranked_results r WHERE r.match_id=m.id);

SELECT match_id,count(*) FROM ranked_results GROUP BY match_id HAVING count(*)<>2;
```

Alert on missing success for any current role for30 seconds, growing unsettled count or repeated sanitized pass failures. Heartbeat failures must be monitored through service logs as a lost database can also prevent heartbeat writes. Render HTTP health checks do not apply to workers. This runbook prepares monitoring; no hosted alert receiver is configured.

## Acceptance matrix

- [ ] Worker deploy live at reviewed commit with all three fresh role heartbeats.
- [ ] Hosted SIGTERM/redeploy/recovery rehearsal and migration/restore evidence.
- [ ] Two physical Telegram phones: foreground/background, network loss, session replacement, expiry, small viewport, VoiceOver/TalkBack and touch controls.
- [ ] Hosted load target agreed and measured;5000 simultaneous sockets and1million pair attempts remain unverified. CI's smaller localhost test is a regression measurement, not a hosted capacity claim.
- [ ] Verified provider-backed cooldown skip. No client ad callback can bypass cooldown.
- [ ] Technical incident compensation/adjudication tooling, separate from this conservative no-automatic-refund policy.

References: https://render.com/docs/background-workers, https://render.com/docs/free, https://render.com/docs/compute-plans, https://render.com/docs/deploys, https://render.com/docs/health-checks, https://render.com/docs/blueprint-spec.
