"use client";

// Models: the reasoning model, the embedding model (with presets) and the planner address. Nothing is
// saved until Save. Test uses the values in the form, saved or not.
import { useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useProject } from "@/lib/client";
import { messageOf } from "@/lib/queries";
import { EMBEDDING_PRESETS, type EmbeddingPreset } from "@/lib/ai/presets";
import { embeddingChoice, httpUrl, reasoningChoice } from "@/lib/admin/schemas";
import {
  useAdminSettings,
  useConnectionTest,
  useCredentials,
  useIndexConcept,
  useSaveSettings,
  type AdminSettings,
  type ModelChoice,
  type ConnectionTest,
} from "@/lib/admin/client";
import { ConfirmButton, describe, FormField, LoadError, LoadingBlocks, NotSetUp, Panel, SaveError, SavedNote, TestOutcome, useFlag } from "./shared";

type ProviderId = ModelChoice["provider"];
const PROVIDER_LABEL: Record<ProviderId, string> = { ollama: "Ollama", lmstudio: "LM Studio", openrouter: "OpenRouter" };
const PROVIDER_IDS = Object.keys(PROVIDER_LABEL) as ProviderId[];

type Kind = "reasoning" | "embedding";
type Form = { provider: ProviderId | ""; baseUrl: string; model: string; dims: string };
type Errors = Partial<Record<keyof Form, string>>;

const FIELD_LABEL: Record<keyof Form, string> = { provider: "Provider", baseUrl: "Address", model: "Model name", dims: "Vector width" };

const formOf = (c: ModelChoice | null): Form => ({ provider: c?.provider ?? "", baseUrl: c?.baseUrl ?? "", model: c?.model ?? "", dims: c?.dims ? String(c.dims) : "" });

/** When the provider changes: keep a typed address, replace an empty one or one that is still a default. */
export function addressFor(next: ProviderId, current: string, defaults: Record<ProviderId, string>): string {
  const t = current.trim().replace(/\/+$/, "");
  const isDefault = !t || Object.values(defaults).some((d) => d.replace(/\/+$/, "") === t);
  return isDefault ? defaults[next] : current;
}

/** Checks the form with the same zod schemas the server uses. Answers the choice or the errors by field. */
function check(kind: Kind, f: Form): { choice: ModelChoice } | { errors: Errors } {
  const raw = {
    provider: f.provider || undefined,
    baseUrl: f.baseUrl,
    model: f.model,
    ...(kind === "embedding" ? { dims: f.dims.trim() === "" ? undefined : Number(f.dims) } : {}),
  };
  const r = (kind === "embedding" ? embeddingChoice : reasoningChoice).safeParse(raw);
  if (r.success) return { choice: r.data as ModelChoice };
  const errors: Errors = {};
  for (const i of r.error.issues) {
    const k = i.path[0] as keyof Form;
    if (k && !errors[k]) errors[k] = k === "provider" ? "Choose a provider." : `${FIELD_LABEL[k]} ${i.message}.`;
  }
  return { errors };
}

function ModelSection({ kind, saved, settings }: { kind: Kind; saved: ModelChoice | null; settings: AdminSettings }) {
  const [form, setForm] = useState<Form>(() => formOf(saved));
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState("");
  const [preset, setPreset] = useState<EmbeddingPreset | null>(null);
  const [justSaved, markSaved] = useFlag();
  const [reindex, setReindex] = useState(false);
  const save = useSaveSettings();
  const test = useConnectionTest();
  const creds = useCredentials();
  const key = kind === "embedding" ? "embeddingModel" : "reasoningModel";
  const id = (f: string) => `${kind}-${f}`;
  const title = kind === "embedding" ? "Embedding model" : "Reasoning model";

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const choose = (p: ProviderId) => setForm((f) => ({ ...f, provider: p, baseUrl: addressFor(p, f.baseUrl, settings.defaultBaseUrl) }));
  const applyPreset = (p: EmbeddingPreset) => {
    setPreset(p);
    setErrors({});
    setForm({ provider: p.choice.provider, baseUrl: p.choice.baseUrl, model: p.choice.model, dims: String(p.choice.dims) });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const c = check(kind, form);
    if ("errors" in c) {
      setErrors(c.errors);
      return;
    }
    setErrors({});
    setSaveError("");
    try {
      await save.mutateAsync({ [key]: c.choice });
      markSaved();
      setPreset(null);
      if (kind === "embedding") setReindex(true);
    } catch (err) {
      const m = messageOf(err);
      setSaveError(m);
      toast.error(m);
    }
  };

  const clear = async () => {
    setSaveError("");
    try {
      await save.mutateAsync({ [key]: null });
      setForm(formOf(null));
      setPreset(null);
      markSaved();
    } catch (err) {
      const m = messageOf(err);
      setSaveError(m);
      toast.error(m);
    }
  };

  const runTest = () => {
    const c = check(kind, form);
    if ("errors" in c) {
      setErrors(c.errors);
      return;
    }
    setErrors({});
    const t: ConnectionTest =
      kind === "embedding"
        ? { kind: "embedding", provider: c.choice.provider, baseUrl: c.choice.baseUrl, model: c.choice.model, dims: c.choice.dims! }
        : { kind: "model", provider: c.choice.provider, baseUrl: c.choice.baseUrl, model: c.choice.model };
    test.mutate(t);
  };

  const openrouterKey = creds.data?.find((p) => p.id === "openrouter")?.configured;
  const dims = Number(form.dims);

  return (
    <Panel
      title={title}
      description={
        kind === "embedding"
          ? "Turns text into vectors so search can find rows by meaning, not only by matching words."
          : "Drafts and reviews your concept: the reviewer in Concept, Challenge uses it today."
      }
      actions={
        <>
          <StatusBadge tone={saved ? "success" : "neutral"}>{saved ? "Chosen" : "Not chosen"}</StatusBadge>
          {kind === "embedding" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  Start from <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                {EMBEDDING_PRESETS.map((p) => (
                  <DropdownMenuItem key={p.id} onSelect={() => applyPreset(p)}>
                    {p.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4" aria-busy={save.isPending || undefined} aria-label={title}>
        {!saved ? <p className="text-sm text-secondary">No {title.toLowerCase()} is chosen yet, so the features that need one say so. Fill in the form and save.</p> : null}
        {preset ? (
          <p role="status" className="rounded-md bg-info-soft px-3 py-2 text-sm text-info">
            Filled from {preset.label}. {preset.note} Nothing is saved until you choose Save.
          </p>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <FormField id={id("provider")} label="Provider" required error={errors.provider}>
            <Select value={form.provider || undefined} onValueChange={(v) => choose(v as ProviderId)}>
              <SelectTrigger id={id("provider")} className="w-full border-hairline bg-surface" {...describe(id("provider"), { error: errors.provider })}>
                <SelectValue placeholder="Choose a provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_IDS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PROVIDER_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            id={id("baseUrl")}
            label="Address"
            required
            error={errors.baseUrl}
            hint="The provider's OpenAI-compatible address. Inside Docker, a server on this computer is at host.docker.internal."
          >
            <Input id={id("baseUrl")} value={form.baseUrl} spellCheck={false} onChange={(e) => set({ baseUrl: e.target.value })} {...describe(id("baseUrl"), { hint: true, error: errors.baseUrl })} />
          </FormField>
          <FormField id={id("model")} label="Model name" required error={errors.model}>
            <Input id={id("model")} value={form.model} spellCheck={false} onChange={(e) => set({ model: e.target.value })} {...describe(id("model"), { error: errors.model })} />
          </FormField>
          {kind === "embedding" ? (
            <FormField id={id("dims")} label="Vector width" required error={errors.dims} hint="How many numbers the model returns per text. The test checks it.">
              <Input
                id={id("dims")}
                inputMode="numeric"
                value={form.dims}
                onChange={(e) => set({ dims: e.target.value })}
                {...describe(id("dims"), { hint: true, error: errors.dims })}
              />
            </FormField>
          ) : null}
        </div>
        {kind === "embedding" ? (
          <p className="text-xs text-muted">
            Widths above 2,000 are searched through a one-bit index and then re-ranked by the full vectors.
            {dims > 2000 ? " This width is one of them." : ""}
          </p>
        ) : null}
        {form.provider === "openrouter" && creds.data && !openrouterKey ? (
          <NotSetUp href="/admin?tab=credentials" label="Open Credentials">
            OpenRouter needs a key, and none is saved.
          </NotSetUp>
        ) : null}
        <SaveError message={saveError} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={test.isPending} onClick={runTest}>
            Test
          </Button>
          {saved ? (
            <ConfirmButton
              label="Clear"
              title={`Clear the ${title.toLowerCase()}?`}
              body="The features that need it say so again until another one is chosen."
              confirmLabel="Clear"
              disabled={save.isPending}
              onConfirm={() => void clear()}
            />
          ) : null}
          <SavedNote show={justSaved} />
        </div>
        <TestOutcome result={test.data} error={test.isError ? messageOf(test.error) : ""} pending={test.isPending} />
        {reindex ? <Reindex onDone={() => setReindex(false)} /> : null}
      </form>
    </Panel>
  );
}

/** After an embedding model is saved: every concept must be indexed again. Offers the current one. */
function Reindex({ onDone }: { onDone: () => void }) {
  const { project } = useProject();
  const index = useIndexConcept();
  return (
    <div className="space-y-2 rounded-xl border border-hairline bg-subtle p-4 text-sm">
      <p className="text-primary">
        Each concept must be indexed again for this model. Until it is, search in that concept falls back to matching words.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {project ? (
          <Button type="button" size="sm" variant="outline" disabled={index.isPending} onClick={() => index.mutate(project.id)}>
            {index.isPending ? "Indexing…" : `Index the current concept (${project.name})`}
          </Button>
        ) : (
          <span className="text-secondary">There is no concept to index yet.</span>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Later
        </Button>
      </div>
      {index.isError ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-danger">
          {messageOf(index.error)}
        </p>
      ) : null}
      {index.data ? (
        <p role="status" className={`rounded-md px-3 py-2 ${index.data.failed ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}>
          Indexed {index.data.indexed}, unchanged {index.data.skipped}, failed {index.data.failed}, with {index.data.model} at width {index.data.dims}.
          {index.data.error ? ` First failure: ${index.data.error}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function PlannerSection({ settings }: { settings: AdminSettings }) {
  const [url, setUrl] = useState(settings.plannerUrl ?? "");
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [justSaved, markSaved] = useFlag();
  const save = useSaveSettings();
  const test = useConnectionTest();
  const eff = settings.plannerEffective;

  const parsed = () => {
    const r = httpUrl.safeParse(url);
    if (!r.success) {
      setError(`Address ${r.error.issues[0].message}.`);
      return null;
    }
    setError("");
    return r.data;
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = parsed();
    if (!v) return;
    setSaveError("");
    try {
      await save.mutateAsync({ plannerUrl: v });
      markSaved();
    } catch (err) {
      const m = messageOf(err);
      setSaveError(m);
      toast.error(m);
    }
  };
  const clear = async () => {
    setSaveError("");
    try {
      await save.mutateAsync({ plannerUrl: null });
      setUrl("");
      markSaved();
    } catch (err) {
      const m = messageOf(err);
      setSaveError(m);
      toast.error(m);
    }
  };

  return (
    <Panel title="Planner address" description="The service that works out the order of operations and the critical path.">
      <form onSubmit={submit} noValidate className="space-y-4" aria-busy={save.isPending || undefined} aria-label="Planner address">
        <p className="text-sm text-secondary">
          {eff.url
            ? `In use: ${eff.url}, ${eff.source === "admin" ? "saved here" : "from the PLANNER_URL environment variable (a fallback)"}.`
            : "No address is saved here and PLANNER_URL is not set, so the plan page lists the steps without an order."}
        </p>
        <FormField id="planner-url" label="Address" error={error} hint="For example http://planner:8811 inside Docker Compose.">
          <Input id="planner-url" value={url} spellCheck={false} onChange={(e) => setUrl(e.target.value)} {...describe("planner-url", { hint: true, error })} />
        </FormField>
        <SaveError message={saveError} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={test.isPending}
            onClick={() => {
              if (!url.trim()) return test.mutate({ kind: "planner" });
              const v = parsed();
              if (v) test.mutate({ kind: "planner", url: v });
            }}
          >
            Test
          </Button>
          {settings.plannerUrl ? (
            <ConfirmButton
              label="Clear"
              title="Clear the saved planner address?"
              body="The PLANNER_URL environment variable applies again, if it is set."
              confirmLabel="Clear"
              onConfirm={() => void clear()}
            />
          ) : null}
          <SavedNote show={justSaved} />
        </div>
        <TestOutcome result={test.data} error={test.isError ? messageOf(test.error) : ""} pending={test.isPending} />
      </form>
    </Panel>
  );
}

export function ModelsTab() {
  const settings = useAdminSettings();
  if (settings.isPending) return <LoadingBlocks rows={3} label="Reading the model settings" />;
  if (settings.isError) return <LoadError message={messageOf(settings.error)} onRetry={() => void settings.refetch()} />;
  const s = settings.data;
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-secondary">
        Each model is served by Ollama, LM Studio or OpenRouter. Keys for them are in Credentials. Test checks the values in the form, saved or not.
      </p>
      {/* Each form starts from the saved values once and then keeps what is typed, so a refused save never empties it. */}
      <ModelSection kind="reasoning" saved={s.reasoningModel} settings={s} />
      <ModelSection kind="embedding" saved={s.embeddingModel} settings={s} />
      <PlannerSection settings={s} />
    </div>
  );
}
