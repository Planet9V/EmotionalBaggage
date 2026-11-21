"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FIELDS, FIELD_LABEL, LAYOUTS, applyMapping, dateSpan, detectLayout, layoutFor, mappingFor, parseReport, type DateOrder, type ImportResult, type Mapping, type ParsedFile } from "@/lib/campaigns/csv";
import type { Item } from "@/lib/types";
import { fetchMapping, saveMapping, useSaveResults, type useMoney } from "./hooks";
import { ErrorLine } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type Money = ReturnType<typeof useMoney>;

/**
 * Pasting or opening a platform report. The file is read in the browser. A recognised layout
 * (Amazon Ads, Meta, Google) is only a suggestion: the mapping stays on screen to correct, and what is
 * chosen is remembered for the next file from the same channel. Nothing is saved until the preview is accepted.
 */
export function ImportPanel({ projectId, campaignId, campaignTitle, creatives, money, onDone }: {
  projectId: string;
  campaignId: number;
  campaignTitle: string;
  creatives: Item[];
  money: Money;
  onDone: (message: string) => void;
}) {
  const save = useSaveResults(projectId);
  const [text, setText] = useState("");
  const [source, setSource] = useState<"paste" | "csv">("paste");
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [layoutId, setLayoutId] = useState("generic");
  const [mapping, setMapping] = useState<Mapping>({});
  const [order, setOrder] = useState<DateOrder>("mdy");
  const [only, setOnly] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const load = async (raw: string, from: "paste" | "csv") => {
    setErr("");
    setNote("");
    const parsed = parseReport(raw);
    if (parsed.headers.length < 2 || parsed.rows.length === 0) {
      setFile(null);
      return setErr("I could not find a header line and at least one row. Paste the report with its column names on the first line.");
    }
    setSource(from);
    setFile(parsed);
    const found = detectLayout(parsed.headers);
    const layout = found?.layout ?? layoutFor("generic")!;
    setLayoutId(layout.id);
    let m: Mapping = found?.mapping ?? mappingFor(layout, parsed.headers);
    let ord: DateOrder = "mdy";
    let remembered = false;
    try {
      const r = await fetchMapping(projectId, layout.memoryKey);
      if (r.saved) {
        // the remembered mapping wins where its columns exist in this file
        const kept = Object.fromEntries(Object.entries(r.saved.mapping).filter(([, h]) => parsed.headers.includes(h)));
        if (Object.keys(kept).length) {
          m = { ...m, ...kept };
          ord = r.saved.dateOrder;
          remembered = true;
        }
      }
    } catch {
      /* no remembered mapping is not an error */
    }
    setMapping(m);
    setOrder(ord);
    // when the file holds several campaigns, start with the one named like this campaign, if exactly one is
    const seen = m.campaign ? applyMapping(parsed.headers, parsed.rows, m, { currency: money.currency, dateOrder: ord }, parsed.skippedAbove + 1).campaigns : [];
    const same = seen.filter((c) => c.trim().toLowerCase() === campaignTitle.trim().toLowerCase());
    setOnly(seen.length > 1 && same.length === 1 ? same[0] : "");
    setNote(found ? `Recognised as ${found.layout.label}.${found.layout.verified ? "" : " That layout was not checked against a real export file, so check the columns below."}${remembered ? " Using the mapping you used last time for this channel." : ""}` : "Layout not recognised: choose the columns below.");
  };

  const result: ImportResult | null = file ? applyMapping(file.headers, file.rows, mapping, { currency: money.currency, dateOrder: order, campaign: only || undefined }, file.skippedAbove + 1) : null;
  const span = result ? dateSpan(result.records) : null;
  const layout = layoutFor(layoutId);
  // several campaigns in one file must not be added together into this one without the user choosing
  const needChoice = !!mapping.campaign && (result?.campaigns.length ?? 0) > 1 && !only;

  const accept = async () => {
    if (!result || !result.records.length) return;
    setErr("");
    const rows = result.records.map((r) => {
      const hit = r.creativeName ? creatives.find((c) => c.title.trim().toLowerCase() === r.creativeName.trim().toLowerCase()) : undefined;
      return { day: r.day, creativeId: hit?.id ?? null, spend: r.spend, impressions: r.impressions, clicks: r.clicks, orders: r.orders, revenue: r.revenue };
    });
    // rows of an unmatched creative name are added into the whole campaign for that day, never dropped
    const merged = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const k = `${r.creativeId ?? 0}|${r.day}`;
      const h = merged.get(k);
      if (h) { h.spend += r.spend; h.impressions += r.impressions; h.clicks += r.clicks; h.orders += r.orders; h.revenue += r.revenue; } else merged.set(k, { ...r });
    }
    try {
      const out = await save.mutateAsync({ campaignId, source, rows: [...merged.values()] });
      if (layout) await saveMapping(projectId, layout.memoryKey, { layout: layout.id, dateOrder: order, mapping: mapping as Record<string, string> }).catch(() => {});
      onDone(`Saved ${out.added} new and ${out.replaced} replaced days for ${campaignTitle}.`);
      setFile(null);
      setText("");
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const matched = result ? new Set(result.records.map((r) => r.creativeName).filter(Boolean)) : new Set<string>();
  const unmatched = [...matched].filter((n) => !creatives.some((c) => c.title.trim().toLowerCase() === n.trim().toLowerCase()));

  return (
    <div className="space-y-4">
      <p className="text-sm text-secondary">
        Paste a report, or open a CSV file saved from Amazon Ads, Meta Ads Manager or Google Ads. The file is read in your browser; nothing is saved until you accept the preview. A day imported again replaces that day, so it is never counted twice.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="Paste a report (header line first)"><Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" /></Field>
        <div className="space-y-2">
          <Field label="Or open a CSV file">
            <Input ref={input} type="file" accept=".csv,.tsv,.txt,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await load(await f.text(), "csv"); }} />
          </Field>
          <Button variant="outline" disabled={!text.trim()} onClick={() => void load(text, "paste")}>Read the pasted report</Button>
        </div>
      </div>
      {err && <ErrorLine>{err}</ErrorLine>}
      {note && <p role="status" className="text-sm text-secondary">{note}</p>}
      {file && (
        <div className="space-y-4 rounded-xl border border-hairline p-4">
          <h3 className="text-sm font-semibold text-primary">Match the columns</h3>
          {file.skippedAbove > 0 && <p className="text-xs text-secondary">{file.skippedAbove} lines above the column names were skipped.</p>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Report layout">
              <NativeSelect value={layoutId} onChange={(e) => { const l = layoutFor(e.target.value)!; setLayoutId(l.id); setMapping(mappingFor(l, file.headers)); }}>
                {LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </NativeSelect>
            </Field>
            {FIELDS.map((f) => (
              <Field key={f} label={FIELD_LABEL[f]}>
                <NativeSelect value={mapping[f] ?? ""} onChange={(e) => setMapping((m) => { const n = { ...m }; if (e.target.value) n[f] = e.target.value; else delete n[f]; return n; })}>
                  <option value="">Not in this file</option>
                  {file.headers.map((h, i) => <option key={`${h}-${i}`} value={h}>{h}</option>)}
                </NativeSelect>
              </Field>
            ))}
            <Field label="Date order in the file">
              <NativeSelect value={order} onChange={(e) => setOrder(e.target.value as DateOrder)}>
                <option value="mdy">Month first (12/31/2026)</option>
                <option value="dmy">Day first (31/12/2026)</option>
              </NativeSelect>
            </Field>
            {mapping.campaign && (
              <Field label="Only the campaign named" hint="Leave empty to take every row.">
                <NativeSelect value={only} onChange={(e) => setOnly(e.target.value)}>
                  <option value="">Every campaign in the file</option>
                  {(result?.campaigns ?? []).map((c) => <option key={c}>{c}</option>)}
                </NativeSelect>
              </Field>
            )}
          </div>
          {layout && !layout.verified && layoutId !== "generic" && <p className="text-xs text-warning">{layout.note} Source of the column names: {layout.source}</p>}
          {result && (
            <div className="space-y-2" data-testid="import-preview">
              <p className="text-sm text-primary">
                {needChoice
                  ? `This file holds ${result.campaigns.length} campaigns. Choose which one is "${campaignTitle}" above; rows of the others are never added.`
                  : result.records.length === 0
                  ? "Nothing in the file can be imported with these columns."
                  : `${result.records.length} days will be saved${span ? `, from ${span.from} to ${span.to}` : ""}. ${result.rowsRead} rows read, ${result.skipped} left out on purpose (totals, empty or other campaigns), ${result.problems.length} refused.`}
              </p>
              {unmatched.length > 0 && <p className="text-xs text-secondary">These ad names match none of this campaign&apos;s creative and are added to the whole campaign: {unmatched.join("; ")}.</p>}
              {result.problems.length > 0 && (
                <ul className="max-h-40 overflow-y-auto rounded-md bg-danger-soft p-2 text-xs text-danger" role="alert">
                  {result.problems.slice(0, 50).map((p, i) => <li key={i}>{p.line ? `Line ${p.line}: ` : ""}{p.problem}</li>)}
                </ul>
              )}
              <div className="flex gap-2">
                <Button onClick={() => void accept()} disabled={save.isPending || result.records.length === 0 || needChoice}>{save.isPending ? "Saving" : `Save ${result.records.length} days`}</Button>
                <Button variant="outline" onClick={() => setFile(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
