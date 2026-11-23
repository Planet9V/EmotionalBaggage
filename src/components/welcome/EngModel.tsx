"use client";

// The 3D tab: the example's own model, the same one the hero turns and stage 03 takes apart (product/*): the case
// as designed, in its leather-look print, and every part at the size and place its row gives, the strap a strap.
// The tab's controls are the 3D view's own and drive that model: Translucent, Solid and Wireframe are its three
// looks, Exploded pulls it apart, Wires draws every net of the schematic part to part, Labels names the parts, and
// the buttons turn, tilt and zoom. It turns slowly until the visitor takes hold of it. The canvas is asked for
// only with this tab (Engineering loads this file lazily), never without WebGL, and gives way to a drawing of the
// tag on a device that cannot keep pace.
import { useMemo, useRef, useState } from "react";
import { useInView } from "motion/react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus, Plus, RotateCcw } from "lucide-react";
import ProductCanvas, { type Pose } from "./product/ProductCanvas";
import { joinedPairs, type Product } from "./product/model";
import type { ViewerMode } from "./product/scene";
import { canDraw3d } from "./product/capable";
import { filmMode, paceVerdict } from "./scenes/pace";
import { TagArt } from "./TagArt";
import { useAnimated } from "./useAnimated";
import { ENGINEERING, EXAMPLE } from "./content";
import { CHIP, CHIP_OFF, CHIP_ON, ICON, StageBar, StageFoot, StageView } from "./StageParts";

type Mode = keyof typeof ENGINEERING.model.modes;
const MODES = Object.keys(ENGINEERING.model.modes) as Mode[];
/** Each of the tab's looks as the model draws it: pulled apart, it is drawn finished. */
const LOOK: Record<Mode, ViewerMode> = { translucent: "translucent", solid: "solid", wireframe: "wireframe", exploded: "solid" };
type Nudge = NonNullable<React.ComponentProps<typeof ProductCanvas>["nudge"]>;
const short = (title: string) => title.split(",")[0]!.replace(/\s*\(.*$/, "");


export default function EngModel({ product, wires }: { product: Product; /** how many wires the schematic has */ wires: number }) {
  const box = useRef<HTMLDivElement>(null);
  const animated = useAnimated();
  const seen = useInView(box, { amount: 0.2 });
  const [mode, setMode] = useState<Mode>("translucent");
  const [wiresOn, setWiresOn] = useState(true);
  const [labelsOn, setLabelsOn] = useState(true);
  const [held, setHeld] = useState(false); // the visitor has taken hold of the view: the turntable stops
  const [nudge, setNudge] = useState<Nudge>({ kind: "left", n: 0 });
  const [pose, setPose] = useState<Pose>({ yaw: 0.6, pitch: 0.12, key: 0 });
  const [ready, setReady] = useState(false);
  const [sharp, setSharp] = useState(true);
  const [slow, setSlow] = useState(false);
  // this file is loaded in the browser only (Engineering's dynamic import), so the canvas can be asked about here
  const [capable] = useState(canDraw3d);
  const [film] = useState(() => filmMode(window.location.search));
  const drawn = useMemo(() => product.parts.filter((p) => p.body), [product]);
  const joins = useMemo(() => joinedPairs(product), [product]);
  // a closed, solid tag hides what is inside it, so its wires and the names of its parts are not drawn over it
  const wiresShown = wiresOn && mode !== "solid";
  const labelsShown = labelsOn && mode !== "solid";
  const labels = useMemo(() => (labelsShown ? drawn.filter((p) => p.placed !== "illustrative").map((p) => ({ ref: p.ref, text: mode === "exploded" ? short(p.title) : p.ref })) : undefined), [labelsShown, drawn, mode]);
  const live = capable && !slow;

  const step = (kind: Nudge["kind"]) => {
    setHeld(true);
    setNudge((n) => ({ kind, n: n.n + 1 }));
  };
  const onPace = (ms: number) => {
    const verdict = paceVerdict(ms, sharp, film);
    if (verdict === "soften") setSharp(false);
    else if (verdict === "stills") setSlow(true);
  };

  return (
    <>
      <StageBar path="/s/design/model">
        <div className="flex gap-1.5" role="group" aria-label="How the model is drawn">
          {MODES.map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`${CHIP} ${mode === m ? CHIP_ON : CHIP_OFF}`}>
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
        <div ref={box} className="absolute inset-0 bg-[radial-gradient(ellipse_62%_58%_at_50%_46%,#2a211b_0%,#15120f_45%,#0b0c0e_82%)]" data-eng-model={live && ready ? "live" : "still"}>
          {/* the tag as a drawing, until the model has drawn and where it cannot */}
          <div className={`absolute inset-x-0 bottom-12 top-0 flex items-center justify-center p-8 transition-opacity duration-500 motion-reduce:transition-none ${live && ready ? "opacity-0" : "opacity-100"}`} aria-hidden={live && ready ? true : undefined}>
            <TagArt strap={10} margin={4} label={ENGINEERING.model.still(EXAMPLE.name)} className="h-full max-h-[440px] w-auto" />
          </div>
          {live ? (
            <div className={`absolute inset-x-0 bottom-12 top-0 transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}>
              <ProductCanvas
                product={product}
                mode={LOOK[mode]}
                explode={mode === "exploded" ? 1 : 0}
                open={null}
                turning={animated && seen && !held}
                pose={pose}
                chosen={null}
                wires={wiresShown}
                labels={labels}
                nudge={nudge}
                playing={seen}
                sharp={sharp}
                label={ENGINEERING.model.label(EXAMPLE.name)}
                onReady={() => setReady(true)}
                onPace={onPace}
              />
            </div>
          ) : null}
        </div>
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5" role="group" aria-label="Turn, tilt and zoom the model">
          <button type="button" className={`${ICON} bg-[#0b0c0e]`} aria-label="Turn left" onClick={() => step("left")}><ArrowLeft className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={`${ICON} bg-[#0b0c0e]`} aria-label="Turn right" onClick={() => step("right")}><ArrowRight className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={`${ICON} bg-[#0b0c0e]`} aria-label="Tilt up" onClick={() => step("up")}><ArrowUp className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={`${ICON} bg-[#0b0c0e]`} aria-label="Tilt down" onClick={() => step("down")}><ArrowDown className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={`${ICON} bg-[#0b0c0e]`} aria-label="Zoom in" onClick={() => step("in")}><Plus className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={`${ICON} bg-[#0b0c0e]`} aria-label="Zoom out" onClick={() => step("out")}><Minus className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={`${ICON} bg-[#0b0c0e]`} aria-label="Reset the view and turn again" onClick={() => { setHeld(false); setPose((p) => ({ ...p, key: p.key + 1 })); }}><RotateCcw className="h-4 w-4" aria-hidden /></button>
        </div>
      </StageView>
      <StageFoot hint={ENGINEERING.model.hint}>{ENGINEERING.model.counts(drawn.length, product.parts.length, joins, wires)}</StageFoot>
    </>
  );
}
