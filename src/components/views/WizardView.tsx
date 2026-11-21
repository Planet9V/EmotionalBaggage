"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type FieldErrors, type Resolver, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { defineStepper } from "@stepperize/react";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusTone } from "@/lib/statusTones";
import { useProject } from "@/lib/client";
import { useCreateConcept } from "@/lib/conceptsClient";
import { useQueryClient } from "@tanstack/react-query";
import { queries } from "@/lib/queries";
import { processQuery, processView } from "@/lib/process/client";
import { PRODUCT_TYPES, productType } from "@/lib/productTypes";
import { STAGES } from "@/lib/menu";
import { SOURCES, STEP_SCHEMAS, buildGroups, buildItems, emptyAnswers, nextKey, type Answers, type StepId } from "@/components/wizard/model";

// The steps are a Stepperize flow; each step's schema is what lets it move on (components/wizard/model.ts).
const wizard = defineStepper([
  { id: "idea", title: "Idea", blurb: "What kind of product it is, a name and one line. Everything else can wait.", schema: STEP_SCHEMAS.idea },
  { id: "who", title: "Who and why", blurb: "Who it is for, the problem, and why now.", schema: STEP_SCHEMAS.who },
  { id: "product", title: "Product", blurb: "How it works, whether any of it is printed, and the parts.", schema: STEP_SCHEMAS.product },
  { id: "proof", title: "Proof", blurb: "The cheapest test that would show it is worth building.", schema: STEP_SCHEMAS.proof },
  { id: "selling", title: "Selling", blurb: "Where it sells first, at what price, and what it might be called.", schema: STEP_SCHEMAS.selling },
  { id: "review", title: "Review", blurb: "Everything below is created when you press Create. Go back to change any of it. Then you go straight to the concept's first next step.", schema: STEP_SCHEMAS.review },
] as const);

/** "Schematic and Wiring" for the sections a product type does not show. */
const hiddenNames = (hidden: readonly string[]) =>
  hidden
    .map((k) => {
      const [st, sec] = k.split("/");
      return STAGES.find((x) => x.key === st)?.sections.find((x) => x.key === sec)?.label ?? sec;
    })
    .join(" and ");

export function WizardView() {
  const router = useRouter();
  const { select } = useProject();
  const createConcept = useCreateConcept();
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const idRef = useRef<StepId>("idea");

  // Each step is checked against its own schema, by the resolver of whichever step is showing.
  const resolver: Resolver<Answers> = (values, ctx, opts) => zodResolver(STEP_SCHEMAS[idRef.current] as never)(values as never, ctx, opts as never) as never;
  const form = useForm<Answers>({ defaultValues: emptyAnswers(), resolver, mode: "onSubmit", reValidateMode: "onChange" });
  const { register, handleSubmit, getValues, formState } = form;

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

  const create = async () => {
    const a = getValues();
    setBusy(true);
    setError("");
    try {
      // A mutation: it puts the new concept into every cached concept list, so the sidebar has it at once.
      const made = await createConcept.mutateAsync({ name: a.name.trim(), oneLiner: a.oneLiner.trim(), productType: a.productType, items: buildItems(a) });
      select(made.id);
      router.push(await firstStepHref(made.id));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      throw e;
    }
  };

  const stepper = wizard.useStepper({ linear: true, onFinish: create });
  const currentId = stepper.current.id as StepId;
  useEffect(() => {
    idRef.current = currentId;
  }, [currentId]);
  // A new step moves focus to its heading, so a keyboard or screen reader user starts at the top of it
  // instead of on the page body or on Continue (U7). Not on the first render: the page's own order applies.
  const heading = useRef<HTMLHeadingElement>(null);
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    heading.current?.focus();
  }, [currentId]);
  const index = stepper.index + 1;
  const last = stepper.isLast;

  const submit = handleSubmit(
    async () => {
      setError("");
      const r = await stepper.next(getValues());
      if (!r.accepted && "issues" in r && r.issues?.length) setError(r.issues[0]!.message);
    },
    () => setError(""), // every invalid field shows its own message, next to it
  );

  const a = useWatch({ control: form.control }) as Answers;
  const go = async (id: StepId) => {
    setError("");
    await stepper.goTo(id);
  };

  return (
    <>
      <PageHeader eyebrow="New concept" title="Start a concept" blurb="Answer what you know. Blank answers stay blank, and the ones that matter become open questions." nextStep={false} />
      <div className="grid gap-8 px-8 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Progress" className="lg:sticky lg:top-6 lg:self-start">
          <ol className="space-y-1">
            {stepper.steps.map((s, i) => {
              const n = i + 1;
              const active = s.id === stepper.current.id;
              const done = stepper.state(s.id) === "complete";
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!active && !stepper.canGoTo(s.id)}
                    aria-current={active ? "step" : undefined}
                    onClick={() => void go(s.id as StepId)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 disabled:opacity-40 ${
                      active ? "bg-dutchOrange/10 text-primary" : "text-secondary hover:bg-subtle hover:text-primary"
                    }`}
                  >
                    <span className={`font-mono text-xs ${active ? "text-link" : "text-muted"}`}>
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
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Step {String(index).padStart(2, "0")} of {String(stepper.steps.length).padStart(2, "0")}</p>
            <h2 ref={heading} tabIndex={-1} className="mt-1.5 text-xl font-semibold tracking-tight text-primary focus:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange rounded-sm">{stepper.current.title}</h2>
            <p className="mt-1 text-sm text-secondary">{stepper.current.blurb}</p>

            <form className="mt-6" noValidate onSubmit={(e) => void submit(e)}>
              <div key={stepper.current.id} className="animate-enter">
                {stepper.match({
                  idea: () => <StepIdea register={register} errors={formState.errors} selected={a.productType} />,
                  who: () => <StepWho register={register} />,
                  product: () => <StepProduct form={form} />,
                  proof: () => <StepProof register={register} errors={formState.errors} />,
                  selling: () => <StepSelling form={form} />,
                  review: () => <StepReview a={a} edit={(id) => void go(id)} />,
                })}
              </div>

              <div aria-live="polite" className="mt-4 min-h-5 text-sm text-danger">{error}</div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <Button type="button" variant="ghost" disabled={stepper.isFirst || busy} onClick={() => { setError(""); void stepper.prev(); }}>
                  <ArrowLeft className="h-4 w-4" aria-hidden /> Back
                </Button>
                <Button type="submit" disabled={busy}>
                  {last ? (busy ? "Creating" : "Create the concept") : "Continue"} {last ? <Check className="h-4 w-4" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}

type Reg = UseFormRegister<Answers>;
type Errs = FieldErrors<Answers>;

function StepIdea({ register, errors, selected }: { register: Reg; errors: Errs; selected: string }) {
  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-primary">What kind of product is it?</legend>
        <p className="text-xs text-muted">This decides which sections the concept shows. You can change it later on the Concepts page, and nothing is deleted.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {PRODUCT_TYPES.map((t) => (
            <label
              key={t.key}
              className={`cursor-pointer rounded-lg border p-3 text-sm transition-colors duration-150 focus-within:ring-2 focus-within:ring-dutchOrange ${
                selected === t.key ? "border-dutchOrange bg-dutchOrange/10 text-primary" : "border-hairline bg-surface text-secondary hover:border-dutchOrange/40"
              }`}
            >
              <input type="radio" value={t.key} {...register("productType")} className="sr-only" />
              <span className="block font-medium text-primary">{t.label}</span>
              <span className="mt-1 block text-xs text-secondary">{t.hidden.length ? `Hides ${hiddenNames(t.hidden)}.` : "Shows every section."}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="w-name" label="Name" required hint="A working name is fine. You can add candidates in step 5." error={errors.name?.message}>
        <Input id="w-name" aria-invalid={!!errors.name} {...register("name")} />
      </Field>
      <Field id="w-one" label="One-line description" required hint="What it is, in one sentence." error={errors.oneLiner?.message}>
        <Input id="w-one" aria-invalid={!!errors.oneLiner} {...register("oneLiner")} />
      </Field>
    </div>
  );
}

function StepWho({ register }: { register: Reg }) {
  return (
    <div className="space-y-5">
      <Field id="w-who" label="Who it is for"><Textarea id="w-who" rows={3} {...register("who")} /></Field>
      <Field id="w-problem" label="The problem"><Textarea id="w-problem" rows={3} {...register("problem")} /></Field>
      <Field id="w-why" label="Why now"><Textarea id="w-why" rows={3} {...register("why")} /></Field>
    </div>
  );
}

function StepProduct({ form }: { form: ReturnType<typeof useForm<Answers>> }) {
  const { register, control, formState: { errors } } = form;
  const parts = useFieldArray({ control, name: "parts" });
  const printed = useWatch({ control, name: "printed" });
  return (
    <div className="space-y-6">
      <Field id="w-how" label="How it works"><Textarea id="w-how" rows={4} {...register("how")} /></Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-primary">Is any part 3D printed?</legend>
        <div className="flex gap-2">
          {(["yes", "no"] as const).map((v) => (
            <label key={v} className={`cursor-pointer rounded-md border px-4 py-1.5 text-sm transition-colors duration-150 focus-within:ring-2 focus-within:ring-dutchOrange ${
              printed === v ? "border-dutchOrange bg-dutchOrange/10 text-primary" : "border-hairline bg-surface text-secondary hover:border-dutchOrange/40"
            }`}>
              <input type="radio" value={v} {...register("printed")} className="sr-only" />
              {v === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {([["w", "Width"], ["h", "Height"], ["d", "Depth"]] as const).map(([k, t]) => (
            <Field key={k} id={`w-${k}`} label={`${t} (mm)`}>
              <Input id={`w-${k}`} inputMode="decimal" className="font-mono" aria-invalid={k === "w" && !!errors.w} {...register(k)} />
            </Field>
          ))}
        </div>
        {errors.w?.message && <p role="alert" className="text-xs text-danger">{errors.w.message}</p>}
        <p className="text-xs text-muted">Optional overall envelope. With a printed part and all three sizes, an Enclosure part is added to the bill of materials.</p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-primary">Parts</legend>
        <ul className="space-y-3">
          {parts.fields.map((p, i) => (
            <Card variant="well" as="li" key={p.id} className="p-3">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-6">
                  <Input aria-label={`Part ${i + 1} name`} placeholder="Part name" {...register(`parts.${i}.name`)} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input aria-label={`Part ${i + 1} quantity`} placeholder="Qty" inputMode="numeric" className="font-mono" aria-invalid={!!errors.parts?.[i]?.qty} {...register(`parts.${i}.qty`)} />
                </div>
                <div className="col-span-8 sm:col-span-4">
                  <NativeSelect aria-label={`Part ${i + 1} source`} {...register(`parts.${i}.source`)}>
                    <option value="">Source</option>
                    {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </NativeSelect>
                </div>
                <div className="col-span-7 sm:col-span-8">
                  <Input aria-label={`Part ${i + 1} search term`} placeholder="Search term" {...register(`parts.${i}.search`)} />
                </div>
                <div className="col-span-5 sm:col-span-4 flex gap-2">
                  <Input aria-label={`Part ${i + 1} estimated line cost`} placeholder="Line cost" inputMode="decimal" className="font-mono" aria-invalid={!!errors.parts?.[i]?.line} {...register(`parts.${i}.line`)} />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove part ${i + 1}`} disabled={parts.fields.length === 1} onClick={() => parts.remove(i)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
              {(errors.parts?.[i]?.qty?.message || errors.parts?.[i]?.line?.message) && (
                <p role="alert" className="mt-2 text-xs text-danger">{errors.parts?.[i]?.qty?.message ?? errors.parts?.[i]?.line?.message}</p>
              )}
            </Card>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={() => parts.append({ key: nextKey(), name: "", qty: "", source: "", search: "", line: "" })}><Plus className="h-3.5 w-3.5" aria-hidden /> Add part</Button>
        <p className="text-xs text-muted">Rows without a name are ignored. Parts are numbered P1, P2 and so on.</p>
      </fieldset>
    </div>
  );
}

function StepProof({ register, errors }: { register: Reg; errors: Errs }) {
  return (
    <div className="space-y-5">
      <Field id="w-test" label="The cheapest test" hint="What would show this is worth building, before you build it."><Textarea id="w-test" rows={3} {...register("test")} /></Field>
      <Field id="w-cost" label="What the test costs" error={errors.testCost?.message}><Input id="w-cost" inputMode="decimal" className="font-mono" aria-invalid={!!errors.testCost} {...register("testCost")} /></Field>
      <Field id="w-gate" label="Go/no-go gate" hint="The result that means go, and the result that means stop."><Textarea id="w-gate" rows={3} {...register("gate")} /></Field>
    </div>
  );
}

function StepSelling({ form }: { form: ReturnType<typeof useForm<Answers>> }) {
  const { register, control, formState: { errors } } = form;
  const names = useFieldArray({ control, name: "names" });
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="w-channel" label="Primary channel"><Input id="w-channel" {...register("channel")} /></Field>
        <Field id="w-price" label="Target price" error={errors.price?.message}><Input id="w-price" inputMode="decimal" className="font-mono" aria-invalid={!!errors.price} {...register("price")} /></Field>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-primary">Working names and taglines</legend>
        <ul className="space-y-2">
          {names.fields.map((n, i) => (
            <li key={n.id} className="flex gap-2">
              <NativeSelect aria-label={`Entry ${i + 1} kind`} className="w-28 shrink-0" {...register(`names.${i}.kind`)}>
                <option>Name</option>
                <option>Tagline</option>
              </NativeSelect>
              <Input aria-label={`Entry ${i + 1} text`} {...register(`names.${i}.text`)} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove entry ${i + 1}`} disabled={names.fields.length === 1} onClick={() => names.remove(i)}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={() => names.append({ key: nextKey(), kind: "Name", text: "" })}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add another
        </Button>
      </fieldset>
    </div>
  );
}

const STEP_IDS: StepId[] = ["idea", "who", "product", "proof", "selling"];

function StepReview({ a, edit }: { a: Answers; edit: (id: StepId) => void }) {
  const groups = buildGroups(a);
  return (
    <div className="space-y-5">
      <Card variant="well" className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Concept</p>
            <p className="mt-1 text-base font-semibold text-primary">{a.name.trim()}</p>
            <p className="text-sm text-secondary">{a.oneLiner.trim()}</p>
            <p className="mt-1 text-xs text-muted">{productType(a.productType).label}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => edit("idea")}>Edit</Button>
        </div>
      </Card>
      {groups.length === 0 && <p className="text-sm text-secondary">Nothing else was entered, so only the concept itself is created.</p>}
      {groups.map((g) => (
        <section key={g.label} className="rounded-xl border border-hairline p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">{g.label}</h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => edit(STEP_IDS[g.step - 1]!)}>Edit</Button>
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
