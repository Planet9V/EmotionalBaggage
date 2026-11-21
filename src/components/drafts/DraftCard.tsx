"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { storeHref, type Draft } from "@/lib/ai/drafts/shared";
import type { Item } from "@/lib/types";
import { messageOf } from "@/lib/queries";
import { useDraftActions } from "./api";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/Card";

/** Fields the card does not offer as text boxes: shapes and positions edited in their own views. */
const STRUCTURED = new Set(["geometry", "schematic", "pinRoles", "options"]);

const show = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") || "(empty)";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

const editable = (v: unknown) => typeof v === "string" || typeof v === "number" || (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number"));

/** One line per changed field, for a draft that would replace a row. */
export function changes(before: Item, d: Draft): { field: string; was: string; now: string }[] {
  const out: { field: string; was: string; now: string }[] = [];
  if (before.title !== d.title) out.push({ field: "Title", was: before.title, now: d.title });
  if (before.body !== d.body) out.push({ field: "Details", was: before.body || "(empty)", now: d.body || "(empty)" });
  const keys = new Set([...Object.keys(before.data ?? {}), ...Object.keys(d.data ?? {})]);
  for (const k of keys) {
    const a = show(before.data?.[k]);
    const b = show(d.data?.[k]);
    if (a !== b) out.push({ field: k, was: a, now: b });
  }
  return out;
}

function pinsText(d: Draft) {
  const pins = Array.isArray(d.data.pins) ? (d.data.pins as string[]) : [];
  const roles = (d.data.pinRoles ?? {}) as Record<string, string>;
  return pins.map((p) => (roles[p] ? `${p} (${roles[p]})` : p)).join(", ");
}

export function DraftCard({ draft, current, decided }: { draft: Draft; current?: Item | null; decided?: boolean }) {
  const base = useId();
  const { approve, reject, edit } = useDraftActions(draft.projectId);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const [fields, setFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(draft.data).filter(([k, v]) => !STRUCTURED.has(k) && editable(v)).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v)]))
  );
  const [error, setError] = useState("");
  const busy = approve.isPending || reject.isPending || edit.isPending;
  const op = draft.op.op;
  const missing = (op === "replace" || op === "remove") && draft.status === "draft" && current === null;

  const save = async () => {
    setError("");
    const data: Record<string, unknown> = { ...draft.data };
    for (const [k, text] of Object.entries(fields)) {
      const was = draft.data[k];
      data[k] = Array.isArray(was) ? text.split(",").map((s) => s.trim()).filter(Boolean) : typeof was === "number" && text.trim() !== "" && Number.isFinite(Number(text)) ? Number(text) : text;
    }
    try {
      await edit.mutateAsync({ id: draft.id, title, body, data });
      setEditing(false);
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const decide = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const diff = op === "replace" && current ? changes(current, draft) : [];
  // A wire reads as "BT1.+ to U1.VCC" rather than four separate fields.
  const wire = typeof draft.data.from === "string" && typeof draft.data.to === "string" && draft.data.from && draft.data.to ? `${draft.data.from}.${draft.data.fromPin ?? ""} to ${draft.data.to}.${draft.data.toPin ?? ""}` : "";
  const WIRE_FIELDS = new Set(["from", "fromPin", "to", "toPin"]);
  const fieldList = Object.entries(draft.data)
    .filter(([k, v]) => !STRUCTURED.has(k) && k !== "pins" && !(wire && WIRE_FIELDS.has(k)) && v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))
    .sort(([a], [b]) => a.localeCompare(b));
  const size = (draft.data.geometry as { size?: number[] } | undefined)?.size;

  return (
    <Card variant="flat" as="article" aria-labelledby={`${base}-t`} className="p-4" data-draft={draft.id}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {op !== "add" && <StatusBadge tone={op === "remove" ? "danger" : "info"}>{op === "remove" ? "Removes a row" : "Changes a row"}</StatusBadge>}
            {draft.status !== "draft" && <StatusBadge tone={draft.status === "approved" ? "success" : "neutral"}>{draft.status}{draft.reason ? `: ${draft.reason}` : ""}</StatusBadge>}
            {draft.data.noProof === true && draft.status === "draft" && <StatusBadge tone="warning">No proof: cannot be approved yet</StatusBadge>}
            <span className="font-mono text-[10px] text-muted">{draft.model}</span>
          </div>
          {editing ? (
            <div className="mt-2">
              <label htmlFor={`${base}-title`} className="text-xs font-medium text-primary">Title</label>
              <Input id={`${base}-title`} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
          ) : (
            <h3 id={`${base}-t`} className="mt-1.5 text-sm font-semibold text-primary wrap-anywhere">{draft.title}</h3>
          )}
        </div>
        {draft.status === "draft" && !decided && !editing && op !== "remove" && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={busy} aria-label={`Edit the draft ${draft.title}`}>
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
          </Button>
        )}
      </div>

      {draft.op.reason && <p className="mt-2 text-sm text-secondary"><span className="font-medium text-primary">Why: </span>{draft.op.reason}</p>}

      {editing ? (
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor={`${base}-body`} className="text-xs font-medium text-primary">Details</label>
            <Textarea id={`${base}-body`} rows={5} className="mt-1" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          {Object.keys(fields).length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.keys(fields).map((k) => (
                <div key={k}>
                  <label htmlFor={`${base}-f-${k}`} className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">{k}</label>
                  <Input id={`${base}-f-${k}`} value={fields[k]} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} className="mt-1 font-mono text-xs" />
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void save()} disabled={busy}>{edit.isPending ? "Saving" : "Save changes"}</Button>
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setTitle(draft.title); setBody(draft.body); }} disabled={busy}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          {op === "remove" ? (
            <p className="mt-2 text-sm text-secondary">Approving removes this row from the section.</p>
          ) : diff.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Before and after</caption>
                <thead>
                  <tr className="text-muted"><th scope="col" className="py-1 pr-3 font-mono font-normal uppercase tracking-[0.15em]">Field</th><th scope="col" className="py-1 pr-3 font-normal">Before</th><th scope="col" className="py-1 font-normal">After</th></tr>
                </thead>
                <tbody>
                  {diff.map((c) => (
                    <tr key={c.field} className="border-t border-hairline align-top">
                      <th scope="row" className="py-1.5 pr-3 font-mono font-normal text-muted">{c.field}</th>
                      <td className="py-1.5 pr-3 text-secondary line-through decoration-muted wrap-anywhere">{c.was}</td>
                      <td className="py-1.5 text-primary wrap-anywhere">{c.now}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              {draft.body && <p className="mt-2 whitespace-pre-wrap text-sm text-secondary wrap-anywhere">{draft.body}</p>}
              {(fieldList.length > 0 || size || wire) && (
                <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                  {wire && <div className="flex gap-2 sm:col-span-2"><dt className="font-mono text-muted">wire</dt><dd className="font-mono text-primary">{wire}</dd></div>}
                  {fieldList.map(([k, v]) => (
                    <div key={k} className="flex gap-2"><dt className="font-mono text-muted">{k}</dt><dd className="text-primary wrap-anywhere">{show(v)}</dd></div>
                  ))}
                  {size && <div className="flex gap-2"><dt className="font-mono text-muted">size</dt><dd className="text-primary">{size.join(" × ")} mm, typical</dd></div>}
                  {pinsText(draft) && <div className="flex gap-2 sm:col-span-2"><dt className="font-mono text-muted">pins</dt><dd className="text-primary wrap-anywhere">{pinsText(draft)}</dd></div>}
                </dl>
              )}
            </>
          )}
        </>
      )}

      {draft.sources.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted hover:text-primary">Made from {draft.sources.length} {draft.sources.length === 1 ? "row" : "rows"}</summary>
          <ul className="mt-1.5 space-y-0.5">
            {draft.sources.map((s) => (
              <li key={`${s.kind}-${s.id}`}>
                {s.section ? <Link href={storeHref(s.section)} className="text-link hover:underline">{s.title}</Link> : s.title}
                {s.section && <span className="font-mono text-muted"> · {s.section}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {missing && <p role="alert" className="mt-3 text-sm text-danger">The row this draft would change no longer exists. Reject it.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-danger wrap-anywhere">{error}</p>}

      {draft.status === "draft" && !decided && !editing && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-hairline pt-3">
          <Button size="sm" onClick={() => void decide(() => approve.mutateAsync(draft.id))} disabled={busy || missing}>
            <Check className="h-3.5 w-3.5" aria-hidden /> {approve.isPending ? "Approving" : op === "remove" ? "Approve removal" : "Approve"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void decide(() => reject.mutateAsync({ id: draft.id }))} disabled={busy}>
            <X className="h-3.5 w-3.5" aria-hidden /> {reject.isPending ? "Rejecting" : "Reject"}
          </Button>
        </div>
      )}
    </Card>
  );
}
