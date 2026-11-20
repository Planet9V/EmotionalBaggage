-- Up Migration
-- What Phase 2 of the plan needs: more than one concept managed properly, and an admin area.

-- A concept has a product type (which sections it shows), can be archived, and knows its stage.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'electronics';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'concept';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE projects ADD CONSTRAINT projects_name_not_blank CHECK (btrim(name) <> '');

-- Install-wide settings chosen in Admin: the reasoning model, the embedding model,
-- the planner address, the default concept. One row per setting.
CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Keys and tokens for outside services, entered in Admin (decision D3: stored here, not encrypted).
-- One row per provider and field, so one field can be replaced or removed without touching the rest.
CREATE TABLE credentials (
  provider text NOT NULL,
  field text NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, field),
  CHECK (btrim(value) <> '')
);

-- Printers added in Admin. `family` picks the adapter; `access` holds what that adapter needs.
CREATE TABLE printers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  family text NOT NULL,
  model text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  access jsonb NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(name) <> ''),
  CHECK (jsonb_typeof(access) = 'object')
);
CREATE UNIQUE INDEX printers_name_unique ON printers (lower(name));

-- One gate per stage per concept (decision D6: an unmet gate warns and can be overridden;
-- the override and its reason are kept).
CREATE TABLE gates (
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'go', 'rework', 'stop')),
  overridden boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT '',
  decided_at timestamptz,
  PRIMARY KEY (project_id, stage),
  CHECK (NOT overridden OR btrim(note) <> '')
);
