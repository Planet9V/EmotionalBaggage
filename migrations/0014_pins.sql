-- Up Migration
-- Plan 5.1 and docs/design/wiring.md: pins become rows, and a part in series becomes an ordinary part.
--
-- Why a table and not `items` rows: the wiring design and docs/design/database.md decide that a pin
-- is a row of `pins (item_id, name, kind, position, side)` belonging to one part row. A pin is
-- part of its part (deleting the part deletes its pins, one name per part), which a foreign key
-- and a unique index enforce here, and which `items` rows could not.
--
-- A part with no pin rows takes its pins from the library entry or kind it names (src/lib/parts/pins.ts).

CREATE TABLE pins (
  id         bigserial PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_id    bigint NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  name       text NOT NULL CONSTRAINT pins_name_valid CHECK (btrim(name) <> '' AND length(name) <= 60),
  -- NULL: not stated yet; the checks that need a kind skip the pin
  kind       text CONSTRAINT pins_kind_known CHECK (kind IN ('power_in','power_out','ground','input','output','bidirectional','passive','no_connect')),
  side       text CONSTRAINT pins_side_known CHECK (side IN ('left','right','top','bottom')),
  -- millimetres in the part's own coordinates: {"x": .., "y": ..}
  position   jsonb CONSTRAINT pins_position_object CHECK (position IS NULL OR jsonb_typeof(position) = 'object'),
  -- volts: {"min": .., "max": .., "nominal": ..}
  voltage    jsonb CONSTRAINT pins_voltage_object CHECK (voltage IS NULL OR jsonb_typeof(voltage) = 'object'),
  -- everything else a pin can say (number, current, bus, analog, pullUp, optional), checked by src/lib/parts/schema.ts
  data       jsonb NOT NULL DEFAULT '{}'::jsonb CONSTRAINT pins_data_object CHECK (jsonb_typeof(data) = 'object'),
  sort       int NOT NULL DEFAULT 0,
  CONSTRAINT pins_name_unique UNIQUE (item_id, name)
);
CREATE INDEX idx_pins_project ON pins (project_id, item_id, sort);

-- 1. Split every wire that runs through a part in series (`via`) into two wires, one to each of
--    the series part's pins (1 on the from side, 2 on the to side), and log each split.
CREATE TEMP TABLE via_split AS
  SELECT id, project_id, title, body, data, status, sort, data->>'via' AS via
  FROM items
  WHERE section = 'design/wiring' AND COALESCE(btrim(data->>'via'), '') <> '';

INSERT INTO items (project_id, section, title, body, data, status, sort)
SELECT project_id, 'design/wiring',
       left(title || ' (from ' || via || ')', 400), '',
       (data - 'via' - 'schematic') || jsonb_build_object('from', via, 'fromPin', '2'),
       status, sort
FROM via_split;

UPDATE items i SET
  title = left(v.title || ' (to ' || v.via || ')', 400),
  data = (i.data - 'via' - 'schematic') || jsonb_build_object('to', v.via, 'toPin', '1')
FROM via_split v WHERE i.id = v.id;

INSERT INTO events (project_id, kind, summary, data)
SELECT project_id, 'upgrade.via_split',
       'Upgrade: wire "' || title || '" ran through ' || via || ' and is now two wires, one to each of its pins',
       jsonb_build_object('itemId', id, 'before', jsonb_build_object('via', via, 'to', data->>'to', 'toPin', data->>'toPin'),
                          'after', jsonb_build_object('to', via, 'toPin', '1'))
FROM via_split;

-- Wires that named no series part drop the empty field.
UPDATE items SET data = data - 'via' WHERE section = 'design/wiring' AND data ? 'via';

-- 2. Parts that listed extra pin names (data.pins) or were in series on a wire get pin rows: the
--    names they listed, the names their wires use, and 1 and 2 for a series part. Their kind is
--    left unstated (NULL) except the series part's two pins, which are passive ends.
WITH parts AS (
  SELECT i.id, i.project_id, i.data->>'ref' AS ref, i.data->'pins' AS listed,
         EXISTS (SELECT 1 FROM via_split v WHERE v.project_id = i.project_id AND v.via = i.data->>'ref') AS series
  FROM items i
  WHERE i.section = 'design/bom' AND COALESCE(i.data->>'ref', '') <> ''
), wanted AS (
  SELECT p.id, p.project_id, p.ref, p.series FROM parts p
  WHERE p.series OR (jsonb_typeof(p.listed) = 'array' AND jsonb_array_length(p.listed) > 0)
), names AS (
  SELECT w.id, w.project_id, btrim(x.value) AS name, 0 AS src, x.ordinality AS n
    FROM wanted w, parts p, jsonb_array_elements_text(CASE WHEN jsonb_typeof(p.listed) = 'array' THEN p.listed ELSE '[]'::jsonb END) WITH ORDINALITY x
   WHERE p.id = w.id
  UNION ALL
  SELECT w.id, w.project_id, btrim(e.pin), 1, e.n
    FROM wanted w
    JOIN LATERAL (
      SELECT CASE WHEN wi.data->>'from' = w.ref THEN wi.data->>'fromPin' END AS pin, wi.id AS n FROM items wi
       WHERE wi.project_id = w.project_id AND wi.section = 'design/wiring' AND wi.data->>'from' = w.ref
      UNION ALL
      SELECT wi.data->>'toPin', wi.id FROM items wi
       WHERE wi.project_id = w.project_id AND wi.section = 'design/wiring' AND wi.data->>'to' = w.ref
    ) e ON true
  UNION ALL
  SELECT w.id, w.project_id, s.name, -1, s.n FROM wanted w, (VALUES ('1', 1), ('2', 2)) AS s(name, n) WHERE w.series
), firsts AS (
  SELECT DISTINCT ON (id, name) id, project_id, name, src, n FROM names
  WHERE COALESCE(name, '') <> '' AND length(name) <= 60
  ORDER BY id, name, src, n
)
INSERT INTO pins (project_id, item_id, name, kind, sort)
SELECT f.project_id, f.id, f.name,
       CASE WHEN f.src = -1 THEN 'passive' END,
       (row_number() OVER (PARTITION BY f.id ORDER BY f.src, f.n))::int
FROM firsts f;

INSERT INTO events (project_id, kind, summary, data)
SELECT i.project_id, 'upgrade.pins_rows',
       'Upgrade: the pins of part ' || (i.data->>'ref') || ' are now rows: ' || string_agg(pn.name, ', ' ORDER BY pn.sort),
       jsonb_build_object('itemId', i.id, 'after', jsonb_build_object('pins', jsonb_agg(pn.name ORDER BY pn.sort)))
FROM pins pn JOIN items i ON i.id = pn.item_id
GROUP BY i.id, i.project_id, i.data;

UPDATE items SET data = data - 'pins' WHERE section = 'design/bom' AND data ? 'pins';

DROP TABLE via_split;

-- Down Migration

DROP TABLE IF EXISTS pins;
-- Wires split from a series part are not joined again: the split is recorded in each concept's history.
