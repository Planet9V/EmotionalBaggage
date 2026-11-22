"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { call } from "@/lib/auth2/client";
import type { Invitation } from "@/lib/auth2/workspaces/invitations";
import { Frame, TextLink } from "../_components/Frame";
import { Message } from "../_components/Message";

const ROLE_WORDS = { owner: "an owner", admin: "an admin", member: "a member" } as const;

/** One screen for every case of an invitation link: not valid, used, expired, signed out, the wrong account, or ready. */
export function InviteView({ token, invitation, signedInAs }: { token: string; invitation: Invitation | null; signedInAs: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const here = `/auth/invite?token=${encodeURIComponent(token)}`;

  if (!invitation || invitation.state !== "open") {
    const why = !invitation
      ? "This invitation link is not valid. It may have been revoked or sent again since, or copied only in part."
      : invitation.state === "used"
        ? "This invitation has been accepted already. Each invitation link works once."
        : "This invitation has expired. Ask whoever invited you to send it again.";
    return (
      <Frame title="This invitation cannot be used" footer={<p><TextLink href="/auth/sign-in">Sign in</TextLink></p>}>
        <p className="text-sm text-primary">{why}</p>
      </Frame>
    );
  }

  const lead = (
    <>
      {invitation.inviter} invited <strong className="break-all font-medium text-primary">{invitation.email}</strong> to join{" "}
      <strong className="font-medium text-primary">{invitation.workspace}</strong> as {ROLE_WORDS[invitation.role]}.
    </>
  );

  if (!signedInAs) {
    return (
      <Frame title="Join a workspace" lead={lead}>
        <p className="text-sm text-primary">Sign in with that address to accept. You keep a workspace of your own as well.</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild><a href={`/auth/sign-in?next=${encodeURIComponent(here)}`}>Sign in to accept</a></Button>
          <Button asChild variant="outline">
            <a href={`/auth/sign-up?email=${encodeURIComponent(invitation.email)}&next=${encodeURIComponent(here)}`}>Create an account</a>
          </Button>
        </div>
      </Frame>
    );
  }

  if (signedInAs.toLowerCase() !== invitation.email.toLowerCase()) {
    const signOut = async () => {
      setBusy(true);
      const r = await call("/sign-out", {});
      if (!r.ok) {
        setBusy(false);
        return setError(r.error);
      }
      window.location.reload();
    };
    return (
      <Frame title="Join a workspace" lead={lead}>
        <Message id="invite-message" error={error} />
        <p className="text-sm text-primary">
          You are signed in as <strong className="break-all font-medium">{signedInAs}</strong>. This invitation is for another address: sign out, then sign in or create an account with the invited one.
        </p>
        <Button type="button" variant="outline" onClick={() => void signOut()} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</Button>
      </Frame>
    );
  }

  const acceptIt = async () => {
    setBusy(true);
    setError("");
    const r = await call("/workspace/invitation/accept", { token });
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional full reload into the joined workspace
    window.location.assign("/auth/workspaces");
  };
  return (
    <Frame title="Join a workspace" lead={lead} footer={<p><TextLink href="/auth/account">Not now</TextLink></p>}>
      <Message id="invite-message" error={error} />
      <Button type="button" className="w-full" onClick={() => void acceptIt()} disabled={busy}>{busy ? "Joining…" : `Join ${invitation.workspace}`}</Button>
    </Frame>
  );
}
