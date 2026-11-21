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
import { ConfirmButton, describe, Empty, FormField, LoadError, LoadingBlocks, Panel, SaveError, SavedNote, TestOutcome, useFlag, when } from "./shared";

type Field = ProviderView["fields"][number];

/** What the field holds, in words. Never the value of a secret. */
export function fieldState(f: Field): string {
  if (!f.set) return "Not set.";
  const where = f.source === "environment" ? " It comes from an environment variable, used only because nothing is saved here." : "";
  if (f.secret) return f.last4 ? `Set, ending in ${f.last4}.${where}` : `Set. It is too short to show its last characters.${where}`;
  return `Set to ${f.value}.${where}`;
}

const MODEL_PROVIDERS = new Set(["ollama", "lmstudio", "openrouter"]);

/** Which test a provider has, given the typed key. Model hosts are tested at the saved model address, else the default. */
function testFor(p: ProviderView, typed: string, settings: AdminSettings | undefined): ConnectionTest | null {
  const apiKey = typed.trim() || undefined;
  if (p.id === "perplexity") return { kind: "perplexity", ...(apiKey ? { apiKey } : {}) };
  if (MODEL_PROVIDERS.has(p.id)) {
    const id = p.id as "ollama" | "lmstudio" | "openrouter";
    const saved = [settings?.reasoningModel, settings?.embeddingModel].find((m) => m?.provider === id);
    const baseUrl = saved?.baseUrl ?? settings?.defaultBaseUrl[id];
    if (!baseUrl) return null;
    return { kind: "model", provider: id, baseUrl, ...(apiKey ? { apiKey } : {}) };
  }
  return null;
}

function ProviderCard({ p, settings }: { p: ProviderView; settings: AdminSettings | undefined }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saved, markSaved] = useFlag();
  const save = useSaveCredentials();
  const remove = useRemoveCredential();
  const test = useConnectionTest();

  const typedKey = values.apiKey ?? "";
  const t = testFor(p, typedKey, settings);
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
              <FormField id={id} label={f.label} required={f.required} hint={<span data-testid={`state-${p.id}-${f.name}`}>{fieldState(f)}</span>}>
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
              </FormField>
              {f.source === "admin" ? (
                <ConfirmButton
                  label="Remove"
                  title={`Remove the saved ${f.label.toLowerCase()} for ${p.label}?`}
                  body={`The saved value is deleted. If an environment variable gives one, that applies again. This cannot be undone; you would need to paste the value again.`}
                  confirmLabel="Remove"
                  disabled={remove.isPending}
                  onConfirm={() => void doRemove(f.name)}
                />
              ) : null}
            </div>
          );
        })}
        <SaveError message={error} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!t || test.isPending}
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
              : "Tests the key typed above, or the saved one."
            : `There is no connection test for ${p.label} yet.`}
        </p>
        <TestOutcome result={test.data} error={test.isError ? messageOf(test.error) : ""} pending={test.isPending} />
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
        <Empty>Nothing yet. Saving a key or testing a connection adds a line here.</Empty>
      ) : (
        <ul className="divide-y divide-hairline rounded-xl border border-hairline text-sm">
          {audit.data.slice(0, 30).map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2">
              <span className="w-44 shrink-0 font-mono text-xs text-muted">{when(e.at)}</span>
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

export function CredentialsTab() {
  const creds = useCredentials();
  const settings = useAdminSettings();
  if (creds.isPending) return <LoadingBlocks rows={3} label="Reading the credentials" />;
  if (creds.isError) return <LoadError message={messageOf(creds.error)} onRetry={() => void creds.refetch()} />;
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-secondary">
        Keys are saved in this install&apos;s database. The app never shows a saved key again: at most its last four characters. A key saved here is used before any
        environment variable.
      </p>
      {creds.data.length === 0 ? <Empty>No providers are defined.</Empty> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {creds.data.map((p) => (
          <ProviderCard key={p.id} p={p} settings={settings.data} />
        ))}
      </div>
      <Activity />
    </div>
  );
}
