"use client";

/**
 * Part tags for the showcase 3D views: a tag per part with its reference and its name from the parts list, joined
 * to the part by a leader line. The tags are page markup (sharp text in the mono type at any pixel density), laid
 * over the canvas by TagLayer; PartTags runs inside the canvas, finds where each part is on screen each frame it is
 * drawn, and moves its tag there with placeTags (showcaseLogic.ts): one column a side, never overlapping, inside
 * the view. A part left out of `shown` (a layer switched off, a part not yet placed) has no tag.
 */
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { placeTags, type TagSpot } from "./showcaseLogic";

export type TagPart = { id: number; ref: string; title: string };

// tags and leaders are page elements changed in place each frame, outside React's data flow
function hide(el: HTMLElement | SVGElement) {
  el.style.opacity = "0";
}
function show(el: HTMLElement | SVGElement) {
  el.style.opacity = "1";
}

/** Inside the canvas: places the tags held by `host` (TagLayer) on their parts. */
export function PartTags({ parts, host, shown, top = 14 }: { parts: TagPart[]; host: RefObject<HTMLDivElement | null>; shown?: ReadonlySet<number> | null; /** px kept clear at the top of the view */ top?: number }) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const spots = useRef(new Map<number, TagSpot>());
  const v = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => invalidate(), [parts, shown, invalidate]);

  useFrame(() => {
    const root = host.current;
    if (!root) return;
    // where each shown part is: the middle of its drawn meshes, in pixels
    const sum = new Map<number, { x: number; y: number; z: number; n: number }>();
    scene.traverse((o) => {
      const id = o.userData.partId;
      if (typeof id !== "number" || !(o as THREE.Mesh).isMesh || (shown && !shown.has(id))) return;
      let visible = true;
      for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) visible = false;
      if (!visible) return;
      // a shell is tagged on its tray (the first of its meshes), not halfway to a lifted lid
      if (o.userData.isShell && sum.has(id)) return;
      o.getWorldPosition(v);
      const s = sum.get(id) ?? { x: 0, y: 0, z: 0, n: 0 };
      sum.set(id, { x: s.x + v.x, y: s.y + v.y, z: s.z + v.z, n: s.n + 1 });
    });
    const at = new Map<number, { x: number; y: number }>();
    for (const [id, s] of sum) {
      v.set(s.x / s.n, s.y / s.n, s.z / s.n).project(camera);
      if (v.z > 1) continue;
      at.set(id, { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height });
    }
    const out = placeTags(at, spots.current, size, 0.18, undefined, top);
    spots.current = out.spots;
    for (const p of parts) {
      const el = root.querySelector<HTMLElement>(`[data-tag="${p.id}"]`);
      const line = root.querySelector<SVGLineElement>(`[data-leader="${p.id}"]`);
      const dot = root.querySelector<SVGCircleElement>(`[data-anchor="${p.id}"]`);
      if (!el || !line || !dot) continue;
      const spot = out.spots.get(p.id);
      const a = at.get(p.id);
      if (!spot || !a) {
        hide(el);
        hide(line);
        hide(dot);
        continue;
      }
      show(el);
      show(line);
      show(dot);
      el.style.transform = `translate(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px) translate(${spot.side < 0 ? "-100%" : "0"}, -50%)`;
      line.setAttribute("x1", a.x.toFixed(1));
      line.setAttribute("y1", a.y.toFixed(1));
      line.setAttribute("x2", (spot.x - spot.side * 4).toFixed(1));
      line.setAttribute("y2", spot.y.toFixed(1));
      dot.setAttribute("cx", a.x.toFixed(1));
      dot.setAttribute("cy", a.y.toFixed(1));
    }
    if (out.moving) invalidate();
  });
  return null;
}

/** The tags themselves, over the canvas: each starts unseen until PartTags has placed it. */
export function TagLayer({ parts, host, on, tone = "dark" }: { parts: TagPart[]; host: RefObject<HTMLDivElement | null>; on: boolean; tone?: "dark" | "light" }) {
  const box = tone === "dark" ? "border-white/15 bg-[#131519]/92 text-[#e8eaed]" : "border-black/10 bg-white/92 text-[#1c1b19]";
  const ref = tone === "dark" ? "text-dutchOrange-300" : "text-dutchOrange-700";
  return (
    <div ref={host} className={`pointer-events-none absolute inset-0 overflow-hidden ${on ? "" : "hidden"}`} aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full">
        {parts.map((p) => (
          <g key={p.id}>
            <line data-leader={p.id} stroke={tone === "dark" ? "#8b919b" : "#77716a"} strokeWidth="1" style={{ opacity: 0 }} />
            <circle data-anchor={p.id} r="2.25" fill="#E05A10" style={{ opacity: 0 }} />
          </g>
        ))}
      </svg>
      {parts.map((p) => (
        <span key={p.id} data-tag={p.id} style={{ opacity: 0 }} className={`absolute left-0 top-0 whitespace-nowrap rounded-[5px] border px-1.5 py-0.5 font-mono text-[11px] leading-4 shadow-sm backdrop-blur-[2px] will-change-transform ${box}`}>
          <span className={ref}>{p.ref}</span>
          <span className="hidden sm:inline"> {p.title}</span>
        </span>
      ))}
    </div>
  );
}
