-- Up Migration

-- Chat with a concept: questions answered from the concept's own rows and saved research answers,
-- found by meaning in pgvector (or by text when that is not available). A concept has any number of
-- chats; deleting the concept deletes its chats, and deleting a chat deletes its messages.
CREATE TABLE chats (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- the first question, shortened; empty until the first question is asked
  title text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chats_project ON chats (project_id, updated_at DESC, id DESC);

CREATE TABLE chat_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id bigint NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  -- on an assistant message, the sources it was given, numbered as the answer cites them:
  -- [{ "n": 1, "kind": "item" | "research", "id": 12, "section": "design/bom", "title": "...", "score": 0.81 }]
  sources jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sources) = 'array'),
  -- the reasoning model that answered (assistant messages only)
  model text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_chat ON chat_messages (chat_id, id);

-- Down Migration

DROP TABLE chat_messages;
DROP TABLE chats;
