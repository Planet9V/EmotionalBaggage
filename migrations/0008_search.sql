-- Up Migration

-- 1. Indexes on the columns that tie research answers and reviewer messages to their concept. Every read
--    of them is by concept, and deleting a concept has to find them; without these each is a full scan.
CREATE INDEX research_project ON research (project_id, id);
CREATE INDEX messages_project ON messages (project_id, id);

-- 2. Full-text search. Each row keeps a search vector that PostgreSQL maintains by itself: the title
--    counts most (A), then the body (B), then the text and numbers inside the row's fields (C).
--    English word forms are folded, so "wires" finds "wire". The GIN index answers "which rows contain
--    any of these words" without reading the rows.
ALTER TABLE items ADD COLUMN search tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(body, '')), 'B') ||
  setweight(jsonb_to_tsvector('english', data, '["string", "numeric"]'), 'C')
) STORED;
CREATE INDEX items_search ON items USING gin (search);

ALTER TABLE research ADD COLUMN search tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(query, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(answer, '')), 'B')
) STORED;
CREATE INDEX research_search ON research USING gin (search);

-- Down Migration

DROP INDEX research_search;
ALTER TABLE research DROP COLUMN search;
DROP INDEX items_search;
ALTER TABLE items DROP COLUMN search;
DROP INDEX messages_project;
DROP INDEX research_project;
