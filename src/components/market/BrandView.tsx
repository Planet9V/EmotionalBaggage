"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/Card";
import { api, useFilesChanged, useItems } from "@/lib/client";
import { queries } from "@/lib/queries";
import { brandCssVariables, brandText, findKit, readKit } from "@/lib/market/brandKit";
import { checkColour } from "@/lib/market/contrast";
import { HEX, type BrandColour, type VoiceRule } from "@/lib/market/schemas";
import type { Item } from "@/lib/types";
import type { ViewProps } from "@/components/views/types";
import { ApproveButton, GenerateButton, ModelGate, Notes, Status, useGenerate, useModelStatus } from "./shared";
import { EmptyState, ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

const LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

type Form = { voiceSummary: string; rules: VoiceRule[]; colours: BrandColour[]; headingFont: string; bodyFont: string; tagline: string; boilerplate: string };

function formOf(item: Item): Form {
  const k = readKit(item) ?? {};
  return {
    voiceSummary: k.voiceSummary ?? "",
    rules: (k.rules ?? []).map((r) => ({ ...r })),
    colours: (k.colours ?? []).map((c) => ({ ...c })),
    headingFont: k.headingFont ?? "",
    bodyFont: k.bodyFont ?? "",
    tagline: k.tagline ?? "",
    boilerplate: k.boilerplate ?? "",
  };
}

export function BrandView({ project, store }: ViewProps) {
  const { items, loading, error, reload, add, patch, remove } = useItems(project.id, store);
  const kit = findKit(items);
  const checks = items.filter((i) => i.data.kind === "voicecheck");
  const [actionError, setActionError] = useState("");

  if (loading) return <LoadingBlocks label="Loading the brand kit" />;
  if (error && !items.length) return <LoadError what="The brand kit" message={error} onRetry={() => void reload()} />;

  return (
    <div className="space-y-5">
      {(actionError || error) && <ErrorLine>{actionError || error}</ErrorLine>}
      {!kit ? (
        <EmptyState title="No brand kit yet">
          <p>The kit holds the voice, colours, type, logos, tagline and boilerplate once, and every generated piece reads it.</p>
          <div className="mt-3 flex justify-center">
            <Button onClick={async () => { setActionError(""); try { await add({ section: store, title: "Brand kit", data: { kind: "kit" }, status: "draft" }); } catch (e) { setActionError((e as Error).message); } }}><Plus className="h-4 w-4" aria-hidden /> Set up the brand kit</Button>
          </div>
        </EmptyState>
      ) : (
        <KitForm key={kit.id} project={project} kit={kit} onSave={(data) => patch(kit.id, { data, ...(kit.status === "approved" ? { status: "draft" } : {}) })} onStatus={(status) => patch(kit.id, { status })} />
      )}
      <VoiceCheck project={project} kit={kit} checks={checks} onDelete={(id) => remove(id).catch((e) => setActionError((e as Error).message))} />
    </div>
  );
}

function KitForm({ project, kit, onSave, onStatus }: { project: ViewProps["project"]; kit: Item; onSave: (data: Record<string, unknown>) => Promise<unknown>; onStatus: (s: "approved" | "draft") => Promise<unknown> }) {
  const [f, setF] = useState<Form>(() => formOf(kit));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const names = useItems(project.id, "concept/names");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setSaved(false); setF((x) => ({ ...x, [k]: v })); };
  const taglines = names.items.filter((n) => n.data.kind === "Tagline");

  const save = async () => {
    const bad = f.colours.find((c) => !HEX.test(c.hex));
    if (bad) return setErr(`"${bad.name || bad.hex}" is not a six-digit colour such as #E05A10.`);
    setSaving(true);
    setErr("");
    try {
      await onSave({
        voiceSummary: f.voiceSummary,
        rules: f.rules.filter((r) => r.rule.trim()),
        colours: f.colours,
        headingFont: f.headingFont,
        bodyFont: f.bodyFont,
        tagline: f.tagline,
        boilerplate: f.boilerplate,
      });
      setSaved(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const preview = { ...kit, data: { ...kit.data, ...f } } as Item;
  const text = brandText(preview);
  const css = brandCssVariables(preview);

  return (
    <Card variant="outlined" hoverEffect={false} innerClassName="space-y-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><h2 className="text-base font-semibold text-primary">Brand kit</h2><Status status={kit.status} /></div>
        <ApproveButton item={kit} onSet={onStatus} />
      </div>

      <section className="space-y-3" aria-labelledby="voice">
        <h3 id="voice" className="text-sm font-semibold text-primary">Voice and tone</h3>
        <Field label="In a sentence or two, how the brand sounds"><Textarea rows={2} value={f.voiceSummary} onChange={(e) => set("voiceSummary", e.target.value)} placeholder="Deadpan and dry. Plain words. Never shouts." /></Field>
        <div className="space-y-3">
          {f.rules.map((r, i) => (
            <fieldset key={i} className="space-y-2 rounded-lg border border-hairline p-3">
              <legend className="px-1 text-xs font-medium text-secondary">Rule {i + 1}</legend>
              <Field label="The rule"><Input value={r.rule} onChange={(e) => set("rules", f.rules.map((x, j) => (j === i ? { ...x, rule: e.target.value } : x)))} /></Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Do: a sentence that follows it"><Input value={r.doExample} onChange={(e) => set("rules", f.rules.map((x, j) => (j === i ? { ...x, doExample: e.target.value } : x)))} /></Field>
                <Field label="Do not: a sentence that breaks it"><Input value={r.dontExample} onChange={(e) => set("rules", f.rules.map((x, j) => (j === i ? { ...x, dontExample: e.target.value } : x)))} /></Field>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => set("rules", f.rules.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove rule {i + 1}</Button>
            </fieldset>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => set("rules", [...f.rules, { rule: "", doExample: "", dontExample: "" }])}><Plus className="h-3.5 w-3.5" aria-hidden /> Add a rule</Button>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="colours">
        <h3 id="colours" className="text-sm font-semibold text-primary">Colours</h3>
        <p className="text-xs text-muted">Contrast is worked out against white and black text. At least 4.5 to 1 reads well for body text; 3 to 1 is the floor for large text.</p>
        {f.colours.map((c, i) => <ColourRow key={i} c={c} onChange={(n) => set("colours", f.colours.map((x, j) => (j === i ? n : x)))} onRemove={() => set("colours", f.colours.filter((_, j) => j !== i))} />)}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => set("colours", [...f.colours, { role: f.colours.some((c) => c.role === "primary") ? "secondary" : "primary", name: "", hex: "#E05A10" }])}><Plus className="h-3.5 w-3.5" aria-hidden /> Add a colour</Button>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="type">
        <h3 id="type" className="text-sm font-semibold text-primary">Type</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Heading font" hint="Letters, numbers, spaces and commas, as in: Inter, sans-serif"><Input value={f.headingFont} onChange={(e) => set("headingFont", e.target.value)} /></Field>
          <Field label="Body font"><Input value={f.bodyFont} onChange={(e) => set("bodyFont", e.target.value)} /></Field>
        </div>
      </section>

      <Logos project={project} kit={kit} />

      <section className="space-y-3" aria-labelledby="words">
        <h3 id="words" className="text-sm font-semibold text-primary">Tagline and boilerplate</h3>
        <Field label="Tagline" hint={taglines.length ? "Taglines from your names list are offered as you type." : undefined}>
          <Input list="brand-taglines" value={f.tagline} onChange={(e) => set("tagline", e.target.value)} />
        </Field>
        <datalist id="brand-taglines">{taglines.map((t) => <option key={t.id} value={t.title} />)}</datalist>
        <Field label="Boilerplate paragraph" hint="The short about-us paragraph for press notes and listings."><Textarea rows={4} value={f.boilerplate} onChange={(e) => set("boilerplate", e.target.value)} /></Field>
      </section>

      {err && <ErrorLine>{err}</ErrorLine>}
      <div className="flex items-center gap-3 border-t border-hairline pt-4">
        <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving" : "Save the kit"}</Button>
        {saved && <span role="status" className="text-sm text-success">Saved.{kit.status === "approved" ? " It went back to draft." : ""}</span>}
      </div>

      <details className="rounded-lg border border-hairline bg-surface px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-primary">What the other tools read from this kit</summary>
        <div className="mt-3 space-y-3">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Added to every writing prompt</p><pre className="mt-1 whitespace-pre-wrap rounded-md bg-subtle p-2 text-xs text-secondary">{text || "Nothing yet. Add a voice summary or a rule."}</pre></div>
          <div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">CSS variables for the landing page</p><pre className="mt-1 overflow-x-auto rounded-md bg-subtle p-2 text-xs text-secondary">{css || "Nothing yet. Add a colour or a font."}</pre></div>
        </div>
      </details>
    </Card>
  );
}

function ColourRow({ c, onChange, onRemove }: { c: BrandColour; onChange: (c: BrandColour) => void; onRemove: () => void }) {
  const check = HEX.test(c.hex) ? checkColour(c.hex) : null;
  const level = (l: string) => (l === "fails" ? "fails" : l);
  return (
    <div className="space-y-2 rounded-lg border border-hairline p-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Role"><select value={c.role} onChange={(e) => onChange({ ...c, role: e.target.value as BrandColour["role"] })} className="h-9 rounded-md border border-hairline bg-surface px-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"><option value="primary">Primary</option><option value="secondary">Secondary</option></select></Field>
        <Field label="Name" className="w-44"><Input value={c.name} onChange={(e) => onChange({ ...c, name: e.target.value })} placeholder="Signal orange" /></Field>
        <Field label="Colour"><input type="color" aria-label="Pick a colour" value={HEX.test(c.hex) ? c.hex : "#000000"} onChange={(e) => onChange({ ...c, hex: e.target.value.toUpperCase() })} className="h-9 w-12 cursor-pointer rounded-md border border-hairline bg-surface p-0.5" /></Field>
        <Field label="Hex" className="w-32"><Input value={c.hex} onChange={(e) => onChange({ ...c, hex: e.target.value })} className="font-mono" aria-invalid={!HEX.test(c.hex)} /></Field>
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove</Button>
      </div>
      {check ? (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="inline-flex h-9 items-center gap-2 rounded-md px-3" style={{ background: c.hex }}>
            <span style={{ color: "#FFFFFF" }} className="font-semibold">Aa</span>
            <span style={{ color: "#000000" }} className="font-semibold">Aa</span>
          </span>
          <span className="font-mono text-xs text-secondary">White text: {check.onWhite.ratio.toFixed(2)}:1 ({level(check.onWhite.level)})</span>
          <span className="font-mono text-xs text-secondary">Black text: {check.onBlack.ratio.toFixed(2)}:1 ({level(check.onBlack.level)})</span>
        </div>
      ) : <p className="text-xs text-danger">Enter the colour as six hex digits, such as #E05A10.</p>}
      {check?.warning && <p role="alert" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">{check.warning}</p>}
      {check?.note && !check.warning && <p className="text-xs text-secondary">{check.note}</p>}
    </div>
  );
}

function Logos({ project, kit }: { project: ViewProps["project"]; kit: Item }) {
  const files = useQuery(queries.files(project.id));
  const filesChanged = useFilesChanged(project.id);
  const { patch } = useItems(project.id, "marketing/brand");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ids = readKit(kit)?.logoFileIds ?? [];
  const logos = (files.data ?? []).filter((f) => ids.includes(f.id));

  const upload = async (file: File) => {
    setErr("");
    if (!LOGO_TYPES.includes(file.type)) return setErr("A logo must be a PNG, JPEG, SVG or WebP image.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "logo");
      const r = await api<{ file: { id: number } }>(`/api/projects/${encodeURIComponent(project.id)}/files`, { method: "POST", body: fd });
      await patch(kit.id, { data: { logoFileIds: [...ids, r.file.id] } });
      await filesChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const drop = async (id: number) => {
    setErr("");
    try {
      await patch(kit.id, { data: { logoFileIds: ids.filter((x) => x !== id) } });
      await api(`/api/files/${id}`, { method: "DELETE" });
      await filesChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <section className="space-y-3" aria-labelledby="logos">
      <h3 id="logos" className="text-sm font-semibold text-primary">Logo files</h3>
      <p className="text-xs text-muted">Upload the files you have: a mark, a wordmark, a reversed version. They are stored with this concept; nothing is generated.</p>
      <div className="flex flex-wrap gap-3">
        {logos.map((l) => (
          <figure key={l.id} className="w-40 rounded-lg border border-hairline bg-surface p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- a stored upload served by the files route, not a static asset */}
            <img src={`/api/files/${l.id}`} alt={`Logo file ${l.name}`} className="h-20 w-full object-contain" />
            <figcaption className="mt-1 truncate text-[11px] text-secondary" title={l.name}>{l.name}</figcaption>
            <Button type="button" size="xs" variant="ghost" onClick={() => void drop(l.id)}><Trash2 className="h-3 w-3" aria-hidden /> Remove</Button>
          </figure>
        ))}
        {!logos.length && <p className="text-sm text-secondary">No logo files yet.</p>}
      </div>
      <input ref={input} type="file" accept={LOGO_TYPES.join(",")} className="sr-only" id="logo-upload" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}><Upload className="h-3.5 w-3.5" aria-hidden /> {busy ? "Uploading" : "Upload a logo file"}</Button>
      {err && <ErrorLine>{err}</ErrorLine>}
    </section>
  );
}

function VoiceCheck({ project, kit, checks, onDelete }: { project: ViewProps["project"]; kit: Item | null; checks: Item[]; onDelete: (id: number) => void }) {
  const gen = useGenerate(project.id);
  const model = useModelStatus(project.id);
  const [text, setText] = useState("");
  const hasVoice = !!kit && !!brandText(kit);
  const run = () => void gen.run({ generator: "voice-check", text }).then(() => setText("")).catch(() => undefined);

  return (
    <Card variant="outlined" hoverEffect={false} innerClassName="space-y-3 p-5">
      <h2 className="text-base font-semibold text-primary">Check this text against the brand voice</h2>
      {model.configured === false && <ModelGate what="The check reads your text against the voice rules." />}
      <p className="text-sm text-secondary">Paste a headline, a listing bullet or a post. You get specific before and after suggestions, saved as a draft. Nothing is changed in your text for you.</p>
      {!hasVoice && <p className="text-xs text-muted">Save a voice summary or at least one rule in the kit first.</p>}
      <Textarea rows={5} aria-label="Text to check" value={text} maxLength={6000} onChange={(e) => setText(e.target.value)} placeholder="Paste the text here" />
      <GenerateButton pending={gen.pending} onClick={run} disabled={!text.trim() || !hasVoice || model.configured === false}>Check the text</GenerateButton>
      {gen.error && <ErrorLine>{gen.error}</ErrorLine>}
      <Notes notes={gen.notes} />
      {checks.length > 0 && (
        <ul className="space-y-3" aria-label="Earlier voice checks">
          {[...checks].reverse().map((c) => {
            const sugg = Array.isArray(c.data.suggestions) ? (c.data.suggestions as { before: string; after: string; why: string }[]) : [];
            return (
              <Card variant="flat" as="li" key={c.id} className="rounded-lg p-3">
                <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-primary">{c.body || "Checked"}</p><Button size="icon-sm" variant="ghost" aria-label="Delete this check" onClick={() => onDelete(c.id)}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button></div>
                <p className="mt-1 text-xs text-muted">Text: {String(c.data.checked ?? "").slice(0, 160)}</p>
                {sugg.length === 0 ? <p className="mt-2 text-sm text-secondary">No changes suggested.</p> : (
                  <ul className="mt-2 space-y-2">
                    {sugg.map((s, i) => (
                      <li key={i} className="grid gap-1 text-sm sm:grid-cols-2 sm:gap-3">
                        <p><span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">Before</span><br />{s.before}</p>
                        <p><span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">After</span><br />{s.after}</p>
                        <p className="text-xs text-secondary sm:col-span-2">{s.why}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
