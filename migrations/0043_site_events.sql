-- Up Migration

-- First-party funnel counting for the public welcome page (docs/research/landing/conversion-review-2026-11-22.md,
-- section 5.1; docs/design/early-access.md). One row per event. No name, email, network address or browser string
-- is ever stored: `visit` is a random value the browser keeps for one session only (sessionStorage, no cookie).
-- Rows older than the setting events.retentionDays (default 180) are deleted (src/lib/events/store.ts).
CREATE TABLE site_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL,
  path text NOT NULL DEFAULT '',
  section text NOT NULL DEFAULT '',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  visit text NOT NULL DEFAULT '',
  CHECK (event ~ '^[a-z_]{2,40}$'),
  CHECK (length(path) <= 200),
  CHECK (length(section) <= 60),
  CHECK (visit = '' OR visit ~ '^[A-Za-z0-9_-]{8,40}$'),
  CHECK (jsonb_typeof(detail) = 'object' AND octet_length(detail::text) <= 2000)
);
CREATE INDEX site_events_at ON site_events (at);
CREATE INDEX site_events_visit ON site_events (visit, at) WHERE visit <> '';

-- Down Migration
DROP TABLE IF EXISTS site_events;
