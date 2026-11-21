-- Up Migration
-- Robustness review (S1): every saved credential records the origin (scheme://host:port) it was saved
-- for, and a secret is only ever sent to that origin (src/lib/secretOrigin.ts). Rows saved before this
-- migration have no origin; the app binds each one to the address in use the first time it is read.
ALTER TABLE credentials ADD COLUMN bound_origin text;

-- S4: sign-in throttling without a lockout. Counts are kept per (username, client address) and per client
-- address (username_key ''), each with the time before which the next try is refused. Old counts are only
-- throttling state, so the table is rebuilt empty.
DROP TABLE sign_in_attempts;
CREATE TABLE sign_in_attempts (
  username_key text NOT NULL,
  client text NOT NULL,
  failures int NOT NULL CHECK (failures >= 0),
  last_attempt_at timestamptz NOT NULL,
  next_allowed_at timestamptz NOT NULL,
  PRIMARY KEY (username_key, client)
);
CREATE INDEX sign_in_attempts_last ON sign_in_attempts (last_attempt_at);

-- Down Migration

DROP TABLE IF EXISTS sign_in_attempts;
CREATE TABLE sign_in_attempts (
  username_key text PRIMARY KEY,
  failures int NOT NULL CHECK (failures >= 0),
  window_started_at timestamptz NOT NULL
);
ALTER TABLE credentials DROP COLUMN IF EXISTS bound_origin;
