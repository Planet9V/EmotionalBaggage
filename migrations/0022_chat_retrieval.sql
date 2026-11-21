-- Up Migration

-- How an answer's sources were found, kept with the answer: "meaning", "text" or "both", why it was by text
-- when it was, and which index ran for a search by meaning. Empty on answers saved before this column, which
-- the screen shows as "not recorded" rather than as a guess.
ALTER TABLE chat_messages
  ADD COLUMN retrieval text NOT NULL DEFAULT '' CHECK (retrieval IN ('', 'meaning', 'text', 'both')),
  ADD COLUMN retrieval_note text NOT NULL DEFAULT '',
  ADD COLUMN search text NOT NULL DEFAULT '';

-- Down Migration

ALTER TABLE chat_messages DROP COLUMN search, DROP COLUMN retrieval_note, DROP COLUMN retrieval;
