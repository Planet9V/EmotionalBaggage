-- Up Migration
-- Sign-in (plan item 2.3, decision D2). Until now anyone who could reach the port could read,
-- change and delete everything and spend any saved API key. One install has one owner, so this is
-- a small sign-in built into the app rather than an auth framework: a framework would bring its
-- own tables and a password-length policy that conflicts with the default `demo` password.

-- The people who may sign in. A fresh install gets one row, `demo` / `demo`, created at start-up
-- by ensureDefaultUser() in src/lib/auth.ts (not here, because hashing needs the app's code).
-- password_hash is one self-describing string (algorithm, parameters, salt, hash) so the hashing
-- parameters can be raised later without a migration.
-- password_changed_at stays empty until the owner chooses a password: an empty value is how the
-- app knows the published default password is still in use and keeps warning about it.
CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  password_changed_at timestamptz,
  CHECK (btrim(username) <> ''),
  CHECK (password_hash LIKE 'scrypt$%')
);
-- `Demo` and `demo` are the same person: the sign-in form should not care how a name was typed.
CREATE UNIQUE INDEX users_username_unique ON users (lower(username));

-- One row per signed-in browser. The browser holds a random token in a cookie; only its SHA-256
-- is stored, so someone who reads this table (a backup, a database dump) cannot sign in with it.
-- Deleting a user ends all of that user's sessions.
CREATE TABLE sessions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_sha256 text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Moved forward at most once an hour when the session is used, together with expires_at,
  -- so reading a page is not a database write on every request.
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  user_agent text NOT NULL DEFAULT '',
  CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK (expires_at > created_at)
);
CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX sessions_expires ON sessions (expires_at);

-- Failed sign-in attempts per typed username (lower-cased), so guessing a password is slow.
-- Kept in the database rather than in memory so a restart does not reset the count.
-- A row exists for names that are not users too: refusing only real names would tell a guesser
-- which names exist. One row per name holds the count inside a fixed 15-minute window.
CREATE TABLE sign_in_attempts (
  username_key text PRIMARY KEY,
  failures int NOT NULL CHECK (failures >= 0),
  window_started_at timestamptz NOT NULL
);
