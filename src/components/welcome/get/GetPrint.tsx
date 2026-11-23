"use client";

// Stage 04's output, live: the example's own printed pieces on the print bed, plate by plate, as its two print
// jobs lay them: plate 1 the body, the back plate and the two doors in PETG, each outside-face down as the design
// prints them; plate 2 the strap in TPU. The pieces are the product model's own (product/build.ts, the same ones
// the Enclosure and print tab sets out), in their filament's colour, in the app's enclosure preview
// (EnclosureCanvas) with its showcase extras. A layer scrubber cuts the plate at the height of one layer: below the
// cut it is printed and the cut face is filled in the accent, above it what is still to print is a faint outline;
// the reading gives the layer number and the height, which is the tallest piece's own thickness. The layer height,
// the material, the time and the mass are the example's print-job rows. While nobody touches it the print climbs
// layer by layer, holds and starts again as the bed turns; a touch stops both, and the reset button starts them again.
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useInView } from "motion/react";
import EnclosureCanvas, { type PreviewMesh } from "@/components/enclosure/EnclosureCanvas";
import { Showcase, type ShowcaseNudge } from "@/components/three/canvasShowcase";
import { heightOfLayer, layerCount } from "@/components/three/showcaseLogic";
import { StatusPill } from "@/components/content/shared";
import type { GetData } from "../storyData";
import { FitBox } from "../bedScene";
import { printedPieceOnBed } from "../product/build";
import { filamentColour, plateLayout, type Printed } from "../product/printed";
import { TapToExplore } from "../TapToExplore";
import { useAnimated } from "../useAnimated";
import { GET_VIEWS } from "../content";
import { ControlGroup, OrbitPad, Range, Segmented } from "./ViewControls";

const CLIMB_MS = 9000;
const HOLD_MS = 2600;
/** the slicer's default when a print job names no layer height */
const FALLBACK_LAYER = 0.2;
type Look = "wireframe" | "translucent" | "solid";

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

export default function GetPrint({ printed, get }: { printed: Printed; get: GetData }) {
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

  const [plate, setPlate] = useState(0);
  // the layer height the plate's own print job sets
  const fromRow = printed.jobs[plate]?.layerMm ?? get.layerMm;
  const layerMm = fromRow ?? FALLBACK_LAYER;
  const { meshes, height, footprint, bounds } = useMemo(() => {
    const on = printed.pieces.filter((p) => p.job === plate);
    const { at } = plateLayout(on);
    // the plate's own middle, so its pieces sit about the bed's
    const xs = on.map((p) => at.get(p.ref)!.x);
    const ys = on.map((p) => at.get(p.ref)!.y);
    const mid = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    const colour = filamentColour(printed.jobs[plate]?.colours[0] ?? "");
    const meshes: PreviewMesh[] = [];
    const bounds = new THREE.Box3();
    let height = 0;
    for (const p of on) {
      const piece = printedPieceOnBed(p.look, p.size);
      if (!piece) continue;
      const { x, y } = at.get(p.ref)!;
      const positions = piece.positions;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] = positions[i]! + x - mid[0]!;
        positions[i + 2] = positions[i + 2]! + y - mid[1]!;
      }
      meshes.push({ id: `${p.ref}-print`, kind: "base", color: colour, mesh: { positions, indices: Uint32Array.from({ length: positions.length / 3 }, (_, i) => i) } });
      bounds.union(new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(positions, 3)));
      height = Math.max(height, piece.height);
    }
    const size = bounds.getSize(new THREE.Vector3());
    return { meshes, height, footprint: [size.x + 16, size.z + 16] as [number, number], bounds };
  }, [printed, plate]);
  const total = layerCount(height, layerMm);
  const [at, setLayer] = useState<number | null>(null);
  // the whole plate until the climb or the slider says otherwise; never past this plate's last layer
  const layer = Math.min(at ?? total, total);

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
  const job = printed.jobs[plate];
  const choosePlate = (i: number) => {
    setPlate(i);
    setLayer(null);
    setToken((t) => t + 1);
  };
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
        <ControlGroup label={c.plateLabel}>
          <Segmented<string> label={c.plateLabel} value={String(plate)} onChange={(v) => choosePlate(Number(v))} options={printed.jobs.map((j, i) => ({ value: String(i), label: c.plate(i + 1, j.material) }))} />
        </ControlGroup>
        <div className="ml-auto hidden sm:block">
          <OrbitPad onNudge={(k) => { setHeld(true); setNudge((n) => ({ kind: k, n: n.n + 1 })); }} onReset={reset} resetLabel={c.reset} compact />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="relative min-h-[300px]">
          <div ref={box} className="absolute inset-0 bg-[radial-gradient(ellipse_62%_58%_at_50%_46%,#2a211b_0%,#15120f_45%,#0b0c0e_82%)]">
            <TapToExplore className="absolute inset-0">
              <EnclosureCanvas meshes={meshes} lift={0} dark label={c.label} floorY={0} wheelZoom={false} look={look} clipY={layer >= total ? height + 1 : h + 1e-3} ghost cutColor="#E05A10">
                <Showcase turntable={climbing} onGrab={() => setHeld(true)} nudge={nudge} />
                <FitBox box={bounds} closer={narrow ? 1.0 : 0.86} token={token} />
                {layer < total ? <CutPlane y={h} size={footprint} /> : null}
              </EnclosureCanvas>
            </TapToExplore>
          </div>
          <div className="pointer-events-none absolute left-3 top-3 z-30 rounded-md border border-white/10 bg-[#0b0c0e]/88 px-2.5 py-1.5 text-[13px] leading-snug text-secondary">
            <p>
              <span className="text-dutchOrange-300">{c.layer}</span> <span className="tabular-nums text-primary">{layer}</span> <span className="tabular-nums">/ {total}</span>
            </p>
            <p className="mt-0.5 tabular-nums text-primary">
              {h.toFixed(1)} <span className="text-secondary">/ {height.toFixed(1)} mm</span>
            </p>
            <p className="mt-0.5 max-w-[15rem]">{printed.pieces.filter((p) => p.job === plate).map((p) => p.name).join(", ")}</p>
          </div>
          <div className="absolute bottom-3 left-3 z-30 sm:hidden">
            <OrbitPad onNudge={(k) => { setHeld(true); setNudge((n) => ({ kind: k, n: n.n + 1 })); }} onReset={reset} resetLabel={c.reset} compact />
          </div>
        </div>
        {/* the example's own print jobs */}
        <div className="min-h-0 overflow-y-auto border-t border-hairline p-4 lg:border-l lg:border-t-0" role="group" aria-label={c.jobsTitle}>
          <p className="text-[13px] font-medium text-muted">{c.jobsTitle}</p>
          <ul className="mt-2 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            {printed.jobs.map((j, i) => (
              <li key={j.title}>
                <button type="button" aria-pressed={plate === i} onClick={() => choosePlate(i)} className={`w-full rounded-lg border bg-white/[0.02] p-3 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus ${plate === i ? "border-dutchOrange" : "border-hairline hover:border-white/30"}`}>
                  <span className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-primary">{j.title}</span>
                    <StatusPill status={j.status} />
                  </span>
                  <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-secondary">
                    {j.colours.map((col) => (
                      <span key={col} className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/25" style={{ background: filamentColour(col) }} aria-hidden />
                        {col}
                      </span>
                    ))}
                  </span>
                  <span className="mt-1.5 block text-[13px] text-primary">{j.estimate || c.none}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">{c.honest(job?.title ?? "", layerMm, fromRow !== null)}</p>
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
