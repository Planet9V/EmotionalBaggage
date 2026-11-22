"use client";

import { RowActions } from "@/components/drafts/RowActions";
import { SectionEmpty } from "@/components/drafts/SectionEmpty";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Gavel, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api, useItems } from "@/lib/client";
import { keys, messageOf } from "@/lib/queries";
import { positioningFingerprint } from "@/lib/market/critique";
import { lineTitle, positioningLine } from "@/lib/market/positioning";
import { checkProof, positioningProofGap, PROOF_NEEDED, type ProofRow, type ProofState } from "@/lib/market/proof";
import { positioningData, type PositioningMessage, type ProofRef } from "@/lib/market/schemas";
import type { Item } from "@/lib/types";
import type { ViewProps } from "@/components/views/types";
import { ApproveButton, GeneratedLine, GenerateButton, ModelGate, Notes, Status, useGenerate, useModelStatus } from "./shared";
import { ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { describe, Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { fmtDate } from "@/lib/format";

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
    for (const i of [...claims.items, ...tests.items, ...reqs.items]) m.set(i.id, { id: i.id, section: i.section, title: i.title, status: i.status, data: i.data, key: typeof i.data.key === "string" ? i.data.key : undefined });
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
          Reads your <Link className="text-link underline" href="/s/marketing/personas">personas</Link> and <Link className="text-link underline" href="/s/marketing/competitors">competitors</Link>. Each message is linked to proof the concept already holds: a verified claim, a passing test or a requirement. A positioning cannot be approved while a message has no proof. Before you can approve it, the reviewer also attacks it once and the critique sits beside it.
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
  // the server refuses the approval for the same reason (assertMarketChange)
  const gap = positioningProofGap(d, rows);

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
                disabled={needsReview || !!gap}
                reason={!needsReview && gap ? `It cannot be approved: ${gap} ${PROOF_NEEDED}` : stale ? "The words changed after the review. Ask the reviewer again." : "Ask the reviewer to attack it once first."}
              />
              <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3.5 w-3.5" aria-hidden /> Edit</Button>
              <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Delete this positioning"><Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete</Button>
            </div>
            {gap && <p className="text-xs text-warning">{item.status === "approved" ? "This approval no longer counts towards the Marketing gate" : "It cannot be approved yet"}: {gap} {PROOF_NEEDED}</p>}
          </div>

          <aside className="space-y-3 bg-subtle p-5" aria-label="The reviewer's critique">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">The reviewer&apos;s attack</p>
            {critique ? (
              <>
                <p className="whitespace-pre-wrap text-sm text-primary">{critique.text}</p>
                <p className="text-[11px] text-muted">By {critique.model}, {fmtDate(critique.at, "short")}.</p>
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

const FOR_WHOM_ID = "positioning-for-whom";
const proofRefShape = z.object({ itemId: z.number(), section: z.string(), title: z.string().optional(), key: z.string().optional() });
const statementSchema = z
  .object({
    forWhom: z.string(),
    need: z.string(),
    productIs: z.string(),
    thatDoes: z.string(),
    unlike: z.string(),
    difference: z.string(),
    messages: z.array(z.object({ text: z.string(), proof: z.array(proofRefShape) })),
  })
  .superRefine((v, ctx) => {
    if (!v.forWhom.trim() && !v.messages.some((m) => m.text.trim())) ctx.addIssue({ code: "custom", path: ["forWhom"], message: "Fill in the line or at least one message." });
  });
type StatementValues = z.infer<typeof statementSchema>;

function StatementDialog({ item, productName, rows, onClose, onSave }: {
  item: Item | null; productName: string; rows: Item[]; onClose: () => void;
  onSave: (data: Record<string, unknown>, title: string) => Promise<void>;
}) {
  const p = positioningData.safeParse(item?.data ?? {});
  const d = p.success ? p.data : {};
  const startMessages = (): PositioningMessage[] => {
    const m = (d.messages ?? []).map((x) => ({ text: x.text, proof: x.proof }));
    while (m.length < 3) m.push({ text: "", proof: [] });
    return m;
  };
  const { register, control, handleSubmit, setValue, setError, formState: { errors, isSubmitting: busy } } = useForm<StatementValues>({
    resolver: zodResolver(statementSchema),
    defaultValues: { forWhom: d.forWhom ?? "", need: d.need ?? "", productIs: d.productIs ?? "", thatDoes: d.thatDoes ?? "", unlike: d.unlike ?? "", difference: d.difference ?? "", messages: startMessages() },
  });
  const [forWhom, need, productIs, thatDoes, unlike, difference, msgs] = useWatch({ control, name: ["forWhom", "need", "productIs", "thatDoes", "unlike", "difference", "messages"] });
  const f = { forWhom, need, productIs, thatDoes, unlike, difference };
  const options = rows.filter((r) => (r.section === "research/claims") || (r.section === "prototype/tests") || (r.section === "design/requirements"));
  const label = (r: Item) => `${r.section === "research/claims" ? "Claim" : r.section === "prototype/tests" ? "Test" : "Requirement"} (${r.status}): ${r.title.length > 70 ? `${r.title.slice(0, 70)}...` : r.title}`;

  const toggle = (n: number, r: Item) => {
    const m = msgs[n];
    const has = m.proof.some((x) => x.itemId === r.id);
    const ref: ProofRef = { itemId: r.id, section: r.section, title: r.title, ...(typeof r.data.key === "string" && r.data.key ? { key: r.data.key } : {}) };
    setValue(`messages.${n}.proof`, has ? m.proof.filter((x) => x.itemId !== r.id) : [...m.proof, ref]);
  };

  const save = handleSubmit(async (v) => {
    const messages = v.messages.filter((m) => m.text.trim()).map((m) => ({ text: m.text.trim(), proof: m.proof }));
    const line = { forWhom: v.forWhom, need: v.need, productIs: v.productIs, thatDoes: v.thatDoes, unlike: v.unlike, difference: v.difference };
    try {
      await onSave({ kind: "statement", ...line, messages }, lineTitle(positioningLine(line, productName)));
    } catch (e) {
      setError("root", { message: (e as Error).message });
    }
  });

  return (
    <Modal open wide onOpenChange={(o) => !o && onClose()} title={item ? "Edit positioning" : "Write a positioning"} description="Saving an edit puts an approved positioning back to draft and needs a new review.">
      <form className="space-y-4" noValidate onSubmit={(e) => void save(e)}>
        <p className="rounded-md bg-subtle px-3 py-2 text-sm text-secondary" aria-live="polite">{positioningLine(f, productName)}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={FOR_WHOM_ID} label="For (who)" error={errors.forWhom?.message}><Input id={FOR_WHOM_ID} {...describe(FOR_WHOM_ID, { error: errors.forWhom?.message })} {...register("forWhom")} /></Field>
          <Field label="Who need"><Input {...register("need")} /></Field>
          <Field label={`${productName} is a`}><Input {...register("productIs")} /></Field>
          <Field label="That"><Input {...register("thatDoes")} /></Field>
          <Field label="Unlike (the main alternative)"><Input {...register("unlike")} /></Field>
          <Field label={`${productName} (what is different)`}><Input {...register("difference")} /></Field>
        </div>
        {msgs.map((m, n) => (
          <fieldset key={n} className="space-y-2 rounded-lg border border-hairline p-3">
            <legend className="px-1 text-xs font-medium text-secondary">Message {n + 1}</legend>
            <Textarea rows={2} aria-label={`Message ${n + 1}`} {...register(`messages.${n}.text`)} />
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
        {errors.root?.message && <ErrorLine>{errors.root.message}</ErrorLine>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}
