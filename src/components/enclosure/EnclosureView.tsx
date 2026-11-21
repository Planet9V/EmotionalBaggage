"use client";

/**
 * Design > Enclosure (plan 5.9): pick a generator, set the parameters, generate a base and a lid around the parts,
 * and see what was checked on the result. Only offered when at least one part has a box.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useItems } from "@/lib/client";
import { messageOf } from "@/lib/queries";
import { sectionHref } from "@/lib/chat/shared";
import { buildSpec, enclosureOffered, validateSpec } from "@/lib/enclosure/spec";
import { validateParams, withDefaults } from "@/lib/enclosure/validate";
import { DEFAULT_PARAMS, GENERATORS, GENERATOR_KEYS, type EnclosureParams, type GeneratorKey } from "@/lib/enclosure/types";
import type { ViewProps } from "@/components/views/types";
import { generate, getStatus, type GenerateAnswer, type ResultFailed, type ResultOk } from "./client";
import { fromDraft, ParamsForm, toDraft, type Draft } from "./ParamsForm";
import { ResultPanel } from "./ResultPanel";
import { SendToPrinting } from "./SendToPrinting";
import { PartOpeningEditor } from "./PartOpeningEditor";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState, ErrorLine, LoadingBlocks } from "@/components/ui/states";
import { Panel } from "@/components/ui/panel";
import { fileSlug } from "@/lib/format";

const BOM = "design/bom";
const SAVE_STORE = "design/enclosure";

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}
const useDark = () =>
  useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains("dark"),
    () => false
  );

const mm = (n: number) => `${Math.round(n * 10) / 10}`;

type Saved = { enclosureGenerator?: GeneratorKey; params?: Partial<EnclosureParams> };
type Held = { result: ResultOk | ResultFailed; inputKey: string };

type Items = ReturnType<typeof useItems>;

const usableAtStart = (d: Saved) => withDefaults(d.params);

function Editor({ project, bom, saved }: { project: ViewProps["project"]; bom: Items; saved: Items }) {
  const dark = useDark();
  const status = useQuery({ queryKey: ["enclosure-status", project.id], queryFn: () => getStatus(project.id), retry: false, staleTime: 30_000 });

  const row = saved.items[0];
  const first = (row?.data ?? {}) as Saved;
  const [generator, setGenerator] = useState<GeneratorKey>(first.enclosureGenerator && GENERATOR_KEYS.includes(first.enclosureGenerator) ? first.enclosureGenerator : "casemaker");
  const [draft, setDraft] = useState<Draft>(() => toDraft(withDefaults(first.params)));
  const [held, setHeld] = useState<Partial<Record<GeneratorKey, Held>>>({});
  const [running, setRunning] = useState<GeneratorKey[] | null>(null);
  const [runError, setRunError] = useState("");
  const [compare, setCompare] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [editPart, setEditPart] = useState<number | null>(null);

  const typed = useMemo(() => fromDraft(draft), [draft]);
  const paramIssues = useMemo(() => validateParams(typed as unknown as EnclosureParams), [typed]);
  const usable = useMemo(() => withDefaults(typed as unknown as Partial<EnclosureParams>), [typed]);
  const spec = useMemo(() => buildSpec({ items: bom.items, params: usable }), [bom.items, usable]);
  const specIssues = useMemo(() => (paramIssues.length ? [] : validateSpec(spec)), [spec, paramIssues]);
  const errors = [...paramIssues, ...specIssues].filter((i) => i.severity === "error");
  const warnings = specIssues.filter((i) => i.severity === "warning");
  const inputKey = useMemo(() => JSON.stringify([usable, spec.outer, spec.inner, spec.openings.map((o) => [o.partRef, o.face, o.center, o.width, o.height])]), [usable, spec]);

  // Save the choice a moment after the last change.
  const lastSaved = useRef<string>(JSON.stringify([generator, usableAtStart(first)]));
  const { add, patch } = saved;
  const persist = useCallback(
    async (g: GeneratorKey, p: EnclosureParams) => {
      setSaveState("saving");
      try {
        const data = { enclosureGenerator: g, params: p };
        // only the choice: the server merges it, so the checks it keeps on the row (data.checked) are never written back stale
        if (row) await patch(row.id, { data });
        else await add({ section: SAVE_STORE, title: "Enclosure settings", data });
        setSaveState("saved");
      } catch {
        setSaveState("failed");
      }
    },
    [row, patch, add]
  );
  useEffect(() => {
    if (paramIssues.length) return;
    const key = JSON.stringify([generator, usable]);
    if (key === lastSaved.current) return;
    const t = setTimeout(() => {
      lastSaved.current = key;
      void persist(generator, usable);
    }, 700);
    return () => clearTimeout(t);
  }, [generator, usable, paramIssues.length, row, persist]);

  const run = async (which: GeneratorKey[]) => {
    setRunError("");
    setRunning(which);
    try {
      const answer: GenerateAnswer = await generate(project.id, which, usable);
      // The server keeps the checks on the saved choice for the Design gate; reload it so a later save does not write back an older copy.
      void saved.reload();
      setHeld((h) => {
        const next = { ...h };
        for (const r of answer.results) next[r.key] = { result: r, inputKey };
        return next;
      });
    } catch (e) {
      setRunError(messageOf(e) || "The enclosure could not be generated.");
    } finally {
      setRunning(null);
    }
  };

  const stat = status.data;
  const yappDown = stat ? !stat.yapp.available : false;
  const options = GENERATOR_KEYS.map((k) => ({ key: k, ...GENERATORS[k] }));
  const busy = running !== null;
  const blocked = errors.length > 0;
  const shown = GENERATOR_KEYS.filter((k) => held[k]);
  const both = !!(held.casemaker && held.yapp);
  const visible: GeneratorKey[] = both && compare ? shown : shown.includes(generator) ? [generator] : shown.slice(0, 1);

  return (
    <div className="space-y-4">
      <Panel
        compact
        title="Generator"
        description="Both read the same parts and parameters. Pick one, or build with both and compare."
        actions={
          <span role="status" className="text-xs text-muted">
            {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : ""}
          </span>
        }
      >
        <div role="radiogroup" aria-label="Enclosure generator" className="grid gap-3 md:grid-cols-2">
          {options.map((o) => {
            const on = generator === o.key;
            const st = stat?.[o.key];
            return (
              <button
                key={o.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setGenerator(o.key)}
                className={`rounded-lg border p-3 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange ${on ? "border-dutchOrange bg-subtle" : "border-hairline bg-surface hover:border-dutchOrange"}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-primary">{o.label}</span>
                  <span className="text-xs text-muted">{o.licence}</span>
                </span>
                <span className="mt-1 block text-xs text-secondary">
                  {o.key === "casemaker"
                    ? "Runs inside this server. Takes a few seconds. Its project file opens in the CaseMaker web app."
                    : "Runs in OpenSCAD inside the planner service. Takes about a minute. Its .scad file opens in OpenSCAD."}
                </span>
                <span className="mt-1 block text-xs">
                  {status.isPending ? (
                    <span className="text-muted">Checking whether it can run</span>
                  ) : st?.available ? (
                    <span className="text-success">Available</span>
                  ) : o.key === "yapp" ? (
                    <span className="text-warning">Not available: {st?.reason ?? "the planner could not be asked."}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        {status.isError ? (
          <p role="alert" className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
            Could not ask whether the generators can run.{" "}
            <button type="button" className="underline" onClick={() => void status.refetch()}>
              Try again
            </button>
          </p>
        ) : null}
        {saveState === "failed" ? <ErrorLine>The settings were not saved. {saved.writeError}</ErrorLine> : null}
        <div className="mt-3"><SendToPrinting projectId={project.id} beforeSend={() => persist(generator, usable)} disabled={blocked || paramIssues.length > 0} reason="Fix the problems listed below first." /></div>
      </Panel>

      <Panel compact title="Parameters" description="Defaults are shown under each field. The checks hold the result to the clearance you set." actions={
        <Button variant="outline" size="sm" onClick={() => setDraft(toDraft(DEFAULT_PARAMS))}>
          Reset to defaults
        </Button>
      }>
        <ParamsForm draft={draft} onChange={setDraft} issues={paramIssues} />
      </Panel>

      <Panel
        compact
        title="What the parts need"
        description={
          spec.envelope === "shell"
            ? `Envelope taken from the shell part: ${mm(spec.outer.max[0] - spec.outer.min[0])} by ${mm(spec.outer.max[2] - spec.outer.min[2])} by ${mm(spec.outer.max[1] - spec.outer.min[1])} mm outside.`
            : `No shell part, so the envelope is worked out from the parts, the clearance and the walls: ${mm(spec.outer.max[0] - spec.outer.min[0])} by ${mm(spec.outer.max[2] - spec.outer.min[2])} by ${mm(spec.outer.max[1] - spec.outer.min[1])} mm outside.`
        }
      >
        {errors.length ? (
          <ul role="alert" className="mb-3 space-y-1 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        ) : null}
        {warnings.length ? (
          <ul className="mb-3 space-y-1 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
            {warnings.map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        ) : null}
        {spec.openings.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Openings the enclosure will have</caption>
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="py-1 pr-3 font-medium">Part</th>
                  <th scope="col" className="py-1 pr-3 font-medium">Wall</th>
                  <th scope="col" className="py-1 pr-3 font-medium">Shape and size (mm)</th>
                  <th scope="col" className="py-1 font-medium">Why</th>
                </tr>
              </thead>
              <tbody>
                {spec.openings.map((o, n) => (
                  <tr key={n} className="border-t border-hairline align-top">
                    <td className="py-1.5 pr-3 text-primary">{o.partRef}</td>
                    <td className="py-1.5 pr-3 text-secondary">{o.face}</td>
                    <td className="py-1.5 pr-3 text-secondary">{o.shape === "circle" ? `round, ${mm(o.width)}` : `${mm(o.width)} by ${mm(o.height)}`}</td>
                    <td className="py-1.5 text-secondary">{o.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-secondary">No part needs an opening. A part sits against a wall, or crosses one, only when it has to show or reach outside.</p>
        )}
        {spec.standoffs ? (
          <p className="mt-3 text-sm text-secondary">
            {spec.standoffs.partRef} stands on {spec.standoffs.holes.length} standoffs, {mm(spec.standoffs.height)} mm tall
            {spec.standoffs.assumed ? ". The mounting holes are assumed (four, 3.5 mm in from the corners) because none are entered for the board; enter its own holes below" : ""}
            {spec.standoffs.dropped.length ? `. Assumed holes under ${spec.standoffs.dropped.join(", ")} were left out` : ""}.
          </p>
        ) : null}
        {(() => {
          const editable = spec.parts.filter((p) => p.role === "inside" || p.role === "through");
          if (!editable.length) return null;
          const chosen = editable.find((p) => p.id === editPart) ?? null;
          const item = chosen ? bom.items.find((i) => i.id === chosen.id) ?? null : null;
          return (
            <div className="mt-4 space-y-3 border-t border-hairline pt-3">
              <label className="block max-w-sm text-xs font-medium text-secondary" htmlFor="enclosure-part-pick">
                Change a part&apos;s opening{spec.standoffs ? " or the board's mounting holes" : ""}
                <NativeSelect id="enclosure-part-pick" className="mt-1" value={editPart ?? ""} onChange={(e) => setEditPart(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Choose a part</option>
                  {editable.map((p) => <option key={p.id} value={p.id}>{p.ref ? `${p.ref} ` : ""}{p.title}</option>)}
                </NativeSelect>
              </label>
              {chosen && item ? <PartOpeningEditor key={item.id} item={item} isBoard={chosen.kind === "pcb"} onSave={(data) => bom.patch(item.id, { data })} /> : null}
            </div>
          );
        })()}
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void run([generator])} disabled={busy || blocked || (generator === "yapp" && yappDown)}>
          {running ? `Generating with ${running.map((k) => GENERATORS[k].label).join(" and ")}` : `Generate with ${GENERATORS[generator].label}`}
        </Button>
        <Button variant="outline" onClick={() => void run(yappDown ? ["casemaker"] : [...GENERATOR_KEYS])} disabled={busy || blocked || yappDown}>
          Generate with both, to compare
        </Button>
        {busy ? (
          <span role="status" className="text-sm text-secondary">
            {running!.includes("yapp") ? "YAPP_Box takes about a minute. The page stays usable." : "Working."}
          </span>
        ) : null}
        {blocked ? <span className="text-sm text-secondary">Fix the problems above first.</span> : null}
        {both ? (
          <Button variant="ghost" onClick={() => setCompare((c) => !c)} aria-pressed={compare}>
            {compare ? "Show one result" : "Show both side by side"}
          </Button>
        ) : null}
      </div>
      {runError ? <ErrorLine>{runError}</ErrorLine> : null}

      {shown.length === 0 && !busy ? (
        <EmptyState title="Nothing generated yet">Choose a generator and press Generate. The checks are worked out on the result and shown here.</EmptyState>
      ) : null}

      {visible.map((k) => {
        const h = held[k]!;
        if (!h.result.ok) {
          return (
            <div key={k} role="alert" className="rounded-xl border border-hairline bg-danger-soft p-4">
              <p className="text-sm font-medium text-danger">{GENERATORS[k].label} could not produce an enclosure.</p>
              <p className="mt-1 text-sm text-danger wrap-anywhere">{h.result.error}</p>
              <Button variant="outline" size="sm" className="mt-3" disabled={busy} onClick={() => void run([k])}>
                Try again
              </Button>
            </div>
          );
        }
        return null;
      })}
      <div className={visible.length > 1 ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"}>
        {visible.map((k) => {
          const h = held[k]!;
          return h.result.ok ? <ResultPanel key={k} result={h.result} dark={dark} floorY={spec.outer.min[1]} slug={fileSlug(project.name)} stale={h.inputKey !== inputKey} /> : null;
        })}
      </div>
    </div>
  );
}

export function EnclosureView({ project }: ViewProps) {
  const bom = useItems(project.id, BOM);
  const saved = useItems(project.id, SAVE_STORE);
  if (bom.loading || saved.loading) return <LoadingBlocks label="Loading the enclosure" />;
  if (bom.error || saved.error) {
    return (
      <div role="alert" className="max-w-xl rounded-xl border border-hairline bg-danger-soft p-4">
        <p className="text-sm font-medium text-danger">The enclosure could not be loaded.</p>
        <p className="mt-1 text-sm text-danger wrap-anywhere">{bom.error || saved.error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void (bom.error ? bom.reload() : saved.reload())}>
          Try again
        </Button>
      </div>
    );
  }
  if (!enclosureOffered(bom.items)) {
    const layout = sectionHref(BOM);
    return (
      <EmptyState title="No part has a box yet">
        An enclosure is built around the parts, so it needs their sizes and places.{" "}
        {layout ? (
          <>
            Add them in{" "}
            <Link href={layout} className="text-link underline">
              Physical layout
            </Link>
            .
          </>
        ) : null}{" "}
        A product with no parts that have boxes (a service, a software product) gets no enclosure option.
      </EmptyState>
    );
  }

  return <Editor project={project} bom={bom} saved={saved} />;
}

