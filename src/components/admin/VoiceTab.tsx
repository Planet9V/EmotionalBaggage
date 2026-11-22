"use client";

// Admin, Voice: text to speech for narration. None by default; two optional providers behind one interface
// (src/lib/voice/speech.ts): any OpenAI-compatible speech endpoint, or ElevenLabs. The settings are saved through the
// shared settings route; the key is the shared key card of the chosen provider, whose Test speaks one sentence.
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
import { voiceSettings } from "@/lib/admin/schemas";
import { useAdminSettings, useSaveSettings, type VoiceSettings } from "@/lib/admin/client";
import { CredentialsTab } from "./CredentialsTab";

type Form = { provider: "none" | "openai" | "elevenlabs"; baseUrl: string; model: string; voice: string; speed: string };
type Errors = Partial<Record<keyof Form, string>>;
const LABEL: Record<keyof Form, string> = { provider: "Provider", baseUrl: "Address", model: "Model", voice: "Voice", speed: "Speed" };
const MODEL_HINT = { openai: "The model name the endpoint expects.", elevenlabs: "An ElevenLabs model id, for example eleven_multilingual_v2." } as const;

const formOf = (v: VoiceSettings): Form =>
  v.provider === "none"
    ? { provider: "none", baseUrl: "", model: "", voice: "", speed: "1" }
    : { provider: v.provider, baseUrl: v.provider === "openai" ? v.baseUrl : "", model: v.model, voice: v.voice, speed: String(v.speed) };

export function VoiceTab() {
  const settings = useAdminSettings();
  if (settings.isPending) return <LoadingBlocks rows={2} label="Reading the voice settings" />;
  if (settings.isError) return <LoadError what="The voice settings" message={messageOf(settings.error)} onRetry={() => void settings.refetch()} />;
  const saved = settings.data.voice;
  return (
    <div className="space-y-4">
      <VoiceForm saved={saved} />
      {saved.provider === "openai" ? <CredentialsTab only={["voice-openai"]} intro={false} /> : null}
      {saved.provider === "elevenlabs" ? <CredentialsTab only={["elevenlabs"]} intro={false} /> : null}
    </div>
  );
}

function VoiceForm({ saved }: { saved: VoiceSettings }) {
  const [form, setForm] = useState<Form>(() => formOf(saved));
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState("");
  const [justSaved, markSaved] = useFlag();
  const save = useSaveSettings();
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const id = (n: string) => `voice-${n}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const speed = Number(form.speed);
    const raw =
      form.provider === "none"
        ? { provider: "none" }
        : form.provider === "openai"
          ? { provider: "openai", baseUrl: form.baseUrl, model: form.model, voice: form.voice, speed }
          : { provider: "elevenlabs", model: form.model, voice: form.voice, speed };
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

  return (
    <Panel
      title="Voice"
      description="Text to speech, for narration. Off unless you choose a provider; nothing else in the app needs it."
      actions={<StatusBadge tone={saved.provider === "none" ? "neutral" : "success"}>{saved.provider === "none" ? "No voice" : saved.provider === "openai" ? "Speech endpoint" : "ElevenLabs"}</StatusBadge>}
    >
      <form onSubmit={submit} noValidate className="space-y-4" aria-label="Voice settings" aria-busy={save.isPending || undefined}>
        <Field id={id("provider")} label="Provider">
          <NativeSelect id={id("provider")} value={form.provider} onChange={(e) => set({ provider: e.target.value as Form["provider"], speed: "1" })}>
            <option value="none">None (narration off)</option>
            <option value="openai">An OpenAI-compatible speech endpoint</option>
            <option value="elevenlabs">ElevenLabs</option>
          </NativeSelect>
        </Field>
        {form.provider !== "none" ? (
          <div className="grid gap-4 md:grid-cols-2">
            {form.provider === "openai" ? (
              <Field id={id("baseUrl")} label="Address" required error={errors.baseUrl} hint="The endpoint's base address; the app adds /audio/speech. For example http://host.docker.internal:8880/v1">
                <Input id={id("baseUrl")} spellCheck={false} value={form.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} {...describe(id("baseUrl"), { hint: true, error: errors.baseUrl })} />
              </Field>
            ) : null}
            <Field id={id("model")} label="Model" required error={errors.model} hint={MODEL_HINT[form.provider]}>
              <Input id={id("model")} spellCheck={false} value={form.model} onChange={(e) => set({ model: e.target.value })} {...describe(id("model"), { hint: true, error: errors.model })} />
            </Field>
            <Field id={id("voice")} label={form.provider === "elevenlabs" ? "Voice ID" : "Default voice"} required error={errors.voice}>
              <Input id={id("voice")} spellCheck={false} value={form.voice} onChange={(e) => set({ voice: e.target.value })} {...describe(id("voice"), { error: errors.voice })} />
            </Field>
            <Field id={id("speed")} label="Speed" required error={errors.speed} hint={form.provider === "elevenlabs" ? "0.7 to 1.2; 1 is normal." : "0.25 to 4; 1 is normal."}>
              <Input id={id("speed")} inputMode="decimal" value={form.speed} onChange={(e) => set({ speed: e.target.value })} {...describe(id("speed"), { hint: true, error: errors.speed })} />
            </Field>
          </div>
        ) : null}
        <SaveError message={saveError} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          <SavedNote show={justSaved} />
        </div>
        {saved.provider !== "none" ? <p className="text-xs text-muted">To hear it, use Test connection on the key card below: it speaks one short sentence.</p> : null}
      </form>
    </Panel>
  );
}
