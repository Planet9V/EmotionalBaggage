-- Up Migration
-- An authenticator code works once (src/lib/auth2/replayGuard.ts): the last 30-second time step each user's code was
-- accepted for. A code for that step or an earlier one is refused. Not part of Better Auth.
CREATE TABLE auth2_totp_steps (
  user_id text PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  last_step bigint NOT NULL CHECK (last_step >= 0),
  used_at timestamptz NOT NULL DEFAULT now()
);

-- Down Migration
DROP TABLE IF EXISTS auth2_totp_steps;
