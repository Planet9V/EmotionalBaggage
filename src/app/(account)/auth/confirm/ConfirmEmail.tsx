"use client";

import { useEffect, useRef, useState } from "react";
import { call } from "@/lib/auth2/client";
import { Frame, TextLink } from "../_components/Frame";
import { Message } from "../_components/Message";

type State = { at: "working" } | { at: "done" } | { at: "failed"; error: string };

/** The page the confirmation email links to: it confirms the address as it opens, then says so. */
export function ConfirmEmail({ token }: { token: string | null }) {
  const [state, setState] = useState<State>(token ? { at: "working" } : { at: "failed", error: "This link is not complete. Open the link from the email again, or copy all of it." });
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    void call(`/verify-email?token=${encodeURIComponent(token)}`).then((r) => setState(r.ok ? { at: "done" } : { at: "failed", error: r.error }));
  }, [token]);

  return (
    <Frame title="Confirm your email address" footer={state.at === "failed" ? <p>Need a new link? <TextLink href="/auth/sign-in">Sign in</TextLink> and ask for one.</p> : undefined}>
      {state.at === "working" && <p role="status" className="text-sm text-secondary">Confirming your address…</p>}
      <Message id="confirm-message" done={state.at === "done" ? "Your email address is confirmed." : undefined} error={state.at === "failed" ? state.error : undefined} />
      {state.at === "done" && (
        <p className="text-sm text-primary">
          You can now <TextLink href="/auth/sign-in">sign in</TextLink>.
        </p>
      )}
    </Frame>
  );
}
