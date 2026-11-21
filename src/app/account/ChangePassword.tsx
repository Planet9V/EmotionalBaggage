"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { meQuery } from "./me";
import { SignOutEverywhere } from "./SignOutEverywhere";

const MIN = 8;

type Field = "current" | "next" | "confirm";

export function ChangePassword() {
  const qc = useQueryClient();
  const me = useQuery(meQuery()).data ?? null;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<{ field: Field; message: string } | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error || done) messageRef.current?.focus();
  }, [error, done]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setDone(false);
    if (!current) return setError({ field: "current", message: "Enter your current password." });
    if ([...next].length < MIN) return setError({ field: "next", message: `The new password must be at least ${MIN} characters.` });
    if (next !== confirm) return setError({ field: "confirm", message: "The two new passwords are not the same." });
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: { field?: Field } };
      if (res.status === 401) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- session ended: full reload to sign in
        window.location.assign(`/sign-in?next=${encodeURIComponent("/account")}`);
        return;
      }
      if (!res.ok) {
        setError({ field: body.detail?.field ?? "next", message: body.error ?? `Changing the password failed (${res.status}).` });
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
      await qc.invalidateQueries({ queryKey: meQuery().queryKey });
    } catch {
      setError({ field: "next", message: "The server could not be reached. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const attrs = (field: Field) => ({
    "aria-invalid": error?.field === field ? true : undefined,
    "aria-describedby": error?.field === field ? "password-message" : field === "next" ? "password-rule" : undefined,
  });

  return (
    <>
      <PageHeader eyebrow="Workbench" title="Account" nextStep={false} blurb={me ? `Signed in as ${me.username}.` : undefined} />
      <div className="max-w-md space-y-4 px-8 py-6">
        {me?.usingDefaultPassword && (
          <p className="rounded-md border border-hairline bg-warning-soft px-3 py-2 text-sm text-primary">
            This account still uses the published default password <strong className="font-mono">demo</strong>. Anyone who can reach
            this install can sign in with it until you change it.
          </p>
        )}
        <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-hairline bg-surface p-5">
          <h2 className="text-base font-semibold tracking-tight text-primary">Change password</h2>
          {error && (
            <p id="password-message" ref={messageRef} tabIndex={-1} role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger focus:outline-hidden">
              {error.message}
            </p>
          )}
          {done && !error && (
            <p ref={messageRef} tabIndex={-1} role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success focus:outline-hidden">
              The password was changed. Other browsers signed in to this account were signed out.
            </p>
          )}
          <div>
            <label htmlFor="current" className="block font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Current password</label>
            <Input id="current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1" {...attrs("current")} />
          </div>
          <div>
            <label htmlFor="next" className="block font-mono text-[10px] uppercase tracking-[0.15em] text-muted">New password</label>
            <Input id="next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className="mt-1" {...attrs("next")} />
            <p id="password-rule" className="mt-1 text-xs text-muted">At least {MIN} characters. The default password cannot be chosen again.</p>
          </div>
          <div>
            <label htmlFor="confirm" className="block font-mono text-[10px] uppercase tracking-[0.15em] text-muted">New password again</label>
            <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1" {...attrs("confirm")} />
          </div>
          <Button type="submit" disabled={busy}>{busy ? "Changing…" : "Change password"}</Button>
        </form>
        <SignOutEverywhere />
      </div>
    </>
  );
}
