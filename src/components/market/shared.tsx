"use client";

// Pieces every marketing view shares: calling a generator, the "not connected" gate,
// the "generated from" line, the status and approval controls, and a loading block.
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NotConnected } from "@/components/wizard/shared";
import { api } from "@/lib/client";
import { keys, messageOf, queries } from "@/lib/queries";
import { statusTone } from "@/lib/statusTones";
import type { GeneratorId } from "@/lib/market/generators";
import type { GeneratedFrom } from "@/lib/market/schemas";
import type { Item } from "@/lib/types";

export type GenerateBody = {
  generator: GeneratorId;
  researchId?: number;
  text?: string;
  count?: number;
  note?: string;
  kind?: "Name" | "Tagline";
};
export type GenerateResult = { items: Item[]; notes: string[]; model: string };

/** Runs one generator; the new drafts appear in every list of the concept when it finishes. */
export function useGenerate(projectId: string) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState<string[]>([]);
  const m = useMutation({
    mutationFn: (b: GenerateBody) =>
      api<GenerateResult>(`/api/projects/${encodeURIComponent(projectId)}/market/generate`, { method: "POST", body: JSON.stringify(b) }),
    onMutate: () => setNotes([]),
    onSuccess: (r) => setNotes(r.notes),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: keys.itemsOf(projectId) }), qc.invalidateQueries({ queryKey: keys.events(projectId) })]),
  });
  return { run: m.mutateAsync, pending: m.isPending, error: messageOf(m.error), notes, reset: () => { m.reset(); setNotes([]); } };
}

/** Whether a reasoning model is chosen in Admin. Read from the reviewer's state, which already reports it. */
export function useModelStatus(projectId: string) {
  const q = useQuery(queries.challenge(projectId));
  return { configured: q.data?.configured ?? null, model: q.data?.model ?? "" };
}

export function ModelGate({ what }: { what: string }) {
  return (
    <NotConnected
      title="No AI model is connected"
      does={`${what} The assistant writes a draft from what is already in this concept; you edit it and approve it.`}
      needs="It needs a reasoning model, served by Ollama, LM Studio or OpenRouter. Choose one in Admin, Models."
    />
  );
}

export function GeneratedLine({ from }: { from: unknown }) {
  const g = from as Partial<GeneratedFrom> | undefined;
  if (!g || typeof g !== "object" || !g.model) return null;
  const when = g.at ? new Date(g.at) : null;
  const sources = Array.isArray(g.sources) ? g.sources : [];
  return (
    <p className="text-[11px] leading-snug text-muted">
      Draft by {g.model}
      {when && !Number.isNaN(when.getTime()) ? `, ${when.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
      {sources.length ? `, from: ${sources.slice(0, 6).map((s) => `${s.kind} "${s.title.length > 40 ? `${s.title.slice(0, 40)}...` : s.title}"`).join("; ")}${sources.length > 6 ? ` and ${sources.length - 6} more` : ""}` : ""}.
    </p>
  );
}

export const Notes = ({ notes }: { notes: string[] }) =>
  notes.length ? (
    <div role="status" className="rounded-md border border-hairline bg-subtle px-3 py-2 text-xs text-secondary">
      <p className="font-medium text-primary">Left out of the draft:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {notes.map((n, i) => <li key={i}>{n}</li>)}
      </ul>
    </div>
  ) : null;

export function Status({ status }: { status: string }) {
  return <StatusBadge tone={status === "approved" ? "success" : status === "draft" ? "warning" : statusTone(status)}>{status}</StatusBadge>;
}

/** Draft becomes approved on the user's click only; approved can go back to draft. */
export function ApproveButton({ item, onSet, disabled, reason }: { item: Item; onSet: (status: "approved" | "draft") => Promise<unknown>; disabled?: boolean; reason?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const approved = item.status === "approved";
  const go = async () => {
    setBusy(true);
    setErr("");
    try {
      await onSet(approved ? "draft" : "approved");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button size="sm" variant={approved ? "outline" : "primary"} onClick={go} disabled={busy || (!approved && disabled)} title={!approved && disabled ? reason : undefined}>
        {approved ? <RotateCcw className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
        {approved ? "Back to draft" : "Approve"}
      </Button>
      {err && <span role="alert" className="max-w-xs text-xs text-danger">{err}</span>}
    </span>
  );
}

export function GenerateButton({ children, pending, onClick, disabled }: { children: ReactNode; pending: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <Button onClick={onClick} disabled={pending || disabled} aria-busy={pending}>
      <Sparkles className="h-4 w-4" aria-hidden /> {pending ? "Drafting. This can take a minute." : children}
    </Button>
  );
}

export const FieldRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{label}</dt>
    <dd className="mt-0.5 text-sm text-primary">{children || <span className="text-muted">Not filled in</span>}</dd>
  </div>
);

