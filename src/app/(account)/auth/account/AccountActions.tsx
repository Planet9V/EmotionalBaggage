"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { call } from "@/lib/auth2/client";
import { Message } from "../_components/Message";

/** Sign out here, or sign out every other browser that is signed in to this account. */
export function AccountActions() {
  const [busy, setBusy] = useState<"" | "out" | "others">("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const signOut = async () => {
    setBusy("out");
    setError("");
    const r = await call("/sign-out", {});
    if (!r.ok) {
      setBusy("");
      return setError(r.error);
    }
    // A full page load drops everything the signed-out session had loaded.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional full reload
    window.location.assign("/auth/sign-in");
  };

  const others = async () => {
    setBusy("others");
    setError("");
    setDone("");
    const r = await call("/revoke-other-sessions", {});
    setBusy("");
    if (r.ok) setDone("Every other browser signed in to this account has been signed out.");
    else setError(r.error);
  };

  return (
    <div className="space-y-3">
      <Message id="account-message" error={error} done={done} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void signOut()} disabled={!!busy}>{busy === "out" ? "Signing out…" : "Sign out"}</Button>
        <Button type="button" variant="outline" onClick={() => void others()} disabled={!!busy}>{busy === "others" ? "Signing out…" : "Sign out other browsers"}</Button>
      </div>
    </div>
  );
}
