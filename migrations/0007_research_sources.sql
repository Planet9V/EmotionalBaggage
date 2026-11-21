-- Up Migration

-- The sources of a research answer as Perplexity returned them, so that their titles survive a reload.
-- One entry per source, in the order of the answer's [n] markers:
--   { "url": "...", "title": "...", "snippet"?: "...", "date"?: "YYYY-MM-DD" }
-- title is "" when Perplexity gave none. `citations` (the URLs alone) stays as it is: the report,
-- the evidence check and older readers use it.
ALTER TABLE research ADD COLUMN sources jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE research ADD CONSTRAINT research_sources_array CHECK (jsonb_typeof(sources) = 'array');

-- Rows saved before this column existed get one entry per stored citation URL, with an empty title.
-- Citations that are not strings are skipped (0002 only checks that the list is an array).
UPDATE research r
SET sources = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('url', c.value #>> '{}', 'title', '') ORDER BY c.ord)
   FROM jsonb_array_elements(r.citations) WITH ORDINALITY AS c(value, ord)
   WHERE jsonb_typeof(c.value) = 'string'),
  '[]'::jsonb
)
WHERE jsonb_array_length(r.citations) > 0;

-- Down Migration

ALTER TABLE research DROP CONSTRAINT research_sources_array;
ALTER TABLE research DROP COLUMN sources;
