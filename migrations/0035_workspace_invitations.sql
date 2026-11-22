-- Up Migration
-- Invitation links (accounts slice 2). Better Auth's organization plugin uses the invitation's id as the link, and
-- keeps that id in the clear. Here the link carries a separate random token; only its SHA-256 is stored, it works
-- once (used_at), until the invitation's "expiresAt", and a resend replaces it (src/lib/auth2/workspaces/invitations.ts).
-- The plugin's own accept-by-id endpoint is switched off. Owner-only: the request role is granted nothing here.
CREATE TABLE auth2_invitation_tokens (
  invitation_id text PRIMARY KEY REFERENCES invitation ("id") ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  send_count integer NOT NULL DEFAULT 1 CHECK (send_count >= 1),
  used_at timestamptz
);

-- Down Migration
DROP TABLE IF EXISTS auth2_invitation_tokens;
