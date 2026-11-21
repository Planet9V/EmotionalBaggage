"use client";

import { RowActions } from "@/components/drafts/RowActions";
import { SectionEmpty } from "@/components/drafts/SectionEmpty";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Gavel, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, useItems } from "@/lib/client";
import { keys, messageOf } from "@/lib/queries";
import { positioningFingerprint } from "@/lib/market/critique";
import { lineTitle, positioningLine } from "@/lib/market/positioning";
import { checkProof, type ProofRow, type ProofState } from "@/lib/market/proof";
import { positioningData, type PositioningMessage, type ProofRef } from "@/lib/market/schemas";
import type { Item } from "@/lib/types";
import type { ViewProps } from "@/components/views/types";
import { ApproveButton, GeneratedLine, GenerateButton, ModelGate, Notes, Status, useGenerate, useModelStatus } from "./shared";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";

const STATE_TONE: Record<ProofState, "success" | "info" | "warning" | "danger"> = {
  "verified claim": "success",
  "passing test": "success",
  requirement: "info",
  "unverified claim": "warning",
  "test not passing": "warning",
  missing: "danger",
};

const isStatement = (i: Item) => i.data.kind === "statement";

export function PositioningView({ project, store }: ViewProps) {
  const { items, loading, error, reload, add, patch, remove } = useItems(project.id, store);
  const claims = useItems(project.id, "research/claims");
  const tests = useItems(project.id, "prototype/tests");
  const reqs = useItems(project.id, "design/requirements");
  const personas = useItems(project.id, "marketing/personas");
  const competitors = useItems(project.id, "marketing/competitors");
  const gen = useGenerate(project.id);
  const model = useModelStatus(project.id);
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [actionError, setActionError] = useState("");

  const rows = useMemo(() => {
    const m = new Map<number, ProofRow>();
    for (const i of [...claims.items, ...tests.items, ...reqs.items]) m.set(i.id, { id: i.id, section: i.section, title: i.title, status: i.status, key: typeof i.data.key === "string" ? i.data.key : undefined });
    return m;
  }, [claims.items, tests.items, reqs.items]);

  if (loading) return <LoadingBlocks label="Loading positioning" />;
  if (error && !items.length) return <LoadError what="Positioning" message={error} onRetry={() => void reload()} />;

  const statements = items.filter(isStatement);
  const notes = items.filter((i) => !isStatement(i));
  const lacks = !personas.items.length ? "Draft or add a persona first (Personas)." : !competitors.items.length ? "Add a competitor or an alternative first (Competitors)." : "";

  const draft = async () => {
    try { await gen.run({ generator: "positioning" }); } catch { /* shown from gen.error */ }
  };

  return (
    <div className="space-y-5">
      {model.configured === false && <ModelGate what="Positioning is drafted from your personas and competitors." />}

      <Card variant="outlined" hoverEffect={false} innerClassName="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-primary">Draft the positioning</h2>
        <p className="text-sm text-secondary">
          Reads your <Link className="text-link underline" href="/s/marketing/personas">personas</Link> and <Link className="text-link underline" href="/s/marketing/competitors">competitors</Link>. Each message is linked to proof the concept already holds: a verified claim, a passing test or a requirement. A message with no proof is flagged. Before you can approve it, the reviewer attacks it once and the critique sits beside it.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <GenerateButton pending={gen.pending} onClick={() => void draft()} disabled={model.configured === false || !!lacks}>Draft positioning</GenerateButton>
          <Button variant="outline" onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden /> Write by hand</Button>
          {lacks && <span className="text-xs text-muted">{lacks}</span>}
        </div>
        {gen.error && <ErrorLine>{gen.error}</ErrorLine>}
        <Notes notes={gen.notes} />
      </Card>

      {(actionError || error) && <ErrorLine>{actionError || error}</ErrorLine>}

      {!statements.length ? (
        <SectionEmpty projectId={project.id} store="marketing/positioning" sectionLabel="Positioning" title="No positioning yet">Every ad, post and landing page is tied to one of these messages, so nothing can be drafted for buyers until one is approved.</SectionEmpty>
      ) : (
        <ul className="space-y-5" aria-label="Positioning statements">
          {statements.map((it) => (
            <StatementCard
              key={it.id}
              item={it}
              productName={project.name}
              projectId={project.id}
              rows={rows}
              modelOn={model.configured !== false}
              onApprove={(status) => patch(it.id, { status })}
              onEdit={() => setEditing(it)}
              onDelete={async () => { setActionError(""); try { await remove(it.id); } catch (e) { setActionError((e as Error).message); } }}
            />
          ))}
        </ul>
      )}

      {notes.length > 0 && (
        <details className="rounded-xl border border-hairline bg-surface px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-primary">Earlier notes ({notes.length})</summary>
          <ul className="mt-3 space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="text-sm text-secondary"><span className="font-medium text-primary">{n.title}</span>{n.body ? `: ${n.body}` : ""}</li>
            ))}
          </ul>
        </details>
      )}

      {editing && (
        <StatementDialog
          key={editing === "new" ? "new" : editing.id}
          item={editing === "new" ? null : editing}
          productName={project.name}
          rows={[...claims.items, ...tests.items, ...reqs.items]}
          onClose={() => setEditing(null)}
          onSave={async (data, title) => {
            if (editing === "new") await add({ section: store, title, data, status: "draft" });
            // An edit puts an approved positioning back to draft: the review no longer matches the words.
            else await patch(editing.id, { title, data, ...(editing.status === "approved" ? { status: "draft" } : {}) });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function StatementCard({ item, productName, projectId, rows, modelOn, onApprove, onEdit, onDelete }: {
  item: Item; productName: string; projectId: string; rows: Map<number, ProofRow>; modelOn: boolean;
  onApprove: (s: "approved" | "draft") => Promise<unknown>; onEdit: () => void; onDelete: () => void;
}) {
  const qc = useQueryClient();
  const parsed = positioningData.safeParse(item.data);
  const d = parsed.success ? parsed.data : {};
  const proof = useMemo(() => checkProof(d.messages ?? [], rows), [d.messages, rows]);
  const critique = d.critique;
  const stale = !!critique?.fingerprint && critique.fingerprint !== positioningFingerprint(item.data);
  const critiqueM = useMutation({
    mutationFn: () => api<{ item: Item }>(`/api/projects/${encodeURIComponent(projectId)}/market/critique`, { method: "POST", body: JSON.stringify({ itemId: item.id }) }),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: keys.itemsOf(projectId) }), qc.invalidateQueries({ queryKey: keys.events(projectId) })]),
  });
  const needsReview = !critique || stale;
  const unproven = proof.filter((p) => !p.hasProof).length;

  return (
    <li id={`positioning-${item.id}`} tabIndex={-1} className="scroll-mt-24">
      <Card variant="outlined" hoverEffect={false} innerClassName="p-0">
        <div className="grid divide-hairline lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:divide-x">
          <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Positioning line</p>
              <div className="flex items-center gap-1"><Status status={item.status} /><RowActions item={item} /></div>
            </div>
            <p className="text-lg font-semibold leading-snug tracking-tight text-primary">{positioningLine(d, productName)}</p>
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Supporting messages and their proof</h3>
              <ol className="mt-2 space-y-3">
                {proof.map((p, i) => (
                  <Card variant="flat" as="li" key={i} className="rounded-lg p-3">
                    <p className="text-sm font-medium text-primary">{p.message.text}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {p.links.map((l) => (
                        <span key={l.ref.itemId} className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2 py-0.5 text-xs text-secondary">
                          <StatusBadge tone={STATE_TONE[l.state]} className="px-1.5 text-[10px]">{l.state}</StatusBadge>
                          {l.ref.key ? <span className="font-mono">{l.ref.key}</span> : null}
                          <span className="max-w-56 truncate">{l.ref.title ?? `item ${l.ref.itemId}`}</span>
                        </span>
                      ))}
                      {!p.hasProof && <StatusBadge tone="danger">No proof: link a verified claim, a passing test or a requirement</StatusBadge>}
                      {p.hasProof && p.onlyRequirement && <StatusBadge tone="warning">Only a requirement: stated, not yet shown</StatusBadge>}
                    </div>
                  </Card>
                ))}
                {!proof.length && <li className="text-sm text-muted">No supporting messages yet. Edit to add up to three.</li>}
              </ol>
            </div>
            <GeneratedLine from={d.generatedFrom} />
            <div className="flex flex-wrap items-start gap-2 border-t border-hairline pt-3">
              <ApproveButton
                item={item}
                onSet={onApprove}
                disabled={needsReview}
                reason={stale ? "The words changed after the review. Ask the reviewer again." : "Ask the reviewer to attack it once first."}
              />
              <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3.5 w-3.5" aria-hidden /> Edit</Button>
              <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Delete this positioning"><Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete</Button>
            </div>
            {unproven > 0 && item.status !== "approved" && <p className="text-xs text-warning">{unproven} of {proof.length} message{proof.length === 1 ? " has" : "s have"} no proof. You can still approve, knowing that.</p>}
          </div>

          <aside className="space-y-3 bg-subtle p-5" aria-label="The reviewer's critique">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">The reviewer&apos;s attack</p>
            {critique ? (
              <>
                <p className="whitespace-pre-wrap text-sm text-primary">{critique.text}</p>
                <p className="text-[11px] text-muted">By {critique.model}, {new Date(critique.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.</p>
                {stale && <p role="status" className="text-xs text-warning">The words changed after this review. Ask again before approving.</p>}
              </>
            ) : (
              <p className="text-sm text-secondary">Not reviewed yet. The same reviewer that challenges the concept will attack this once. Approval waits for it.</p>
            )}
            <Button size="sm" variant={needsReview ? "primary" : "outline"} onClick={() => critiqueM.mutate()} disabled={critiqueM.isPending || !modelOn} aria-busy={critiqueM.isPending}>
              <Gavel className="h-3.5 w-3.5" aria-hidden /> {critiqueM.isPending ? "Reviewing" : critique ? "Ask again" : "Ask the reviewer to attack it"}
            </Button>
            {critiqueM.error && <ErrorLine>{messageOf(critiqueM.error)}</ErrorLine>}
          </aside>
        </div>
      </Card>
    </li>
  );
}

function StatementDialog({ item, productName, rows, onClose, onSave }: {
  item: Item | null; productName: string; rows: Item[]; onClose: () => void;
  onSave: (data: Record<string, unknown>, title: string) => Promise<void>;
}) {
  const p = positioningData.safeParse(item?.data ?? {});
  const d = p.success ? p.data : {};
  const [f, setF] = useState({ forWhom: d.forWhom ?? "", need: d.need ?? "", productIs: d.productIs ?? "", thatDoes: d.thatDoes ?? "", unlike: d.unlike ?? "", difference: d.difference ?? "" });
  const [msgs, setMsgs] = useState<PositioningMessage[]>(() => {
    const m = (d.messages ?? []).map((x) => ({ text: x.text, proof: x.proof }));
    while (m.length < 3) m.push({ text: "", proof: [] });
    return m;
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const options = rows.filter((r) => (r.section === "research/claims") || (r.section === "prototype/tests") || (r.section === "design/requirements"));
  const label = (r: Item) => `${r.section === "research/claims" ? "Claim" : r.section === "prototype/tests" ? "Test" : "Requirement"} (${r.status}): ${r.title.length > 70 ? `${r.title.slice(0, 70)}...` : r.title}`;

  const toggle = (n: number, r: Item) =>
    setMsgs((all) => all.map((m, i) => {
      if (i !== n) return m;
      const has = m.proof.some((x) => x.itemId === r.id);
      const ref: ProofRef = { itemId: r.id, section: r.section, title: r.title, ...(typeof r.data.key === "string" && r.data.key ? { key: r.data.key } : {}) };
      return { ...m, proof: has ? m.proof.filter((x) => x.itemId !== r.id) : [...m.proof, ref] };
    }));

  const save = async () => {
    const messages = msgs.filter((m) => m.text.trim()).map((m) => ({ text: m.text.trim(), proof: m.proof }));
    if (!f.forWhom.trim() && !messages.length) return setErr("Fill in the line or at least one message.");
    setBusy(true);
    setErr("");
    try {
      await onSave({ kind: "statement", ...f, messages }, lineTitle(positioningLine(f, productName)));
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal open wide onOpenChange={(o) => !o && onClose()} title={item ? "Edit positioning" : "Write a positioning"} description="Saving an edit puts an approved positioning back to draft and needs a new review.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className="rounded-md bg-subtle px-3 py-2 text-sm text-secondary" aria-live="polite">{positioningLine(f, productName)}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="For (who)"><Input value={f.forWhom} onChange={(e) => setF({ ...f, forWhom: e.target.value })} /></Field>
          <Field label="Who need"><Input value={f.need} onChange={(e) => setF({ ...f, need: e.target.value })} /></Field>
          <Field label={`${productName} is a`}><Input value={f.productIs} onChange={(e) => setF({ ...f, productIs: e.target.value })} /></Field>
          <Field label="That"><Input value={f.thatDoes} onChange={(e) => setF({ ...f, thatDoes: e.target.value })} /></Field>
          <Field label="Unlike (the main alternative)"><Input value={f.unlike} onChange={(e) => setF({ ...f, unlike: e.target.value })} /></Field>
          <Field label={`${productName} (what is different)`}><Input value={f.difference} onChange={(e) => setF({ ...f, difference: e.target.value })} /></Field>
        </div>
        {msgs.map((m, n) => (
          <fieldset key={n} className="space-y-2 rounded-lg border border-hairline p-3">
            <legend className="px-1 text-xs font-medium text-secondary">Message {n + 1}</legend>
            <Textarea rows={2} aria-label={`Message ${n + 1}`} value={m.text} onChange={(e) => setMsgs((all) => all.map((x, i) => (i === n ? { ...x, text: e.target.value } : x)))} />
            <p className="text-[11px] text-muted">Proof: tick what backs this message.</p>
            <div className="max-h-36 space-y-1 overflow-y-auto">
              {options.length === 0 && <p className="text-xs text-muted">The concept has no claims, tests or requirements to link yet.</p>}
              {options.map((r) => (
                <label key={r.id} className="flex items-start gap-2 text-xs text-secondary">
                  <input type="checkbox" className="mt-0.5" checked={m.proof.some((x) => x.itemId === r.id)} onChange={() => toggle(n, r)} />
                  <span>{label(r)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {err && <ErrorLine>{err}</ErrorLine>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}
