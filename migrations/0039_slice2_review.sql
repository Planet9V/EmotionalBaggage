-- Up Migration
-- The independent review of accounts slice 2 (docs/research/auth-trial-findings.md, "Review findings, slice 2").
-- Every table here is owner-only: the request role is granted nothing on it (src/lib/auth2/dbRoles.ts, WITHHELD).

-- F6: the new sign-in's own settings move out of `settings`, which the request role may write, into a table only
-- the owner's connection reads and writes (src/lib/auth2/config.ts). Existing values come along; the switch stays
-- off unless it was stored on.
CREATE TABLE auth2_settings (
  key text PRIMARY KEY CHECK (key IN ('auth2.enabled', 'auth2.baseUrl', 'auth2.trustedOrigins', 'auth2.platformAdminAddress')),
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);
INSERT INTO auth2_settings (key, value, updated_at)
  SELECT key, value, updated_at FROM settings WHERE key IN ('auth2.enabled', 'auth2.baseUrl', 'auth2.trustedOrigins', 'auth2.platformAdminAddress');
INSERT INTO auth2_settings (key, value) VALUES ('auth2.platformAdminAddress', '"admin@oxot.nl"') ON CONFLICT (key) DO NOTHING;
DELETE FROM settings WHERE key IN ('auth2.enabled', 'auth2.baseUrl', 'auth2.trustedOrigins', 'auth2.platformAdminAddress');

-- B3: the install is complete once the first-run owner exists; first run is open only while it is not and no
-- platform administrator exists.
ALTER TABLE auth2_install ADD COLUMN completed_at timestamptz;
UPDATE auth2_install SET completed_at = claimed_at WHERE owner_user_id IS NOT NULL;

-- B2: the one-time set-up code the first-run page asks for. One row; only its SHA-256; printed once to the server
-- log at start while first run is open; a wrong code earns a growing wait.
CREATE TABLE auth2_setup_code (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  code_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  failures integer NOT NULL DEFAULT 0,
  next_allowed_at timestamptz NOT NULL DEFAULT now()
);

-- B4: after someone else resets an account's two-factor, setting it up again needs proof beyond the password: an
-- emailed link, or a code handed over by whoever reset it. Only its SHA-256 is kept; it expires.
CREATE TABLE auth2_reenrol (
  user_id text PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  proof_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by text NOT NULL DEFAULT '',
  proved_until timestamptz
);
-- B4: resets of one account by others, counted per day.
CREATE TABLE auth2_two_factor_resets (
  user_id text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth2_two_factor_resets_idx ON auth2_two_factor_resets (user_id, at);

-- N8: an invitation made by a platform administrator is checked against that role when it is accepted, not
-- against a workspace role.
ALTER TABLE auth2_invitation_tokens ADD COLUMN by_platform_admin boolean NOT NULL DEFAULT false;

-- Down Migration
ALTER TABLE auth2_invitation_tokens DROP COLUMN IF EXISTS by_platform_admin;
DROP TABLE IF EXISTS auth2_two_factor_resets;
DROP TABLE IF EXISTS auth2_reenrol;
DROP TABLE IF EXISTS auth2_setup_code;
ALTER TABLE auth2_install DROP COLUMN IF EXISTS completed_at;
INSERT INTO settings (key, value) SELECT key, value FROM auth2_settings ON CONFLICT (key) DO NOTHING;
DROP TABLE IF EXISTS auth2_settings;
