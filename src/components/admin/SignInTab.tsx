"use client";

// Admin, Sign-in: whether the new sign-in (accounts, workspaces, two-step sign-in) is on, its addresses, the platform
// administrator address, and whether mail is set up. Changed by the platform administrator only; while it is off
// nobody is one, so it is first turned on from inside the container (docs/guide/admin.md, "Switching to the new
// sign-in").
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, describe } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadError, LoadingBlocks, SaveError } from "@/components/ui/states";
import { messageOf } from "@/lib/queries";
import { useAdminAccess, useSaveSignIn, useSignInStatus } from "@/lib/admin/client";
import type { SignInStatus } from "@/lib/admin/signIn";

const SWITCH_COMMAND = "docker compose exec web node scripts/sign-in.mjs on";

export function SignInTab() {
  const status = useSignInStatus();
  const admin = useAdminAccess().platformAdmin;
  if (status.isPending) return <LoadingBlocks rows={2} label="Reading the sign-in settings" />;
  if (status.isError) return <LoadError what="The sign-in settings" message={messageOf(status.error)} onRetry={() => void status.refetch()} />;
  // Anyone but the platform administrator is told only whether it is on (cut-over review F1).
  const s = "on" in status.data ? status.data : null;
  const on = s ? s.on : (status.data as { enabled: boolean }).enabled;
  return (
    <div className="space-y-4">
      <Panel
        title="Sign-in"
        description="Accounts with email and password, workspaces, invitations and two-step sign-in. While it is off, the app signs in as before."
        actions={<StatusBadge tone={on ? "success" : "neutral"}>{on ? "On" : "Off"}</StatusBadge>}
      >
        <div className="space-y-3 text-sm text-primary">
          {on ? (
            <p>The new sign-in is on: every page and every part of the app is reached with an account. The old shared sign-in no longer works.</p>
          ) : (
            <>
              <p>
                The new sign-in is off. It is turned on once, from inside the container, because nobody is the platform administrator until then:
              </p>
              <p className="rounded-md bg-canvas px-3 py-2 font-mono text-xs text-primary">{SWITCH_COMMAND}</p>
              <p className="text-secondary">
                The command prints where the one-time set-up code appears. Then open the app: it asks you to create the owner, who is the platform administrator. After that this page can turn the new sign-in off and on again.
              </p>
            </>
          )}
          {s?.switchFrom === "environment" ? <p className="text-warning">The AUTH2 setting in the environment decides it here (development or tests); the stored switch is not used.</p> : null}
          {s ? <p role="note" className="rounded-md bg-info-soft px-3 py-2 text-info">{s.sharedConcepts}</p> : null}
          {on && admin ? <TurnOff /> : null}
        </div>
      </Panel>
      {s ? <Details detail={s.detail} canWrite={admin} /> : on ? <p className="text-sm text-secondary">The addresses are shown to the platform administrator only.</p> : null}
    </div>
  );
}

function TurnOff() {
  const save = useSaveSignIn();
  return (
    <ConfirmButton
      label="Turn the new sign-in off"
      title="Turn the new sign-in off?"
      body="Everyone is signed out of the new sign-in, and the app goes back to the old shared sign-in. Accounts, workspaces and invitations are kept; turning it on again here brings them back."
      confirmLabel="Turn off"
      disabled={save.isPending}
      onConfirm={() =>
        save.mutate({ enabled: false }, { onSuccess: () => window.location.reload(), onError: (e) => toast.error(messageOf(e)) })
      }
    />
  );
}

function Details({ detail, canWrite }: { detail: NonNullable<SignInStatus["detail"]>; canWrite: boolean }) {
  const [base, setBase] = useState(detail.baseURL ?? "");
  const [others, setOthers] = useState(detail.trustedOrigins.join("\n"));
  const [error, setError] = useState("");
  const save = useSaveSignIn();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const list = others.split(/\s+/).map((x) => x.trim()).filter(Boolean);
    save.mutate(
      { baseURL: base.trim() || null, trustedOrigins: list },
      { onSuccess: () => toast.success("The addresses are saved."), onError: (err) => setError(messageOf(err)) }
    );
  };
  return (
    <Panel title="Addresses and mail" description="The address people open the app at: links in emails point there, and forms from any other address are refused.">
      <div className="space-y-4">
        {detail.warnings.map((w) => (
          <p key={w} role="alert" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">{w}</p>
        ))}
        <form onSubmit={submit} noValidate className="space-y-3">
          <Field id="signin-base" label="Address of this installation" hint="For example https://app.example.com.">
            <Input id="signin-base" type="url" value={base} disabled={!canWrite} onChange={(e) => setBase(e.target.value)} {...describe("signin-base", { hint: true })} />
          </Field>
          <Field id="signin-others" label="Other addresses it is opened at" hint="One per line. Leave empty for none.">
            <Textarea id="signin-others" rows={3} value={others} disabled={!canWrite} onChange={(e) => setOthers(e.target.value)} className="font-mono" {...describe("signin-others", { hint: true })} />
          </Field>
          {error ? <SaveError message={error} /> : null}
          {canWrite ? <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save the addresses"}</Button> : null}
        </form>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-secondary">Platform administrator address</dt>
          <dd className="break-all text-primary">{detail.platformAdminAddress ?? "Not set"}</dd>
          <dt className="text-secondary">Mail</dt>
          <dd className="text-primary">
            {detail.mail ? "Set up (Admin, Email): confirmations, resets and invitations are sent." : "Not set up: no mail is sent. An administrator confirms new accounts, and invitation links are handed over."}
          </dd>
        </dl>
      </div>
    </Panel>
  );
}
