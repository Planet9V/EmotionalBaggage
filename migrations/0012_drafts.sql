-- Up Migration

-- AI drafts (plan 4.2 to 4.6, 4.8, 4.9). A generator reads a concept's rows, asks the reasoning model
-- for new rows of another section, and every row it proposes is kept here until a person decides.
-- A draft is not an `items` row: the section lists, the plan, the report and search never see it.
-- Approving creates (or, with item_id set, replaces) the items row in the same transaction and stores
-- its id here; rejecting only records the decision.
--
-- Why a table and not items rows with a "draft" status: a draft must not count anywhere a row counts
-- (keys and references are unique per concept, the planner orders every keyed row, the report and the
-- sections list every row), it records what it was generated from and by which model, and a draft of
-- a change to an existing row has to live beside that row without replacing it until approved.
CREATE TABLE drafts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- the generator's id, e.g. "requirements"
  generator text NOT NULL CHECK (generator <> ''),
  -- the section store the approved row goes into, e.g. "design/requirements"
  target_store text NOT NULL CHECK (target_store <> ''),
  title text NOT NULL CHECK (btrim(title) <> ''),
  body text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  -- what the draft was generated from: [{ "kind": "item" | "research" | "message", "id": 12, "title": "..." }]
  sources jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sources) = 'array'),
  model text NOT NULL DEFAULT '',
  provider text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected')),
  -- every draft made by one run of one generator shares this id
  run_id uuid NOT NULL,
  -- why a draft was rejected ("superseded" when a newer run of the same generator replaced it)
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by text,
  -- before approval: the row this draft would replace (null for a new row);
  -- after approval: the row it created or replaced. A removed row leaves it null.
  item_id bigint NULL REFERENCES items(id) ON DELETE SET NULL,
  CHECK ((status = 'draft') = (decided_at IS NULL))
);
CREATE INDEX drafts_scope ON drafts (project_id, target_store, status);
CREATE INDEX drafts_run ON drafts (run_id);

-- "Challenge this": a reviewer exchange about one row keeps a link back to that row.
ALTER TABLE messages ADD COLUMN item_id bigint NULL REFERENCES items(id) ON DELETE SET NULL;
CREATE INDEX messages_item ON messages (item_id) WHERE item_id IS NOT NULL;

-- Down Migration

DROP INDEX messages_item;
ALTER TABLE messages DROP COLUMN item_id;
DROP TABLE drafts;
