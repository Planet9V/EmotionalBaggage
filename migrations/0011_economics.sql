-- Up Migration
-- Plan 3.6 and 3.8: two settings of a concept that the economics and the compliance checklist read.
-- They are columns on projects and not item rows because they belong to the concept as a whole and
-- exactly one value each exists. Everything else this work stores is uniform `items` rows.

-- The one currency every money figure of the concept is in. No conversion anywhere; this is a label
-- and decides how many decimals a minor unit has. Three capital letters (an ISO 4217 code).
ALTER TABLE projects ADD COLUMN currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$');

-- The sales regions the user chose, as keys: us, eu, uk, canada, australia, other.
ALTER TABLE projects ADD COLUMN sales_regions jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(sales_regions) = 'array');

-- Down Migration

ALTER TABLE projects DROP COLUMN sales_regions;
ALTER TABLE projects DROP COLUMN currency;
