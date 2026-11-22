-- Up Migration
-- Two-factor requirement (accounts slice 2, step 4; owner's ruling): an owner or admin can require an
-- authenticator app for the whole workspace, or for one member. A person who belongs to any workspace that
-- requires it, or who is required by name in any, must enrol before reaching a workspace and cannot turn it off
-- (src/lib/auth2/workspaces/twoFactor.ts). Owner-only: the request role is granted nothing on these tables.
CREATE TABLE auth2_workspace_policy (
  organization_id text PRIMARY KEY REFERENCES organization ("id") ON DELETE CASCADE,
  two_factor_required boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE TABLE auth2_member_flags (
  member_id text PRIMARY KEY REFERENCES member ("id") ON DELETE CASCADE,
  two_factor_required boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

-- Down Migration
DROP TABLE IF EXISTS auth2_member_flags;
DROP TABLE IF EXISTS auth2_workspace_policy;
