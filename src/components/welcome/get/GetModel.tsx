"use client";

// Stage 03's output, live: the example's 3D model from its own parts list, in the app's own 3D view (ModelCanvas,
// with the scene derivations of the 3D page, useSceneModel) and its showcase extras: drawn as wireframe,
// see-through or solid; layers (enclosure, electronics, power, wiring, fasteners, from each part's kind) switched
// on and off; tags with each part's reference and name from the parts list; an exploded view on a slider; and the
// assembly in the build sheet's order, step by step, with the step named. While nobody touches it the assembly
// plays, holds, and plays again as the model turns; the first touch of a slider or a drag stops both, and the
// reset button starts them again. Under reduced motion it stands assembled and still, every control still works.
import { useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "motion/react";
import { toPart, type NetClass, type Part } from "@/lib/domain";
import type { Item } from "@/lib/types";
import ModelCanvas from "@/components/three/ModelCanvas";
import type { ShowcaseNudge } from "@/components/three/canvasShowcase";
import { PartTags, TagLayer } from "@/components/three/canvasTags";
import { SHELL_DEFAULTS } from "@/components/three/stl";
import { LAYERS, assemblySteps, hiddenByLayers, layerOf, type Layer } from "@/components/three/showcaseLogic";
import { useSceneModel } from "@/components/views/model/useSceneModel";
import { TapToExplore } from "../TapToExplore";
import { useAnimated } from "../useAnimated";
import type { GetData } from "../storyData";
import { toneOf } from "./projection";
import { ControlGroup, Layers, OrbitPad, Range, Segmented, Switch } from "./ViewControls";
import { GET_VIEWS } from "../content";

const NONE = new Set<number>();
const NO_CLASSES = new Set<NetClass>();
const NO_SHAPES = new Map<number, Float32Array | null>();
const noop = () => {};
const STEP_MS = 950;
const HOLD_MS = 3200;

export type Look = "wireframe" | "translucent" | "solid";
const LOOK = { wireframe: { xray: 1, edges: false, wireframe: true }, translucent: { xray: 0.58, edges: true, wireframe: false }, solid: { xray: 1, edges: true, wireframe: false } } as const;
const kindOf = (p: Part) => (typeof p.item.data.kind === "string" ? p.item.data.kind : "");
const SWATCH: Record<Layer, string> = { enclosure: "--accent-orange", electronics: "--net-signal", power: "--net-power", wiring: "--net-audio", fasteners: "--text-muted" };

export default function GetModel({ parts: partItems, wires, get }: { parts: Item[]; wires: Item[]; get: GetData }) {
  const box = useRef<HTMLDivElement>(null);
  const tagHost = useRef<HTMLDivElement>(null);
  const animated = useAnimated();
  const seen = useInView(box, { amount: 0.2 });
  const c = GET_VIEWS.model;
  const [look, setLook] = useState<Look>("translucent");
  const [layersOn, setLayersOn] = useState<Layer[]>([...LAYERS]);
  const [tagsOn, setTagsOn] = useState(true);
  const [held, setHeld] = useState(false);
  // what the sliders show: the assembly, step by step, or the assembled model pulled apart
  const [motion, setMotion] = useState<"assembly" | "explode">("assembly");
  const [explodePct, setExplodePct] = useState(0);
  const [nudge, setNudge] = useState<ShowcaseNudge>({ kind: "left", n: 0 });
  const [resetToken, setResetToken] = useState(0);
  const [colors, setColors] = useState<Map<number, string>>(new Map());
  const [narrow, setNarrow] = useState(false);

  const parts = useMemo(() => partItems.map(toPart), [partItems]);
  const shaped = useMemo(() => parts.filter((p) => p.geometry), [parts]);
  const layerById = useMemo(() => new Map(shaped.map((p) => [p.item.id, layerOf(kindOf(p), p.ref, p.title)])), [shaped]);
  const steps = useMemo(
    () => assemblySteps(shaped.map((p) => ({ id: p.item.id, ref: p.ref, title: p.title, layer: layerById.get(p.item.id)!, board: kindOf(p) === "circuit board", shell: p.geometry!.shape === "shell" })), get.solder, get.phases),
    [shaped, layerById, get.solder, get.phases],
  );
  const N = steps.length;
  const [done, setDone] = useState(N);

  // the assembly plays while nobody holds the view: one step at a time, a hold on the finished model, again
  const playing = animated && seen && !held && motion === "assembly";
  useEffect(() => {
    if (!playing) return;
    let t = 0;
    let at = N;
    const tick = () => {
      at = at >= N ? 0 : at + 1;
      setDone(at);
      t = window.setTimeout(tick, at === N ? HOLD_MS : at === 0 ? 700 : STEP_MS);
    };
    t = window.setTimeout(tick, 400);
    return () => window.clearTimeout(t);
  }, [playing, N]);

  const scene = useSceneModel({ parts, hidden: NONE, shapes: NO_SHAPES, wireItems: wires, focusId: null, sub: false, explodeBy: "", routeCell: 2, explodePct: motion === "assembly" ? 100 : explodePct, classOff: NO_CLASSES, pinRows: [] });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const style = getComputedStyle(el);
    // the enclosure keeps the viewer's own neutral shell colour, so the parts inside read through it in theirs
    setColors(new Map(parts.filter((p) => p.geometry?.shape !== "shell").map((p) => [p.item.id, style.getPropertyValue(toneOf(kindOf(p), p.ref)).trim()])));
    setNarrow(el.clientWidth < 640);
  }, [parts]);

  const canvasParts = useMemo(() => scene.canvasParts.map((x) => ({ ...x, color: colors.get(x.id) || undefined })), [scene.canvasParts, colors]);
  const tagParts = useMemo(() => canvasParts.map((x) => ({ id: x.id, ref: x.ref, title: x.title })), [canvasParts]);
  const off = useMemo(() => new Set(LAYERS.filter((l) => !layersOn.includes(l))), [layersOn]);
  const hide = useMemo(() => hiddenByLayers(canvasParts.map((x) => ({ id: x.id, layer: layerById.get(x.id) ?? "electronics" })), off), [canvasParts, layerById, off]);
  const placed = useMemo(() => (motion === "assembly" ? new Set(steps.slice(0, done).flatMap((s) => s.ids)) : null), [motion, steps, done]);
  const shown = useMemo(() => new Set(canvasParts.map((x) => x.id).filter((id) => !hide.has(id) && (!placed || placed.has(id)))), [canvasParts, hide, placed]);
  // a wire is drawn once both its ends are in sight
  const drawWires = useMemo(() => scene.wirePlan.draw.filter((w) => shown.has(w.a) && shown.has(w.b)), [scene.wirePlan.draw, shown]);
  const wiresOn = layersOn.includes("wiring") && drawWires.length > 0;
  const assembly = useMemo(() => (motion === "assembly" ? { steps, done } : undefined), [motion, steps, done]);

  const showcase = useMemo(
    () => ({
      turntable: animated && seen && !held,
      ...LOOK[look],
      hide,
      assembly,
      onGrab: () => setHeld(true),
      nudge,
      closer: (motion === "assembly" ? 0.78 : 0.82) * (narrow ? 1.2 : 1),
      children: tagsOn ? <PartTags parts={tagParts} host={tagHost} shown={shown} top={78} /> : null,
    }),
    [animated, seen, held, look, hide, assembly, nudge, motion, narrow, tagsOn, tagParts, shown],
  );

  const toAssembly = (v: number) => {
    setHeld(true);
    if (motion !== "assembly") setResetToken((t) => t + 1);
    setMotion("assembly");
    setDone(v);
  };
  const toExplode = (v: number) => {
    setHeld(true);
    if (motion !== "explode") {
      setMotion("explode");
      setDone(N);
      // the exploded model is taller than the assembled one: frame it afresh
      setResetToken((t) => t + 1);
    }
    setExplodePct(v);
  };
  const reset = () => {
    setHeld(false);
    setMotion("assembly");
    setExplodePct(0);
    setResetToken((t) => t + 1);
  };
  const current = motion === "assembly" && done > 0 ? steps[done - 1] : null;
  const counts = Object.fromEntries(LAYERS.map((l) => [l, l === "wiring" ? scene.wirePlan.draw.length : [...layerById.values()].filter((x) => x === l).length])) as Record<Layer, number>;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline px-3 py-2 sm:px-4">
        <ControlGroup label={c.lookLabel}>
          <Segmented<Look> label={c.lookLabel} value={look} onChange={setLook} options={(Object.keys(c.looks) as Look[]).map((k) => ({ value: k, label: c.looks[k] }))} />
        </ControlGroup>
        <Switch label={c.tags} on={tagsOn} onChange={setTagsOn} />
        <div className="ml-auto hidden sm:block">
          <OrbitPad onNudge={(k) => { setHeld(true); setNudge((n) => ({ kind: k, n: n.n + 1 })); }} onReset={reset} resetLabel={c.reset} compact={narrow} />
        </div>
      </div>
      <div className="relative min-h-[340px] flex-1">
        <div ref={box} className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,#1a1e25_0%,#0b0c0e_70%)]" role="group" aria-label={c.label}>
          <TapToExplore className="absolute inset-0">
            <ModelCanvas
              parts={canvasParts}
              selectedId={null}
              onSelect={noop}
              explode={motion === "assembly" ? 1 : explodePct / 100}
              labels={false}
              shellView={look === "solid" ? "solid" : "clear"}
              shellParams={SHELL_DEFAULTS}
              resetToken={resetToken + (narrow ? 1000 : 0)}
              dark
              uploaded={null}
              wires={drawWires}
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
          </TapToExplore>
          <TagLayer parts={tagParts} host={tagHost} on={tagsOn} />
        </div>
        {/* what the view stands at: the assembly step, or how far apart the parts are */}
        <div className="pointer-events-none absolute left-3 top-3 z-30 max-w-[min(34rem,calc(100%-1.5rem))] rounded-md border border-white/10 bg-[#0b0c0e]/88 px-2.5 py-1.5 font-mono text-[11px] leading-snug text-secondary" aria-live="polite">
          {motion === "assembly" ? (
            <>
              <p>
                <span className="tabular-nums text-dutchOrange-300">{c.stepOf(done, N)}</span>
                {current ? <span className="text-muted"> · {current.phase}</span> : null}
              </p>
              <p className="mt-0.5 truncate text-primary">{current ? current.label : c.nothingYet}</p>
            </>
          ) : (
            <p>
              <span className="text-dutchOrange-300">{c.exploded}</span> <span className="tabular-nums text-primary">{explodePct}%</span>
            </p>
          )}
        </div>
        <div className="absolute bottom-3 left-3 z-30 sm:hidden">
          <OrbitPad onNudge={(k) => { setHeld(true); setNudge((n) => ({ kind: k, n: n.n + 1 })); }} onReset={reset} resetLabel={c.reset} compact />
        </div>
      </div>
      <div className="grid gap-x-6 gap-y-2.5 border-t border-hairline px-3 py-2.5 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="lg:col-span-2">
          <Layers<Layer> label={c.layersLabel} on={layersOn} onChange={setLayersOn} options={LAYERS.map((l) => ({ value: l, label: c.layers[l], count: counts[l], swatch: SWATCH[l] }))} />
        </div>
        <Range onTouch={() => setHeld(true)} label={c.assembly} value={motion === "assembly" ? done : N} min={0} max={N} onChange={toAssembly} readout={`${motion === "assembly" ? done : N}/${N}`} valueText={motion === "assembly" ? `${c.stepOf(done, N)}${current ? `: ${current.label}` : ""}` : c.stepOf(N, N)} />
        <Range onTouch={() => setHeld(true)} label={c.explode} value={motion === "explode" ? explodePct : 0} min={0} max={100} step={5} onChange={toExplode} readout={`${motion === "explode" ? explodePct : 0}%`} valueText={`${motion === "explode" ? explodePct : 0} percent apart`} />
      </div>
    </div>
  );
}
