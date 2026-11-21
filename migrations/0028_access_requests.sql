-- Up Migration

-- Requests for a workspace of one's own, sent from the public welcome page (/welcome).
-- A new table, not `items` rows: an access request belongs to no concept (items rows all have a project_id
-- and a menu section), it is written by a visitor who is not signed in, and it holds a person's name and email,
-- which the concept export, duplicate and report must never carry.
-- No email is sent from here; the install's owner reads the requests in Admin and replies by hand.
CREATE TABLE access_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  email text NOT NULL,
  -- what the person wants to build, in their own words
  building text NOT NULL,
  company text NOT NULL DEFAULT '',
  -- new: not looked at; contacted: the owner replied; declined: no workspace will be made
  status text NOT NULL DEFAULT 'new',
  status_changed_at timestamptz,
  CHECK (btrim(name) <> '' AND length(name) <= 120),
  CHECK (length(email) BETWEEN 3 AND 254 AND email LIKE '%_@_%'),
  CHECK (btrim(building) <> '' AND length(building) <= 2000),
  CHECK (length(company) <= 160),
  CHECK (status IN ('new', 'contacted', 'declined'))
);
CREATE INDEX access_requests_created ON access_requests (created_at DESC, id DESC);

-- Down Migration
DROP TABLE IF EXISTS access_requests;
