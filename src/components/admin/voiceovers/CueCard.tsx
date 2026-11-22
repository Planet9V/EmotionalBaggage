"use client";

// One cue in Admin, Voice-overs: the subtitle, the published clip, the direction (as a voice director's note and as
// bracket cues), the controls for a batch of takes, and the takes side by side to be heard, starred and published.
import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Field } from "@/components/ui/field";
import { SPEAKER_NAME } from "@/components/welcome/scenes/voiceScript";
import type { Catalog } from "@/lib/voice/catalog";
import { DIRECTION_MODES, resolveMode, stripTags, type DirectionMode } from "@/lib/voice/direction";
import type { VoiceoverRow } from "@/lib/voice/takes";
import { ModelFacts, ModelPicker } from "./ModelPicker";
import { MODE_LABEL, seconds, type Action } from "./useVoiceovers";

const loud = (lufs: number | null) => (lufs === null ? "loudness not measured" : `${lufs.toFixed(1)} LUFS`);

export function CueCard({ row, catalog, provider, ready, busy, onAct }: { row: VoiceoverRow; catalog: Catalog | undefined; provider: "kokoro" | "openrouter" | null; ready: boolean; busy: string | null; onAct: (a: Action) => void }) {
  const [direction, setDirection] = useState(row.direction);
  const [tags, setTags] = useState(row.inlineTags);
  const [model, setModel] = useState("");
  const [voice, setVoice] = useState("");
  const [count, setCount] = useState("3");
  const [mode, setMode] = useState<DirectionMode | "auto">("auto");
  const id = `cue-${row.cue}`;
  const n = Number(count);
  const countOk = Number.isInteger(n) && n >= 1 && n <= 6;
  const tagsOk = stripTags(tags) === row.text.replace(/\s+/g, " ").trim();
  const changed = direction.trim() !== row.direction || tags.trim() !== row.inlineTags;
  const facts = catalog?.ok ? catalog.models.find((m) => m.id === model) : undefined;
  const effective = provider && model ? resolveMode({ provider, id: model, parameters: facts?.parameters ?? [], description: facts?.description ?? undefined }, mode) : null;
  const over = (s: number) => row.window !== null && s > row.window;
  return (
    <li className="space-y-3 py-5 first:pt-0 last:pb-0" data-testid={`cue-${row.cue}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <StatusBadge tone={row.clip ? "success" : "neutral"}>{row.clip ? "Published" : "No clip"}</StatusBadge>
        <p className="font-mono text-xs text-muted">{row.cue}</p>
        <p className="text-xs font-medium text-secondary">{SPEAKER_NAME[row.speaker]}</p>
        {row.window !== null ? <p className="text-xs text-muted">subtitle: {seconds(row.window)}</p> : null}
      </div>
      <p className="max-w-[80ch] text-sm text-primary">&ldquo;{row.text}&rdquo;</p>
      {row.clip ? (
        <div className="flex flex-wrap items-center gap-3">
          <audio controls preload="none" src={row.clip.url} aria-label={`Published clip of ${row.cue}`} className="h-9 max-w-full" />
          <p className="text-xs text-secondary">
            Published: {row.clip.voice} ({row.clip.model}), {seconds(row.clip.seconds)}, {row.clip.seeded ? "a Kokoro draft that came with the example" : `published by ${row.clip.by}`}
            {row.versions ? `; ${row.versions} earlier version${row.versions === 1 ? "" : "s"} kept` : ""}.{over(row.clip.seconds) ? ` Longer than its subtitle (${seconds(row.window!)}).` : ""}
          </p>
        </div>
      ) : null}

      <div className="grid gap-2 lg:grid-cols-2">
        <Field id={`${id}-direction`} label={`Direction${row.directionEdited ? " (edited)" : ""}: for models that take instructions`}>
          <Textarea id={`${id}-direction`} rows={5} value={direction} onChange={(e) => setDirection(e.target.value)} className="text-xs leading-relaxed" />
        </Field>
        <Field id={`${id}-tags`} label="Bracket cues: for models that read them" error={tagsOk ? undefined : "Taking out the [cues] must leave the subtitle word for word."}>
          <Textarea id={`${id}-tags`} rows={5} value={tags} onChange={(e) => setTags(e.target.value)} className="font-mono text-xs leading-relaxed" aria-invalid={!tagsOk || undefined} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={!ready || !changed || !tagsOk || !direction.trim() || !!busy} onClick={() => onAct({ action: "direct", cue: row.cue, direction: direction.trim(), inlineTags: tags.trim() })}>
          {busy === "direct" ? "Saving…" : "Save direction"}
        </Button>
        {row.directionEdited ? (
          <Button type="button" size="sm" variant="ghost" disabled={!ready || !!busy} onClick={() => onAct({ action: "reset-direction", cue: row.cue })}>
            Back to the script&rsquo;s direction
          </Button>
        ) : null}
      </div>

      <div className="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_5rem_auto]">
        <ModelPicker id={id} catalog={catalog} model={model} voice={voice} onModel={setModel} onVoice={setVoice} placeholder="the speaker's" />
        <Field id={`${id}-mode`} label="Send the direction">
          <NativeSelect id={`${id}-mode`} value={mode} onChange={(e) => setMode(e.target.value as DirectionMode | "auto")}>
            <option value="auto">As the model takes it</option>
            {DIRECTION_MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id={`${id}-count`} label="Takes">
          <Input id={`${id}-count`} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} aria-invalid={!countOk || undefined} />
        </Field>
        <Button
          type="button"
          size="sm"
          disabled={!ready || !!busy || !countOk || !tagsOk || !direction.trim()}
          onClick={() => onAct({ action: "generate", cue: row.cue, count: n, ...(model.trim() ? { model: model.trim() } : {}), ...(voice.trim() ? { voice: voice.trim() } : {}), direction: direction.trim(), inlineTags: tags.trim(), mode })}
        >
          {busy === "generate" ? "Generating…" : `Generate ${countOk ? n : ""} take${n === 1 ? "" : "s"}`}
        </Button>
      </div>
      <ModelFacts model={facts} />
      {effective && effective !== facts?.mode && mode !== "auto" ? <p className="text-xs text-muted">This model will get: {MODE_LABEL[effective]}.</p> : null}

      {row.takes.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label={`Takes of ${row.cue}`}>
          {row.takes.map((t, i) => (
            <li key={t.id} className={`space-y-2 rounded-lg border px-3 py-2 ${t.starred ? "border-dutchOrange bg-warning-soft" : "border-hairline bg-info-soft"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-primary">Take {i + 1}</p>
                <Button type="button" size="xs" variant="ghost" aria-pressed={t.starred} aria-label={t.starred ? `Unstar take ${i + 1}` : `Star take ${i + 1}`} disabled={!ready || !!busy} onClick={() => onAct({ action: "star", cue: row.cue, take: t.id })}>
                  <Star className={`h-4 w-4 ${t.starred ? "fill-current text-dutchOrange" : ""}`} aria-hidden />
                </Button>
              </div>
              <audio controls preload="none" src={t.url} aria-label={`Take ${i + 1} of ${row.cue}`} className="h-9 w-full" />
              <p className="text-xs leading-relaxed text-secondary">
                {seconds(t.seconds)}
                {row.window !== null ? (over(t.seconds) ? `, longer than its subtitle (${seconds(row.window)})` : ` of ${seconds(row.window)}`) : ""}; {loud(t.lufs)}
                {t.peak !== null ? `, peak ${t.peak.toFixed(1)} dBFS` : ""}. {t.voice} ({t.model}); direction: {t.via ? MODE_LABEL[t.via].toLowerCase() : "none recorded"}.
              </p>
              <details className="text-xs text-muted">
                <summary className="cursor-pointer">What was sent</summary>
                <p className="mt-1 font-mono wrap-anywhere">{t.say}</p>
                {t.direction ? <p className="mt-1 wrap-anywhere">Instructions: {t.direction}</p> : null}
              </details>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="xs" disabled={!ready || !!busy} onClick={() => onAct({ action: "publish", cue: row.cue, take: t.id })}>
                  {busy === "publish" ? "Publishing…" : "Publish"}
                </Button>
                <Button type="button" size="xs" variant="outline" disabled={!ready || !!busy} onClick={() => onAct({ action: "discard", cue: row.cue, take: t.id })}>
                  Discard
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
