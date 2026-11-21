-- Up Migration

-- The install-wide record of all work. One row per change, whoever made it and whichever concept it was in.
-- It has no foreign key to projects on purpose: deleting a concept deletes its rows, files and events, and
-- must not delete the record that the work, and the deletion, happened. The concept's id and its name at
-- the time are kept as plain text.
-- Nothing in the app updates or deletes these rows.
CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  -- the signed-in user's name; empty when the app itself did it (start-up, a migration)
  actor text NOT NULL DEFAULT '',
  -- empty for work that belongs to no concept (sign-in, keys, settings, printers)
  project_id text NOT NULL DEFAULT '',
  project_name text NOT NULL DEFAULT '',
  -- what happened, as "thing.verb": item.added, project.deleted, credential.set, session.started ...
  action text NOT NULL CHECK (btrim(action) <> ''),
  summary text NOT NULL DEFAULT '',
  -- before and after, ids, counts. Never a key, password or token.
  detail jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(detail) = 'object')
);
CREATE INDEX audit_log_at ON audit_log (at DESC, id DESC);
CREATE INDEX audit_log_project ON audit_log (project_id, at DESC);

-- What is already in each concept's own activity list is copied in, so the record does not start empty.
INSERT INTO audit_log (at, actor, project_id, project_name, action, summary, detail)
SELECT e.created_at, '', e.project_id, p.name, e.kind, e.summary,
       CASE WHEN jsonb_typeof(e.data) = 'object' THEN e.data ELSE jsonb_build_object('value', e.data) END
FROM events e JOIN projects p ON p.id = e.project_id
ORDER BY e.created_at, e.id;

-- Down Migration

DROP TABLE audit_log;
