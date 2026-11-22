-- Up Migration
-- Sign-in waits per account (accounts slice 2, step 5; review note N4). Better Auth's own throttle counts per
-- network address only, so guesses at one account spread over many addresses were not slowed. Each try at an
-- address name is counted here, per (name, network address) and per name across all addresses, and earns a growing
-- wait: a delay, never a lock (src/lib/auth2/signInWait.ts). The name is stored as its SHA-256, never in the clear.
-- client = '' is the row for the name across every address. Owner-only: the request role is granted nothing here.
CREATE TABLE auth2_sign_in_waits (
  name_key text NOT NULL,
  client text NOT NULL,
  failures integer NOT NULL CHECK (failures >= 0),
  last_attempt_at timestamptz NOT NULL,
  next_allowed_at timestamptz NOT NULL,
  PRIMARY KEY (name_key, client)
);
CREATE INDEX auth2_sign_in_waits_last_idx ON auth2_sign_in_waits (last_attempt_at);

-- Down Migration
DROP TABLE IF EXISTS auth2_sign_in_waits;
