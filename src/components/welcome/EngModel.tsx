"use client";

// The 3D tab: the app's own 3D view (ModelCanvas) with the app's own scene derivations (useSceneModel) on the
// example's seeded parts and wires. Parts are coloured by kind from the theme tokens, the camera frames the model
// large, and it turns slowly until the visitor takes hold of it. Part labels are this page's own layer (Labels):
// they sit in two columns beside the model, are kept apart from each other, and follow the model as it turns.
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useInView } from "motion/react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus, Plus, RotateCcw } from "lucide-react";
import { toPart, type NetClass } from "@/lib/domain";
import type { Item } from "@/lib/types";
import ModelCanvas from "@/components/three/ModelCanvas";
import type { ShowcaseNudge } from "@/components/three/canvasShowcase";
import { SHELL_DEFAULTS } from "@/components/three/stl";
import { useSceneModel } from "@/components/views/model/useSceneModel";
import { TapToExplore } from "./TapToExplore";
import { useAnimated } from "./useAnimated";
import { ENGINEERING } from "./content";
import { CHIP, CHIP_OFF, CHIP_ON, ICON, StageBar, StageFoot, StageView } from "./StageParts";

const NONE = new Set<number>();
const NO_CLASSES = new Set<NetClass>();
const NO_SHAPES = new Map<number, Float32Array | null>();
const noop = () => {};

type Mode = keyof typeof ENGINEERING.model.modes;
const MODES = Object.keys(ENGINEERING.model.modes) as Mode[];

// A part's colour is a theme token chosen by its kind; the shell is the accent.
const KIND_TOKEN: Record<string, string> = {
  "circuit board": "--success",
  microcontroller: "--net-signal",
  sensor: "--net-signal",
  module: "--net-signal",
  speaker: "--text-secondary",
  battery: "--warning",
  switch: "--danger",
  button: "--danger",
  enclosure: "--accent-orange",
  mechanical: "--text-muted",
};
const tokenOf = (item: Item, ref: string) => (ref === "BAT" ? "--net-power" : (KIND_TOKEN[typeof item.data.kind === "string" ? item.data.kind : ""] ?? "--text-muted"));

type LabelPart = { id: number; ref: string; title: string };
type Spot = { side: -1 | 1; x: number; y: number; set: boolean };
const GAP = 24; // px between label centres

/**
 * Inside the canvas: finds where each part is on screen and moves its label (an element of `host`) and leader
 * line there. Labels keep to the side of the model their part is on, in one column a side, never closer than GAP.
 */
function Labels({ parts, host }: { parts: LabelPart[]; host: RefObject<HTMLDivElement | null> }) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const spots = useRef(new Map<number, Spot>());
  const v = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => invalidate(), [parts, invalidate]);

  useFrame(() => {
    const root = host.current;
    if (!root) return;
    // where each part is: the middle of its meshes, in pixels
    const sum = new Map<number, { x: number; y: number; z: number; n: number }>();
    scene.traverse((o) => {
      const id = o.userData.partId;
      if (typeof id !== "number" || !(o as THREE.Mesh).isMesh) return;
      o.getWorldPosition(v);
      const s = sum.get(id) ?? { x: 0, y: 0, z: 0, n: 0 };
      sum.set(id, { x: s.x + v.x, y: s.y + v.y, z: s.z + v.z, n: s.n + 1 });
    });
    const at = new Map<number, { x: number; y: number }>();
    let lo = Infinity;
    let hi = -Infinity;
    for (const [id, s] of sum) {
      v.set(s.x / s.n, s.y / s.n, s.z / s.n).project(camera);
      if (v.z > 1) continue;
      const p = { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height };
      at.set(id, p);
      lo = Math.min(lo, p.x);
      hi = Math.max(hi, p.x);
    }
    const mid = (lo + hi) / 2;
    const narrow = size.width < 640;
    const reach = narrow ? 30 : 150;
    const columns = { [-1]: Math.max(narrow ? 34 : 150, lo - reach), 1: Math.min(size.width - (narrow ? 34 : 150), hi + reach) } as Record<-1 | 1, number>;

    // a part changes side only once it is well across the middle, so labels do not flicker over
    const sides: Record<-1 | 1, { id: number; y: number }[]> = { [-1]: [], 1: [] };
    for (const [id, p] of at) {
      const was = spots.current.get(id);
      const side: -1 | 1 = was && Math.abs(p.x - mid) < 18 ? was.side : p.x < mid ? -1 : 1;
      sides[side].push({ id, y: p.y });
    }
    let moving = false;
    for (const side of [-1, 1] as const) {
      const col = sides[side].sort((a, b) => a.y - b.y);
      // push apart downwards, then slide the column back so it stays centred on its parts and inside the view
      const ys: number[] = [];
      col.forEach((c, i) => ys.push(i ? Math.max(c.y, ys[i - 1]! + GAP) : c.y));
      const drift = col.length ? ys.reduce((a, y, i) => a + (y - col[i]!.y), 0) / col.length : 0;
      const first = (ys[0] ?? 0) - drift;
      const last = (ys[ys.length - 1] ?? 0) - drift;
      const fit = first < 14 ? 14 - first : last > size.height - 14 ? size.height - 14 - last : 0;
      col.forEach((c, i) => {
        const to = { x: columns[side], y: ys[i]! - drift + fit };
        const was = spots.current.get(c.id);
        const now: Spot = was?.set ? { side, x: was.x + (to.x - was.x) * 0.18, y: was.y + (to.y - was.y) * 0.18, set: true } : { side, ...to, set: true };
        if (Math.abs(now.x - to.x) + Math.abs(now.y - to.y) > 0.4) moving = true;
        spots.current.set(c.id, now);
      });
    }
    for (const p of parts) {
      const el = root.querySelector<HTMLElement>(`[data-label="${p.id}"]`);
      const line = root.querySelector<SVGLineElement>(`[data-leader="${p.id}"]`);
      const spot = spots.current.get(p.id);
      const a = at.get(p.id);
      if (!el || !line) continue;
      if (!spot || !a) {
        el.style.opacity = "0";
        line.style.opacity = "0";
        continue;
      }
      el.style.opacity = "1";
      line.style.opacity = "1";
      el.style.transform = `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px) translate(${spot.side < 0 ? "-100%" : "0"}, -50%)`;
      line.setAttribute("x1", a.x.toFixed(1));
      line.setAttribute("y1", a.y.toFixed(1));
      line.setAttribute("x2", (spot.x - spot.side * 4).toFixed(1));
      line.setAttribute("y2", spot.y.toFixed(1));
    }
    if (moving) invalidate();
  });
  return null;
}

export default function EngModel({ parts: partItems, wires }: { parts: Item[]; wires: Item[] }) {
  const box = useRef<HTMLDivElement>(null);
  const labelHost = useRef<HTMLDivElement>(null);
  const animated = useAnimated();
  const seen = useInView(box, { amount: 0.2 });
  const [mode, setMode] = useState<Mode>("translucent");
  const [wiresOn, setWiresOn] = useState(true);
  const [labelsOn, setLabelsOn] = useState(true);
  const [held, setHeld] = useState(false); // the visitor has taken hold of the view: the turntable stops
  const [nudge, setNudge] = useState<ShowcaseNudge>({ kind: "left", n: 0 });
  const [resetToken, setResetToken] = useState(0);
  const [colors, setColors] = useState<Map<number, string>>(new Map());
  const [narrow, setNarrow] = useState(false); // a phone's canvas is taller than wide, so the camera stands further back
  const parts = useMemo(() => partItems.map(toPart), [partItems]);
  const explodePct = mode === "exploded" ? 100 : 0;
  const scene = useSceneModel({ parts, hidden: NONE, shapes: NO_SHAPES, wireItems: wires, focusId: null, sub: false, explodeBy: "", routeCell: 2, explodePct, classOff: NO_CLASSES, pinRows: [] });

  // the tokens, read where the stage's dark theme applies
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const style = getComputedStyle(el);
    // the token values exist only in the browser, so they are read once the stage is in the page
    setColors(new Map(parts.map((p) => [p.item.id, style.getPropertyValue(tokenOf(p.item, p.ref)).trim()])));
    setNarrow(el.clientWidth < 640);
  }, [parts]);

  const canvasParts = useMemo(() => scene.canvasParts.map((c) => ({ id: c.id, ref: c.ref, title: c.title, geometry: c.geometry, shape: c.shape, color: colors.get(c.id) || undefined })), [scene.canvasParts, colors]);
  const labelParts = useMemo(() => canvasParts.map((c) => ({ id: c.id, ref: c.ref, title: c.title })), [canvasParts]);
  // a closed, solid lid hides the wires inside it, so they are not drawn over it
  const wiresShown = wiresOn && mode !== "solid";
  const labelsShown = labelsOn && mode !== "solid";
  const showcase = useMemo(
    () => ({
      turntable: animated && seen && !held,
      wireframe: mode === "wireframe",
      onGrab: () => setHeld(true),
      nudge,
      // the exploded model is tall and its labels need the room
      closer: (mode === "exploded" ? 0.94 : 0.74) * (narrow ? 1.45 : 1),
      children: labelsShown ? <Labels parts={labelParts} host={labelHost} /> : null,
    }),
    [animated, seen, held, mode, nudge, labelsShown, labelParts, narrow],
  );
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
    <>
      <StageBar path="/s/design/model">
        <div className="flex gap-1.5" role="group" aria-label="How the model is drawn">
          {MODES.map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => choose(m)} className={`${CHIP} ${mode === m ? CHIP_ON : CHIP_OFF}`}>
              {ENGINEERING.model.modes[m]}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5" role="group" aria-label="What is drawn with the model">
          <button type="button" aria-pressed={wiresShown} disabled={mode === "solid"} title={mode === "solid" ? ENGINEERING.model.wiresHidden : undefined} onClick={() => setWiresOn((w) => !w)} className={`${CHIP} disabled:opacity-50 ${wiresShown ? "border-dutchOrange text-primary" : CHIP_OFF}`}>
            Wires
          </button>
          <button type="button" aria-pressed={labelsShown} disabled={mode === "solid"} title={mode === "solid" ? ENGINEERING.model.wiresHidden : undefined} onClick={() => setLabelsOn((l) => !l)} className={`${CHIP} disabled:opacity-50 ${labelsShown ? "border-dutchOrange text-primary" : CHIP_OFF}`}>
            Labels
          </button>
        </div>
      </StageBar>
      <StageView>
        <div ref={box} className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#171a20_0%,#0b0c0e_72%)]" role="group" aria-label="The 3D model of the example. Use the buttons to turn, tilt and zoom.">
          <TapToExplore className="relative h-full w-full">
          <ModelCanvas
            parts={canvasParts}
            selectedId={null}
            onSelect={noop}
            explode={explodePct / 100}
            labels={false}
            shellView={mode === "solid" ? "solid" : "clear"}
            shellParams={SHELL_DEFAULTS}
            resetToken={resetToken + (narrow ? 1000 : 0)}
            dark
            uploaded={null}
            wires={scene.wirePlan.draw}
            wiresOn={wiresShown}
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
          {/* the labels: placed each frame by Labels, from inside the canvas */}
          <div ref={labelHost} className={`pointer-events-none absolute inset-0 overflow-hidden ${labelsShown ? "" : "hidden"}`} aria-hidden="true">
            <svg className="absolute inset-0 h-full w-full">
              {labelParts.map((p) => (
                <line key={p.id} data-leader={p.id} stroke="#8b919b" strokeWidth="1" style={{ opacity: 0 }} />
              ))}
            </svg>
            {labelParts.map((p) => (
              <span key={p.id} data-label={p.id} style={{ opacity: 0 }} className="absolute left-0 top-0 whitespace-nowrap rounded-md border border-hairline bg-[#131519] px-1.5 py-0.5 text-[11px] leading-4 text-primary will-change-transform">
                <span className="font-mono text-dutchOrange-300">{p.ref}</span>
                <span className="hidden sm:inline"> {p.title}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5" role="group" aria-label="Turn, tilt and zoom the model">
          <button type="button" className={`${ICON} bg-[#0b0c0e]`} aria-label="Turn left" onClick={() => step("left")}><ArrowLeft className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={`${ICON} bg-[#0b0c0e]`} aria-label="Turn right" onClick={() => step("right")}><ArrowRight className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={`${ICON} bg-[#0b0c0e]`} aria-label="Tilt up" onClick={() => step("up")}><ArrowUp className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={`${ICON} bg-[#0b0c0e]`} aria-label="Tilt down" onClick={() => step("down")}><ArrowDown className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={`${ICON} bg-[#0b0c0e]`} aria-label="Zoom in" onClick={() => step("in")}><Plus className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={`${ICON} bg-[#0b0c0e]`} aria-label="Zoom out" onClick={() => step("out")}><Minus className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={`${ICON} bg-[#0b0c0e]`} aria-label="Reset the view and turn again" onClick={() => { setHeld(false); setResetToken((t) => t + 1); }}><RotateCcw className="h-4 w-4" aria-hidden /></button>
        </div>
      </StageView>
      <StageFoot hint={<><span className="sm:hidden">{ENGINEERING.hintTouch}</span><span className="hidden sm:inline">{ENGINEERING.hintMouse}</span></>}>
        {ENGINEERING.model.counts(canvasParts.length, partItems.length, scene.wirePlan.draw.length, wires.length)}
      </StageFoot>
    </>
  );
}
