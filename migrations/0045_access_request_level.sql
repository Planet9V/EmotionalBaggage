-- Up Migration

-- The service level a visitor chose on the welcome page (Free, Maker, Studio, Self-hosted) travels with the
-- access request. '' means no level was chosen: every request stored before this column existed, and a
-- visitor who left the form on "Not sure yet". The names live in src/lib/accessRequests/shared.ts.
ALTER TABLE access_requests
  ADD COLUMN level text NOT NULL DEFAULT '',
  ADD CONSTRAINT access_requests_level_check CHECK (level IN ('', 'free', 'maker', 'studio', 'self'));

-- Down Migration
ALTER TABLE access_requests DROP CONSTRAINT IF EXISTS access_requests_level_check, DROP COLUMN IF EXISTS level;
