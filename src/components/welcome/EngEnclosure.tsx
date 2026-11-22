"use client";

// The Enclosure and print tab: the base and the lid the app's own generator (CaseMaker) built for the example on
// the server, drawn by the app's own enclosure preview (EnclosureCanvas, as the Enclosure page mounts it). In
// "As it prints" the two pieces lie on the bed the way their print files do (the lid turned over) and a cutting
// plane rises through them, layer on layer, again and again; "Assembled" shows the lid on the base. The checks
// beside it are the app's own, measured on these meshes. Under reduced motion the pieces stand complete.
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useInView } from "motion/react";
import { Check, Minus, Plus, RotateCcw, X } from "lucide-react";
import EnclosureCanvas, { type PreviewMesh } from "@/components/enclosure/EnclosureCanvas";
import { Showcase, type ShowcaseNudge } from "@/components/three/canvasShowcase";
import type { GeneratedMesh } from "@/lib/enclosure/types";
import type { ExampleEnclosure, PlainMesh } from "./exampleData";
import { useAnimated } from "./useAnimated";
import { ENGINEERING } from "./content";
import { CHIP, CHIP_OFF, CHIP_ON, ICON, StageBar, StageFoot, StageView } from "./StageParts";

const GAP = 12; // mm between the two pieces on the bed
const RISE_S = 9; // seconds for the plane to climb
const HOLD_S = 3.5; // and to rest on the finished pieces

/** The mesh moved by `f`, as the typed arrays the preview takes. */
function mesh(m: PlainMesh, f: (x: number, y: number, z: number) => [number, number, number]): GeneratedMesh {
  const positions = new Float32Array(m.positions.length);
  for (let i = 0; i < m.positions.length; i += 3) positions.set(f(m.positions[i]!, m.positions[i + 1]!, m.positions[i + 2]!), i);
  return { positions, indices: Uint32Array.from(m.indices) };
}
const span = (m: PlainMesh, k: 0 | 1 | 2) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = k; i < m.positions.length; i += 3) {
    lo = Math.min(lo, m.positions[i]!);
    hi = Math.max(hi, m.positions[i]!);
  }
  return [lo, hi] as const;
};

// three.js objects and DOM nodes are changed in place, outside React's data flow; these do it by name
function setClipping(gl: THREE.WebGLRenderer, planes: THREE.Plane[]) {
  gl.clippingPlanes = planes;
}
function setLevel(plane: THREE.Plane, y: number) {
  plane.constant = y;
}
function setText(el: HTMLElement | null, text: string) {
  if (el && el.textContent !== text) el.textContent = text;
}

/** The cutting plane that climbs through the pieces: everything above it is not printed yet. */
function PrintRise({ height, running, readout }: { height: number; running: boolean; readout: RefObject<HTMLSpanElement | null> }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const [plane] = useState(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), height));
  const t = useRef(0);
  useEffect(() => {
    setLevel(plane, height);
    setClipping(gl, running ? [plane] : []);
    if (!running) setText(readout.current, height.toFixed(1));
    invalidate();
    return () => setClipping(gl, []);
  }, [gl, plane, running, height, invalidate, readout]);
  useFrame((_, dt) => {
    if (!running) return;
    t.current = (t.current + Math.min(dt, 0.05)) % (RISE_S + HOLD_S);
    const h = Math.min(1, t.current / RISE_S) * height;
    setLevel(plane, h + 0.01);
    setText(readout.current, h.toFixed(1));
    invalidate();
  });
  return null;
}

/** Brings the camera in on the pieces once the preview has framed them: its own framing leaves them small. */
function Closer({ height, by }: { height: number; by: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!controls) return;
    controls.target.set(0, height / 2, 0);
    camera.position.sub(controls.target).multiplyScalar(by).add(controls.target);
    controls.update();
    invalidate();
  }, [camera, controls, height, by, invalidate]);
  return null;
}

type Mode = keyof typeof ENGINEERING.enclosure.modes;
const MODES = Object.keys(ENGINEERING.enclosure.modes) as Mode[];

export default function EngEnclosure({ enclosure }: { enclosure: ExampleEnclosure }) {
  const box = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const animated = useAnimated();
  const seen = useInView(box, { amount: 0.2 });
  const [mode, setMode] = useState<Mode>("printing");
  const [held, setHeld] = useState(false);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => setNarrow((box.current?.clientWidth ?? 1000) < 640), []);
  const [nudge, setNudge] = useState<ShowcaseNudge>({ kind: "left", n: 0 });

  const { meshes, height } = useMemo(() => {
    const [bx0, bx1] = span(enclosure.base, 0);
    const [by0, by1] = span(enclosure.base, 1);
    const [ly0, ly1] = span(enclosure.lid, 1);
    const w = bx1 - bx0;
    if (mode === "assembled") {
      const same = (x: number, y: number, z: number): [number, number, number] => [x, y - by0, z];
      return { meshes: [{ id: "base", kind: "base", mesh: mesh(enclosure.base, same) }, { id: "lid", kind: "lid", mesh: mesh(enclosure.lid, same) }] as PreviewMesh[], height: ly1 - by0 };
    }
    // as the print files lay them: the base upright, the lid turned over, both resting on the bed
    const shift = (w + GAP) / 2;
    return {
      meshes: [
        { id: "base-print", kind: "base", mesh: mesh(enclosure.base, (x, y, z) => [x - shift, y - by0, z]) },
        { id: "lid-print", kind: "lid", mesh: mesh(enclosure.lid, (x, y, z) => [x + shift, ly1 - y, -z]) },
      ] as PreviewMesh[],
      height: Math.max(by1 - by0, ly1 - ly0),
    };
  }, [enclosure, mode]);

  const printing = mode === "printing" && animated && seen;
  const step = (kind: ShowcaseNudge["kind"]) => {
    setHeld(true);
    setNudge((n) => ({ kind, n: n.n + 1 }));
  };
  const met = enclosure.checks.filter((c) => c.ok).length;

  return (
    <>
      <StageBar path="/s/design/enclosure">
        <div className="flex gap-1.5" role="group" aria-label="How the enclosure is shown">
          {MODES.map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`${CHIP} ${mode === m ? CHIP_ON : CHIP_OFF}`}>
              {ENGINEERING.enclosure.modes[m]}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Turn and zoom the enclosure">
          <button type="button" className={ICON} aria-label="Zoom in" onClick={() => step("in")}><Plus className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={ICON} aria-label="Zoom out" onClick={() => step("out")}><Minus className="h-4 w-4" aria-hidden /></button>
          <button type="button" className={ICON} aria-label="Turn again" onClick={() => setHeld(false)}><RotateCcw className="h-4 w-4" aria-hidden /></button>
        </div>
      </StageBar>
      <StageView className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div ref={box} className="relative min-h-0 bg-[radial-gradient(ellipse_at_center,#171a20_0%,#0b0c0e_72%)]">
          <div className="absolute inset-0">
            <EnclosureCanvas key={`${mode}${narrow}`} meshes={meshes} lift={0} dark label={ENGINEERING.enclosure.label} floorY={0} wheelZoom={false}>
              <Showcase turntable={animated && seen && !held} onGrab={() => setHeld(true)} nudge={nudge} />
              <Closer height={height} by={(mode === "printing" ? 0.56 : 1.05) * (narrow ? 1.7 : 1)} />
              <PrintRise height={height} running={printing} readout={readout} />
            </EnclosureCanvas>
          </div>
          <p className="pointer-events-none absolute left-3 top-3 rounded-md border border-hairline bg-[#0b0c0e] px-2.5 py-1.5 font-mono text-[11px] text-secondary">
            {mode === "printing" ? ENGINEERING.enclosure.printed : ENGINEERING.enclosure.tall}{" "}
            <span className="tabular-nums text-primary"><span ref={readout}>{height.toFixed(1)}</span> of {height.toFixed(1)} mm</span>
          </p>
        </div>
        <div className="hidden min-h-0 overflow-y-auto border-l border-hairline p-4 lg:block" tabIndex={0} role="group" aria-label="The enclosure checks">
          <p className="font-mono text-[11px] text-muted">{ENGINEERING.enclosure.checksTitle}</p>
          <ul className="mt-3 space-y-3">
            {enclosure.checks.map((c) => (
              <li key={c.key} className="flex gap-2.5 text-[13px] leading-snug">
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${c.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                  {c.ok ? <Check className="h-3 w-3" aria-hidden /> : <X className="h-3 w-3" aria-hidden />}
                </span>
                <span>
                  <span className="font-medium text-primary">{c.label}</span>
                  <span className="sr-only">{c.ok ? " (met). " : " (not met). "}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-secondary">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </StageView>
      <StageFoot hint={<><span className="sm:hidden">{ENGINEERING.hintTouch}</span><span className="hidden sm:inline">{ENGINEERING.hintMouse}</span></>}>
        {enclosure.outer.map((n) => Number(n.toFixed(1))).join(" x ")} mm, {met} of {enclosure.checks.length} checks met, {enclosure.version}
      </StageFoot>
    </>
  );
}
