"use client";

/**
 * The three.js scene for the 3D model view. Loaded with next/dynamic (ssr: false) from ModelView.
 * Units are mm, Y up. Renders on demand: frames are drawn only while something moves.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { lidLift, sceneBounds, totalExtent } from "./layout";
import { BodyPart, Handles, LabelInfo, Leader, ShellPart, Uploaded } from "./canvasParts";
import { ORANGE, Progress, ToolContext, palette, setCursor } from "./canvasShared";
import type { ModelCanvasProps } from "./canvasTypes";

// The types this view and its tool panels import from here.
export type { CanvasPart, CanvasWire, CutPlane, Measurement, RoutedDraw, ShellView, TransformMode, ModelCanvasProps } from "./canvasTypes";
import { Animator, CameraRig } from "./canvasRig";
import { RoutedLayer, WiresLayer } from "./canvasWires";
import { MeasureLayer, SectionClip } from "./canvasTools";
import { Showcase } from "./canvasShowcase";

function Scene(props: ModelCanvasProps & { progress: Progress }) {
  const { parts, selectedId, onSelect, explode, labels, shellView, shellParams, resetToken, dark, uploaded, progress, wires, wiresOn, fade, weights, focusIds, onFocusPart, transform, onTransform, section, measure, onMeasure, routed } = props;
  const colors = palette(dark);
  const invalidate = useThree((s) => s.invalidate);
  const [labelsOn, setLabelsOn] = useState(false);

  // Handles: the selected part's group, and which part is being dragged.
  const drag = useRef<number | null>(null);
  const [groups, setGroups] = useState<ReadonlyMap<number, THREE.Group>>(() => new Map());
  const onGroup = React.useCallback((id: number, g: THREE.Group | null) => {
    setGroups((cur) => {
      if ((cur.get(id) ?? null) === g) return cur;
      const next = new Map(cur);
      if (g) next.set(id, g);
      else next.delete(id);
      return next;
    });
  }, []);
  const handleObj = selectedId === null ? null : (groups.get(selectedId) ?? null);
  const selectedPart = parts.find((p) => p.id === selectedId) ?? null;
  const showHandles = transform !== "off" && explode === 0 && !!handleObj && !!selectedPart && selectedPart.geometry.shape !== "shell";

  // Measure: two clicked points, in scene millimetres.
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const [wasMeasuring, setWasMeasuring] = useState(measure);
  if (wasMeasuring !== measure) {
    // Turning the tool off or on starts with no points.
    setWasMeasuring(measure);
    setPoints([]);
  }
  useEffect(() => {
    if (points.length === 2) onMeasure({ a: points[0].toArray(), b: points[1].toArray(), distance: points[0].distanceTo(points[1]) });
    else onMeasure(null);
    // onMeasure is a stable setter from the view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);
  const onMeasureClick = (e: ThreeEvent<MouseEvent>) => {
    if (!measure || e.delta > 4) return;
    // Measure to parts, not to a see-through shell or a wire in front of them.
    const hit = e.intersections.find((h) => !h.object.userData.isShell && !h.object.userData.isWire && (h.object as THREE.Mesh).isMesh) ?? e.intersections.find((h) => (h.object as THREE.Mesh).isMesh);
    if (!hit) return;
    e.stopPropagation();
    setPoints((cur) => (cur.length >= 2 ? [hit.point.clone()] : [...cur, hit.point.clone()]));
  };
  const tool = useMemo(() => ({ measuring: measure, cutting: section.some((c) => c.on) }), [measure, section]);

  const geoms = useMemo(() => parts.map((p) => p.geometry), [parts]);
  // Fade and explode-weight targets are handed to the render loop, not rendered by React.
  useEffect(() => {
    progress.setTargets(parts.map((p) => p.id), fade, weights);
    invalidate();
  }, [parts, fade, weights, progress, invalidate]);
  const shellLift = useMemo(() => {
    const out = new Map<number, number>();
    for (const p of parts) if (p.geometry.shape === "shell") out.set(p.id, lidLift(p.geometry, geoms.filter((g) => g !== p.geometry)));
    return out;
  }, [parts, geoms]);

  const labelInfo = useMemo(() => {
    let maxX = 0;
    for (const g of geoms) {
      const e = totalExtent(g);
      maxX = Math.max(maxX, Math.abs(g.pos[0]) + e[0] / 2, Math.abs(g.pos[0] + g.explode[0]) + e[0] / 2);
    }
    const out = new Map<number, LabelInfo>();
    for (const p of parts) {
      const g = p.geometry;
      const side: 1 | -1 = g.pos[0] + g.explode[0] < 0 ? -1 : 1;
      out.set(p.id, { side, column: side * (maxX + 22) });
    }
    return out;
  }, [parts, geoms]);

  const uploadedBounds = useMemo(() => {
    if (!uploaded) return null;
    const b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    const m = uploaded.mesh;
    for (let i = 0; i < m.length; i += 3) {
      // Z-up file coordinates: x, z (up), y (depth)
      const v = [m[i], m[i + 2], m[i + 1]];
      for (let k = 0; k < 3; k++) {
        b.min[k] = Math.min(b.min[k], v[k]);
        b.max[k] = Math.max(b.max[k], v[k]);
      }
    }
    const w = b.max[0] - b.min[0];
    const h = b.max[1] - b.min[1];
    const d = b.max[2] - b.min[2];
    return { min: [-w / 2, 0, -d / 2], max: [w / 2, h, d / 2] };
  }, [uploaded]);

  const floor = useMemo(() => {
    let lo = 0;
    for (const g of geoms) lo = Math.min(lo, g.pos[1] - totalExtent(g)[1] / 2);
    return lo - 0.05;
  }, [geoms]);

  const boundsOf = useMemo(
    () => () => {
      const exploded = progress.target > 0.5;
      const b = sceneBounds(geoms, exploded);
      if (exploded) {
        for (const p of parts) {
          const lift = shellLift.get(p.id);
          if (lift) b.max[1] = Math.max(b.max[1], p.geometry.pos[1] + p.geometry.size[1] / 2 + p.geometry.explode[1] + lift);
        }
      }
      if (uploadedBounds) {
        if (!geoms.length) return uploadedBounds;
        for (let k = 0; k < 3; k++) {
          b.min[k] = Math.min(b.min[k], uploadedBounds.min[k]);
          b.max[k] = Math.max(b.max[k], uploadedBounds.max[k]);
        }
      }
      return b;
    },
    [geoms, parts, shellLift, uploadedBounds, progress]
  );

  const focusKey = focusIds && focusIds.length ? focusIds.join(",") : "";
  const focusBoundsOf = useMemo(
    () => () => {
      if (!focusIds || !focusIds.length) return null;
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (const p of parts) {
        if (!focusIds.includes(p.id)) continue;
        const g = p.geometry;
        const e = totalExtent(g);
        const f = progress.settled(p.id);
        for (let k = 0; k < 3; k++) {
          const c = g.pos[k] + g.explode[k] * f;
          min[k] = Math.min(min[k], c - e[k] / 2);
          max[k] = Math.max(max[k], c + e[k] / 2);
        }
        const lift = shellLift.get(p.id);
        if (lift) max[1] += lift * f;
      }
      return min[0] === Infinity ? null : { min, max };
    },
    [focusIds, parts, shellLift, progress]
  );

  const span = useMemo(() => {
    const b = sceneBounds(geoms, true);
    const u = uploadedBounds ? Math.max(uploadedBounds.max[0] - uploadedBounds.min[0], uploadedBounds.max[2] - uploadedBounds.min[2]) : 0;
    return Math.ceil((Math.max(200, u, geoms.length ? Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) : 0) * 4) / 100) * 100;
  }, [geoms, uploadedBounds]);

  return (
    <>
      <Animator progress={progress} explode={explode} onLabels={setLabelsOn} />
      <CameraRig resetToken={resetToken} boundsOf={boundsOf} focusKey={focusKey} focusBoundsOf={focusBoundsOf} />
      <hemisphereLight args={[dark ? "#c9d1dc" : "#ffffff", dark ? "#1a1c20" : "#d9d2c6", dark ? 1.1 : 1.25]} />
      <directionalLight position={[120, 220, 160]} intensity={dark ? 1.4 : 1.6} />
      <directionalLight position={[-160, 90, -120]} intensity={0.45} />
      <Grid
        position={[0, floor, 0]}
        args={[span, span]}
        cellSize={10}
        cellThickness={0.6}
        cellColor={colors.cell}
        sectionSize={50}
        sectionThickness={1}
        sectionColor={colors.section}
        fadeDistance={span / 2}
        fadeStrength={1.5}
      />
      <SectionClip cut={section} />
      <ToolContext.Provider value={tool}>
      <group onClick={onMeasureClick}>
      {parts.map((p, i) =>
        p.geometry.shape === "shell" ? (
          <ShellPart
            key={p.id}
            part={p}
            progress={progress}
            selected={p.id === selectedId}
            onSelect={onSelect}
            onFocusPart={onFocusPart}
            colors={colors}
            view={shellView}
            params={shellParams}
            lift={shellLift.get(p.id) ?? 20}
          />
        ) : (
          <BodyPart key={p.id} part={p} progress={progress} selected={p.id === selectedId} onSelect={onSelect} onFocusPart={onFocusPart} colors={colors} index={i} drag={drag} onGroup={onGroup} />
        )
      )}
      {labels &&
        labelsOn &&
        parts.map((p) => {
          const info = labelInfo.get(p.id);
          if (!info || (fade?.get(p.id) ?? 1) < 0.5) return null;
          const isShell = p.geometry.shape === "shell";
          return (
            <Leader
              key={p.id}
              progress={progress}
              part={p}
              info={info}
              selected={p.id === selectedId}
              color={p.id === selectedId ? ORANGE : colors.leader}
              onSelect={onSelect}
              lift={isShell ? shellLift.get(p.id) ?? 20 : 0}
              yOffset={isShell ? p.geometry.size[1] / 2 : 0}
            />
          );
        })}
      {wiresOn && wires.length > 0 && <WiresLayer wires={wires} parts={parts} progress={progress} />}
      {wiresOn && explode === 0 && routed.length > 0 && <RoutedLayer wires={routed} />}
      {uploaded && <Uploaded mesh={uploaded.mesh} color={colors.uploaded} />}
      </group>
      </ToolContext.Provider>
      <MeasureLayer points={points} dark={dark} />
      {showHandles && selectedPart && handleObj && (
        <Handles key={`${selectedPart.id}:${transform}`} part={selectedPart} object={handleObj} mode={transform === "rotate" ? "rotate" : "translate"} dragRef={drag} onTransform={onTransform} />
      )}
      {/* with `showcase` (the public welcome page) a plain wheel scrolls the page; Showcase zooms on Ctrl or Cmd + wheel */}
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} enableZoom={!props.showcase} />
      {props.showcase && <Showcase {...props.showcase} />}
    </>
  );
}

/** Hands out a synchronous capture: render, then read the canvas in the same task so the buffer is still there. */
function CaptureBridge({ onReady }: { onReady: (capture: (() => string) | null) => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    onReady(() => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    });
    return () => onReady(null);
  }, [gl, scene, camera, onReady]);
  return null;
}

export default function ModelCanvas(props: ModelCanvasProps) {
  const [progress] = useState(() => new Progress(props.explode));
  useEffect(() => () => setCursor("auto"), []);
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 40, near: 1, far: 20000, position: [180, 140, 260] }}
      style={{ touchAction: "none" }}
    >
      <Scene {...props} progress={progress} />
      {props.onCaptureReady && <CaptureBridge onReady={props.onCaptureReady} />}
    </Canvas>
  );
}
