"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Download, Printer, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorLine } from "@/components/parts/controls";
import { Modal } from "@/components/parts/Modal";
import { api, useFilesChanged, useItems } from "@/lib/client";
import { STORE } from "@/lib/domain";
import { Checklist } from "@/components/buildsheet/Checklist";
import { ConnectionsTable } from "@/components/buildsheet/ConnectionsTable";
import { CutList } from "@/components/buildsheet/CutList";
import { HarnessPanel } from "@/components/buildsheet/HarnessPanel";
import { Joints } from "@/components/buildsheet/Joints";
import { Progress } from "@/components/buildsheet/Progress";
import { StepCard } from "@/components/buildsheet/StepCard";
import {
  DEFAULT_ALLOWANCE, DEFAULT_ROUTING, beforePower, connectionsByPart, consumables, counts, cutList,
  groupByPart, hubRef, partMap, sequence, toWires, isSoldered,
} from "@/components/buildsheet/derive";
import { buildMarkdown } from "@/components/buildsheet/markdown";
import type { ViewProps } from "./types";

type Mode = "order" | "part";

const PRINT_CSS = `
@media print {
  .bs-root, .bs-root * { color: #000 !important; background: transparent !important; border-color: #000 !important; box-shadow: none !important; }
  .bs-root { background: #fff !important; }
  .bs-root .bs-dot { border: 1px solid #000 !important; }
  .bs-root [role="progressbar"] > div { background: #000 !important; }
}
`;

const EYEBROW = "font-mono text-[10px] uppercase tracking-[0.2em] text-link";

function Section({ n, title, blurb, children }: { n: string; title: string; blurb?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3" aria-labelledby={`bs-${n}`}>
      <div>
        <p className={EYEBROW}>{n}</p>
        <h3 id={`bs-${n}`} className="mt-1 text-lg font-semibold tracking-tight text-primary">{title}</h3>
        {blurb && <p className="mt-0.5 max-w-3xl text-sm text-secondary">{blurb}</p>}
      </div>
      {children}
    </section>
  );
}

const parseNum = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function BuildSheetView({ project, store }: ViewProps) {
  const reduce = useReducedMotion();
  const wiring = useItems(project.id, store || STORE.wiring);
  const partItems = useItems(project.id, STORE.parts);
  const filesChanged = useFilesChanged(project.id);
  const [mode, setMode] = useState<Mode>("order");
  const [routing, setRouting] = useState({ text: String(DEFAULT_ROUTING), value: DEFAULT_ROUTING });
  const [allowance, setAllowance] = useState({ text: String(DEFAULT_ALLOWANCE), value: DEFAULT_ALLOWANCE });
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [actionError, setActionError] = useState("");

  const wires = useMemo(() => toWires(wiring.items), [wiring.items]);
  const parts = useMemo(() => partMap(partItems.items), [partItems.items]);
  const steps = useMemo(() => sequence(wires), [wires]);
  const c = useMemo(() => counts(steps), [steps]);
  const hub = useMemo(() => hubRef(wires), [wires]);
  const groups = useMemo(() => groupByPart(steps, hub), [steps, hub]);
  const blocks = useMemo(() => connectionsByPart(steps), [steps]);
  const cuts = useMemo(() => cutList(steps, parts, routing.value, allowance.value), [steps, parts, routing.value, allowance.value]);
  const k = useMemo(() => consumables(wires), [wires]);
  const lines = useMemo(() => beforePower(wires), [wires]);

  const setStatus = (id: number, current: string, next: string) => {
    if (next === "tested" && !isSoldered(current)) return;
    void wiring.patch(id, { status: next });
  };

  const markdown = () => buildMarkdown({ projectName: project.name, steps, parts, routing: routing.value, allowance: allowance.value });

  const save = async () => {
    setSaving(true);
    setSaved("");
    setActionError("");
    try {
      const file = new File([markdown()], `${project.id}-build-sheet.md`, { type: "text/markdown" });
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "buildsheet");
      form.append("meta", JSON.stringify({ format: "markdown", wires: c.total, soldered: c.soldered, tested: c.tested }));
      const r = await api<{ file: { id: number; name: string } }>(`/api/projects/${project.id}/files`, { method: "POST", body: form });
      void filesChanged();
      setSaved(`Saved as ${r.file.name} (file ${r.file.id}).`);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const resetAll = async () => {
    setResetting(true);
    setActionError("");
    try {
      await Promise.all(wires.filter((w) => w.status !== "to solder").map((w) => wiring.patch(w.item.id, { status: "to solder" })));
      setConfirmReset(false);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setResetting(false);
    }
  };

  if (wiring.loading || partItems.loading) return <p className="text-sm text-secondary">Loading the build sheet.</p>;

  if (steps.length === 0) {
    return (
      <div className="space-y-4">
        {wiring.error && <ErrorLine>{wiring.error}</ErrorLine>}
        <EmptyState title="No wires yet, so there is nothing to build from">
          <p>
            This sheet is generated from the schematic. Draw the wires there (each one a part, a pin and a net) and the soldering steps, connection tables and cut list appear here.
          </p>
          <p className="mt-3">
            <Link href="/s/design/schematic" className="font-medium text-link underline-offset-2 hover:underline">Open the schematic</Link>
          </p>
        </EmptyState>
      </div>
    );
  }

  const stepList = (list: typeof steps) => (
    <ol className="space-y-3">
      {list.map((s) => (
        <StepCard key={s.wire.item.id} step={s} parts={parts} onStatus={(next) => setStatus(s.wire.item.id, s.wire.status, next)} />
      ))}
    </ol>
  );

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="bs-root space-y-8"
    >
      <style>{PRINT_CSS}</style>

      <div className="hidden print:block">
        <h2 className="text-xl font-semibold">Build sheet: {project.name}</h2>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" aria-hidden /> Print
        </Button>
        <Button variant="outline" size="sm" onClick={() => download(`${project.id}-build-sheet.md`, markdown())}>
          <Download className="h-3.5 w-3.5" aria-hidden /> Download Markdown
        </Button>
        <Button variant="outline" size="sm" onClick={() => void save()} disabled={saving}>
          <Save className="h-3.5 w-3.5" aria-hidden /> {saving ? "Saving" : "Save to concept"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)} disabled={c.soldered === 0}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset all
        </Button>
        <span className="ml-auto flex flex-wrap items-center gap-4 text-xs">
          <Link href="/s/design/schematic" className="text-link underline-offset-2 hover:underline">Change wiring in the schematic</Link>
          <Link href="/s/prototype/assembly" className="text-link underline-offset-2 hover:underline">Assembly, the wider build</Link>
        </span>
      </div>

      {saved && <p role="status" className="no-print rounded-md bg-success-soft px-3 py-2 text-sm text-success">{saved}</p>}
      {(actionError || wiring.writeError || wiring.error || partItems.error) && <ErrorLine>{actionError || wiring.writeError || wiring.error || partItems.error}</ErrorLine>}

      <Progress c={c} label="Whole sheet" />

      <Section n="01" title="Soldering sequence" blurb="One step per wire, in the order set in the schematic. Mark a wire soldered, then tested.">
        <div className="no-print inline-flex rounded-md border border-hairline bg-subtle p-0.5" role="group" aria-label="Order of steps">
          {(["order", "part"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`h-7 rounded px-3 text-xs font-medium transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange ${
                mode === m ? "bg-surface text-primary shadow-xs" : "text-secondary hover:text-primary"
              }`}
            >
              {m === "order" ? "In order" : "By part"}
            </button>
          ))}
        </div>
        {mode === "order" ? (
          stepList(steps)
        ) : (
          <div className="space-y-6">
            {groups.map((g) => {
              const p = parts.get(g.ref);
              const label = g.ref === hub && g.steps.every((s) => s.wire.from === hub && s.wire.to === hub) ? `${g.ref} on its own` : g.ref;
              return (
                <div key={g.key} className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-2">
                    <div>
                      <p className="text-sm font-semibold tracking-tight text-primary">
                        <span className="font-mono">{label}</span> <span className="font-normal text-secondary">{p ? p.title : "not in the bill of materials"}</span>
                      </p>
                    </div>
                    <div className="w-56"><Progress c={counts(g.steps)} label={`Progress for ${g.ref}`} /></div>
                  </div>
                  {stepList(g.steps)}
                </div>
              );
            })}
            <p className="no-print text-xs text-muted">
              Grouped by the part each wire shares, other than {hub}, the part most wires meet at. Step numbers stay global.
            </p>
          </div>
        )}
      </Section>

      <Section n="02" title="Connections by part" blurb="Every pin in use, what it connects to and its status. A shared joint is a pin where more than one wire meets.">
        <ConnectionsTable blocks={blocks} parts={parts} />
      </Section>

      <Section n="03" title="Wire cut list" blurb="One row per wire, in soldering order.">
        <CutList
          rows={cuts}
          routing={routing.text}
          allowance={allowance.text}
          routingValue={routing.value}
          allowanceValue={allowance.value}
          routingOk={parseNum(routing.text) !== null}
          allowanceOk={parseNum(allowance.text) !== null}
          onRouting={(v) => { const n = parseNum(v); setRouting((r) => ({ text: v, value: n ?? r.value })); }}
          onAllowance={(v) => { const n = parseNum(v); setAllowance((r) => ({ text: v, value: n ?? r.value })); }}
        />
      </Section>

      <Section n="03a" title="Harness drawing" blurb="The wires drawn as a harness, with WireViz. Lengths are the routed ones; a wire that has not been routed is drawn without one.">
        <HarnessPanel projectId={project.id} />
      </Section>

      <Section n="04" title="Joints and consumables" blurb="Counted from the wires. No solder or flux quantities are given, because they are not derivable.">
        <Joints k={k} wireCount={wires.length} parts={parts} />
      </Section>

      <Section n="05" title="Before power" blurb="Live from the statuses above.">
        <Checklist lines={lines} />
      </Section>

      <Modal
        open={confirmReset}
        onOpenChange={(o) => { if (!resetting) setConfirmReset(o); }}
        title="Reset every wire to to solder?"
        description="This clears soldered and tested on all wires. The wires themselves are not changed."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirmReset(false)} disabled={resetting}>Cancel</Button>
          <Button size="sm" onClick={() => void resetAll()} disabled={resetting}>{resetting ? "Resetting" : "Reset all"}</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
