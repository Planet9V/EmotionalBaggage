-- Up Migration
-- Plan 8.17 to 8.20: rows read from an outside service (Amazon orders, X mentions, Instagram comments,
-- imported reviews) carry the service's id in data.externalId. This index keeps one row per id per
-- section of a concept, so a repeated import updates the row instead of adding a second one, even when
-- two imports run at once. It is a partial index on `items`: no new table, and rows without an
-- externalId (everything typed by hand) are not touched.
-- A row that already shares an externalId with an older row in the same section would stop the index
-- being built; none existed before this migration (no code wrote externalId), but repair defensively:
-- the newer duplicate loses its externalId and the change is logged as a notice.
DO $$
DECLARE n int;
BEGIN
  WITH d AS (
    SELECT id, row_number() OVER (PARTITION BY project_id, section, data->>'externalId' ORDER BY id) AS rn
    FROM items WHERE data ? 'externalId'
  )
  UPDATE items SET data = data - 'externalId' FROM d WHERE items.id = d.id AND d.rn > 1;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN RAISE NOTICE '0021: removed a duplicate externalId from % rows', n; END IF;
END $$;

CREATE UNIQUE INDEX items_external_id_unique ON items (project_id, section, (data->>'externalId')) WHERE data ? 'externalId';

-- Down Migration

DROP INDEX IF EXISTS items_external_id_unique;
