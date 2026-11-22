"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { call } from "@/lib/auth2/client";
import { Frame, TextLink } from "../_components/Frame";
import { Message } from "../_components/Message";

/** After sign-up, or a sign-in refused because the address is not confirmed yet: where the link went, and a resend. */
export function CheckEmail({ email, next = null, mail = true }: { email: string | null; next?: string | null; mail?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const resend = async () => {
    if (!email || busy) return;
    setBusy(true);
    setError("");
    setDone("");
    const r = await call("/send-verification-email", { email });
    setBusy(false);
    if (r.ok) setDone("A new link is on its way. Only the newest link works.");
    else setError(r.error);
  };

  const signIn = next ? `/auth/sign-in?next=${encodeURIComponent(next)}` : "/auth/sign-in";
  if (!mail) {
    // "No mail" mode: nothing was sent, and nothing can be sent again.
    return (
      <Frame title="Account created" footer={<p>Confirmed already? <TextLink href={signIn}>Sign in</TextLink></p>}>
        <p className="text-sm text-primary">
          This installation sends no email. An administrator confirms new accounts{email ? <> (yours is <strong className="break-all font-medium">{email}</strong>)</> : null}; you can sign in once they have.
        </p>
      </Frame>
    );
  }
  return (
    <Frame title="Check your email" footer={<p>Confirmed already? <TextLink href={signIn}>Sign in</TextLink></p>}>
      <p className="text-sm text-primary">
        {email ? (
          <>We sent a link to <strong className="break-all font-medium">{email}</strong>. Follow it to confirm your address, then sign in.</>
        ) : (
          <>We sent a link to the address you gave. Follow it to confirm your address, then sign in.</>
        )}
      </p>
      {next && <p className="text-sm text-secondary">After you sign in, you come back to the invitation.</p>}
      <p className="text-sm text-secondary">The link works for 24 hours. If nothing arrives within a few minutes, look in the spam folder, or ask for a new link.</p>
      <Message id="check-email-message" error={error} done={done} />
      {email && (
        <Button type="button" variant="outline" className="w-full" onClick={() => void resend()} disabled={busy}>
          {busy ? "Sending…" : "Send the link again"}
        </Button>
      )}
    </Frame>
  );
}
