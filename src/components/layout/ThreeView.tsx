"use client";

/**
 * One orthographic view drawn in SVG. Drawing units are mm; the viewBox is the camera, so zoom and
 * pan are just a different viewBox. Dragging a part reports live positions upward; the parent saves
 * once on release.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  bodiesInView,
  boxRect,
  footprint,
  fmtMm,
  fromScreen,
  innerBox,
  niceStep,
  snapTo,
  toScreen,
  type LayoutPart,
  type ViewDef,
} from "./geom";
import { clamp } from "@/lib/math";

export type Marker = { id: number; label: string; pos: number[] };
type Cam = { cx: number; cy: number; ppm: number };
type Gesture =
  | { mode: "part"; id: number; startMm: [number, number]; startPos: number[]; startClient: [number, number]; moved: boolean; last: number[] }
  | { mode: "pan"; startCam: Cam; startClient: [number, number]; moved: boolean };

const MIN_PPM = 0.4;
const MAX_PPM = 120;
const RULER_TOP = 16;
const RULER_LEFT = 32;
export const DRAG_MIME = "application/x-layout-part";


type Props = {
  view: ViewDef;
  parts: LayoutPart[];
  shells: LayoutPart[];
  markers: Marker[];
  wall: number;
  /** y of the floor, for placing draft markers in side views */
  floor: number;
  selectedId: number | null;
  overlapping: Set<number>;
  snapOn: boolean;
  step: number;
  heightClass: string;
  onSelect: (id: number | null) => void;
  onActivate: () => void;
  onMove: (id: number, pos: number[]) => void;
  onCommit: (id: number, pos: number[]) => void;
  /** Top view only: a tray part was dropped at scene x and z. */
  onDropDraft?: (id: number, x: number, z: number) => void;
  /** A viewer only: parts cannot be dragged (a drag pans), and a plain wheel scrolls the page (Ctrl or Cmd + wheel zooms). Used by the public welcome page. */
  readOnly?: boolean;
};

export function ThreeView({
  view, parts, shells, markers, wall, floor, selectedId, overlapping, snapOn, step, heightClass,
  onSelect, onActivate, onMove, onCommit, onDropDraft, readOnly = false,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [camState, setCamState] = useState<Cam | null>(null);
  const [readout, setReadout] = useState<string>("");

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight })));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useMemo<Cam | null>(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x: number, y: number, w: number, h: number) => {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h);
    };
    for (const p of [...shells, ...parts]) {
      const f = footprint(view, p.geometry);
      add(f.x, f.y, f.w, f.h);
    }
    for (const m of markers) {
      const [sx, sy] = toScreen(view, m.pos);
      add(sx - 5, sy - 5, 10, 10);
    }
    if (!Number.isFinite(x0) || size.w < 80 || size.h < 80) return null;
    const bw = Math.max(x1 - x0, 20);
    const bh = Math.max(y1 - y0, 20);
    const ppm = clamp(Math.min((size.w - RULER_LEFT - 40) / bw, (size.h - RULER_TOP - 40) / bh), MIN_PPM, MAX_PPM);
    // Centre the drawing in the space the rulers leave free.
    return { cx: (x0 + x1) / 2 - RULER_LEFT / 2 / ppm, cy: (y0 + y1) / 2 - RULER_TOP / 2 / ppm, ppm };
  }, [shells, parts, markers, view, size]);

  // Freeze the first fit so later edits never move the camera under the pointer.
  if (!camState && fit) setCamState(fit);
  const cam = camState ?? fit;

  const toMm = (clientX: number, clientY: number): [number, number] | null => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !cam) return null;
    return [cam.cx + (clientX - r.left - r.width / 2) / cam.ppm, cam.cy + (clientY - r.top - r.height / 2) / cam.ppm];
  };

  // Wheel zoom about the cursor. Needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !cam) return;
    const onWheel = (e: WheelEvent) => {
      if (readOnly && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const px = e.clientX - r.left - r.width / 2;
      const py = e.clientY - r.top - r.height / 2;
      const ppm = clamp(cam.ppm * Math.exp(-e.deltaY * 0.0015), MIN_PPM, MAX_PPM);
      const mx = cam.cx + px / cam.ppm;
      const my = cam.cy + py / cam.ppm;
      setCamState({ ppm, cx: mx - px / ppm, cy: my - py / ppm });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [cam, readOnly]);

  const zoomBy = (f: number) => cam && setCamState({ ...cam, ppm: clamp(cam.ppm * f, MIN_PPM, MAX_PPM) });

  const partById = (id: number) => parts.find((p) => p.id === id);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || !cam) return;
    onActivate();
    setCamState(cam);
    const hit = (e.target as Element).closest("[data-part-id]");
    const mm = toMm(e.clientX, e.clientY);
    svgRef.current?.setPointerCapture(e.pointerId);
    if (hit && mm) {
      const id = Number(hit.getAttribute("data-part-id"));
      const p = partById(id);
      if (p && readOnly) onSelect(id);
      else if (p) {
        onSelect(id);
        gesture.current = { mode: "part", id, startMm: mm, startPos: [...p.geometry.pos], startClient: [e.clientX, e.clientY], moved: false, last: [...p.geometry.pos] };
        return;
      }
    }
    gesture.current = { mode: "pan", startCam: cam, startClient: [e.clientX, e.clientY], moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g || !cam) return;
    const dist = Math.hypot(e.clientX - g.startClient[0], e.clientY - g.startClient[1]);
    if (!g.moved && dist < 3) return;
    g.moved = true;
    if (g.mode === "pan") {
      setCamState({ ...g.startCam, cx: g.startCam.cx - (e.clientX - g.startClient[0]) / g.startCam.ppm, cy: g.startCam.cy - (e.clientY - g.startClient[1]) / g.startCam.ppm });
      return;
    }
    const mm = toMm(e.clientX, e.clientY);
    if (!mm) return;
    const [dh, dv] = fromScreen(view, mm[0] - g.startMm[0], mm[1] - g.startMm[1]);
    const next = [...g.startPos];
    next[view.h] = g.startPos[view.h] + dh;
    next[view.v] = g.startPos[view.v] + dv;
    if (snapOn) {
      next[view.h] = snapTo(next[view.h], step);
      next[view.v] = snapTo(next[view.v], step);
    } else {
      next[view.h] = Number(next[view.h].toFixed(2));
      next[view.v] = Number(next[view.v].toFixed(2));
    }
    g.last = next;
    const p = partById(g.id);
    setReadout(`${p?.label ?? ""}  ${view.hName} ${fmtMm(next[view.h])}, ${view.vName} ${fmtMm(next[view.v])} mm`);
    onMove(g.id, next);
  };

  const endGesture = (e: React.PointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    setReadout("");
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);
    if (!g) return;
    if (g.mode === "part") {
      if (g.moved && !cancelled) onCommit(g.id, g.last);
      else if (g.moved) onMove(g.id, g.startPos);
    } else if (!g.moved && !cancelled && !(readOnly && (e.target as Element).closest("[data-part-id]"))) {
      onSelect(null);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    if (onDropDraft && e.dataTransfer.types.includes(DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };
  const onDrop = (e: React.DragEvent) => {
    if (!onDropDraft) return;
    const id = Number(e.dataTransfer.getData(DRAG_MIME));
    const mm = toMm(e.clientX, e.clientY);
    if (!Number.isFinite(id) || !mm) return;
    e.preventDefault();
    const [x, z] = fromScreen(view, mm[0], mm[1]);
    onDropDraft(id, snapOn ? snapTo(x, step) : Number(x.toFixed(2)), snapOn ? snapTo(z, step) : Number(z.toFixed(2)));
  };

  const ordered = useMemo(
    () =>
      [...parts].sort((a, b) => {
        if (a.id === selectedId) return 1;
        if (b.id === selectedId) return -1;
        const fa = footprint(view, a.geometry);
        const fb = footprint(view, b.geometry);
        return fb.w * fb.h - fa.w * fa.h;
      }),
    [parts, selectedId, view]
  );

  const hint = `${view.label}: ${view.hName} right, ${view.vName} ${view.flip ? "up" : "down"}`;

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden rounded-xl border border-hairline bg-subtle ${heightClass}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {cam && size.w > 0 && (
        <svg
          ref={svgRef}
          role="img"
          aria-label={`${view.label} view of the layout`}
          className="absolute inset-0 h-full w-full touch-none select-none"
          viewBox={`${cam.cx - size.w / cam.ppm / 2} ${cam.cy - size.h / cam.ppm / 2} ${size.w / cam.ppm} ${size.h / cam.ppm}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endGesture(e, false)}
          onPointerCancel={(e) => endGesture(e, true)}
        >
          <Scene
            view={view} cam={cam} size={size} parts={ordered} shells={shells} markers={markers} wall={wall} floor={floor}
            selectedId={selectedId} overlapping={overlapping} dragging={!!readout} readOnly={readOnly}
          />
        </svg>
      )}

      <p className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-surface px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-link">
        {hint}
      </p>
      {readout && (
        <p aria-live="polite" className="pointer-events-none absolute left-2 top-10 rounded-md border border-dutchOrange/40 bg-surface px-2 py-1 font-mono text-xs text-primary">
          {readout}
        </p>
      )}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md border border-hairline bg-surface p-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Zoom out ${view.label} view`} onClick={() => zoomBy(1 / 1.35)}>
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Zoom in ${view.label} view`} onClick={() => zoomBy(1.35)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Fit ${view.label} view`} onClick={() => fit && setCamState(fit)}>
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function Scene({
  view, cam, size, parts, shells, markers, wall, floor, selectedId, overlapping, dragging, readOnly,
}: {
  view: ViewDef; cam: Cam; size: { w: number; h: number }; parts: LayoutPart[]; shells: LayoutPart[]; markers: Marker[];
  wall: number; floor: number; selectedId: number | null; overlapping: Set<number>; dragging: boolean; readOnly: boolean;
}) {
  const { ppm } = cam;
  const px = (n: number) => n / ppm;
  const vbX = cam.cx - size.w / ppm / 2;
  const vbY = cam.cy - size.h / ppm / 2;
  const vbW = size.w / ppm;
  const vbH = size.h / ppm;
  const fs = px(10);
  const hatch = `hatch-${view.key}`;

  // Grid: minor 5 mm, major 10 mm; coarser when the lines would be too close to read.
  const minorOn = 5 * ppm >= 7;
  const majorStep = 10 * ppm >= 7 ? 10 : 10 * ppm >= 1.4 ? 50 : 100;
  const gridPath = (stepMm: number) => {
    let d = "";
    for (let x = Math.ceil(vbX / stepMm) * stepMm; x <= vbX + vbW; x += stepMm) d += `M${x} ${vbY}V${vbY + vbH}`;
    for (let y = Math.ceil(vbY / stepMm) * stepMm; y <= vbY + vbH; y += stepMm) d += `M${vbX} ${y}H${vbX + vbW}`;
    return d;
  };

  const rulerStep = niceStep(ppm, 56);
  const topTicks: number[] = [];
  for (let t = Math.ceil(vbX / rulerStep) * rulerStep; t <= vbX + vbW; t += rulerStep) topTicks.push(Number(t.toFixed(4)));
  const leftTicks: number[] = [];
  {
    const a = view.flip ? -(vbY + vbH) : vbY;
    const b = view.flip ? -vbY : vbY + vbH;
    for (let t = Math.ceil(a / rulerStep) * rulerStep; t <= b; t += rulerStep) leftTicks.push(Number(t.toFixed(4)));
  }

  const wallMm = Math.max(0, wall);

  // Where each part's name goes. Parts often share a centre (a board over a battery holder, a speaker over both),
  // so the smallest parts are placed first, in the middle of their own outline, and a larger part whose middle is
  // taken moves its name to a free corner or edge of its outline. A part too small to hold a name gets it above.
  type LabelBox = { x: number; y: number; w: number; h: number };
  const taken: LabelBox[] = [];
  const clash = (r: LabelBox) => taken.some((t) => Math.abs(t.x - r.x) < (t.w + r.w) / 2 && Math.abs(t.y - r.y) < (t.h + r.h) / 2);
  const sizeOf = (text: string) => ({ w: px(text.length * 6.2 + 6), h: px(13) });
  for (const s of shells) {
    const [b] = bodiesInView(view, s.geometry);
    if (b.kind !== "rect") continue;
    const { w, h } = sizeOf(s.label);
    taken.push({ x: b.x + px(4) + w / 2, y: b.y + px(9), w, h });
  }
  const labels = [...parts]
    .map((p) => ({ p, f: footprint(view, p.geometry) }))
    .sort((a, b) => a.f.w * a.f.h - b.f.w * b.f.h)
    .map(({ p, f }) => {
      const { w, h } = sizeOf(p.label);
      const small = f.w * ppm < 26 || f.h * ppm < 12;
      const inside = (sx: number, sy: number) => ({ x: f.x + f.w / 2 + sx * Math.max(0, f.w / 2 - w / 2 - px(3)), y: f.y + f.h / 2 + sy * Math.max(0, f.h / 2 - h / 2 - px(3)) });
      const spots = small
        ? [{ x: f.x + f.w / 2, y: f.y - px(7) }, { x: f.x + f.w / 2, y: f.y + f.h + px(8) }, { x: f.x - w / 2 - px(3), y: f.y + f.h / 2 }, { x: f.x + f.w + w / 2 + px(3), y: f.y + f.h / 2 }]
        : [inside(0, 0), inside(-1, -1), inside(1, -1), inside(-1, 1), inside(1, 1), inside(0, -1), inside(0, 1), inside(-1, 0), inside(1, 0)];
      const at = spots.find((s) => !clash({ ...s, w, h })) ?? spots[0];
      taken.push({ ...at, w, h });
      return { p, at };
    });

  return (
    <>
      <defs>
        <pattern id={hatch} width={px(7)} height={px(7)} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={px(7)} className="stroke-danger" strokeWidth={px(2)} />
        </pattern>
      </defs>

      {minorOn && <path d={gridPath(5)} className="stroke-hairline" fill="none" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      <path d={gridPath(majorStep)} className="stroke-muted" strokeOpacity={0.35} fill="none" strokeWidth={1} vectorEffect="non-scaling-stroke" />

      {/* origin */}
      <path d={`M${-px(8)} 0H${px(8)}M0 ${-px(8)}V${px(8)}`} className="stroke-link" fill="none" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />

      {shells.map((s) => {
        const [b] = bodiesInView(view, s.geometry);
        if (b.kind !== "rect") return null;
        const inner = innerBox(s.geometry, wallMm);
        const f = boxRect(view, inner);
        const showInner = wallMm > 0 && inner.max[0] > inner.min[0] && inner.max[1] > inner.min[1] && inner.max[2] > inner.min[2];
        return (
          <g key={s.id} pointerEvents="none">
            <rect x={b.x} y={b.y} width={b.w} height={b.h} className="fill-canvas stroke-primary" fillOpacity={0.7} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            {showInner && <rect x={f.x} y={f.y} width={f.w} height={f.h} className="fill-none stroke-muted" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
            <text x={b.x + px(4)} y={b.y + px(13)} fontSize={fs} className="fill-secondary font-mono">{s.label}</text>
          </g>
        );
      })}

      {parts.map((p) => {
        const sel = p.id === selectedId;
        const over = overlapping.has(p.id);
        const bodies = bodiesInView(view, p.geometry);
        const stroke = sel ? "stroke-dutchOrange" : over ? "stroke-danger" : "stroke-secondary";
        const fill = sel ? "fill-dutchOrange" : "fill-surface";
        return (
          <g key={p.id} data-part-id={p.id} style={{ cursor: readOnly ? "pointer" : dragging && sel ? "grabbing" : "grab" }}>
            {bodies.map((b, i) =>
              b.kind === "rect" ? (
                <g key={i}>
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} className={`${fill} ${stroke}`} fillOpacity={sel ? 0.2 : 0.75} strokeWidth={sel ? 2 : 1.25} vectorEffect="non-scaling-stroke" />
                  {over && <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={`url(#${hatch})`} pointerEvents="none" />}
                </g>
              ) : (
                <g key={i}>
                  <circle cx={b.cx} cy={b.cy} r={b.r} className={`${fill} ${stroke}`} fillOpacity={sel ? 0.2 : 0.75} strokeWidth={sel ? 2 : 1.25} vectorEffect="non-scaling-stroke" />
                  {over && <circle cx={b.cx} cy={b.cy} r={b.r} fill={`url(#${hatch})`} pointerEvents="none" />}
                </g>
              )
            )}
          </g>
        );
      })}

      {/* Every label is drawn after every body, so no part hides another part's name, and each keeps clear of the others. */}
      {labels.map(({ p, at }) => (
        <text
          key={p.id}
          x={at.x}
          y={at.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fs}
          className={`pointer-events-none font-mono ${p.id === selectedId ? "fill-link" : "fill-primary"} stroke-canvas`}
          strokeWidth={3}
          strokeLinejoin="round"
          paintOrder="stroke"
          vectorEffect="non-scaling-stroke"
        >
          {p.label}
        </text>
      ))}

      {markers.map((m) => {
        const c = [...m.pos];
        if (view.vName === "y") c[1] = floor;
        const [sx, sy] = toScreen(view, c);
        const r = px(6);
        return (
          <g key={m.id} pointerEvents="none">
            <circle cx={sx} cy={sy} r={r} className="fill-none stroke-dutchOrange" strokeWidth={1.5} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
            <path d={`M${sx - r * 1.6} ${sy}H${sx + r * 1.6}M${sx} ${sy - r * 1.6}V${sy + r * 1.6}`} className="stroke-dutchOrange" fill="none" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={sx + r * 1.8} y={sy - r} fontSize={fs} className="fill-link font-mono">{m.label} (size needed)</text>
          </g>
        );
      })}

      {/* rulers */}
      <g pointerEvents="none">
        <rect x={vbX} y={vbY} width={vbW} height={px(RULER_TOP)} className="fill-surface" />
        <rect x={vbX} y={vbY} width={px(RULER_LEFT)} height={vbH} className="fill-surface" />
        <path d={`M${vbX} ${vbY + px(RULER_TOP)}H${vbX + vbW}M${vbX + px(RULER_LEFT)} ${vbY}V${vbY + vbH}`} className="stroke-hairline" fill="none" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {topTicks.map((t) => (
          <g key={`t${t}`}>
            <path d={`M${t} ${vbY + px(RULER_TOP - 5)}V${vbY + px(RULER_TOP)}`} className="stroke-muted" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={t + px(3)} y={vbY + px(9)} fontSize={fs} className="fill-muted font-mono">{fmtMm(t)}</text>
          </g>
        ))}
        {leftTicks.map((t) => {
          const y = view.flip ? -t : t;
          return (
            <g key={`l${t}`}>
              <path d={`M${vbX + px(RULER_LEFT - 5)} ${y}H${vbX + px(RULER_LEFT)}`} className="stroke-muted" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <text x={vbX + px(RULER_LEFT - 7)} y={y - px(3)} textAnchor="end" fontSize={fs} className="fill-muted font-mono">{fmtMm(t)}</text>
            </g>
          );
        })}
        <rect x={vbX} y={vbY} width={px(RULER_LEFT)} height={px(RULER_TOP)} className="fill-subtle" />
        <text x={vbX + px(RULER_LEFT / 2)} y={vbY + px(9)} textAnchor="middle" fontSize={fs} className="fill-link font-mono">mm</text>
      </g>
    </>
  );
}
