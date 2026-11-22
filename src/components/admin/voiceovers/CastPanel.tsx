"use client";

// Per speaker: the default model, voice and speed of their takes, and the character note put in front of every one
// of their directions (the bag's note applies to all her lines).
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { CAST, SPEAKER_NAME, type Speaker } from "@/components/welcome/scenes/voiceScript";
import type { Catalog } from "@/lib/voice/catalog";
import type { CastChoice } from "@/lib/voice/voiceovers";
import { ModelFacts, ModelPicker } from "./ModelPicker";
import type { Action } from "./useVoiceovers";

const SPEAKERS: Speaker[] = ["bag", "agent", "host", "stranger", "narrator"];

export function CastPanel({ cast, notes, catalog, disabled, onAct }: { cast: Record<string, CastChoice>; notes: Record<Speaker, string>; catalog: Catalog | undefined; disabled: boolean; onAct: (a: Action, done?: () => void) => void }) {
  return (
    <Panel title="The cast" description="Each speaker's default model, voice and speed, and the character note sent in front of every one of their directions. A take of a line uses its speaker's choice unless the line names its own.">
      <div className="divide-y divide-hairline">
        {SPEAKERS.map((s) => (
          <CastRow key={`${s}:${JSON.stringify(cast[s] ?? null)}:${notes[s]}`} speaker={s} saved={cast[s]} note={notes[s]} catalog={catalog} disabled={disabled} onAct={onAct} />
        ))}
      </div>
    </Panel>
  );
}

function CastRow({ speaker, saved, note, catalog, disabled, onAct }: { speaker: Speaker; saved?: CastChoice; note: string; catalog: Catalog | undefined; disabled: boolean; onAct: (a: Action, done?: () => void) => void }) {
  const first = saved ?? CAST[speaker];
  const [model, setModel] = useState(first.model);
  const [voice, setVoice] = useState(first.voice);
  const [speed, setSpeed] = useState(String(first.speed));
  const [prefix, setPrefix] = useState(note);
  const n = Number(speed);
  const valid = model.trim() && voice.trim() && n >= 0.25 && n <= 4;
  const id = `cast-${speaker}`;
  const facts = catalog?.ok ? catalog.models.find((m) => m.id === model) : undefined;
  return (
    <form
      aria-label={`Voice for ${SPEAKER_NAME[speaker].toLowerCase()}`}
      className="space-y-2 py-3 first:pt-0 last:pb-0"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onAct({ action: "cast", speaker, model: model.trim(), voice: voice.trim(), speed: n, prefix: prefix.trim() }, () => toast.success(`Saved for ${SPEAKER_NAME[speaker].toLowerCase()}.`));
      }}
    >
      <div className="grid items-end gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)_6rem_auto]">
        <p className="pb-2 text-sm font-medium text-primary">{SPEAKER_NAME[speaker]}</p>
        <ModelPicker id={id} catalog={catalog} model={model} voice={voice} onModel={setModel} onVoice={setVoice} />
        <Field id={`${id}-speed`} label="Speed">
          <Input id={`${id}-speed`} inputMode="decimal" value={speed} onChange={(e) => setSpeed(e.target.value)} />
        </Field>
        <Button type="submit" size="sm" variant="outline" disabled={disabled || !valid}>
          {saved ? "Save" : "Use this"}
        </Button>
      </div>
      <ModelFacts model={facts} />
      <Field id={`${id}-prefix`} label="Character note (in front of every direction of this speaker)">
        <Textarea id={`${id}-prefix`} rows={2} value={prefix} onChange={(e) => setPrefix(e.target.value)} className="text-xs" />
      </Field>
    </form>
  );
}
