"use client";

// Admin, Voice-overs: the spoken lines of the welcome film (the introduction and every cue of the six scenes), each
// with its words, who says them, the clip the public page plays, and a way to make another: choose the model, voice
// and speed for a speaker (or for one cue), generate a take with the voice set up in Admin, Voice, listen, and accept
// it (it is stored in the files store with its loudness envelope and published; the clip it replaces is kept as a
// version) or discard it. A new power: only the platform administrator changes anything here.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { LoadError, LoadingBlocks, NotSetUp } from "@/components/ui/states";
import { api } from "@/lib/http";
import { messageOf } from "@/lib/queries";
import { CAST, SPEAKER_NAME, cueOf, type Speaker } from "@/components/welcome/scenes/voiceScript";
import type { CastChoice, VoiceoverRow } from "@/lib/voice/voiceovers";

type View = {
  rows: VoiceoverRow[];
  cast: Record<string, CastChoice>;
  voice: { configured: true; provider: string; model?: string; voice?: string; speed?: number } | { configured: false; reason: string };
  canWrite: boolean;
};
type Action =
  | { action: "generate"; cue: string; say?: string; model?: string; voice?: string; speed?: number }
  | { action: "accept" | "discard"; cue: string }
  | ({ action: "cast"; speaker: Speaker } & CastChoice);

const KEY = ["admin", "voiceovers"] as const;
const SPEAKERS: Speaker[] = ["bag", "agent", "host", "stranger", "narrator"];
const seconds = (n: number) => `${n.toFixed(1)} s`;

function useVoiceovers() {
  return useQuery<View>({ queryKey: KEY, queryFn: ({ signal }) => api<View>("/api/admin/voiceovers", { signal }) });
}
function useVoiceoverAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: Action) => api<{ ok: boolean }>("/api/admin/voiceovers", { method: "POST", body: JSON.stringify(a) }),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e) => toast.error(messageOf(e)),
  });
}

export function VoiceoversTab() {
  const view = useVoiceovers();
  const act = useVoiceoverAction();
  const [batch, setBatch] = useState<{ done: number; of: number } | null>(null);
  if (view.isPending) return <LoadingBlocks rows={4} label="Reading the voice-overs" />;
  if (view.isError) return <LoadError what="The voice-overs" message={messageOf(view.error)} onRetry={() => void view.refetch()} />;
  const { rows, cast, voice, canWrite } = view.data;
  const ready = voice.configured && canWrite;
  const missing = rows.filter((r) => !r.clip && !r.take);

  // one cue at a time: the voice service speaks one piece per request, and each take is stored before the next starts
  const generateMissing = async () => {
    setBatch({ done: 0, of: missing.length });
    for (const [i, r] of missing.entries()) {
      try {
        await act.mutateAsync({ action: "generate", cue: r.cue });
      } catch {
        break;
      }
      setBatch({ done: i + 1, of: missing.length });
    }
    setBatch(null);
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Voice-overs"
        description="The spoken lines of the welcome film: an introduction and the lines of its six scenes. The public page plays the published clip of each line when a visitor turns the sound on; a line with no clip is shown as a subtitle only."
        actions={<StatusBadge tone={voice.configured ? "success" : "neutral"}>{voice.configured ? (voice.provider === "openrouter" ? "OpenRouter" : "Kokoro") : "No voice"}</StatusBadge>}
      >
        {voice.configured ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-secondary">
              {rows.filter((r) => r.clip).length} of {rows.length} lines have a published clip. Takes are made with the voice service set up in Admin, Voice{voice.model ? ` (${voice.model})` : ""}; the model, voice and speed below replace its saved ones for each speaker.
            </p>
            <Button type="button" size="sm" variant="outline" disabled={!ready || !missing.length || !!batch || act.isPending} onClick={() => void generateMissing()}>
              {batch ? `Generating ${batch.done + 1} of ${batch.of}…` : missing.length ? `Generate all missing (${missing.length})` : "Nothing is missing"}
            </Button>
          </div>
        ) : (
          <NotSetUp href="/admin?tab=voice" label="Open Admin, Voice">
            Voice is not configured. Set it in Admin, Voice. The clips already published keep playing; new takes cannot be made until a voice service is chosen.
          </NotSetUp>
        )}
      </Panel>

      <Panel title="The cast" description="One voice per speaker. A take of a line uses its speaker's voice unless the line names its own.">
        <div className="space-y-3">
          {SPEAKERS.map((s) => (
            <CastRow key={`${s}:${JSON.stringify(cast[s] ?? null)}`} speaker={s} saved={cast[s]} disabled={!canWrite || act.isPending} onSave={(c) => act.mutate({ action: "cast", speaker: s, ...c }, { onSuccess: () => toast.success(`Voice saved for ${SPEAKER_NAME[s].toLowerCase()}.`) })} />
          ))}
        </div>
      </Panel>

      <Panel title="The lines" description="Words are shown as subtitled; what is sent to the voice may be shaped with punctuation or spelling for timing, never with other words.">
        <ul className="divide-y divide-hairline">
          {rows.map((r) => (
            <CueRow key={r.cue} row={r} ready={ready && !batch} busy={act.isPending && act.variables && "cue" in act.variables && act.variables.cue === r.cue ? act.variables.action : null} onAct={(a) => act.mutate(a)} />
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function CastRow({ speaker, saved, disabled, onSave }: { speaker: Speaker; saved?: CastChoice; disabled: boolean; onSave: (c: CastChoice) => void }) {
  const first = saved ?? CAST[speaker];
  const [model, setModel] = useState(first.model);
  const [voice, setVoice] = useState(first.voice);
  const [speed, setSpeed] = useState(String(first.speed));
  const n = Number(speed);
  const valid = model.trim() && voice.trim() && n >= 0.25 && n <= 4;
  const id = `cast-${speaker}`;
  return (
    <form
      aria-label={`Voice for ${SPEAKER_NAME[speaker].toLowerCase()}`}
      className="grid items-end gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)_6rem_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave({ model: model.trim(), voice: voice.trim(), speed: n });
      }}
    >
      <p className="pb-2 text-sm font-medium text-primary">{SPEAKER_NAME[speaker]}</p>
      <Field id={`${id}-model`} label="Model">
        <Input id={`${id}-model`} spellCheck={false} value={model} onChange={(e) => setModel(e.target.value)} />
      </Field>
      <Field id={`${id}-voice`} label="Voice">
        <Input id={`${id}-voice`} spellCheck={false} value={voice} onChange={(e) => setVoice(e.target.value)} />
      </Field>
      <Field id={`${id}-speed`} label="Speed">
        <Input id={`${id}-speed`} inputMode="decimal" value={speed} onChange={(e) => setSpeed(e.target.value)} />
      </Field>
      <Button type="submit" size="sm" variant="outline" disabled={disabled || !valid}>
        {saved ? "Save" : "Use this voice"}
      </Button>
    </form>
  );
}

function CueRow({ row, ready, busy, onAct }: { row: VoiceoverRow; ready: boolean; busy: string | null; onAct: (a: Action) => void }) {
  const [say, setSay] = useState(row.take?.say ?? row.clip?.say ?? row.say);
  const [voice, setVoice] = useState("");
  const [speed, setSpeed] = useState("");
  const n = Number(speed);
  const speedOk = speed.trim() === "" || (n >= 0.25 && n <= 4);
  const id = `cue-${row.cue}`;
  const direction = cueOf(row.cue)?.direction;
  const over = (s: number) => (row.window !== null && s > row.window ? ` Longer than its subtitle, which has ${seconds(row.window)}.` : "");
  return (
    <li className="space-y-3 py-4 first:pt-0 last:pb-0" data-testid={`cue-${row.cue}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <StatusBadge tone={row.clip ? "success" : "neutral"}>{row.clip ? "Published" : "No clip"}</StatusBadge>
        <p className="font-mono text-xs text-muted">{row.cue}</p>
        <p className="text-xs font-medium text-secondary">{SPEAKER_NAME[row.speaker]}</p>
        {row.window !== null ? <p className="text-xs text-muted">subtitle: {seconds(row.window)}</p> : null}
      </div>
      <p className="max-w-[80ch] text-sm text-primary">&ldquo;{row.text}&rdquo;</p>
      {direction ? (
        <p className="max-w-[80ch] text-xs leading-relaxed text-muted">
          {direction.delivery} {direction.pause}
        </p>
      ) : null}
      {row.clip ? (
        <div className="flex flex-wrap items-center gap-3">
          <audio controls preload="none" src={row.clip.url} aria-label={`Published clip of ${row.cue}`} className="h-9 max-w-full" />
          <p className="text-xs text-secondary">
            {row.clip.voice}, {seconds(row.clip.seconds)}, {row.clip.seeded ? "came with the example" : `accepted by ${row.clip.by}`}
            {row.versions ? `; ${row.versions} earlier version${row.versions === 1 ? "" : "s"} kept` : ""}.{over(row.clip.seconds)}
          </p>
        </div>
      ) : null}
      {row.take ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-info-soft px-3 py-2">
          <audio controls preload="none" src={row.take.url} aria-label={`Take of ${row.cue}`} className="h-9 max-w-full" />
          <p className="text-xs text-info">
            A take, not published: {row.take.voice}, {seconds(row.take.seconds)}.{over(row.take.seconds)}
          </p>
          <Button type="button" size="sm" disabled={!ready || !!busy} onClick={() => onAct({ action: "accept", cue: row.cue })}>
            {busy === "accept" ? "Publishing…" : "Accept and publish"}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={!ready || !!busy} onClick={() => onAct({ action: "discard", cue: row.cue })}>
            {busy === "discard" ? "Discarding…" : "Discard"}
          </Button>
        </div>
      ) : null}
      <div className="grid items-end gap-2 md:grid-cols-[minmax(0,1fr)_10rem_6rem_auto]">
        <Field id={`${id}-say`} label="Sent to the voice">
          <Textarea id={`${id}-say`} rows={row.speaker === "narrator" ? 4 : 1} value={say} onChange={(e) => setSay(e.target.value)} className="min-h-9" />
        </Field>
        <Field id={`${id}-voice`} label="Voice for this line">
          <Input id={`${id}-voice`} spellCheck={false} placeholder="the speaker's" value={voice} onChange={(e) => setVoice(e.target.value)} />
        </Field>
        <Field id={`${id}-speed`} label="Speed">
          <Input id={`${id}-speed`} inputMode="decimal" placeholder="the speaker's" value={speed} onChange={(e) => setSpeed(e.target.value)} aria-invalid={!speedOk || undefined} />
        </Field>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!ready || !!busy || !say.trim() || !speedOk}
          onClick={() => onAct({ action: "generate", cue: row.cue, say: say.trim(), ...(voice.trim() ? { voice: voice.trim() } : {}), ...(speed.trim() ? { speed: n } : {}) })}
        >
          {busy === "generate" ? "Generating…" : row.take ? "Generate another take" : "Generate a take"}
        </Button>
      </div>
    </li>
  );
}
