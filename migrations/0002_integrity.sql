-- Up Migration
-- Rules the database now enforces itself, so no code path can break them.

-- 1. Key lists are arrays. Rows written before that hold "a, b" in one string.
UPDATE items SET data = jsonb_set(data, '{after}', COALESCE(
  (SELECT jsonb_agg(btrim(x)) FROM unnest(string_to_array(data->>'after', ',')) AS x WHERE btrim(x) <> ''), '[]'::jsonb))
WHERE jsonb_typeof(data->'after') = 'string';
UPDATE items SET data = jsonb_set(data, '{dependsOn}', COALESCE(
  (SELECT jsonb_agg(btrim(x)) FROM unnest(string_to_array(data->>'dependsOn', ',')) AS x WHERE btrim(x) <> ''), '[]'::jsonb))
WHERE jsonb_typeof(data->'dependsOn') = 'string';
UPDATE items SET data = jsonb_set(data, '{unlocks}', COALESCE(
  (SELECT jsonb_agg(btrim(x)) FROM unnest(string_to_array(data->>'unlocks', ',')) AS x WHERE btrim(x) <> ''), '[]'::jsonb))
WHERE jsonb_typeof(data->'unlocks') = 'string';

-- 2. A part's reference is unique within its concept. Wires name parts by reference,
--    so two parts sharing one made every wire to it ambiguous. Where an existing
--    database already has a repeat, the later rows get "-2", "-3"… and the change is logged.
WITH ranked AS (
  SELECT id, project_id, title, data->>'ref' AS ref,
         row_number() OVER (PARTITION BY project_id, data->>'ref' ORDER BY sort, id) AS n
  FROM items
  WHERE section = 'design/bom' AND COALESCE(data->>'ref', '') <> ''
), renamed AS (
  UPDATE items i SET data = jsonb_set(i.data, '{ref}', to_jsonb(r.ref || '-' || r.n))
  FROM ranked r WHERE i.id = r.id AND r.n > 1
  RETURNING i.project_id, i.id, r.ref AS was, r.ref || '-' || r.n AS now, i.title
)
INSERT INTO events (project_id, kind, summary, data)
SELECT project_id, 'upgrade.ref_renamed',
       'Upgrade: part "' || title || '" shared the reference ' || was || ' with another part and is now ' || now,
       jsonb_build_object('itemId', id, 'before', jsonb_build_object('ref', was), 'after', jsonb_build_object('ref', now))
FROM renamed;

CREATE UNIQUE INDEX IF NOT EXISTS items_part_ref_unique
  ON items (project_id, (data->>'ref'))
  WHERE section = 'design/bom' AND COALESCE(data->>'ref', '') <> '';

-- 3. A key is unique within its concept, across every section: the order of operations
--    and the decision tree both address rows by key.
WITH ranked AS (
  SELECT id, project_id, title, data->>'key' AS key,
         row_number() OVER (PARTITION BY project_id, data->>'key' ORDER BY sort, id) AS n
  FROM items
  WHERE COALESCE(data->>'key', '') <> ''
), renamed AS (
  UPDATE items i SET data = jsonb_set(i.data, '{key}', to_jsonb(r.key || '-' || r.n))
  FROM ranked r WHERE i.id = r.id AND r.n > 1
  RETURNING i.project_id, i.id, r.key AS was, r.key || '-' || r.n AS now, i.title
)
INSERT INTO events (project_id, kind, summary, data)
SELECT project_id, 'upgrade.key_renamed',
       'Upgrade: "' || title || '" shared the key ' || was || ' with another row and is now ' || now,
       jsonb_build_object('itemId', id, 'before', jsonb_build_object('key', was), 'after', jsonb_build_object('key', now))
FROM renamed;

CREATE UNIQUE INDEX IF NOT EXISTS items_key_unique
  ON items (project_id, (data->>'key'))
  WHERE COALESCE(data->>'key', '') <> '';

-- 4. Shapes that every reader assumes.
ALTER TABLE items    ADD CONSTRAINT items_data_is_object     CHECK (jsonb_typeof(data) = 'object');
ALTER TABLE files    ADD CONSTRAINT files_meta_is_object     CHECK (jsonb_typeof(meta) = 'object');
ALTER TABLE events   ADD CONSTRAINT events_data_is_object    CHECK (jsonb_typeof(data) = 'object');
ALTER TABLE research ADD CONSTRAINT research_citations_array CHECK (jsonb_typeof(citations) = 'array');
ALTER TABLE items    ADD CONSTRAINT items_title_not_blank    CHECK (btrim(title) <> '');
ALTER TABLE messages ADD CONSTRAINT messages_role_known      CHECK (role IN ('user', 'assistant'));

-- 5. History is looked up by the row it is about.
CREATE INDEX IF NOT EXISTS idx_events_item ON events ((data->>'itemId')) WHERE data ? 'itemId';
CREATE INDEX IF NOT EXISTS idx_items_project ON items (project_id, sort, id);
