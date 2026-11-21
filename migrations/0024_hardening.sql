-- Up Migration
-- Robustness review (S1): every saved credential records the origin (scheme://host:port) it was saved
-- for, and a secret is only ever sent to that origin (src/lib/secretOrigin.ts). Rows saved before this
-- migration have no origin; the app binds each one to the address in use the first time it is read.
ALTER TABLE credentials ADD COLUMN bound_origin text;

-- Down Migration

ALTER TABLE credentials DROP COLUMN IF EXISTS bound_origin;
