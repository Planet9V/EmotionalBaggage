"use client";

// Stage 04's output, live: the enclosure the app's own generator (CaseMaker) built from the example's parts, laid
// on the print bed the way its print files lay it (the base upright, the lid turned over), in the app's own
// enclosure preview (EnclosureCanvas) with its showcase extras. A layer scrubber cuts it at the height of one
// layer: below the cut it is printed and the cut face is filled in the accent, above it what is still to print
// is a faint outline; the reading gives the layer number and the height. The layer height, the material, the
// time and the mass are the example's own print-job rows. While nobody touches it the print climbs layer by
// layer, holds and starts again as the bed turns; a touch stops both, and the reset button starts them again.
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useInView } from "motion/react";
import EnclosureCanvas, { type PreviewMesh } from "@/components/enclosure/EnclosureCanvas";
import { Showcase, type ShowcaseNudge } from "@/components/three/canvasShowcase";
import { heightOfLayer, layerCount } from "@/components/three/showcaseLogic";
import { StatusPill } from "@/components/content/shared";
import type { ExampleEnclosure } from "../exampleData";
import type { GetData } from "../storyData";
import { FitBox, mesh, span } from "../bedScene";
import { TapToExplore } from "../TapToExplore";
import { useAnimated } from "../useAnimated";
import { GET_VIEWS } from "../content";
import { ControlGroup, OrbitPad, Range, Segmented } from "./ViewControls";
import type { Look } from "./GetModel";

const GAP = 12; // mm between the two pieces on the bed
const CLIMB_MS = 9000;
const HOLD_MS = 2600;
/** the slicer's default when a print job names no layer height */
const FALLBACK_LAYER = 0.2;

/** A faint square of the bed's surface at the cut, so the height reads against the pieces. */
function CutPlane({ y, size }: { y: number; size: [number, number] }) {
  const geo = useMemo(() => new THREE.PlaneGeometry(size[0], size[1]).rotateX(-Math.PI / 2), [size]);
  useEffect(() => () => geo.dispose(), [geo]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  useEffect(() => () => edges.dispose(), [edges]);
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={geo} renderOrder={3}>
        <meshBasicMaterial color="#E05A10" transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={edges} renderOrder={3}>
        <lineBasicMaterial color="#E05A10" transparent opacity={0.65} />
      </lineSegments>
    </group>
  );
}

export default function GetPrint({ enclosure, get }: { enclosure: ExampleEnclosure; get: GetData }) {
  const box = useRef<HTMLDivElement>(null);
  const animated = useAnimated();
  const seen = useInView(box, { amount: 0.2 });
  const c = GET_VIEWS.print;
  const [look, setLook] = useState<Look>("solid");
  const [held, setHeld] = useState(false);
  const [nudge, setNudge] = useState<ShowcaseNudge>({ kind: "left", n: 0 });
  const [token, setToken] = useState(0);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => setNarrow((box.current?.clientWidth ?? 1000) < 640), []);

  const layerMm = get.layerMm ?? FALLBACK_LAYER;
  const { meshes, height, footprint, bounds } = useMemo(() => {
    const [bx0, bx1] = span(enclosure.base, 0);
    const [by0, by1] = span(enclosure.base, 1);
    const [, ly1] = span(enclosure.lid, 1);
    const [ly0] = span(enclosure.lid, 1);
    const [bz0, bz1] = span(enclosure.base, 2);
    const w = bx1 - bx0;
    const shift = (w + GAP) / 2;
    const meshes: PreviewMesh[] = [
      { id: "base-print", kind: "base", mesh: mesh(enclosure.base, (x, y, z) => [x - shift, y - by0, z]) },
      { id: "lid-print", kind: "lid", mesh: mesh(enclosure.lid, (x, y, z) => [x + shift, ly1 - y, -z]) },
    ];
    const bounds = new THREE.Box3();
    for (const m of meshes) bounds.union(new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(m.mesh.positions, 3)));
    return { meshes, height: Math.max(by1 - by0, ly1 - ly0), footprint: [w * 2 + GAP + 16, bz1 - bz0 + 16] as [number, number], bounds };
  }, [enclosure]);
  const total = layerCount(height, layerMm);
  const [layer, setLayer] = useState(total);

  // the print climbs while nobody holds it
  const climbing = animated && seen && !held;
  useEffect(() => {
    if (!climbing) return;
    let raf = 0;
    let start = performance.now();
    const frame = (now: number) => {
      const t = now - start;
      if (t > CLIMB_MS + HOLD_MS) start = now;
      setLayer(Math.max(1, Math.round(Math.min(1, t / CLIMB_MS) * total)));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [climbing, total]);

  const h = heightOfLayer(layer, layerMm, height);
  const job = get.print[get.print.length - 1];
  const reset = () => {
    setHeld(false);
    setToken((t) => t + 1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline px-3 py-2 sm:px-4">
        <ControlGroup label={c.lookLabel}>
          <Segmented<Look> label={c.lookLabel} value={look} onChange={setLook} options={(Object.keys(c.looks) as Look[]).map((k) => ({ value: k, label: c.looks[k] }))} />
        </ControlGroup>
        <div className="ml-auto hidden sm:block">
          <OrbitPad onNudge={(k) => { setHeld(true); setNudge((n) => ({ kind: k, n: n.n + 1 })); }} onReset={reset} resetLabel={c.reset} compact />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="relative min-h-[300px]">
          <div ref={box} className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,#1a1e25_0%,#0b0c0e_70%)]">
            <TapToExplore className="absolute inset-0">
              <EnclosureCanvas meshes={meshes} lift={0} dark label={c.label} floorY={0} wheelZoom={false} look={look} clipY={layer >= total ? height + 1 : h + 1e-3} ghost cutColor="#E05A10" tint={look === "wireframe" ? "#c7ccd3" : "#aeb6c1"}>
                <Showcase turntable={climbing} onGrab={() => setHeld(true)} nudge={nudge} />
                <FitBox box={bounds} closer={narrow ? 1.0 : 0.86} token={token} />
                {layer < total ? <CutPlane y={h} size={footprint} /> : null}
              </EnclosureCanvas>
            </TapToExplore>
          </div>
          <div className="pointer-events-none absolute left-3 top-3 z-30 rounded-md border border-white/10 bg-[#0b0c0e]/88 px-2.5 py-1.5 font-mono text-[11px] leading-snug text-secondary">
            <p>
              <span className="text-dutchOrange-300">{c.layer}</span> <span className="tabular-nums text-primary">{layer}</span> <span className="tabular-nums">/ {total}</span>
            </p>
            <p className="mt-0.5 tabular-nums text-primary">
              {h.toFixed(1)} <span className="text-secondary">/ {height.toFixed(1)} mm</span>
            </p>
          </div>
          <div className="absolute bottom-3 left-3 z-30 sm:hidden">
            <OrbitPad onNudge={(k) => { setHeld(true); setNudge((n) => ({ kind: k, n: n.n + 1 })); }} onReset={reset} resetLabel={c.reset} compact />
          </div>
        </div>
        {/* the example's own print jobs */}
        <div className="border-t border-hairline p-4 lg:border-l lg:border-t-0" role="group" aria-label={c.jobsTitle}>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{c.jobsTitle}</p>
          <ul className="mt-2 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            {[...get.print].reverse().map((j) => (
              <li key={j.title} className="rounded-lg border border-hairline bg-white/[0.02] p-3">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-primary">{j.title}</p>
                  <StatusPill status={j.status} />
                </div>
                <dl className="mt-2 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 font-mono text-[11px] leading-snug">
                  <dt className="text-muted">{c.material}</dt>
                  <dd className="text-secondary">{j.material || c.none}</dd>
                  <dt className="text-muted">{c.settings}</dt>
                  <dd className="text-secondary">{j.settings || c.none}</dd>
                  <dt className="text-muted">{c.estimate}</dt>
                  <dd className="text-primary">{j.estimate || c.none}</dd>
                </dl>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">{c.honest(job?.title ?? "", layerMm, get.layerMm !== null)}</p>
        </div>
      </div>
      <div className="border-t border-hairline px-3 py-2.5 sm:px-4">
        <Range
          onTouch={() => setHeld(true)}
          label={c.layer}
          value={layer}
          min={1}
          max={total}
          onChange={(v) => {
            setHeld(true);
            setLayer(v);
          }}
          readout={`${layer}/${total} · ${h.toFixed(1)} mm`}
          valueText={c.valueText(layer, total, h.toFixed(1))}
        />
      </div>
    </div>
  );
}
