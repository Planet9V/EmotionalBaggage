-- Up Migration

-- The plan catalogue becomes two plans, Maker and Studio, prices shown (owner, 22 Nov: "nothing free"; "limit early
-- access to 50 only, then convert to 20/month and 40 per month"; "no you cannot run it yourself, remove it").
-- An install with no saved catalogue needs nothing: the built-in one (src/lib/admin/planSchema.ts) is already the
-- two plans. A catalogue saved in Admin, Pricing and tiers keeps everything its admin set, except:
--  - the Free and Self-hosted tiers (keys "free" and "self") are removed;
--  - a monthly price still at the old built-in value or never set ($29 or none for Maker, $99 or none for Studio)
--    becomes $20 or $40; any other price an admin typed is kept;
--  - a tier whose button was "Run it yourself" asks for access instead (that button is retired);
--  - prices are shown on the public page (the admin can turn them off again).
-- With no tier left, or none of them shown, the saved row is removed and the built-in catalogue applies.
-- The change is written to the audit log with the catalogue before and after.

WITH old AS (
  SELECT value FROM settings WHERE key = 'plans.catalogue' AND jsonb_typeof(value -> 'tiers') = 'array'
),
kept AS (
  SELECT coalesce(jsonb_agg(
    CASE
      WHEN t ->> 'key' = 'maker' AND (t -> 'priceMonthly' IS NULL OR t -> 'priceMonthly' = 'null'::jsonb OR t -> 'priceMonthly' = '29'::jsonb) THEN t || '{"priceMonthly": 20}'::jsonb
      WHEN t ->> 'key' = 'studio' AND (t -> 'priceMonthly' IS NULL OR t -> 'priceMonthly' = 'null'::jsonb OR t -> 'priceMonthly' = '99'::jsonb) THEN t || '{"priceMonthly": 40}'::jsonb
      ELSE t
    END || CASE WHEN t ->> 'action' = 'run' THEN '{"action": "request"}'::jsonb ELSE '{}'::jsonb END
    ORDER BY ord), '[]'::jsonb) AS tiers
  FROM old, jsonb_array_elements(old.value -> 'tiers') WITH ORDINALITY AS e(t, ord)
  WHERE coalesce(t ->> 'key', '') NOT IN ('free', 'self')
),
next AS (
  SELECT old.value AS before, jsonb_set(jsonb_set(old.value, '{tiers}', kept.tiers), '{showPrices}', 'true'::jsonb) AS after,
         EXISTS (SELECT 1 FROM jsonb_array_elements(kept.tiers) x WHERE x -> 'shown' = 'true'::jsonb) AS usable
  FROM old, kept
),
changed AS (
  UPDATE settings s SET value = next.after, updated_at = now() FROM next
  WHERE s.key = 'plans.catalogue' AND next.usable AND next.after IS DISTINCT FROM next.before
  RETURNING next.before, next.after
),
cleared AS (
  DELETE FROM settings s USING next WHERE s.key = 'plans.catalogue' AND NOT next.usable
  RETURNING next.before
)
INSERT INTO audit_log (action, summary, detail, actor)
SELECT 'setting.changed', 'Plan catalogue brought to two plans, Maker and Studio, prices shown (upgrade 0042; prices an admin set were kept)', jsonb_build_object('key', 'plans.catalogue', 'before', before, 'after', after), ''
FROM changed
UNION ALL
SELECT 'setting.cleared', 'Plan catalogue reset to the built-in one: no tier was left after Free and Self-hosted were removed (upgrade 0042)', jsonb_build_object('key', 'plans.catalogue', 'before', before, 'after', null), ''
FROM cleared;

-- Down Migration
-- Nothing to undo: the removed tiers are kept in the audit line's "before".
SELECT 1;
