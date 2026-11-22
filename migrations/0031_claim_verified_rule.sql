-- Up Migration
-- A claim is verified only when a supporting source stands behind it: the source is named, it came
-- from a saved research answer, and the words it says are quoted (src/lib/research/status.ts). Until
-- now one supporting verdict was enough, and a status typed before the evidence rule existed stayed.
-- A claim's status is a copy of what its evidence gives, so the copies that the rule no longer gives
-- go back to unverified here. The evidence itself is left as it is: adding the quote verifies the claim
-- again. Each change is written to the concept's activity, with the status before and after.
WITH weak AS (
  SELECT i.id, i.project_id, i.title, i.section
  FROM items i
  CROSS JOIN LATERAL (SELECT CASE WHEN jsonb_typeof(i.data->'evidence') = 'array' THEN i.data->'evidence' ELSE '[]'::jsonb END AS list) ev
  WHERE i.section = 'research/claims'
    AND i.status = 'verified'
    AND (
      NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(ev.list) e
        WHERE e->>'verdict' = 'supports'
          AND jsonb_typeof(e->'researchId') = 'number'
          AND btrim(coalesce(e->>'quote', '')) <> ''
          AND btrim(coalesce(e->>'url', '')) <> ''
      )
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(ev.list) e WHERE e->>'verdict' = 'contradicts')
    )
), changed AS (
  UPDATE items SET status = 'unverified', updated_at = now() FROM weak WHERE items.id = weak.id
  RETURNING items.id
)
INSERT INTO events (project_id, kind, summary, data)
SELECT w.project_id, 'item.status',
       'Claim "' || w.title || '" went back to unverified: no supporting source with a saved answer and a quote stands behind it',
       jsonb_build_object('itemId', w.id, 'section', w.section, 'title', w.title, 'before', jsonb_build_object('status', 'verified'), 'after', jsonb_build_object('status', 'unverified'), 'by', 'migration 0031')
FROM weak w JOIN changed c ON c.id = w.id;

-- Down Migration
-- Nothing to undo: which claims were verified under the earlier rule is in the events written above.
