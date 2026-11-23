-- Up Migration

-- Early access (owner, 22 Nov: "nothing free, but we could do a signup for early access"; "limit early access to 50
-- only"). An access request is now the early-access sign-up: an email and one line ("What do you want to make?").
-- Name, company and level are optional and may be added afterwards on the confirmation step, by an unguessable
-- token tied to the request just stored (never by email).
--
-- A place is held by a request with a place number whose status is not 'declined'. Places are given in order up to
-- the limit (the setting earlyAccess.limit, default 50); after that a request is stored on the waiting list (no
-- place number), and its position is its rank among waiting requests that are not declined, oldest first.
-- src/lib/accessRequests/places.ts gives places under one transaction-level advisory lock, so the limit holds when
-- many claim at once.

-- the name is optional now: an empty one is "not given"
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'access_requests'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%btrim(name)%' LOOP
    EXECUTE format('ALTER TABLE access_requests DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE access_requests
  ADD CONSTRAINT access_requests_name_length CHECK (length(name) <= 120),
  -- the early-access place number, 1 up to the limit; null: on the waiting list
  ADD COLUMN place integer,
  -- where on the welcome page the form was sent from ('' for the older request form)
  ADD COLUMN placement text NOT NULL DEFAULT '',
  -- sha-256 (hex) of the token that lets the confirmation step add name, company and level; the token itself is
  -- never stored
  ADD COLUMN details_token_hash text,
  ADD COLUMN details_token_expires timestamptz,
  ADD CONSTRAINT access_requests_place_check CHECK (place IS NULL OR place >= 1),
  ADD CONSTRAINT access_requests_placement_check CHECK (placement IN ('', 'hero', 'pricing', 'close', 'page'));

CREATE INDEX access_requests_email ON access_requests (lower(email));
CREATE UNIQUE INDEX access_requests_details_token ON access_requests (details_token_hash) WHERE details_token_hash IS NOT NULL;

-- Requests stored before early access: the ones not declined take places in the order they came, up to the
-- default limit of 50; any after that wait.
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS n FROM access_requests WHERE status <> 'declined'
)
UPDATE access_requests a SET place = r.n FROM ranked r WHERE a.id = r.id AND r.n <= 50;

-- Down Migration
DROP INDEX IF EXISTS access_requests_details_token;
DROP INDEX IF EXISTS access_requests_email;
ALTER TABLE access_requests
  DROP CONSTRAINT IF EXISTS access_requests_placement_check,
  DROP CONSTRAINT IF EXISTS access_requests_place_check,
  DROP CONSTRAINT IF EXISTS access_requests_name_length,
  DROP COLUMN IF EXISTS details_token_expires,
  DROP COLUMN IF EXISTS details_token_hash,
  DROP COLUMN IF EXISTS placement,
  DROP COLUMN IF EXISTS place;
UPDATE access_requests SET name = '(not given)' WHERE btrim(name) = '';
ALTER TABLE access_requests ADD CONSTRAINT access_requests_check CHECK (btrim(name) <> '' AND length(name) <= 120);
