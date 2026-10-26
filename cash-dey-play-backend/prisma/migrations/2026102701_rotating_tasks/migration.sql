BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE daily_task_policy (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 rotating_from date NOT NULL
);
INSERT INTO daily_task_policy(rotating_from) VALUES((clock_timestamp() AT TIME ZONE 'Africa/Lagos')::date+1);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM daily_task_state WHERE lagos_date>=(SELECT rotating_from FROM daily_task_policy)) THEN
  RAISE EXCEPTION 'Future daily task state requires explicit cutover reconciliation';
 END IF;
END $$;
CREATE FUNCTION valid_daily_task_schedule(value jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE item jsonb; keys text[]='{}'; k text;
BEGIN
 IF jsonb_typeof(value)<>'array' OR jsonb_array_length(value)<>3 THEN RETURN false; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(value) LOOP
  k=item->>'key';
  IF k IS NULL OR NOT(k=ANY(ARRAY['WIN_MATCH','RANKED_FINISH','RANKED_PLAY_CARDS','RANKED_SUITS'])) OR k=ANY(keys)
   OR jsonb_typeof(item->'target') IS DISTINCT FROM 'number' OR (item->>'target')!~'^[1-9][0-9]?$'
   OR jsonb_typeof(item->'points') IS DISTINCT FROM 'number' OR item->>'points'<>'50'
   OR jsonb_typeof(item->'title') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
  IF (item->>'target')::int>CASE k WHEN 'WIN_MATCH' THEN 3 WHEN 'RANKED_FINISH' THEN 3 WHEN 'RANKED_SUITS' THEN 5 ELSE 50 END THEN RETURN false; END IF;
  keys=array_append(keys,k);
 END LOOP;
 RETURN true;
END $$;
CREATE TABLE daily_task_schedules (
 lagos_date date PRIMARY KEY,version text NOT NULL CHECK(version='rotating-v2'),
 definition jsonb NOT NULL CHECK(valid_daily_task_schedule(definition)),
 published_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION reject_task_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Daily task policy, schedules and claim receipts are immutable'; END $$;
CREATE TRIGGER daily_task_policy_immutable BEFORE UPDATE OR DELETE ON daily_task_policy FOR EACH ROW EXECUTE FUNCTION reject_task_history_mutation();
CREATE TRIGGER daily_task_schedules_immutable BEFORE UPDATE OR DELETE ON daily_task_schedules FOR EACH ROW EXECUTE FUNCTION reject_task_history_mutation();
CREATE TRIGGER task_claims_immutable BEFORE UPDATE OR DELETE ON task_claims FOR EACH ROW EXECUTE FUNCTION reject_task_history_mutation();
ALTER TABLE daily_task_state DROP CONSTRAINT daily_task_state_task_key_check;
ALTER TABLE daily_task_state ADD CONSTRAINT daily_task_state_task_key_check CHECK(task_key IN('MANDATORY_VIDEO_LOGIN','MANDATORY_VIDEO_UNLOCK','WIN_MATCH','BONUS_ALL_COMPLETE','RANKED_FINISH','RANKED_PLAY_CARDS','RANKED_SUITS'));
ALTER TABLE daily_task_state ADD COLUMN progress integer NOT NULL DEFAULT 0 CHECK(progress>=0);
CREATE FUNCTION guard_rotating_task_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.lagos_date>=(SELECT rotating_from FROM daily_task_policy) AND NOT EXISTS(
  SELECT 1 FROM daily_task_schedules s WHERE s.lagos_date=NEW.lagos_date
   AND (NEW.task_key='BONUS_ALL_COMPLETE' OR EXISTS(SELECT 1 FROM jsonb_array_elements(s.definition) item WHERE item->>'key'=NEW.task_key))
 ) THEN RAISE EXCEPTION 'Published rotating task schedule required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER daily_task_schedule_required BEFORE INSERT ON daily_task_state FOR EACH ROW EXECUTE FUNCTION guard_rotating_task_insert();
CREATE VIEW qualified_task_days AS
 WITH required AS (
  SELECT b.user_id,b.lagos_date,b.claimed_at AS bonus_at,
   coalesce(s.definition,'[{"key":"MANDATORY_VIDEO_LOGIN"},{"key":"MANDATORY_VIDEO_UNLOCK"},{"key":"WIN_MATCH"}]'::jsonb) AS definition
  FROM daily_task_state b LEFT JOIN daily_task_schedules s USING(lagos_date)
  WHERE b.task_key='BONUS_ALL_COMPLETE' AND b.status='CLAIMED'
 )
 SELECT r.user_id,r.lagos_date,least(r.bonus_at,min(d.claimed_at)) AS first_claim_at,
  greatest(r.bonus_at,max(d.claimed_at)) AS completed_at
 FROM required r CROSS JOIN LATERAL jsonb_array_elements(r.definition) item
 LEFT JOIN daily_task_state d ON d.user_id=r.user_id AND d.lagos_date=r.lagos_date AND d.task_key=item->>'key' AND d.status='CLAIMED'
 GROUP BY r.user_id,r.lagos_date,r.bonus_at,r.definition
 HAVING count(d.task_key)=jsonb_array_length(r.definition);
COMMIT;
