"use client";

import { useMemo, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorLine, Field, Select, Textarea } from "@/components/parts/controls";
import { useItems } from "@/lib/client";
import { AD_CHANNELS, checkChannel, measure, type ChannelSpec, type FieldSpec, type FieldValues } from "@/lib/content/channels";
import type { Item } from "@/lib/types";
import type { ViewProps } from "@/components/views/types";
import { asFlags, Count, FlagList, MessageLine, Panel, Problems, SourceLink, StatusPill } from "./shared";

const STATUSES = ["draft", "approved", "running", "paused", "killed"];
const toMinor = (s: string) => (s.trim() === "" ? undefined : Math.round(Number(s) * 100));
const fromMinor = (n: unknown) => (typeof n === "number" ? (n / 100).toFixed(2) : "");

export function AdsView({ project, store }: ViewProps) {
  const { items, loading, error, writeError, add, patch, remove } = useItems(project.id, store);
  const [channelId, setChannelId] = useState(AD_CHANNELS[0].id);
  const spec = AD_CHANNELS.find((c) => c.id === channelId)!;
  const ads = useMemo(() => items.filter((i) => i.data.channel === channelId), [items, channelId]);
  const counts = useMemo(() => new Map(AD_CHANNELS.map((c) => [c.id, items.filter((i) => i.data.channel === c.id).length])), [items]);
  const [err, setErr] = useState("");
  // Rows written before channels existed (a retargeting plan, say) keep their text; the writer can move them to a channel.
  const loose = useMemo(() => items.filter((i) => !AD_CHANNELS.some((c) => c.id === i.data.channel)), [items]);
  const exportable = ads.some((a) => ["approved", "running", "paused"].includes(a.status));

  const addBlank = async () => {
    setErr("");
    try {
      await add({ section: store, title: `${spec.label}: new variant`, status: "draft", data: { channel: spec.id, fields: {} } });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <nav aria-label="Ad channels" className="flex flex-wrap gap-2">
        {AD_CHANNELS.map((c) => (
          <Button key={c.id} size="sm" variant={c.id === channelId ? "default" : "outline"} aria-pressed={c.id === channelId} onClick={() => setChannelId(c.id)}>
            {c.label}
            <span className="ml-1.5 font-mono text-[10px] opacity-80">{counts.get(c.id) ?? 0}</span>
          </Button>
        ))}
      </nav>

      <SpecPanel spec={spec} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-secondary">Use Draft with AI above to write variants from your approved messages, or add one by hand.</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild={exportable} disabled={!exportable} title={exportable ? undefined : "Approve an ad first"}>
            {exportable ? (
              <a href={`/api/content/ads/export?projectId=${encodeURIComponent(project.id)}&channel=${spec.id}`}>
                <Download className="h-4 w-4" aria-hidden /> Export CSV
              </a>
            ) : (
              <span><Download className="h-4 w-4" aria-hidden /> Export CSV</span>
            )}
          </Button>
          <Button size="sm" onClick={() => void addBlank()}><Plus className="h-4 w-4" aria-hidden /> Add variant</Button>
        </div>
      </div>
      <p className="text-xs text-muted">{spec.bulk.note}{spec.bulk.source ? <> <SourceLink url={spec.bulk.source} label="Layout source" /></> : null}</p>
      {err || writeError ? <ErrorLine>{err || writeError}</ErrorLine> : null}
      {error && !items.length ? <ErrorLine>{error}</ErrorLine> : null}

      {loose.length > 0 && (
        <Panel title={`Older ad rows without a channel (${loose.length})`}>
          <p className="mb-2 text-xs text-muted">These were written before ads had channels. They are kept as they are. Move one to a channel to edit it with that channel&apos;s fields.</p>
          <ul className="space-y-2">
            {loose.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                <StatusPill status={i.status} />
                <span className="min-w-0 flex-1 truncate text-primary">{i.title}</span>
                <label className="flex items-center gap-2 text-xs text-secondary">
                  Move to
                  <Select aria-label={`Channel for ${i.title}`} className="h-8 w-56" value="" onChange={(e) => e.target.value && void patch(i.id, { data: { channel: e.target.value, fields: {} } }).catch((x) => setErr((x as Error).message))}>
                    <option value="">Choose a channel</option>
                    {AD_CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                </label>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {loading ? (
        <p className="text-sm text-secondary" role="status">Loading the ads.</p>
      ) : ads.length === 0 ? (
        <EmptyState title={`No ${spec.label} ads yet`}>Draft variants with AI, each tied to one approved message, or add one by hand.</EmptyState>
      ) : (
        <ul className="space-y-4">
          {ads.map((a) => (
            <li key={a.id}>
              <AdCard ad={a} spec={spec} onSave={(c) => patch(a.id, c)} onDelete={() => remove(a.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SpecPanel({ spec }: { spec: ChannelSpec }) {
  return (
    <Panel title={`${spec.label}: what it accepts`}>
      <p className="text-sm text-secondary">{spec.summary}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Fields and limits for {spec.label}</caption>
          <thead>
            <tr className="text-muted">
              <th scope="col" className="py-1 pr-3 font-medium">Field</th>
              <th scope="col" className="py-1 pr-3 font-medium">Limit</th>
              <th scope="col" className="py-1 font-medium">Kind of limit</th>
            </tr>
          </thead>
          <tbody>
            {spec.fields.map((f) => (
              <tr key={f.key} className="border-t border-hairline align-top">
                <th scope="row" className="py-1.5 pr-3 font-medium text-primary">{f.label}{f.required ? " *" : ""}</th>
                <td className="py-1.5 pr-3 text-secondary">{limitText(f)}</td>
                <td className="py-1.5 text-secondary">
                  {f.enforce ? <>Enforced <SourceLink url={f.source!} label="platform page" /></> : "Soft warning"}
                  {f.note ? <span className="block text-muted">{f.note}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {spec.unverified && <p className="mt-2 text-xs text-warning">Not verified: {spec.unverified}</p>}
      <p className="mt-2 text-xs text-muted">
        Read from: {spec.sources.length ? spec.sources.map((s, i) => <span key={s.url}>{i ? "; " : ""}<SourceLink url={s.url} label={s.label} /></span>) : "no page could be read for this channel"}
      </p>
    </Panel>
  );
}

function limitText(f: FieldSpec) {
  const bits: string[] = [];
  if (f.kind === "list") bits.push(`${f.minItems ?? 0} to ${f.maxItems ?? "any"} items`);
  if (f.max !== undefined) bits.push(`${f.max} characters${f.kind === "list" ? " each" : ""}`);
  if (f.maxWords) bits.push(`${f.maxWords} words`);
  if (f.choices) bits.push(`one of ${f.choices.length} choices`);
  if (f.kind === "url") bits.push("web address");
  return bits.join(", ") || "none";
}

function AdCard({ ad, spec, onSave, onDelete }: { ad: Item; spec: ChannelSpec; onSave: (c: { data?: Record<string, unknown>; status?: string; title?: string; body?: string }) => Promise<unknown>; onDelete: () => Promise<unknown> }) {
  const saved = (ad.data.fields ?? {}) as FieldValues;
  const [vals, setVals] = useState<FieldValues>(saved);
  const [rule, setRule] = useState(String(ad.data.stopRule ?? ""));
  const [ceiling, setCeiling] = useState(fromMinor(ad.data.costPerOrderCeilingMinor));
  const [minSpend, setMinSpend] = useState(fromMinor(ad.data.minSpendBeforeJudgingMinor));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const problems = checkChannel(spec, vals);
  const hard = problems.filter((p) => p.level === "refuse");
  const dirty = JSON.stringify(vals) !== JSON.stringify(saved) || rule !== String(ad.data.stopRule ?? "") || ceiling !== fromMinor(ad.data.costPerOrderCeilingMinor) || minSpend !== fromMinor(ad.data.minSpendBeforeJudgingMinor);
  const cur = String(ad.data.currency ?? "");

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(() => {
      const first = spec.fields.find((f) => f.kind !== "url" && vals[f.key]);
      const lead = first ? (Array.isArray(vals[first.key]) ? (vals[first.key] as string[])[0] : String(vals[first.key])) : "new variant";
      return onSave({
        title: `${spec.label}: ${lead}`.slice(0, 120),
        data: { fields: vals, stopRule: rule, costPerOrderCeilingMinor: toMinor(ceiling), minSpendBeforeJudgingMinor: toMinor(minSpend) },
      });
    });

  const set = (k: string, v: string | string[]) => setVals((p) => ({ ...p, [k]: v }));

  return (
    <article className="rounded-xl border border-hairline bg-surface p-4" aria-label={ad.title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusPill status={ad.status} />
          {ad.data.noProof === true && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">No proof</span>}
        </div>
        <Button size="icon" variant="ghost" aria-label={`Delete ${ad.title}`} onClick={() => void run(onDelete)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
      </div>
      <div className="mt-2"><MessageLine message={ad.data.message as { text?: string } | undefined} /></div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {spec.fields.map((f) => (
          <FieldEditor key={f.key} spec={f} value={vals[f.key]} onChange={(v) => set(f.key, v)} id={`${ad.id}-${f.key}`} />
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-hairline bg-subtle p-3">
        <h3 className="text-xs font-semibold text-primary">Stop and scale rule</h3>
        <p className="text-[11px] text-muted">The two numbers are read by the campaign tracking. They are yours to set; none is filled in for you.</p>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <Field label="The rule, in a sentence"><Textarea rows={3} value={rule} onChange={(e) => setRule(e.target.value)} /></Field>
          <Field label={`Highest cost per order you accept${cur ? ` (${cur})` : ""}`} hint={`Stop when ${spec.costWord} stays above this.`}>
            <Input inputMode="decimal" value={ceiling} onChange={(e) => setCeiling(e.target.value)} />
          </Field>
          <Field label={`Least spend before judging${cur ? ` (${cur})` : ""}`} hint="Do not judge the ad before this much is spent.">
            <Input inputMode="decimal" value={minSpend} onChange={(e) => setMinSpend(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <FlagList flags={asFlags(ad.data.flags)} />
        <Problems problems={problems} />
        {err && <ErrorLine>{err}</ErrorLine>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void save()} disabled={busy || !dirty || hard.some((h) => !/required|at least/.test(h.message))}>{busy ? "Saving" : dirty ? "Save changes" : "Saved"}</Button>
        <label className="flex items-center gap-2 text-xs text-secondary">
          Status
          <Select aria-label={`Status of ${ad.title}`} className="h-8 w-36" value={ad.status} disabled={busy || dirty} onChange={(e) => void run(() => onSave({ status: e.target.value }))}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </label>
        {dirty && <span className="text-xs text-muted">Save before changing the status.</span>}
      </div>
    </article>
  );
}

function FieldEditor({ spec, value, onChange, id }: { spec: FieldSpec; value: string | string[] | undefined; onChange: (v: string | string[]) => void; id: string }) {
  const label = `${spec.label}${spec.required ? " *" : ""}`;
  if (spec.kind === "list") {
    const items = Array.isArray(value) ? value : [];
    return (
      <div className="md:col-span-2">
        <p className="mb-1 text-xs font-medium text-secondary">{label}</p>
        <ul className="space-y-1.5">
          {items.map((t, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input aria-label={`${spec.label} ${i + 1}`} value={t} onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))} />
              <span className="w-28 shrink-0 text-right"><Count n={measure(t)} max={spec.max} enforce={spec.enforce} /></span>
              <Button size="icon" variant="ghost" aria-label={`Remove ${spec.label} ${i + 1}`} onClick={() => onChange(items.filter((_, k) => k !== i))}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex items-center gap-3">
          <Button size="sm" variant="outline" disabled={spec.maxItems !== undefined && items.length >= spec.maxItems} onClick={() => onChange([...items, ""])}><Plus className="h-3.5 w-3.5" aria-hidden /> Add</Button>
          <span className="text-[11px] text-muted">{items.length}{spec.maxItems ? ` / ${spec.maxItems}` : ""} items{spec.minItems ? `, at least ${spec.minItems}` : ""}</span>
        </div>
      </div>
    );
  }
  if (spec.kind === "choice") {
    return (
      <Field label={label}>
        <Select value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose</option>
          {spec.choices!.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </Field>
    );
  }
  const text = typeof value === "string" ? value : "";
  const long = (spec.max ?? 0) > 120;
  return (
    <div className={long ? "md:col-span-2" : undefined}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-secondary">{label}</label>
      {long ? <Textarea id={id} rows={3} value={text} onChange={(e) => onChange(e.target.value)} /> : <Input id={id} value={text} onChange={(e) => onChange(e.target.value)} />}
      <div className="mt-0.5 flex justify-between gap-2">
        <span className="text-[11px] text-muted">{spec.note ?? ""}</span>
        {spec.kind !== "url" && <Count n={measure(text, spec.xWeight)} max={spec.max} enforce={spec.enforce} shown={spec.shown} />}
      </div>
    </div>
  );
}
