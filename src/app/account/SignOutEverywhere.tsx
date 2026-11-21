"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/http";
import { Panel } from "@/components/ui/panel";
import { ErrorLine } from "@/components/ui/states";

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
    <Panel
      title="Sign out everywhere"
      description="Ends every session of this account, in every browser, this one included. A session also ends 30 days after it was last used, and 90 days after signing in however often it is used."
    >
      <div className="space-y-3">
        {error ? <ErrorLine>{error}</ErrorLine> : null}
        <Button type="button" variant="outline" onClick={() => void go()} disabled={busy}>
          {busy ? "Signing out…" : "Sign out everywhere"}
        </Button>
      </div>
    </Panel>
  );
}
