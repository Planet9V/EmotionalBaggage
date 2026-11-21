"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusTone } from "@/lib/statusTones";
import { useProject } from "@/lib/client";
import { useCreateConcept } from "@/lib/conceptsClient";
import { useQueryClient } from "@tanstack/react-query";
import { queries } from "@/lib/queries";
import { processQuery, processView } from "@/lib/process/client";
import { AreaField, Field, TextField, selectClass } from "@/components/wizard/fields";
import {
  SOURCES, buildGroups, buildItems, emptyAnswers, nextKey, stepError, type Answers, type NameRow, type PartRow,
} from "@/components/wizard/model";

const STEPS = [
  { title: "Idea", blurb: "A name and one line. Everything else can wait." },
  { title: "Who and why", blurb: "Who it is for, the problem, and why now." },
  { title: "Product", blurb: "How it works, whether any of it is printed, and the parts." },
  { title: "Proof", blurb: "The cheapest test that would show it is worth building." },
  { title: "Selling", blurb: "Where it sells first, at what price, and what it might be called." },
  { title: "Review", blurb: "Everything below is created when you press Create. Go back to change any of it. Then you go straight to the concept's first next step." },
];

export function WizardView() {
  const router = useRouter();
  const { select } = useProject();
  const createConcept = useCreateConcept();
  const qc = useQueryClient();
  const [a, setA] = useState<Answers>(emptyAnswers);
  const [step, setStep] = useState(1);
  const [reached, setReached] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dir, setDir] = useState(1);

  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => {
    setA((x) => ({ ...x, [k]: v }));
    setError("");
  };

  const go = (to: number) => {
    if (to > step) {
      for (let s = step; s < to; s++) {
        const e = stepError(a, s);
        if (e) { setError(e); setStep(s); return; }
      }
    }
    setDir(to >= step ? 1 : -1);
    setError("");
    setStep(to);
    setReached((r) => Math.max(r, to));
  };

  const create = async () => {
    for (let s = 1; s <= 5; s++) {
      const e = stepError(a, s);
      if (e) { setError(e); setStep(s); return; }
    }
    setBusy(true);
    setError("");
    try {
      // A mutation: it puts the new concept into every cached concept list, so the sidebar has it at once.
      const made = await createConcept.mutateAsync({ name: a.name.trim(), oneLiner: a.oneLiner.trim(), items: buildItems(a) });
      select(made.id);
      router.push(await firstStepHref(made.id));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  /** Where the new concept's first next step is (plan 3.9). Loading it also fills the cache the page will read. */
  const firstStepHref = async (id: string) => {
    try {
      const [state, rows] = await Promise.all([qc.fetchQuery(processQuery(id)), qc.fetchQuery(queries.items(id, null))]);
      return processView(state, rows).next.href;
    } catch {
      // The concept exists; if its process cannot be read now, the overview still shows it.
      return "/";
    }
  };

  const last = step === STEPS.length;
  const cur = STEPS[step - 1];

  return (
    <>
      <PageHeader eyebrow="New concept" title="Start a concept" blurb="Answer what you know. Blank answers stay blank, and the ones that matter become open questions." nextStep={false} />
      <div className="grid gap-8 px-8 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Progress" className="lg:sticky lg:top-6 lg:self-start">
          <ol className="space-y-1">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const active = n === step;
              const done = n < step || (n <= reached && n !== step);
              const enabled = n <= reached || !stepError(a, 1);
              return (
                <li key={s.title}>
                  <button
                    type="button"
                    disabled={!enabled}
                    aria-current={active ? "step" : undefined}
                    onClick={() => go(n)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 disabled:opacity-40 ${
                      active ? "bg-dutchOrange/10 text-primary" : "text-secondary hover:bg-subtle hover:text-primary"
                    }`}
                  >
                    <span className={`font-mono text-xs ${active ? "text-dutchOrange" : "text-muted"}`}>
                      {done && !active ? <Check className="h-3.5 w-3.5" aria-label="Visited" /> : String(n).padStart(2, "0")}
                    </span>
                    <span className={active ? "font-medium" : ""}>{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0 max-w-3xl">
          <Card hoverEffect={false} innerClassName="p-[26px]">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Step {String(step).padStart(2, "0")} of {String(STEPS.length).padStart(2, "0")}</p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-primary">{cur.title}</h2>
            <p className="mt-1 text-sm text-secondary">{cur.blurb}</p>

            <form
              className="mt-6"
              noValidate
              onSubmit={(e) => { e.preventDefault(); if (last) void create(); else go(step + 1); }}
            >
                <div className="animate-enter" key={step}>
                  {step === 1 && <StepIdea a={a} set={set} />}
                  {step === 2 && <StepWho a={a} set={set} />}
                  {step === 3 && <StepProduct a={a} set={set} setA={setA} />}
                  {step === 4 && <StepProof a={a} set={set} />}
                  {step === 5 && <StepSelling a={a} set={set} setA={setA} />}
                  {step === 6 && <StepReview a={a} edit={go} />}
                </div>

              <div aria-live="polite" className="mt-4 min-h-5 text-sm text-danger">{error}</div>

              <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
                <Button type="button" variant="ghost" disabled={step === 1 || busy} onClick={() => go(step - 1)}>
                  <ArrowLeft className="h-4 w-4" aria-hidden /> Back
                </Button>
                <Button type="submit" disabled={busy}>
                  {last ? (busy ? "Creating" : "Create concept") : "Next"}
                  {!last && <ArrowRight className="h-4 w-4" aria-hidden />}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}

type SetFn = <K extends keyof Answers>(k: K, v: Answers[K]) => void;
type SetA = React.Dispatch<React.SetStateAction<Answers>>;

function StepIdea({ a, set }: { a: Answers; set: SetFn }) {
  return (
    <div className="space-y-5">
      <TextField title="Name" required value={a.name} onChange={(v) => set("name", v)} hint="A working name is fine. You can add candidates in step 5." />
      <TextField title="One-line description" required value={a.oneLiner} onChange={(v) => set("oneLiner", v)} hint="What it is, in one sentence." />
    </div>
  );
}

function StepWho({ a, set }: { a: Answers; set: SetFn }) {
  return (
    <div className="space-y-5">
      <AreaField title="Who it is for" value={a.who} onChange={(v) => set("who", v)} />
      <AreaField title="The problem" value={a.problem} onChange={(v) => set("problem", v)} />
      <AreaField title="Why now" value={a.why} onChange={(v) => set("why", v)} />
    </div>
  );
}

function StepProduct({ a, set, setA }: { a: Answers; set: SetFn; setA: SetA }) {
  const upd = (key: number, patch: Partial<PartRow>) =>
    setA((x) => ({ ...x, parts: x.parts.map((p) => (p.key === key ? { ...p, ...patch } : p)) }));
  const addPart = () => setA((x) => ({ ...x, parts: [...x.parts, { key: nextKey(), name: "", qty: "", source: "", search: "", line: "" }] }));
  const del = (key: number) => setA((x) => ({ ...x, parts: x.parts.length > 1 ? x.parts.filter((p) => p.key !== key) : x.parts }));
  return (
    <div className="space-y-6">
      <AreaField title="How it works" value={a.how} onChange={(v) => set("how", v)} rows={4} />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-primary">Is any part 3D printed?</legend>
        <div className="flex gap-2">
          {(["yes", "no"] as const).map((v) => (
            <label key={v} className={`cursor-pointer rounded-md border px-4 py-1.5 text-sm transition-colors duration-150 focus-within:ring-2 focus-within:ring-dutchOrange ${
              a.printed === v ? "border-dutchOrange bg-dutchOrange/10 text-primary" : "border-hairline bg-surface text-secondary hover:border-dutchOrange/40"
            }`}>
              <input type="radio" name="printed" value={v} checked={a.printed === v} onChange={() => set("printed", v)} className="sr-only" />
              {v === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {([["w", "Width"], ["h", "Height"], ["d", "Depth"]] as const).map(([k, t]) => (
            <Field key={k} title={`${t} (mm)`}>
              {(id) => <Input id={id} inputMode="decimal" className="font-mono" value={a[k]} onChange={(e) => set(k, e.target.value)} />}
            </Field>
          ))}
        </div>
        <p className="text-xs text-muted">Optional overall envelope. With a printed part and all three sizes, an Enclosure part is added to the bill of materials.</p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-primary">Parts</legend>
        <ul className="space-y-3">
          {a.parts.map((p, i) => (
            <Card variant="well" as="li" key={p.key} className="p-3">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-6">
                  <Input aria-label={`Part ${i + 1} name`} placeholder="Part name" value={p.name} onChange={(e) => upd(p.key, { name: e.target.value })} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input aria-label={`Part ${i + 1} quantity`} placeholder="Qty" inputMode="numeric" className="font-mono" value={p.qty} onChange={(e) => upd(p.key, { qty: e.target.value })} />
                </div>
                <div className="col-span-8 sm:col-span-4">
                  <select aria-label={`Part ${i + 1} source`} className={selectClass} value={p.source} onChange={(e) => upd(p.key, { source: e.target.value })}>
                    <option value="">Source</option>
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-7 sm:col-span-8">
                  <Input aria-label={`Part ${i + 1} search term`} placeholder="Search term" value={p.search} onChange={(e) => upd(p.key, { search: e.target.value })} />
                </div>
                <div className="col-span-5 sm:col-span-4 flex gap-2">
                  <Input aria-label={`Part ${i + 1} estimated line cost`} placeholder="Line cost" inputMode="decimal" className="font-mono" value={p.line} onChange={(e) => upd(p.key, { line: e.target.value })} />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove part ${i + 1}`} disabled={a.parts.length === 1} onClick={() => del(p.key)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={addPart}><Plus className="h-3.5 w-3.5" aria-hidden /> Add part</Button>
        <p className="text-xs text-muted">Rows without a name are ignored. Parts are numbered P1, P2 and so on.</p>
      </fieldset>
    </div>
  );
}

function StepProof({ a, set }: { a: Answers; set: SetFn }) {
  return (
    <div className="space-y-5">
      <AreaField title="The cheapest test" hint="What would show this is worth building, before you build it." value={a.test} onChange={(v) => set("test", v)} />
      <TextField title="What the test costs" mono inputMode="decimal" value={a.testCost} onChange={(v) => set("testCost", v)} />
      <AreaField title="Go/no-go gate" hint="The result that means go, and the result that means stop." value={a.gate} onChange={(v) => set("gate", v)} />
    </div>
  );
}

function StepSelling({ a, set, setA }: { a: Answers; set: SetFn; setA: SetA }) {
  const upd = (key: number, patch: Partial<NameRow>) =>
    setA((x) => ({ ...x, names: x.names.map((n) => (n.key === key ? { ...n, ...patch } : n)) }));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField title="Primary channel" value={a.channel} onChange={(v) => set("channel", v)} />
        <TextField title="Target price" mono inputMode="decimal" value={a.price} onChange={(v) => set("price", v)} />
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-primary">Working names and taglines</legend>
        <ul className="space-y-2">
          {a.names.map((n, i) => (
            <li key={n.key} className="flex gap-2">
              <select aria-label={`Entry ${i + 1} kind`} className={`${selectClass} w-28 shrink-0`} value={n.kind} onChange={(e) => upd(n.key, { kind: e.target.value as NameRow["kind"] })}>
                <option>Name</option>
                <option>Tagline</option>
              </select>
              <Input aria-label={`Entry ${i + 1} text`} value={n.text} onChange={(e) => upd(n.key, { text: e.target.value })} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove entry ${i + 1}`} disabled={a.names.length === 1}
                onClick={() => setA((x) => ({ ...x, names: x.names.filter((m) => m.key !== n.key) }))}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={() => setA((x) => ({ ...x, names: [...x.names, { key: nextKey(), kind: "Name", text: "" }] }))}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add another
        </Button>
      </fieldset>
    </div>
  );
}

function StepReview({ a, edit }: { a: Answers; edit: (n: number) => void }) {
  const groups = buildGroups(a);
  return (
    <div className="space-y-5">
      <Card variant="well" className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Concept</p>
            <p className="mt-1 text-base font-semibold text-primary">{a.name.trim()}</p>
            <p className="text-sm text-secondary">{a.oneLiner.trim()}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => edit(1)}>Edit</Button>
        </div>
      </Card>
      {groups.length === 0 && <p className="text-sm text-secondary">Nothing else was entered, so only the concept itself is created.</p>}
      {groups.map((g) => (
        <section key={g.label} className="rounded-xl border border-hairline p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">{g.label}</h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => edit(g.step)}>Edit</Button>
          </div>
          <ul className="mt-3 divide-y divide-hairline">
            {g.items.map((it, i) => (
              <li key={i} className="flex items-start justify-between gap-4 py-2 text-sm">
                <div className="min-w-0">
                  <p className="text-primary">
                    {typeof it.data?.ref === "string" && <span className="mr-2 font-mono text-xs text-muted">{it.data.ref}</span>}
                    {it.title}
                  </p>
                  {it.body && <p className="mt-0.5 whitespace-pre-line text-secondary">{it.body}</p>}
                  <Meta item={it} />
                </div>
                {it.status && <StatusBadge tone={statusTone(it.status)}>{it.status}</StatusBadge>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Meta({ item }: { item: { data?: Record<string, unknown> } }) {
  const d = item.data ?? {};
  const bits: string[] = [];
  if (d.kind) bits.push(String(d.kind));
  if (d.qty !== undefined) bits.push(`qty ${d.qty}`);
  if (d.source) bits.push(String(d.source));
  if (d.search) bits.push(`search: ${d.search}`);
  if (d.line !== undefined) bits.push(`line ${d.line}`);
  if (d.price !== undefined) bits.push(`price ${d.price}`);
  const g = d.geometry as { size?: number[] } | undefined;
  if (g?.size) bits.push(`${g.size.join(" x ")} mm shell`);
  return bits.length ? <p className="mt-0.5 font-mono text-xs text-muted">{bits.join(" · ")}</p> : null;
}
