"use client";

// The engineering showcase: the app's own views, live, on the worked example's rows. The rows come from the
// server (exampleData.ts) as props; nothing here calls the API. The 3D view is the app's ModelCanvas with the
// app's own scene derivations (useSceneModel), loaded with next/dynamic only when the panel nears the window, in a
// box of fixed height so nothing moves when it arrives. Until then, without script, and under reduced motion,
// the box holds a still of the same view.
import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { useInView } from "motion/react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronUp, Minus, Plus, RotateCcw } from "lucide-react";
import { partPrice, partSource, sumLine, toPart, type NetClass, type Part } from "@/lib/domain";
import type { Item } from "@/lib/types";
import type { ShowcaseNudge } from "@/components/three/canvasShowcase";
import { SHELL_DEFAULTS } from "@/components/three/stl";
import { useSceneModel } from "@/components/views/model/useSceneModel";
import { Shot } from "./Shot";
import { useAnimated, useHydrated } from "./useAnimated";
import { ENGINEERING, FEATURES } from "./content";

const ModelCanvas = dynamic(() => import("@/components/three/ModelCanvas"), { ssr: false });

const NONE = new Set<number>();
const NO_CLASSES = new Set<NetClass>();
const NO_SHAPES = new Map<number, Float32Array | null>();
const noop = () => {};

const PANEL = "dark overflow-hidden rounded-xl border border-hairline bg-[#0b0c0e] text-primary shadow-[var(--shadow-card)]";
const CHIP = "h-8 rounded-md border px-3 font-mono text-[11px] transition-colors duration-150";
const ICON = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-hairline text-secondary transition-colors duration-150 hover:border-dutchOrange hover:text-primary";

type Mode = keyof typeof ENGINEERING.model.modes;
const MODES = Object.keys(ENGINEERING.model.modes) as Mode[];

function ModelStage({ parts, wires }: { parts: Part[]; wires: Item[] }) {
  const box = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  const animated = useAnimated();
  const near = useInView(box, { margin: "600px 0px", once: true });
  const seen = useInView(box, { amount: 0.2 });
  const [mode, setMode] = useState<Mode>("translucent");
  const [wiresOn, setWiresOn] = useState(true);
  const [held, setHeld] = useState(false); // the visitor has taken hold of the view: the turntable stops
  const [opened, setOpened] = useState(false); // under reduced motion the live view waits to be asked for
  const [nudge, setNudge] = useState<ShowcaseNudge>({ kind: "left", n: 0 });
  const [resetToken, setResetToken] = useState(0);
  const explodePct = mode === "exploded" ? 100 : 0;
  const scene = useSceneModel({ parts, hidden: NONE, shapes: NO_SHAPES, wireItems: wires, focusId: null, sub: false, explodeBy: "", routeCell: 2, explodePct, classOff: NO_CLASSES, pinRows: [] });
  const canvasParts = useMemo(() => scene.canvasParts.map((c) => ({ id: c.id, ref: c.ref, title: c.title, geometry: c.geometry, shape: c.shape })), [scene.canvasParts]);
  const showcase = useMemo(() => ({ turntable: animated && seen && !held, wireframe: mode === "wireframe", onGrab: () => setHeld(true), nudge }), [animated, seen, held, mode, nudge]);
  const live = hydrated && near && (animated || opened);
  // a new look is framed afresh, because the exploded model is much taller than the assembled one
  const choose = (m: Mode) => {
    setMode(m);
    setResetToken((t) => t + 1);
  };
  const step = (kind: ShowcaseNudge["kind"]) => {
    setHeld(true);
    setNudge((n) => ({ kind, n: n.n + 1 }));
  };

  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline px-4 py-2.5">
        <p className="mr-auto font-mono text-[11px] text-muted">/s/design/model</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="How the model is drawn">
          {MODES.map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => choose(m)} className={`${CHIP} ${mode === m ? "border-transparent bg-action text-white" : "border-hairline text-secondary hover:border-dutchOrange hover:text-primary"}`}>
              {ENGINEERING.model.modes[m]}
            </button>
          ))}
          <button type="button" aria-pressed={wiresOn} onClick={() => setWiresOn((w) => !w)} className={`${CHIP} ${wiresOn ? "border-dutchOrange text-primary" : "border-hairline text-secondary hover:border-dutchOrange hover:text-primary"}`}>
            Wires
          </button>
        </div>
      </div>

      {/* the stage: a fixed height, so the page does not move when the live view arrives */}
      <div ref={box} className="relative h-[340px] bg-[radial-gradient(ellipse_at_center,#171a20_0%,#0b0c0e_72%)] sm:h-[480px] lg:h-[600px]">
        {live ? (
          <div className="absolute inset-0" role="group" aria-label="The 3D model of the example. Use the buttons below to turn, tilt and zoom.">
            <ModelCanvas
              parts={canvasParts}
              selectedId={null}
              onSelect={noop}
              explode={explodePct / 100}
              labels
              shellView={mode === "solid" ? "solid" : "clear"}
              shellParams={SHELL_DEFAULTS}
              resetToken={resetToken}
              dark
              uploaded={null}
              wires={scene.wirePlan.draw}
              wiresOn={wiresOn}
              fade={null}
              weights={null}
              focusIds={null}
              onFocusPart={noop}
              transform="off"
              onTransform={noop}
              section={[]}
              measure={false}
              onMeasure={noop}
              routed={[]}
              showcase={showcase}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <div className="w-full opacity-90">
              <Shot name="model" theme="dark" alt={FEATURES.find((f) => f.shot === "model")?.alt ?? ""} />
            </div>
            {hydrated && !animated && !opened ? (
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-3 border-t border-hairline bg-[#0b0c0e] px-4 py-3">
                <p className="text-[13px] text-secondary">{ENGINEERING.model.still}</p>
                <button type="button" onClick={() => setOpened(true)} className={`${CHIP} border-dutchOrange text-primary`}>
                  {ENGINEERING.model.open}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline px-4 py-2.5">
        <div className="flex gap-1.5" role="group" aria-label="Turn, tilt and zoom the model">
          <button type="button" className={ICON} aria-label="Turn left" onClick={() => step("left")}><ArrowLeft className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={ICON} aria-label="Turn right" onClick={() => step("right")}><ArrowRight className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={ICON} aria-label="Tilt up" onClick={() => step("up")}><ArrowUp className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={ICON} aria-label="Tilt down" onClick={() => step("down")}><ArrowDown className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={ICON} aria-label="Zoom in" onClick={() => step("in")}><Plus className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={ICON} aria-label="Zoom out" onClick={() => step("out")}><Minus className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={ICON} aria-label="Reset the view and turn again" onClick={() => { setHeld(false); setResetToken((t) => t + 1); }}><RotateCcw className="h-4 w-4" aria-hidden /></button>
        </div>
        <p className="font-mono text-[11px] text-muted">{ENGINEERING.model.hint}</p>
        <p className="ml-auto font-mono text-[11px] text-muted">
          {canvasParts.length} parts placed, {scene.wirePlan.draw.length} wires drawn
        </p>
      </div>
    </div>
  );
}

type SortKey = keyof typeof ENGINEERING.bom.columns;
const COLUMNS = Object.keys(ENGINEERING.bom.columns) as SortKey[];
const money = (n: number | null) => (n === null ? "no price" : `$${n.toFixed(2)}`);

function BomTable({ parts }: { parts: Part[] }) {
  const [sort, setSort] = useState<{ key: SortKey; down: boolean } | null>(null);
  const rows = useMemo(() => {
    const value = (p: Part, k: SortKey) => (k === "line" ? (partPrice(p).line ?? -1) : k === "qty" ? (p.qty ?? -1) : k === "source" ? partSource(p) : p[k]);
    if (!sort) return parts;
    return [...parts].sort((a, b) => {
      const [x, y] = [value(a, sort.key), value(b, sort.key)];
      const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "en", { numeric: true });
      return sort.down ? -order : order;
    });
  }, [parts, sort]);
  const numeric = (k: SortKey) => k === "qty" || k === "line";
  return (
    <div className={PANEL}>
      <div className="flex items-center justify-between gap-4 border-b border-hairline px-4 py-2.5">
        <p className="font-mono text-[11px] text-muted">/s/design/bom</p>
        <p className="font-mono text-[11px] text-muted">{parts.length} lines</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-hairline">
              {COLUMNS.map((k) => (
                <th key={k} scope="col" aria-sort={sort?.key === k ? (sort.down ? "descending" : "ascending") : "none"} className={`px-3 py-0 font-normal sm:px-4 ${numeric(k) ? "text-right" : ""} ${k === "spec" ? "hidden md:table-cell" : k === "source" ? "hidden sm:table-cell" : ""}`}>
                  <button type="button" onClick={() => setSort((s) => ({ key: k, down: s?.key === k ? !s.down : false }))} className={`inline-flex h-9 items-center gap-1 font-mono text-[11px] transition-colors duration-150 hover:text-primary ${sort?.key === k ? "text-primary" : "text-muted"}`}>
                    {ENGINEERING.bom.columns[k]}
                    {sort?.key === k ? sort.down ? <ChevronDown className="h-3 w-3" aria-hidden /> : <ChevronUp className="h-3 w-3" aria-hidden /> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.item.id} className="border-b border-hairline">
                <td className="px-3 py-2 font-mono text-xs text-dutchOrange-300 sm:px-4">{p.ref}</td>
                <th scope="row" className="px-3 py-2 font-medium text-primary sm:whitespace-nowrap sm:px-4">{p.title}</th>
                <td className="hidden px-4 py-2 text-secondary md:table-cell">{p.spec}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-secondary sm:px-4">{p.qty ?? ""}</td>
                <td className="hidden whitespace-nowrap px-4 py-2 text-secondary sm:table-cell">{partSource(p)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-primary sm:px-4">{money(partPrice(p).line)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3} className="px-3 py-2.5 text-right sm:hidden"><span className="font-mono text-[11px] font-normal text-muted">{ENGINEERING.bom.total}</span></th>
              <th scope="row" colSpan={4} className="hidden px-4 py-2.5 text-right sm:table-cell md:hidden"><span className="font-mono text-[11px] font-normal text-muted">{ENGINEERING.bom.total}</span></th>
              <th scope="row" colSpan={5} className="hidden px-4 py-2.5 text-right md:table-cell font-mono text-[11px] font-normal text-muted">{ENGINEERING.bom.total}</th>
              <td className="px-4 py-2.5 text-right font-mono text-base font-semibold tabular-nums text-primary">{money(sumLine(parts))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Intro({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold tracking-tight text-primary">{title}</h3>
      <p className="mt-1 max-w-[64ch] text-[15px] leading-relaxed text-secondary">{text}</p>
    </div>
  );
}

export function Engineering({ parts: partItems, wires }: { parts: Item[]; wires: Item[] }) {
  const parts = useMemo(() => partItems.map(toPart), [partItems]);
  return (
    <div className="grid gap-9 [&>*]:min-w-0">
      <div>
        <Intro title={ENGINEERING.model.title} text={ENGINEERING.model.text} />
        <ModelStage parts={parts} wires={wires} />
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          {ENGINEERING.model.real} {ENGINEERING.model.illustrative}
        </p>
      </div>
      <div>
        <Intro title={ENGINEERING.bom.title} text={ENGINEERING.bom.text} />
        <BomTable parts={parts} />
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{ENGINEERING.bom.real}</p>
      </div>
    </div>
  );
}
