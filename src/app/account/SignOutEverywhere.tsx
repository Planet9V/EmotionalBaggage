"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/http";

/**
 * Ends every session of this account, in every browser, this one included (robustness review S9). For a
 * browser left signed in somewhere else, or after the default password was used on a shared machine.
 */
export function SignOutEverywhere() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/sign-out-everywhere", { method: "POST" });
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- every session ended: full reload to sign in
      window.location.assign("/sign-in");
    } catch (e) {
      setError((e as Error).message || "Signing out everywhere failed. Try again.");
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="everywhere-h" className="space-y-3 rounded-xl border border-hairline bg-surface p-5">
      <h2 id="everywhere-h" className="text-base font-semibold tracking-tight text-primary">Sign out everywhere</h2>
      <p className="text-sm text-secondary">
        Ends every session of this account, in every browser, this one included. A session also ends 30 days after it was last used, and
        90 days after signing in however often it is used.
      </p>
      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="button" variant="outline" onClick={() => void go()} disabled={busy}>
        {busy ? "Signing out…" : "Sign out everywhere"}
      </Button>
    </section>
  );
}
