-- Up Migration
-- The new sign-in keeps its configuration in PostgreSQL (owner's rulings of 22 Nov, "everything is stored in
-- Postgres", "Docker first"): nothing but the database connection has to be set outside it.
--
-- auth2_secrets: the signing and encryption secret, made by the app on first use when BETTER_AUTH_SECRET is not
-- set (src/lib/auth2/config.ts). Owner-only: the request role is granted nothing on it (src/lib/auth2/dbRoles.ts).
CREATE TABLE auth2_secrets (
  name text PRIMARY KEY,
  value text NOT NULL CHECK (length(value) >= 32),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The address the first-run page offers for the platform administrator (owner's ruling). A setting, so it can be
-- changed there before any account exists; not used by any logic beyond prefilling that page.
INSERT INTO settings (key, value) VALUES ('auth2.platformAdminAddress', '"admin@oxot.nl"') ON CONFLICT (key) DO NOTHING;

-- Down Migration
DELETE FROM settings WHERE key = 'auth2.platformAdminAddress';
DROP TABLE IF EXISTS auth2_secrets;
