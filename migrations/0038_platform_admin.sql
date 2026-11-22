-- Up Migration
-- Platform administration and the first-run owner (accounts slice 2, step 6 and the owner's rulings of 22 Nov).
--
-- On Better Auth's "user" table, three columns of this app's own (Better Auth's schema check only looks for missing
-- columns, tests/auth2/schema.test.ts):
-- - "platformAdmin": an application-wide administrator, above every workspace role. Granted only by the first-run
--   page (to the owner it creates) or by another platform administrator; the last one can never lose it, be
--   disabled or be deleted (src/lib/auth2/adminOps.ts). A sign-up with the platform administrator address does not
--   get it.
-- - "disabledAt": set by a platform administrator; a disabled account cannot sign in and its sessions are ended.
-- - "twoFactorRequired": required of this person by a platform administrator, whatever their workspaces say.
-- The request role's grant on "user" names its columns (src/lib/auth2/dbRoles.ts), so these are not readable by it.
ALTER TABLE "user"
  ADD COLUMN "platformAdmin" boolean NOT NULL DEFAULT false,
  ADD COLUMN "disabledAt" timestamptz,
  ADD COLUMN "twoFactorRequired" boolean NOT NULL DEFAULT false;

-- The first-run claim: one row at most, taken by the one request that creates the owner, so two submissions at
-- once create one owner (src/lib/auth2/firstRun.ts). Owner-only: the request role is granted nothing here.
CREATE TABLE auth2_install (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  owner_user_id text REFERENCES "user" ("id") ON DELETE SET NULL
);

-- Down Migration
DROP TABLE IF EXISTS auth2_install;
ALTER TABLE "user" DROP COLUMN IF EXISTS "twoFactorRequired", DROP COLUMN IF EXISTS "disabledAt", DROP COLUMN IF EXISTS "platformAdmin";
