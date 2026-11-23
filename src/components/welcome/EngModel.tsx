"use client";

// The 3D tab: the app's own 3D view (ModelCanvas) with the app's own scene derivations (useSceneModel) on the
// example's seeded parts and wires. Parts are coloured by kind from the theme tokens, the camera frames the model
// large, and it turns slowly until the visitor takes hold of it. Part labels are the shared tag layer (PartTags and
// TagLayer, canvasTags.tsx): two columns beside the model, kept apart, following the model as it turns.
import { useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "motion/react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus, Plus, RotateCcw } from "lucide-react";
import { toPart, type NetClass } from "@/lib/domain";
import type { Item } from "@/lib/types";
import ModelCanvas from "@/components/three/ModelCanvas";
import type { ShowcaseNudge } from "@/components/three/canvasShowcase";
import { PartTags, TagLayer } from "@/components/three/canvasTags";
import { SHELL_DEFAULTS } from "@/components/three/stl";
import { useSceneModel } from "@/components/views/model/useSceneModel";
import { TapToExplore } from "./TapToExplore";
import { TAG_TONE, shellOutlineFor } from "./get/tagShell";
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
    // the enclosure that takes the tag's outline takes its colour too; every other part its kind's theme colour
    setColors(new Map(parts.map((p) => [p.item.id, p.geometry?.shape === "shell" && shellOutlineFor(p.geometry.size) ? TAG_TONE : style.getPropertyValue(tokenOf(p.item, p.ref)).trim()])));
    setNarrow(el.clientWidth < 640);
  }, [parts]);

  const outline = useMemo(() => shellOutlineFor(parts.find((p) => p.geometry?.shape === "shell")?.geometry?.size), [parts]);
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
      children: labelsShown ? <PartTags parts={labelParts} host={labelHost} /> : null,
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
            shellOutline={outline}
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
          {/* the labels: placed each frame by PartTags, from inside the canvas */}
          <TagLayer parts={labelParts} host={labelHost} on={labelsShown} />
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
