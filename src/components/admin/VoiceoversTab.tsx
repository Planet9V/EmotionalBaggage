"use client";

// Admin, Voice-overs: directing and recording the spoken lines of the welcome film (the introduction and every cue
// of the six scenes). Per cue: the subtitle (never changed), its direction as a voice director's note and as bracket
// cues, a model and voice from the configured service's live list, N takes at once with the direction sent the way
// that model takes it, the takes side by side with their length and loudness, a star, and Publish (stored in the files
// store with its loudness envelope; the clip it replaces is kept as a version). Per speaker: the default model, voice
// and the character note. "Generate takes for every cue" shows its cost first. A new power: only the platform
// administrator changes anything here.
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { LoadError, LoadingBlocks, NotSetUp } from "@/components/ui/states";
import { messageOf } from "@/lib/queries";
import { KOKORO_NOTE } from "@/lib/voice/direction";
import type { Estimate } from "@/lib/voice/takes";
import { CastPanel } from "./voiceovers/CastPanel";
import { CueCard } from "./voiceovers/CueCard";
import { PackDirections } from "./voiceovers/PackDirections";
import { estimate, useSpeechModels, useVoiceoverAction, useVoiceovers, type Action } from "./voiceovers/useVoiceovers";

const dollars = (n: number) => (n < 0.01 ? "under $0.01" : `about $${n.toFixed(2)}`);

export function VoiceoversTab() {
  const view = useVoiceovers();
  const act = useVoiceoverAction();
  const ready = !!view.data?.voice.configured && !!view.data?.canWrite;
  const models = useSpeechModels(ready);
  const [batch, setBatch] = useState<{ done: number; of: number } | null>(null);
  const [plan, setPlan] = useState<(Estimate & { count: number }) | null>(null);
  const [count, setCount] = useState("3");
  if (view.isPending) return <LoadingBlocks rows={4} label="Reading the voice-overs" />;
  if (view.isError) return <LoadError what="The voice-overs" message={messageOf(view.error)} onRetry={() => void view.refetch()} />;
  const { rows, cast, notes, voice, canWrite } = view.data;
  const provider = voice.configured ? voice.provider : null;
  const n = Number(count);
  const countOk = Number.isInteger(n) && n >= 1 && n <= 6;

  const run = (a: Action, done?: () => void) => act.mutate(a, { onSuccess: () => done?.() });
  const askCost = async () => {
    try {
      setPlan({ ...(await estimate(n)), count: n });
    } catch (e) {
      toast.error(messageOf(e));
    }
  };
  // one cue at a time: the voice service speaks one piece per request, and each cue's takes are stored before the next
  const generateAll = async (takes: number) => {
    setPlan(null);
    setBatch({ done: 0, of: rows.length });
    for (const [i, r] of rows.entries()) {
      try {
        await act.mutateAsync({ action: "generate", cue: r.cue, count: takes });
      } catch {
        break;
      }
      setBatch({ done: i + 1, of: rows.length });
    }
    setBatch(null);
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Voice-overs"
        description="The spoken lines of the welcome film: an introduction and the lines of its six scenes. Each line is directed like an actor's: the words stay as subtitled, and the performance (pauses, stress, attitude) is sent to the model as a direction. The public page plays the published clip of each line when a visitor turns the sound on."
        actions={<StatusBadge tone={voice.configured ? "success" : "neutral"}>{voice.configured ? (voice.provider === "openrouter" ? "OpenRouter" : "Kokoro") : "No voice"}</StatusBadge>}
      >
        {voice.configured ? (
          <div className="space-y-3">
            <p className="text-sm text-secondary">
              {rows.filter((r) => r.clip).length} of {rows.length} lines have a published clip. Takes are made with the voice service set up in Admin, Voice{voice.model ? ` (${voice.model})` : ""}.
              {voice.provider === "kokoro" ? <span className="font-medium text-warning"> Kokoro: {KOKORO_NOTE.toLowerCase()} It cannot act a direction, so its takes are timing drafts.</span> : null}
            </p>
            {models.data && !models.data.ok ? <p className="text-xs text-warning">{models.data.reason} Models and voices can be typed.</p> : null}
            <p className="text-sm font-medium text-primary">Length and loudness help you compare takes; whether a take is funny is for your ear alone.</p>
            <p className="text-xs text-muted">The words of a take are not checked here: the app has no speech recogniser, so listen that every word is there and that no [cue] is read aloud.</p>
            <div className="flex flex-wrap items-end gap-2">
              <Field id="vo-all-count" label="Takes per line">
                <Input id="vo-all-count" className="w-20" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} aria-invalid={!countOk || undefined} />
              </Field>
              <Button type="button" size="sm" variant="outline" disabled={!ready || !!batch || act.isPending || !countOk} onClick={() => void askCost()}>
                {batch ? `Generating ${Math.min(batch.done + 1, batch.of)} of ${batch.of}…` : "Generate takes for every line…"}
              </Button>
            </div>
          </div>
        ) : (
          <NotSetUp href="/admin?tab=voice" label="Open Admin, Voice">
            Voice is not configured. Set it in Admin, Voice. The clips already published keep playing; new takes cannot be made until a voice service is chosen.
          </NotSetUp>
        )}
      </Panel>

      <Modal open={!!plan} onOpenChange={(o) => !o && setPlan(null)} title="Generate takes for every line" description="Nothing has been generated yet.">
        {plan ? (
          <div className="space-y-3 text-sm text-secondary">
            <p>
              {plan.takes} takes ({plan.count} for each of {plan.lines.length} lines), about {plan.characters.toLocaleString("en")} characters sent with their directions.
            </p>
            <p className="font-medium text-primary">Cost: {plan.cost === null ? "unknown: the service does not list a price per character for every model chosen." : dollars(plan.cost)}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setPlan(null)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={() => void generateAll(plan.count)}>
                Generate {plan.takes} takes
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <CastPanel cast={cast} notes={notes} catalog={models.data} disabled={!canWrite || act.isPending} onAct={run} />

      <Panel title="The lines" description="The words are the subtitle, word for word. Edit the direction and the bracket cues, generate takes, listen side by side, star the best and publish it.">
        <ul className="divide-y divide-hairline">
          {rows.map((r) => (
            <CueCard
              key={`${r.cue}:${r.direction.length}:${r.inlineTags}`}
              row={r}
              catalog={models.data}
              provider={provider}
              ready={ready && !batch}
              busy={act.isPending && act.variables && "cue" in act.variables && act.variables.cue === r.cue ? act.variables.action : null}
              onAct={(a) => run(a)}
            />
          ))}
        </ul>
      </Panel>

      <PackDirections />
    </div>
  );
}
