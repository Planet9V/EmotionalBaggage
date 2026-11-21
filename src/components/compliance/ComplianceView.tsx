"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { InlineEdit } from "@/components/parts/InlineEdit";
import { api, saveOrMessage, useItems } from "@/lib/client";
import { DRAFT_NOTE, NOT_ADVICE } from "@/lib/compliance/text";
import { useProductionSettings } from "@/lib/economics/client";
import { CONFIRM_STATUSES, isPublicUrl, REGIONS, REGION_LABEL, STORE_COMPLIANCE, type Region } from "@/lib/economics/schemas";
import { keys } from "@/lib/queries";
import type { Item } from "@/lib/types";
import type { ViewProps } from "@/components/views/types";
import { ComplianceDialog } from "./ComplianceDialog";
import { EmptyState, ErrorLine, LoadingBlocks } from "@/components/ui/states";
import { NativeSelect } from "@/components/ui/native-select";

const text = (v: unknown) => (typeof v === "string" ? v : "");
const tone = (s: string) => (s === "done" ? "success" : s === "applies" ? "info" : s === "does not apply" ? "neutral" : "warning");

type Generated = { sources?: unknown[]; model?: string; at?: string; trigger?: string };
const generatedOf = (i: Item): Generated => ((i.data.generated as Generated | undefined) ?? {}) as Generated;

export function ComplianceView({ project }: ViewProps) {
  const settings = useProductionSettings(project.id);
  const rows = useItems(project.id, STORE_COMPLIANCE);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [confirmAs, setConfirmAs] = useState<Record<number, string>>({});

  if (rows.loading || settings.loading) return <LoadingBlocks label="Loading the compliance checklist" />;
  if ((rows.error && !rows.items.length) || settings.error) {
    return (
      <div role="alert" className="max-w-xl rounded-xl border border-hairline bg-danger-soft p-4">
        <p className="text-sm font-medium text-danger">The compliance checklist could not be loaded.</p>
        <p className="mt-1 text-sm text-danger wrap-anywhere">{rows.error || settings.error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void (rows.error ? rows.reload() : settings.reload())}>
          Try again
        </Button>
      </div>
    );
  }

  const regions = settings.regions;
  const drafts = rows.items.filter((r) => r.status === "draft");
  const open = rows.items.filter((r) => r.status === "to check");
  const decided = rows.items.length - drafts.length - open.length;
  const editingRow = typeof editing === "number" ? rows.items.find((r) => r.id === editing) ?? null : null;

  const toggle = async (region: Region) => {
    setMessage("");
    const next = regions.includes(region) ? regions.filter((r) => r !== region) : [...regions, region];
    try {
      await settings.save({ regions: next });
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const draft = async () => {
    setDrafting(true);
    setDraftError("");
    setNotice("");
    try {
      const r = await api<{ drafts: unknown[]; dropped: unknown[] }>(`/api/projects/${encodeURIComponent(project.id)}/compliance/draft`, { method: "POST" });
      await qc.invalidateQueries({ queryKey: ["drafts", project.id] });
      setNotice(
        r.drafts.length
          ? `${r.drafts.length} ${r.drafts.length === 1 ? "draft is" : "drafts are"} waiting for review in Draft with AI at the top of this page${r.dropped.length ? `; ${r.dropped.length} left out` : ""}. Approve one to add it here, then confirm it.`
          : "Nothing new to add: every topic the model proposed is already on the list.",
      );
    } catch (e) {
      setDraftError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  };

  const confirm = async (row: Item) => {
    setMessage("");
    try {
      await api(`/api/items/${row.id}/confirm`, { method: "POST", body: JSON.stringify({ status: confirmAs[row.id] ?? "to check" }) });
      await qc.invalidateQueries({ queryKey: keys.itemsOf(project.id) });
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  const remove = async (row: Item) => {
    setMessage("");
    try {
      await rows.remove(row.id);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <p role="note" className="max-w-3xl rounded-lg border border-hairline bg-subtle px-3 py-2 text-sm text-primary">
        {NOT_ADVICE} {DRAFT_NOTE}
      </p>

      <fieldset className="rounded-xl border border-hairline bg-surface p-4">
        <legend className="px-1 text-sm font-semibold text-primary">Where you will sell</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {REGIONS.map((r) => (
            <label key={r} className="inline-flex items-center gap-2 text-sm text-primary">
              <input type="checkbox" className="h-4 w-4 accent-dutchOrange" checked={regions.includes(r)} onChange={() => void toggle(r)} />
              {REGION_LABEL[r]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void draft()} disabled={drafting || regions.length === 0}>
          <Sparkles className="h-4 w-4" aria-hidden /> {drafting ? "Drafting" : "Draft a checklist"}
        </Button>
        <Button variant="outline" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden /> Add a row by hand
        </Button>
        <p className="max-w-xl text-xs text-secondary">
          {regions.length === 0 ? "Choose at least one region to draft. " : ""}
          Drafting reads the brief, the product type, the parts and your regions, using the reasoning model chosen in{" "}
          <Link href="/admin?tab=models" className="text-link hover:underline">
            Admin, Models
          </Link>
          . With none chosen, the page works by hand.
        </p>
      </div>
      {draftError ? <ErrorLine>{draftError}</ErrorLine> : null}
      {message || rows.writeError ? <ErrorLine>{message || rows.writeError}</ErrorLine> : null}
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}

      {!rows.items.length ? (
        <EmptyState title="No compliance rows yet">Choose your regions and draft a checklist, or add a row by hand. Each drafted row waits for your confirmation.</EmptyState>
      ) : (
        <>
          <p className="text-xs text-secondary" role="status">
            {drafts.length} to confirm, {open.length} to check, {decided} decided.
          </p>
          <ul className="space-y-3">
            {rows.items.map((r) => {
              const g = generatedOf(r);
              const isDraft = r.status === "draft";
              return (
                <li key={r.id} className={`rounded-xl border bg-surface p-4 ${isDraft ? "border-dashed border-dutchOrange" : "border-hairline"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="min-w-0 text-sm font-semibold text-primary">{r.title}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      {isDraft ? (
                        <>
                          <StatusBadge tone="warning">Draft</StatusBadge>
                          <NativeSelect aria-label={`Confirm ${r.title} as`} value={confirmAs[r.id] ?? "to check"} className="h-8 w-40 text-xs" onChange={(e) => setConfirmAs({ ...confirmAs, [r.id]: e.target.value })}>
                            {CONFIRM_STATUSES.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </NativeSelect>
                          <Button size="sm" onClick={() => void confirm(r)} aria-label={`Confirm ${r.title}`}>
                            Confirm
                          </Button>
                        </>
                      ) : (
                        <>
                          <StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge>
                          <NativeSelect
                            aria-label={`Status of ${r.title}`}
                            value={r.status}
                            className="h-8 w-40 text-xs"
                            onChange={(e) => {
                              setMessage("");
                              rows.patch(r.id, { status: e.target.value }).catch((err: Error) => setMessage(err.message));
                            }}
                          >
                            {CONFIRM_STATUSES.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </NativeSelect>
                        </>
                      )}
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.title}`} onClick={() => setEditing(r.id)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={isDraft ? `Discard ${r.title}` : `Remove ${r.title}`} onClick={() => void remove(r)}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium text-secondary">Why it may apply</dt>
                      <dd className="text-primary">{text(r.data.why) || <span className="text-muted">Not written yet</span>}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-secondary">What to check</dt>
                      <dd className="text-primary">{text(r.data.check) || <span className="text-muted">Not written yet</span>}</dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="text-xs font-medium text-secondary">Evidence</dt>
                      <dd className="flex flex-wrap items-center gap-2">
                        <div className="min-w-[16rem] flex-1">
                          <InlineEdit
                            label={`Evidence web address for ${r.title}`}
                            value={text(r.data.evidence)}
                            placeholder="Add a web address"
                            className="text-left"
                            onSave={(v) => {
                              const t = v.trim();
                              if (t && !isPublicUrl(t)) return "Enter a public web address starting with http:// or https://.";
                              return saveOrMessage(rows.patch(r.id, { data: { evidence: t } }));
                            }}
                          />
                        </div>
                        {isPublicUrl(text(r.data.evidence)) ? (
                          <a href={text(r.data.evidence)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-link hover:underline">
                            Open <ExternalLink className="h-3 w-3" aria-hidden /> <span className="sr-only">(new tab)</span>
                          </a>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                  {g.model ? (
                    <p className="mt-2 text-[11px] text-muted">
                      Drafted by {g.model}
                      {g.at ? ` on ${new Date(g.at).toLocaleDateString(undefined, { dateStyle: "medium" })}` : ""} from {g.sources?.length ?? 0} {g.sources?.length === 1 ? "row" : "rows"} of this concept
                      {g.trigger ? `, triggered by ${g.trigger}` : ""}.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <ComplianceDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editingRow}
        onSave={async (v) => {
          if (editingRow) await rows.patch(editingRow.id, { title: v.title, data: v.data });
          else await rows.add({ section: STORE_COMPLIANCE, title: v.title, data: v.data, status: "to check" });
          setEditing(null);
        }}
      />
    </div>
  );
}
