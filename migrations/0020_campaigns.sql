-- Up Migration

-- Campaign results and tracked links (plan 8.15, 8.16).
--
-- Why tables and not `items` rows: a campaign makes one results row per creative per day and a short
-- link counts one click per day, so a long campaign is thousands of rows. They are numbers added up and
-- compared, never read one by one as sections, and the open redirect (/l/<code>) must find a link by its
-- code in one indexed read and count a click in one statement, with nothing else about the visitor kept.
-- Campaigns, creatives and the launch plan stay `items` rows.

CREATE TABLE campaign_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- the campaign row (marketing/campaigns); its results go with it
  campaign_id bigint NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  -- the ad or post row the numbers belong to, when they are for one creative. Not a foreign key: deleting
  -- an ad must not delete what it earned, and must not fail because a campaign-wide row already exists.
  creative_id bigint NULL,
  -- the creative's name when the row was saved, for when the row is gone
  creative_label text NOT NULL DEFAULT '',
  day date NOT NULL,
  -- money in minor units (cents)
  spend_minor bigint NOT NULL DEFAULT 0 CHECK (spend_minor >= 0),
  impressions bigint NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  orders bigint NOT NULL DEFAULT 0 CHECK (orders >= 0),
  revenue_minor bigint NOT NULL DEFAULT 0 CHECK (revenue_minor >= 0),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'paste', 'csv')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- one row per campaign, creative and day; saving a day again replaces it
CREATE UNIQUE INDEX campaign_results_day ON campaign_results (campaign_id, COALESCE(creative_id, 0), day);
CREATE INDEX campaign_results_project ON campaign_results (project_id, campaign_id, day);

CREATE TABLE tracked_links (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  campaign_id bigint NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  creative_id bigint NULL,
  creative_label text NOT NULL DEFAULT '',
  -- the address the user typed, and the address with UTM parameters that visitors are sent to
  base_url text NOT NULL CHECK (base_url ~ '^https?://'),
  destination text NOT NULL CHECK (destination ~ '^https?://' AND length(destination) <= 2000),
  utm_source text NOT NULL,
  utm_medium text NOT NULL,
  utm_campaign text NOT NULL,
  utm_content text NOT NULL DEFAULT '',
  utm_term text NOT NULL DEFAULT '',
  -- the short address /l/<code>; null when the link is used as a plain UTM address only
  code text NULL UNIQUE CHECK (code ~ '^[a-z0-9]{6,12}$'),
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT ''
);
CREATE INDEX tracked_links_project ON tracked_links (project_id, campaign_id);

-- Clicks by day and nothing else: no address, no user agent, no referrer, no time of day.
CREATE TABLE link_clicks (
  link_id bigint NOT NULL REFERENCES tracked_links(id) ON DELETE CASCADE,
  day date NOT NULL,
  clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  PRIMARY KEY (link_id, day)
);

-- Down Migration

DROP TABLE link_clicks;
DROP TABLE tracked_links;
DROP TABLE campaign_results;
