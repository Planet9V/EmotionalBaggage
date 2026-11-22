"use client";

// Credentials: one card per provider, built from the registry the API returns. A secret is never shown:
// at most its last four characters, and only when the API gives them. Typed values live in this
// component's state until saved, then are cleared.
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { messageOf } from "@/lib/queries";
import {
  useAdminSettings,
  useConnectionTest,
  useCredentials,
  useCredentialsAudit,
  useRemoveCredential,
  useSaveCredentials,
  type AdminSettings,
  type AuditEntry,
  type ConnectionTest,
  type ProviderView,
} from "@/lib/admin/client";
import { ChannelProviderNotes } from "@/components/channels/AdminExtras";
import { TestOutcome } from "./shared";
import { fmtDateTime } from "@/lib/format";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, describe } from "@/components/ui/field";
import { EmptyState, LoadError, LoadingBlocks, SaveError, SavedNote, useFlag } from "@/components/ui/states";
import { Panel } from "@/components/ui/panel";

type Field = ProviderView["fields"][number];

/** What the field holds, in words. Never the value of a secret. */
function fieldState(f: Field): string {
  if (!f.set) return "Not set.";
  if (f.masked) return "Set.";
  const where = f.source === "environment" ? " It comes from an environment variable, used only because nothing is saved here." : "";
  const bound = f.secret && f.boundTo ? ` It is only ever sent to ${f.boundTo}, the address it was saved for; moving a model to another host needs the key typed again.` : "";
  if (f.secret) return f.last4 ? `Set, ending in ${f.last4}.${where}${bound}` : `Set. It is too short to show its last characters.${where}${bound}`;
  return `Set to ${f.value}.${where}`;
}

const MODEL_PROVIDERS = new Set(["ollama", "lmstudio", "openrouter"]);

/** Which test a provider has, given the typed key. Model hosts are tested at the saved model address, else the default. */
function testFor(p: ProviderView, typed: string, settings: AdminSettings | undefined): ConnectionTest | null {
  const apiKey = typed.trim() || undefined;
  if (p.id === "perplexity") return { kind: "perplexity", ...(apiKey ? { apiKey } : {}) };
  // the channel connections test the saved values (src/lib/channels/connection.ts)
  if (p.id === "amazon-sp" || p.id === "x" || p.id === "instagram") return { kind: p.id };
  if (p.id === "stripe" || p.id === "smtp") return { kind: p.id };
  if (p.id === "kokoro") return { kind: "voice" };
  if (MODEL_PROVIDERS.has(p.id)) {
    const id = p.id as "ollama" | "lmstudio" | "openrouter";
    const saved = [settings?.reasoningModel, settings?.embeddingModel].find((m) => m?.provider === id);
    const baseUrl = saved?.baseUrl ?? settings?.defaultBaseUrl[id];
    if (!baseUrl) return null;
    return { kind: "model", provider: id, baseUrl, ...(apiKey ? { apiKey } : {}) };
  }
  return null;
}

const SAVED_ONLY = new Set<ConnectionTest["kind"]>(["amazon-sp", "x", "instagram", "stripe", "smtp", "voice"]);

/** The answer's audio, when a voice test hands one back (held in memory only). */
const audioOf = (r: { detail?: Record<string, unknown> } | undefined) => (typeof r?.detail?.audio === "string" && r.detail.audio.startsWith("data:audio/") ? r.detail.audio : null);

function ProviderCard({ p, settings }: { p: ProviderView; settings: AdminSettings | undefined }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saved, markSaved] = useFlag();
  const save = useSaveCredentials();
  const remove = useRemoveCredential();
  const test = useConnectionTest();

  const typedKey = values.apiKey ?? "";
  const t = testFor(p, typedKey, settings);
  // a new power (src/lib/admin/guard.ts): only the platform administrator saves, removes and tests it
  const locked = p.locked;
  const fieldId = (name: string) => `cred-${p.id}-${name}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fields = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ""));
    if (!Object.keys(fields).length) {
      setError("Type a value to save. Empty boxes leave the saved values as they are.");
      return;
    }
    setError("");
    try {
      await save.mutateAsync({ provider: p.id, fields });
      setValues({});
      markSaved();
    } catch (err) {
      const m = messageOf(err);
      setError(m);
      toast.error(m);
    }
  };

  const doRemove = async (name: string) => {
    setError("");
    try {
      await remove.mutateAsync({ provider: p.id, field: name });
    } catch (err) {
      const m = messageOf(err);
      setError(m);
      toast.error(m);
    }
  };

  return (
    <Panel
      title={p.label}
      description={p.purpose}
      actions={
        p.fields.some((f) => f.required) || p.fields.some((f) => f.set) ? (
          <StatusBadge tone={p.configured ? "success" : "neutral"}>{p.configured ? "Configured" : "Not configured"}</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">No key needed</StatusBadge>
        )
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4" aria-busy={save.isPending || undefined}>
        {p.fields.map((f) => {
          const id = fieldId(f.name);
          return (
            <div key={f.name} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <Field id={id} label={f.label} required={f.required} hint={<span data-testid={`state-${p.id}-${f.name}`}>{fieldState(f)}</span>}>
                <Input
                  id={id}
                  type={f.secret ? "password" : "text"}
                  autoComplete={f.secret ? "new-password" : "off"}
                  spellCheck={false}
                  placeholder={f.set ? (f.secret ? "Type a new value to replace it" : "Type a new value") : f.secret ? "Paste the value" : ""}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  {...describe(id, { hint: true })}
                />
              </Field>
              {f.source === "admin" ? (
                <ConfirmButton
                  label="Remove"
                  title={`Remove the saved ${f.label.toLowerCase()} for ${p.label}?`}
                  body={`The saved value is deleted. If an environment variable gives one, that applies again. This cannot be undone; you would need to paste the value again.`}
                  confirmLabel="Remove"
                  disabled={remove.isPending || locked}
                  onConfirm={() => void doRemove(f.name)}
                />
              ) : null}
            </div>
          );
        })}
        <SaveError message={error} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={save.isPending || locked}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!t || test.isPending || locked}
            onClick={() => t && test.mutate(t)}
            aria-describedby={`test-${p.id}-note`}
          >
            Test connection
          </Button>
          <SavedNote show={saved} />
        </div>
        <p id={`test-${p.id}-note`} className="text-xs text-muted">
          {t
            ? t.kind === "model"
              ? `Tests the key typed above, or the saved one, at ${t.baseUrl}.`
              : SAVED_ONLY.has(t.kind)
                ? t.kind === "voice"
                  ? "Speaks one short sentence with the saved settings (save first). The audio is played here and not kept."
                  : "Tests the saved values: save first."
                : "Tests the key typed above, or the saved one."
            : `There is no connection test for ${p.label} yet.`}
        </p>
        <TestOutcome result={test.data} error={test.isError ? messageOf(test.error) : ""} pending={test.isPending} />
        {audioOf(test.data) ? <audio controls src={audioOf(test.data)!} className="w-full max-w-md" aria-label="The test sentence, as spoken" /> : null}
        <ChannelProviderNotes id={p.id} />
      </form>
    </Panel>
  );
}

const ACTION: Record<AuditEntry["action"], string> = { set: "Saved", replaced: "Replaced", removed: "Removed", tested: "Tested" };

function Activity() {
  const audit = useCredentialsAudit();
  return (
    <Panel title="Recent credentials activity" description="Saves, removals and connection tests, newest first. Values are never recorded.">
      {audit.isPending ? (
        <LoadingBlocks rows={1} label="Reading recent activity" />
      ) : audit.isError ? (
        <LoadError message={messageOf(audit.error)} onRetry={() => void audit.refetch()} />
      ) : audit.data.length === 0 ? (
        <EmptyState>Nothing yet. Saving a key or testing a connection adds a line here.</EmptyState>
      ) : (
        <ul className="divide-y divide-hairline rounded-xl border border-hairline text-sm">
          {audit.data.slice(0, 30).map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2">
              <span className="w-44 shrink-0 font-mono text-xs text-muted">{fmtDateTime(e.at)}</span>
              <span className="font-medium text-primary">{ACTION[e.action] ?? e.action}</span>
              <span className="font-mono text-xs text-secondary">
                {e.provider}
                {e.field ? ` ${e.field}` : ""}
              </span>
              {e.result ? (
                <span className={`min-w-0 basis-full text-xs md:basis-auto ${e.result.ok ? "text-success" : "text-danger"}`}>
                  {e.result.ok ? "Worked: " : "Failed: "}
                  {e.result.message}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * The key cards. Every Admin section that holds keys shows its own providers through this (`only`); the All keys
 * section shows every provider and the recent activity.
 */
export function CredentialsTab({ only, activity = !only, intro = true }: { only?: readonly ProviderView["id"][]; activity?: boolean; intro?: boolean } = {}) {
  const creds = useCredentials();
  const settings = useAdminSettings();
  if (creds.isPending) return <LoadingBlocks rows={only?.length ?? 3} label="Reading the credentials" />;
  if (creds.isError) return <LoadError message={messageOf(creds.error)} onRetry={() => void creds.refetch()} />;
  const shown = only ? only.map((id) => creds.data.find((p) => p.id === id)).filter((p): p is ProviderView => !!p) : creds.data;
  return (
    <div className="space-y-4">
      {intro ? (
        <p className="max-w-3xl text-sm text-secondary">
          Keys are saved in this install&apos;s database. The app never shows a saved key again: at most its last four characters. A key saved here is used before any
          environment variable.
        </p>
      ) : null}
      {shown.length === 0 ? <EmptyState>No providers are defined.</EmptyState> : null}
      <div className={`grid gap-4 ${shown.length > 1 ? "xl:grid-cols-2" : ""}`}>
        {shown.map((p) => (
          <ProviderCard key={p.id} p={p} settings={settings.data} />
        ))}
      </div>
      {activity ? <Activity /> : null}
    </div>
  );
}
