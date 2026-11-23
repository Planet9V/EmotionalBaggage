-- Up Migration
-- Platform-administrator user management and the account rules of the owner's ruling of 23 Nov (docs/TASKS.md):
-- invitations that expire after 7 days, a lock after 7 failed sign-ins, password rules, self-service reset, and
-- sign-up requests sent to the owner. Workstream ws25-users: this number may be changed when it is merged.
-- Every table here is owner-only: the request role is granted nothing on it (src/lib/auth2/dbRoles.ts, WITHHELD),
-- and the new "user" columns are outside the request role's column grant on "user".

-- The new settings live with the sign-in's own (owner's connection only). Defaults are in the code
-- (src/lib/auth2/rules.ts); a row exists only once the platform administrator changes one.
ALTER TABLE auth2_settings DROP CONSTRAINT IF EXISTS auth2_settings_key_check;
ALTER TABLE auth2_settings ADD CONSTRAINT auth2_settings_key_check CHECK (key IN (
  'auth2.enabled', 'auth2.baseUrl', 'auth2.trustedOrigins', 'auth2.platformAdminAddress',
  'invites.expiryDays', 'signIn.maxFailures', 'signIn.lockMinutes', 'password.policy', 'notify.signupRequestsTo', 'signUp.open'
));

-- The first-run page no longer suggests admin@oxot.nl: the platform administrator is whoever is created there
-- (23 Nov: jim@eigenia.nl). The seeded suggestion is cleared only while no owner exists and it is still the seed.
DELETE FROM auth2_settings
 WHERE key = 'auth2.platformAdminAddress' AND value = '"admin@oxot.nl"'::jsonb
   AND NOT EXISTS (SELECT 1 FROM "user" WHERE "platformAdmin")
   AND NOT EXISTS (SELECT 1 FROM auth2_install WHERE completed_at IS NOT NULL);
DELETE FROM settings WHERE key = 'auth2.platformAdminAddress' AND value = '"admin@oxot.nl"'::jsonb;

-- Per account:
-- - "mustChangePassword": the password was set by an administrator; it must be changed before a session starts.
-- - "resetRequestedAt": the person asked for a password reset while no mail is set up; shown to the administrator.
ALTER TABLE "user"
  ADD COLUMN "mustChangePassword" boolean NOT NULL DEFAULT false,
  ADD COLUMN "resetRequestedAt" timestamptz;

-- The lock (src/lib/auth2/signInWait.ts): the name-wide row of auth2_sign_in_waits (client = '') counts failed
-- passwords in a row and holds the lock. 'infinity' is "until an administrator unlocks".
ALTER TABLE auth2_sign_in_waits ADD COLUMN locked_until timestamptz;

-- Invitations to create an account, sent by a platform administrator (src/lib/auth2/accountInvitations.ts). The
-- account exists from the invitation on, with no password; the link sets one. Only the SHA-256 of the link's
-- token is kept. An invitation expires `invites.expiryDays` after it was last sent.
CREATE TABLE auth2_account_invitations (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  email text NOT NULL,
  platform_admin boolean NOT NULL DEFAULT false,
  token_hash text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT '',
  sent_at timestamptz NOT NULL DEFAULT now(),
  send_count integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  mailed boolean NOT NULL DEFAULT false
);
CREATE INDEX auth2_account_invitations_user_idx ON auth2_account_invitations (user_id, created_at DESC);

-- Down Migration
DROP TABLE IF EXISTS auth2_account_invitations;
ALTER TABLE auth2_sign_in_waits DROP COLUMN IF EXISTS locked_until;
ALTER TABLE "user" DROP COLUMN IF EXISTS "resetRequestedAt", DROP COLUMN IF EXISTS "mustChangePassword";
DELETE FROM auth2_settings WHERE key IN ('invites.expiryDays', 'signIn.maxFailures', 'signIn.lockMinutes', 'password.policy', 'notify.signupRequestsTo', 'signUp.open');
ALTER TABLE auth2_settings DROP CONSTRAINT IF EXISTS auth2_settings_key_check;
ALTER TABLE auth2_settings ADD CONSTRAINT auth2_settings_key_check CHECK (key IN ('auth2.enabled', 'auth2.baseUrl', 'auth2.trustedOrigins', 'auth2.platformAdminAddress'));
