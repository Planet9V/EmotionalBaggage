"use client";

// Admin, Voice: text to speech for voice-overs and narration (owner ruling, 22 Nov). None by default. Kokoro: a speech
// server the admin runs, at an address entered here; its voices and models are read from the server for the pickers,
// and any name can still be typed. OpenRouter is listed but not offered, with the reason (VOICE_PROVIDERS). Settings
// are saved through the shared settings route; an optional key is the shared key card of "kokoro", whose Test speaks
// one sentence. A new power: only the platform administrator changes it.
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
import { httpUrl, VOICE_PROVIDERS, voiceSettings } from "@/lib/admin/schemas";
import { useAdminAccess, useAdminSettings, useSaveSettings, useVoiceOptions, type VoiceSettings } from "@/lib/admin/client";
import { CredentialsTab } from "./CredentialsTab";

type Form = { provider: "none" | "kokoro"; baseUrl: string; model: string; voice: string; speed: string };
type Errors = Partial<Record<keyof Form, string>>;
const LABEL: Record<keyof Form, string> = { provider: "Provider", baseUrl: "Address", model: "Model", voice: "Voice", speed: "Speed" };
const OPENROUTER = VOICE_PROVIDERS.find((p) => p.id === "openrouter")!;

const formOf = (v: VoiceSettings): Form =>
  v.provider === "none" ? { provider: "none", baseUrl: "", model: "kokoro", voice: "", speed: "1" } : { provider: "kokoro", baseUrl: v.baseUrl, model: v.model, voice: v.voice, speed: String(v.speed) };

export function VoiceTab() {
  const settings = useAdminSettings();
  if (settings.isPending) return <LoadingBlocks rows={2} label="Reading the voice settings" />;
  if (settings.isError) return <LoadError what="The voice settings" message={messageOf(settings.error)} onRetry={() => void settings.refetch()} />;
  const saved = settings.data.voice;
  if ("hidden" in saved) {
    return (
      <div className="space-y-4">
        <Panel title="Voice" description="Text to speech, for voice-overs and narration." actions={<StatusBadge tone="success">Kokoro</StatusBadge>}>
          <p className="text-sm text-secondary">A voice is set up. Its details are shown to the platform administrator only.</p>
        </Panel>
        <CredentialsTab only={["kokoro"]} intro={false} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <VoiceForm saved={saved} />
      {saved.provider === "kokoro" ? <CredentialsTab only={["kokoro"]} intro={false} /> : null}
    </div>
  );
}

function VoiceForm({ saved }: { saved: VoiceSettings }) {
  const [form, setForm] = useState<Form>(() => formOf(saved));
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState("");
  const [justSaved, markSaved] = useFlag();
  const save = useSaveSettings();
  const options = useVoiceOptions();
  const canWrite = useAdminAccess().capabilities.voice;
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const id = (n: string) => `voice-${n}`;

  const load = () => {
    const r = httpUrl.safeParse(form.baseUrl);
    if (!r.success) {
      setErrors({ baseUrl: `Address ${r.error.issues[0].message}.` });
      return;
    }
    setErrors({});
    options.mutate(r.data);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const raw = form.provider === "none" ? { provider: "none" } : { provider: "kokoro", baseUrl: form.baseUrl, model: form.model, voice: form.voice, speed: Number(form.speed) };
    const r = voiceSettings.safeParse(raw);
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
      await save.mutateAsync({ voice: r.data });
      markSaved();
    } catch (err) {
      const m = messageOf(err);
      setSaveError(m);
      toast.error(m);
    }
  };

  const voices = options.data?.voices;
  const models = options.data?.models;
  const listNote = (o: typeof voices, what: string) => (!o ? `Type the ${what}, or load the server's list.` : o.ok ? `${o.items.length} ${what}s listed by the server; any name can still be typed.` : o.reason);

  return (
    <Panel
      title="Voice"
      description="Text to speech, for voice-overs and narration. Off unless you choose a provider; nothing else in the app needs it."
      actions={<StatusBadge tone={saved.provider === "none" ? "neutral" : "success"}>{saved.provider === "none" ? "No voice" : "Kokoro"}</StatusBadge>}
    >
      <form onSubmit={submit} noValidate className="space-y-4" aria-label="Voice settings" aria-busy={save.isPending || undefined}>
        <Field id={id("provider")} label="Provider" hint={OPENROUTER.reason}>
          <NativeSelect id={id("provider")} value={form.provider} onChange={(e) => set({ provider: e.target.value as Form["provider"] })} {...describe(id("provider"), { hint: true })}>
            {VOICE_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.available}>
                {p.available ? p.label : `${p.label} (not available)`}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {form.provider === "kokoro" ? (
          <>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <Field id={id("baseUrl")} label="Address" required error={errors.baseUrl} hint="The Kokoro server's OpenAI-compatible base address; the app adds /audio/speech. For example http://host.docker.internal:8880/v1">
                <Input id={id("baseUrl")} spellCheck={false} value={form.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} {...describe(id("baseUrl"), { hint: true, error: errors.baseUrl })} />
              </Field>
              <Button type="button" variant="outline" size="sm" disabled={options.isPending || !canWrite} onClick={load}>
                {options.isPending ? "Loading…" : "Load voices and models"}
              </Button>
            </div>
            {options.isError ? <SaveError message={messageOf(options.error)} /> : null}
            <div className="grid gap-4 md:grid-cols-3">
              <Field id={id("model")} label="Model" required error={errors.model} hint={listNote(models, "model")}>
                <Input id={id("model")} list={id("models")} spellCheck={false} value={form.model} onChange={(e) => set({ model: e.target.value })} {...describe(id("model"), { hint: true, error: errors.model })} />
              </Field>
              <Field id={id("voice")} label="Voice" required error={errors.voice} hint={listNote(voices, "voice")}>
                <Input id={id("voice")} list={id("voices")} spellCheck={false} value={form.voice} onChange={(e) => set({ voice: e.target.value })} {...describe(id("voice"), { hint: true, error: errors.voice })} />
              </Field>
              <Field id={id("speed")} label="Speed" required error={errors.speed} hint="0.25 to 4; 1 is normal.">
                <Input id={id("speed")} inputMode="decimal" value={form.speed} onChange={(e) => set({ speed: e.target.value })} {...describe(id("speed"), { hint: true, error: errors.speed })} />
              </Field>
            </div>
            <datalist id={id("models")}>{models?.ok ? models.items.map((m) => <option key={m} value={m} />) : null}</datalist>
            <datalist id={id("voices")}>{voices?.ok ? voices.items.map((v) => <option key={v} value={v} />) : null}</datalist>
          </>
        ) : null}
        <SaveError message={saveError} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={save.isPending || !canWrite}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <SavedNote show={justSaved} />
        </div>
        {saved.provider !== "none" ? <p className="text-xs text-muted">To hear it, use Test connection on the key card below: it speaks one short sentence.</p> : null}
      </form>
    </Panel>
  );
}
