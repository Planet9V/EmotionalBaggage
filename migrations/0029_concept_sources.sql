-- Up Migration

-- The text of a concept's sources (the "Sources" page), cut into passages.
--
-- A source itself is an ordinary row in `items` (section "concept/files"): its title, what it is, where it came
-- from and who added it are row fields, so history, the audit log, export and duplicate treat it like any other
-- row. Its text can be long (a 6-page PDF is about 15,000 characters, a row's body holds 20,000), and search by
-- meaning needs short passages, so the text lives here instead, one row per passage, in order. A passage
-- belongs to its source row and goes when the row goes.
--
-- Each passage keeps a word-search vector PostgreSQL maintains by itself, as `items.search` does
-- (migration 0008), so chat finds a source by its words when no embedding model is chosen.
CREATE TABLE source_chunks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_id bigint NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  n int NOT NULL CHECK (n >= 1),
  text text NOT NULL CHECK (length(text) BETWEEN 1 AND 8000),
  search tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, n)
);
CREATE INDEX source_chunks_project ON source_chunks (project_id, item_id);
CREATE INDEX source_chunks_search ON source_chunks USING gin (search);

-- The concept story (section "concept/story") has one row per part: one pitch, one origin, and so on.
CREATE UNIQUE INDEX items_story_part_unique ON items (project_id, (data->>'part')) WHERE section = 'concept/story';

-- Down Migration

-- With pgvector, start-up gives `embeddings` a chunk_id column (src/lib/db.ts, vectorSupport). Its passage
-- vectors go, and the table's one-target rule goes back to rows and research answers.
DO $$
BEGIN
  IF to_regclass('embeddings') IS NOT NULL THEN
    DELETE FROM embeddings WHERE chunk_id IS NOT NULL;
    ALTER TABLE embeddings DROP CONSTRAINT IF EXISTS embeddings_one_target;
    ALTER TABLE embeddings DROP COLUMN IF EXISTS chunk_id;
    ALTER TABLE embeddings ADD CONSTRAINT embeddings_one_target CHECK (num_nonnulls(item_id, research_id) = 1);
  END IF;
END $$;
DROP INDEX items_story_part_unique;
DROP TABLE source_chunks;
