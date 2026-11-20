"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ERROR_ID = "sign-in-error";

export function SignInForm({ next, showDefault }: { next: string; showDefault: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // This page has no app shell, so it applies the stored theme itself (the shell does it elsewhere).
  useEffect(() => {
    document.documentElement.classList.toggle("dark", window.localStorage.getItem("c2r.theme") === "dark");
  }, []);

  // Screen-reader and keyboard users land on the error as soon as it appears.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!username.trim() || !password) {
      setError(!username.trim() ? "Enter your username." : "Enter your password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        // A full navigation, so every part of the app starts again signed in.
        window.location.assign(next);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Signing in failed (${res.status}).`);
      setPassword("");
    } catch {
      setError("The server could not be reached. Check that the app is running and try again.");
    } finally {
      setBusy(false);
    }
  };

  const invalid = error ? true : undefined;
  const describedBy = error ? ERROR_ID : undefined;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4 py-10 text-primary">
      <div className="w-full max-w-sm">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Concept to realization</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-primary">Sign in</h1>
        <p className="mt-1 text-sm text-secondary">Product workbench</p>

        {/* method="post": if the script has not loaded, a native submit must not put the password in the address. */}
        <form method="post" onSubmit={submit} noValidate className="mt-6 space-y-4 rounded-xl border border-hairline bg-surface p-5" aria-describedby={showDefault ? "sign-in-default" : undefined}>
          {showDefault && (
            <p id="sign-in-default" className="rounded-md border border-hairline bg-warning-soft px-3 py-2 text-sm text-primary">
              This install still uses the default account: user <strong className="font-mono">demo</strong>, password{" "}
              <strong className="font-mono">demo</strong>. Change the password after signing in.
            </p>
          )}

          {error && (
            <p id={ERROR_ID} ref={errorRef} tabIndex={-1} role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-dutchOrange">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="username" className="block font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
              Username
            </label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="password" className="block font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className="mt-1"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
