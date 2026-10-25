BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE player_admissions ADD COLUMN ranked_changed_at timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE player_admissions ADD COLUMN ranked_epoch bigint NOT NULL DEFAULT 0 CHECK(ranked_epoch>=0);
CREATE TABLE ranked_tickets (
 id uuid PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),connection_id uuid NOT NULL,
 request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
 state text NOT NULL CHECK(state IN('SEARCHING','OFFER','STARTED','CANCELLED','EXPIRED')),
 joined_at timestamptz NOT NULL,last_seen_at timestamptz NOT NULL,search_expires_at timestamptz NOT NULL,
 UNIQUE(user_id,request_key),UNIQUE(id,user_id),CHECK(search_expires_at>joined_at)
);
CREATE UNIQUE INDEX ranked_ticket_live ON ranked_tickets(user_id) WHERE state IN('SEARCHING','OFFER');
CREATE INDEX ranked_ticket_search ON ranked_tickets(joined_at,id) WHERE state='SEARCHING';
CREATE TABLE ranked_offers (
 id uuid PRIMARY KEY,a_ticket uuid NOT NULL REFERENCES ranked_tickets(id),b_ticket uuid NOT NULL REFERENCES ranked_tickets(id),
 state text NOT NULL CHECK(state IN('PENDING','STARTED','CANCELLED','EXPIRED')),
 accepted_a boolean NOT NULL DEFAULT false,accepted_b boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,match_id uuid UNIQUE REFERENCES game_matches(id),
 CHECK(a_ticket<>b_ticket),CHECK(expires_at>created_at),CHECK((state='STARTED')=(match_id IS NOT NULL))
);
CREATE UNIQUE INDEX ranked_offer_a_live ON ranked_offers(a_ticket) WHERE state='PENDING';
CREATE UNIQUE INDEX ranked_offer_b_live ON ranked_offers(b_ticket) WHERE state='PENDING';
CREATE TABLE ranked_reservations (
 offer_id uuid NOT NULL REFERENCES ranked_offers(id),user_id text NOT NULL REFERENCES users(id),
 state text NOT NULL CHECK(state IN('RESERVED','STARTED','RELEASED')),lagos_date date NOT NULL,
 reserved_at timestamptz NOT NULL,started_at timestamptz,slot smallint CHECK(slot BETWEEN 1 AND 3),match_id uuid REFERENCES game_matches(id),
 PRIMARY KEY(offer_id,user_id),FOREIGN KEY(match_id,user_id) REFERENCES game_players(match_id,user_id),
 CHECK((state='STARTED' AND match_id IS NOT NULL AND started_at IS NOT NULL AND slot IS NOT NULL) OR (state<>'STARTED' AND match_id IS NULL AND started_at IS NULL AND slot IS NULL))
);
CREATE UNIQUE INDEX ranked_reservation_live ON ranked_reservations(user_id) WHERE state='RESERVED';
CREATE UNIQUE INDEX ranked_daily_slot ON ranked_reservations(user_id,lagos_date,slot) WHERE state='STARTED';
CREATE INDEX ranked_usage ON ranked_reservations(user_id,lagos_date,state);
CREATE TABLE ranked_matchmaker_lease (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),generation bigint NOT NULL DEFAULT 0,
 token uuid,expires_at timestamptz NOT NULL DEFAULT '-infinity'
);
INSERT INTO ranked_matchmaker_lease(id) VALUES(true);
CREATE FUNCTION protect_ranked_charge() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.state='STARTED' THEN RAISE EXCEPTION 'Ranked start charge is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ranked_charge_immutable BEFORE UPDATE OR DELETE ON ranked_reservations FOR EACH ROW EXECUTE FUNCTION protect_ranked_charge();
CREATE FUNCTION enforce_ranked_offer() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; o ranked_offers%ROWTYPE; au text; bu text; n integer; valid integer; days integer;
BEGIN
 IF TG_TABLE_NAME='ranked_offers' THEN target:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
 ELSE target:=CASE WHEN TG_OP='DELETE' THEN OLD.offer_id ELSE NEW.offer_id END; END IF;
 SELECT * INTO o FROM ranked_offers WHERE id=target;IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT user_id INTO au FROM ranked_tickets WHERE id=o.a_ticket;SELECT user_id INTO bu FROM ranked_tickets WHERE id=o.b_ticket;
 SELECT count(*),count(*) FILTER(WHERE user_id IN(au,bu) AND
  ((o.state='PENDING' AND state='RESERVED') OR (o.state='STARTED' AND state='STARTED' AND match_id=o.match_id) OR (o.state IN('CANCELLED','EXPIRED') AND state='RELEASED'))),
  count(DISTINCT lagos_date) INTO n,valid,days FROM ranked_reservations WHERE offer_id=target;
 IF au=bu OR n<>2 OR valid<>2 OR days<>1 THEN RAISE EXCEPTION 'Ranked offer requires two matching reservations'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER ranked_offer_complete AFTER INSERT OR UPDATE ON ranked_offers DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_ranked_offer();
CREATE CONSTRAINT TRIGGER ranked_reservations_complete AFTER INSERT OR UPDATE OR DELETE ON ranked_reservations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_ranked_offer();
COMMIT;
