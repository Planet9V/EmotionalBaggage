"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Progress, setLineReach, setOpacity, touch, useDispose } from "./canvasShared";
import { CanvasPart, CanvasWire, RoutedDraw } from "./canvasTypes";

const WIRE_STEPS = 20;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

type WireEnds = { a: CanvasPart; b: CanvasPart };

function centreOf(part: CanvasPart, f: number, out: THREE.Vector3) {
  const g = part.geometry;
  return out.set(g.pos[0] + g.explode[0] * f, g.pos[1] + g.explode[1] * f, g.pos[2] + g.explode[2] * f);
}

/** One wire: a quadratic curve between two part centres, lifted on y so overlapping wires separate. */
function WireLine({ wire, ends, index, progress, onHover }: {
  wire: CanvasWire;
  ends: WireEnds;
  index: number;
  progress: Progress;
  onHover: (h: { wire: CanvasWire; point: THREE.Vector3 } | null) => void;
}) {
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((WIRE_STEPS + 1) * 3), 3));
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: wire.color, transparent: true, opacity: 0.95 }));
    l.frustumCulled = false;
    return l;
  }, [wire.color]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line]
  );
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [invalidate, wire, ends]);
  useFrame(() => {
    const fa = progress.f(ends.a.id);
    const fb = progress.f(ends.b.id);
    centreOf(ends.a, fa, _a);
    centreOf(ends.b, fb, _b);
    const len = _a.distanceTo(_b);
    const lift = 4 + len * 0.14 + (index % 4) * 3.5;
    const pos = line.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i <= WIRE_STEPS; i++) {
      const t = i / WIRE_STEPS;
      const u = 1 - t;
      // Quadratic bezier whose control point is the midpoint raised by 2 x lift, so the curve peaks at lift.
      pos.setXYZ(
        i,
        u * u * _a.x + 2 * u * t * ((_a.x + _b.x) / 2) + t * t * _b.x,
        u * u * _a.y + 2 * u * t * ((_a.y + _b.y) / 2 + lift * 2) + t * t * _b.y,
        u * u * _a.z + 2 * u * t * ((_a.z + _b.z) / 2) + t * t * _b.z
      );
    }
    touch(pos);
    line.geometry.computeBoundingSphere();
    const o = 0.95 * Math.min(progress.fade(ends.a.id), progress.fade(ends.b.id));
    setOpacity(line.material as THREE.Material, o);
  });
  return (
    <primitive
      object={line}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => onHover({ wire, point: e.point.clone() })}
      onPointerOut={() => onHover(null)}
    />
  );
}

/** The wiring overlay. Hover state lives here, so a hover re-renders only the wires. */
export function WiresLayer({ wires, parts, progress }: { wires: CanvasWire[]; parts: CanvasPart[]; progress: Progress }) {
  const raycaster = useThree((s) => s.raycaster);
  // Thin lines are hard to hit: give the picker some reach, and put it back on the way out.
  useEffect(() => {
    const was = setLineReach(raycaster, 1.6);
    return () => {
      setLineReach(raycaster, was);
    };
  }, [raycaster]);
  const [hover, setHover] = useState<{ wire: CanvasWire; point: THREE.Vector3 } | null>(null);
  const byId = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const rows = useMemo(
    () =>
      wires.flatMap((w, i) => {
        const a = byId.get(w.a);
        const b = byId.get(w.b);
        return a && b ? [{ w, i, ends: { a, b } }] : [];
      }),
    [wires, byId]
  );
  const shownHover = hover && wires.some((w) => w.id === hover.wire.id) ? hover : null;
  return (
    <>
      {rows.map(({ w, i, ends }) => (
        <WireLine
          key={w.id}
          wire={w}
          ends={ends}
          index={i}
          progress={progress}
          onHover={setHover}
        />
      ))}
      {shownHover && (
        <Html position={shownHover.point} zIndexRange={[30, 0]} style={{ pointerEvents: "none", transform: "translate(10px, -110%)" }}>
          <div className="whitespace-nowrap rounded-md border border-hairline bg-surface px-2 py-1 text-[11px] text-primary shadow-xs">
            <span className="block font-medium">{shownHover.wire.name}</span>
            <span className="block font-mono text-[10px] text-secondary">{shownHover.wire.ends}</span>
          </div>
        </Html>
      )}
    </>
  );
}

/** One routed wire as a tube along its path, coloured by net. */
function RoutedTube({ wire, onHover }: { wire: RoutedDraw; onHover: (h: { wire: RoutedDraw; point: THREE.Vector3 } | null) => void }) {
  const geometry = useMemo(() => {
    const pts = wire.path.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    if (pts.length < 2) return null;
    // A polyline with a few corners: a centripetal spline rounds them without cutting far in.
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    return new THREE.TubeGeometry(curve, Math.max(8, pts.length * 8), wire.radius, 8, false);
  }, [wire.path, wire.radius]);
  useDispose(geometry ?? new THREE.BufferGeometry());
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: wire.color, roughness: 0.5, metalness: 0 }), [wire.color]);
  useDispose(material);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [geometry, material, invalidate]);
  if (!geometry) return null;
  return (
    <mesh
      geometry={geometry}
      material={material}
      dispose={null}
      userData={{ isWire: true }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover({ wire, point: e.point.clone() });
      }}
      onPointerOut={() => onHover(null)}
    />
  );
}

export function RoutedLayer({ wires }: { wires: RoutedDraw[] }) {
  const [hover, setHover] = useState<{ wire: RoutedDraw; point: THREE.Vector3 } | null>(null);
  const shown = hover && wires.some((w) => w.id === hover.wire.id) ? hover : null;
  return (
    <>
      {wires.map((w) => (
        <RoutedTube key={w.id} wire={w} onHover={setHover} />
      ))}
      {shown && (
        <Html position={shown.point} zIndexRange={[30, 0]} style={{ pointerEvents: "none", transform: "translate(10px, -110%)" }}>
          <div className="whitespace-nowrap rounded-md border border-hairline bg-surface px-2 py-1 text-[11px] text-primary shadow-xs">
            <span className="block font-medium">{shown.wire.name}</span>
            <span className="block font-mono text-[10px] text-secondary">{shown.wire.ends}</span>
            <span className="block font-mono text-[10px] text-secondary">routed {shown.wire.length} mm</span>
          </div>
        </Html>
      )}
    </>
  );
}
