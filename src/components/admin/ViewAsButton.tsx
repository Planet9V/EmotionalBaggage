"use client";

// "View as this user" (src/lib/auth2/viewAs.ts): the administrator's own password again, then the app opens as the
// person sees it, with the banner on every page and Stop to come back.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SaveError } from "@/components/ui/states";
import { call } from "@/lib/auth2/client";

export function ViewAsButton({ userId, name, email, stepUp = "" }: { userId: string; name: string; email: string; stepUp?: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState(stepUp);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setError("");
    setBusy(true);
    const r = await call("/view-as/start", { userId, password });
    setPassword("");
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load: every part of the page starts again as the person
    window.location.assign("/");
  };
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>View as this person</Button>
      {open ? (
        <Modal open onOpenChange={setOpen} title={`View as ${name}`} description={email}>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void start(); }}>
            <p className="text-sm text-secondary">
              You see and can change exactly what {name} can, in their workspaces, until you press Stop in the banner or the time set in Admin, Sign-in runs out (60 minutes unless changed). Their password, address, two-step sign-in and sessions cannot be changed, and the admin area is closed meanwhile. Every change is recorded under your name as theirs. Their own sessions are not touched.
            </p>
            <Field id="viewas-password" label="Your own password">
              <Input id="viewas-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} {...describe("viewas-password", {})} />
            </Field>
            {error ? <SaveError message={error} /> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy || !password}>{busy ? "Opening…" : "View as this person"}</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
