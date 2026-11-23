"use client";

// Admin, Email: "no mail" (the default) or an SMTP server. The server settings are saved through the shared
// settings route; the password is the shared key card of provider "smtp" (write-only, bound to this server).
// A test connects and signs in; "Send a test message" sends one short message to an address typed here.
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Field, describe } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { LoadError, LoadingBlocks, SaveError, SavedNote, useFlag } from "@/components/ui/states";
import { messageOf } from "@/lib/queries";
import { mailSettings } from "@/lib/admin/schemas";
import { useAdminAccess, useAdminSettings, useConnectionTest, useSaveSettings, useSignInStatus, type MailSettings } from "@/lib/admin/client";
import { NotifyPanel } from "./AccountRulesPanel";
import { CredentialsTab } from "./CredentialsTab";
import { TestOutcome } from "./shared";

type Form = { mode: "none" | "smtp"; fromName: string; fromAddress: string; host: string; port: string; security: "starttls" | "tls" | "none"; username: string };
type Errors = Partial<Record<keyof Form, string>>;
const LABEL: Record<keyof Form, string> = { mode: "Mail", fromName: "Sender name", fromAddress: "Sender address", host: "Server", port: "Port", security: "Security", username: "User name" };
const PORT_FOR = { starttls: "587", tls: "465", none: "25" } as const;

const formOf = (m: MailSettings): Form =>
  m.mode === "smtp"
    ? { mode: "smtp", fromName: m.fromName, fromAddress: m.fromAddress, host: m.host, port: String(m.port), security: m.security, username: m.username ?? "" }
    : { mode: "none", fromName: "Concept to Realization", fromAddress: "", host: "", port: "587", security: "starttls", username: "" };

export function EmailTab() {
  const settings = useAdminSettings();
  if (settings.isPending) return <LoadingBlocks rows={2} label="Reading the email settings" />;
  if (settings.isError) return <LoadError what="The email settings" message={messageOf(settings.error)} onRetry={() => void settings.refetch()} />;
  const saved = settings.data.mail;
  if ("hidden" in saved) {
    return (
      <div className="space-y-4">
        <Panel title="Email" description="The mail server that sends sign-up confirmations, password resets and invitations." actions={<StatusBadge tone="success">Set up</StatusBadge>}>
          <p className="text-sm text-secondary">A mail server is set up. Its details are shown to the platform administrator only.</p>
        </Panel>
        <CredentialsTab only={["smtp"]} intro={false} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <ServerForm saved={saved} />
      {saved.mode === "smtp" ? (
        <>
          <CredentialsTab only={["smtp"]} intro={false} />
          <TestMessage defaultTo={saved.fromAddress} />
        </>
      ) : null}
      <SignupNotify mail={saved.mode === "smtp"} />
    </div>
  );
}

/** The address sign-up requests are announced to; it is one of the sign-in's settings (Admin, Sign-in route). */
function SignupNotify({ mail }: { mail: boolean }) {
  const status = useSignInStatus();
  const admin = useAdminAccess().platformAdmin;
  if (!status.data || !("rules" in status.data)) return null;
  return <NotifyPanel to={status.data.rules.notifySignupRequestsTo} lockTo={status.data.rules.notifyLockAlertsTo} mail={mail} canWrite={admin} />;
}

function ServerForm({ saved }: { saved: MailSettings }) {
  const [form, setForm] = useState<Form>(() => formOf(saved));
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState("");
  const [justSaved, markSaved] = useFlag();
  const save = useSaveSettings();
  const canWrite = useAdminAccess().capabilities.email;
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const id = (n: string) => `mail-${n}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const raw = form.mode === "none" ? { mode: "none" } : { ...form, port: form.port.trim() === "" ? undefined : Number(form.port) };
    const r = mailSettings.safeParse(raw);
    if (!r.success) {
      const next: Errors = {};
      for (const i of r.error.issues) {
        const k = i.path[0] as keyof Form;
        if (k && !next[k]) next[k] = `${LABEL[k]} ${i.message}.`;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaveError("");
    try {
      await save.mutateAsync({ mail: r.data });
      markSaved();
    } catch (err) {
      const m = messageOf(err);
      setSaveError(m);
      toast.error(m);
    }
  };

  return (
    <Panel
      title="Email"
      description="The mail server that sends sign-up confirmations, password resets and invitations. Without one, nothing is sent and those messages wait; nothing else stops."
      actions={<StatusBadge tone={saved.mode === "smtp" ? "success" : "neutral"}>{saved.mode === "smtp" ? "SMTP server" : "No mail"}</StatusBadge>}
    >
      <form onSubmit={submit} noValidate className="space-y-4" aria-label="Mail server" aria-busy={save.isPending || undefined}>
        <Field id={id("mode")} label="Mail">
          <NativeSelect id={id("mode")} value={form.mode} onChange={(e) => set({ mode: e.target.value as Form["mode"] })}>
            <option value="none">No mail (nothing is sent)</option>
            <option value="smtp">Send through an SMTP server</option>
          </NativeSelect>
        </Field>
        {form.mode === "smtp" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field id={id("fromName")} label="Sender name" required error={errors.fromName}>
              <Input id={id("fromName")} value={form.fromName} onChange={(e) => set({ fromName: e.target.value })} {...describe(id("fromName"), { error: errors.fromName })} />
            </Field>
            <Field id={id("fromAddress")} label="Sender address" required error={errors.fromAddress} hint="The server must be allowed to send as this address.">
              <Input id={id("fromAddress")} type="email" autoComplete="off" value={form.fromAddress} onChange={(e) => set({ fromAddress: e.target.value })} {...describe(id("fromAddress"), { hint: true, error: errors.fromAddress })} />
            </Field>
            <Field id={id("host")} label="Server" required error={errors.host} hint="For example smtp.example.com">
              <Input id={id("host")} spellCheck={false} value={form.host} onChange={(e) => set({ host: e.target.value })} {...describe(id("host"), { hint: true, error: errors.host })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field id={id("security")} label="Security">
                <NativeSelect id={id("security")} value={form.security} onChange={(e) => { const v = e.target.value as Form["security"]; set({ security: v, port: PORT_FOR[v] }); }}>
                  <option value="starttls">STARTTLS (usually 587)</option>
                  <option value="tls">TLS (usually 465)</option>
                  <option value="none">None (only inside your network)</option>
                </NativeSelect>
              </Field>
              <Field id={id("port")} label="Port" required error={errors.port}>
                <Input id={id("port")} inputMode="numeric" value={form.port} onChange={(e) => set({ port: e.target.value })} {...describe(id("port"), { error: errors.port })} />
              </Field>
            </div>
            <Field id={id("username")} label="User name" error={errors.username} hint="Leave empty for a server that needs no sign-in. The password is below, once saved.">
              <Input id={id("username")} autoComplete="off" spellCheck={false} value={form.username} onChange={(e) => set({ username: e.target.value })} {...describe(id("username"), { hint: true, error: errors.username })} />
            </Field>
          </div>
        ) : (
          <p className="text-sm text-secondary">With no mail, confirmation and reset messages are not sent and their links are not written anywhere.</p>
        )}
        {form.mode === "smtp" && form.security === "none" ? <p className="text-xs text-warning">Without security the password and every message cross the network readable. Use it only for a server inside your own network.</p> : null}
        <SaveError message={saveError} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={save.isPending || !canWrite}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <SavedNote show={justSaved} />
        </div>
        <p className="text-xs text-muted">Moving to another server removes a saved password, which is only ever sent to the server it was saved for.</p>
      </form>
    </Panel>
  );
}

function TestMessage({ defaultTo }: { defaultTo: string }) {
  const [to, setTo] = useState(defaultTo);
  const [error, setError] = useState("");
  const test = useConnectionTest();
  const canWrite = useAdminAccess().capabilities.email;
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
      setError("Address must be an email address.");
      return;
    }
    setError("");
    test.mutate({ kind: "mail-message", to: to.trim() });
  };
  return (
    <Panel title="Send a test message" description="Sends one short message with the saved settings. Save the server and password first.">
      <form onSubmit={send} noValidate className="space-y-3" aria-label="Send a test message">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <Field id="mail-test-to" label="Send to" error={error}>
            <Input id="mail-test-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} {...describe("mail-test-to", { error })} />
          </Field>
          <Button type="submit" variant="outline" size="sm" disabled={test.isPending || !canWrite}>
            Send test message
          </Button>
        </div>
        <TestOutcome result={test.data} error={test.isError ? messageOf(test.error) : ""} pending={test.isPending} />
      </form>
    </Panel>
  );
}
