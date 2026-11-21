"use client";

import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, TransformControls } from "@react-three/drei";
import { bodyOffsets, totalExtent } from "./layout";
import { type Mesh, type ShellParams } from "./stl";
import { bodyGeometry, sceneGeometry, shellGeometries, soupToGeometry } from "@/lib/geometry/shapes";
import { degToRad, radToDeg, snap, wrapDegrees } from "@/lib/geometry/rotation";
import { ORANGE, Progress, ToolContext, applyFade, clickSelect, palette, setCursor, setOpacity, setSegment, useDispose } from "./canvasShared";
import { CanvasPart, ModelCanvasProps, ShellView } from "./canvasTypes";

export type LabelInfo = { side: 1 | -1; column: number };

export function Leader({ progress, part, info, selected, color, onSelect, lift = 0, yOffset = 0 }: {
  progress: Progress;
  part: CanvasPart;
  info: LabelInfo;
  selected: boolean;
  color: string;
  onSelect: (id: number) => void;
  lift?: number;
  yOffset?: number;
}) {
  const g = part.geometry;
  const ext = totalExtent(g);
  const labelRef = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  // The scene renders on demand: ask for a frame so a new label is placed right away.
  useEffect(() => invalidate(), [invalidate]);
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  }, [color]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line]
  );
  useFrame(() => {
    const p = progress.f(part.id);
    const x = g.pos[0] + g.explode[0] * p;
    const y = g.pos[1] + yOffset + (g.explode[1] + lift) * p;
    const z = g.pos[2] + g.explode[2] * p;
    setSegment(line, x + (info.side * ext[0]) / 2, info.column, y, z);
    labelRef.current?.position.set(info.column, y, z);
  });
  return (
    <>
      <primitive object={line} />
      <group ref={labelRef}>
        <Html zIndexRange={[20, 0]} style={{ transform: `translate(${info.side > 0 ? "4px" : "calc(-100% - 4px)"}, -50%)` }}>
          <button
            type="button"
            onClick={() => onSelect(part.id)}
            className={`whitespace-nowrap rounded-md border bg-surface px-1.5 py-0.5 text-left text-[11px] text-primary shadow-xs transition-colors duration-150 ${
              selected ? "border-dutchOrange" : "border-hairline hover:border-dutchOrange/40"
            }`}
          >
            {part.ref && <span className="font-mono text-link">{part.ref} </span>}
            {part.title}
          </button>
        </Html>
      </group>
    </>
  );
}

/** Shared between the parts and the handles: which part is being dragged right now, so the frame loop leaves it alone. */
type Drag = { current: number | null };

export function BodyPart({ part, progress, selected, onSelect, onFocusPart, colors, index, drag, onGroup }: {
  part: CanvasPart;
  progress: Progress;
  selected: boolean;
  onSelect: (id: number) => void;
  onFocusPart: (id: number) => void;
  colors: ReturnType<typeof palette>;
  index: number;
  drag: Drag;
  onGroup: (id: number, g: THREE.Group | null) => void;
}) {
  const g = part.geometry;
  const group = useRef<THREE.Group>(null);
  const tool = React.useContext(ToolContext);
  const { shape, size, axis } = g;
  const hasFile = !!part.shape && !!g.file;
  const fileShape = part.shape;
  const geometry = useMemo<THREE.BufferGeometry>(() => {
    if (hasFile && fileShape) return sceneGeometry(fileShape);
    return bodyGeometry({ shape, size, axis });
    // size is read through its numbers so a new array with the same values keeps the geometry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFile, fileShape, shape, size[0], size[1], size[2], axis]);
  useDispose(geometry);
  const offsets = hasFile ? ([[0, 0, 0]] as [number, number, number][]) : bodyOffsets(g);
  const color = selected ? ORANGE : colors.body[index % 2];
  // One material per part, shared by its identical bodies; the meshes opt out of R3F disposal (dispose={null})
  // because they share this material and geometry, so both are disposed here.
  const material = useMemo(() => {
    const f = progress.fade(part.id);
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.62,
      metalness: 0.05,
      emissive: selected ? ORANGE : "#000000",
      emissiveIntensity: selected ? 0.18 : 0,
      transparent: f < 0.999,
      opacity: f,
      depthWrite: f >= 0.999,
      // A cut shows the inside of a solid: draw both faces while a section is on.
      side: tool.cutting ? THREE.DoubleSide : THREE.FrontSide,
    });
  }, [color, selected, progress, part.id, tool.cutting]);
  useDispose(material);
  const rot = g.rotation ?? [0, 0, 0];
  useEffect(() => {
    onGroup(part.id, group.current);
    return () => onGroup(part.id, null);
  }, [part.id, onGroup]);
  useFrame(() => {
    if (drag.current === part.id) return;
    const p = progress.f(part.id);
    group.current?.position.set(g.pos[0] + g.explode[0] * p, g.pos[1] + g.explode[1] * p, g.pos[2] + g.explode[2] * p);
    group.current?.rotation.set(degToRad(rot[0]), degToRad(rot[1]), degToRad(rot[2]), "XYZ");
    applyFade(material, 1, progress.fade(part.id), false);
  });
  return (
    <group ref={group} position={g.pos as [number, number, number]} rotation={[degToRad(rot[0]), degToRad(rot[1]), degToRad(rot[2]), "XYZ"]}>
      {offsets.map((o, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={material}
          position={o}
          dispose={null}
          userData={{ partId: part.id }}
          onClick={clickSelect(part.id, onSelect, false, tool.measuring)}
          onDoubleClick={clickSelect(part.id, onFocusPart, false, tool.measuring)}
          onPointerOver={(e) => {
            e.stopPropagation();
            setCursor(tool.measuring ? "crosshair" : "pointer");
          }}
          onPointerOut={() => setCursor("auto")}
        />
      ))}
    </group>
  );
}

export function ShellPart({ part, progress, selected, onSelect, onFocusPart, colors, view, params, lift }: {
  part: CanvasPart;
  progress: Progress;
  selected: boolean;
  onSelect: (id: number) => void;
  onFocusPart: (id: number) => void;
  colors: ReturnType<typeof palette>;
  view: ShellView;
  params: ShellParams;
  lift: number;
}) {
  const g = part.geometry;
  const [sx, sy, sz] = g.size;
  const { wallMm, clearanceMm, lipMm } = params;
  const cuttingNow = React.useContext(ToolContext).cutting;
  // A shell too small for the wall settings still shows as its envelope, so it never disappears.
  const { tray, lid } = useMemo(() => shellGeometries([sx, sy, sz], { wallMm, clearanceMm, lipMm }), [sx, sy, sz, wallMm, clearanceMm, lipMm]);
  useDispose(tray);
  useDispose(lid);
  const edgesOf = (geo: THREE.BufferGeometry) => (geo.getAttribute("position") ? new THREE.EdgesGeometry(geo, 20) : new THREE.BufferGeometry());
  const trayEdges = useMemo(() => edgesOf(tray), [tray]);
  const lidEdges = useMemo(() => edgesOf(lid), [lid]);
  useDispose(trayEdges);
  useDispose(lidEdges);
  const trayRef = useRef<THREE.Group>(null);
  const lidRef = useRef<THREE.Group>(null);
  const H = g.size[1];
  const clear = view === "clear";
  const color = selected ? ORANGE : colors.shell;
  const edge = selected ? ORANGE : colors.edge;
  const material = useMemo(() => {
    const f = progress.fade(part.id);
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0,
      transparent: clear || f < 0.999,
      opacity: (clear ? 0.16 : 1) * f,
      depthWrite: !(clear || f < 0.999),
      side: clear || cuttingNow ? THREE.DoubleSide : THREE.FrontSide,
    });
  }, [color, clear, progress, part.id, cuttingNow]);
  useDispose(material);
  const edgeMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: edge, transparent: true, opacity: progress.fade(part.id) }), [edge, progress, part.id]);
  useDispose(edgeMaterial);
  useFrame(() => {
    const p = progress.f(part.id);
    const x = g.pos[0] + g.explode[0] * p;
    const z = g.pos[2] + g.explode[2] * p;
    trayRef.current?.position.set(x, g.pos[1] - H / 2 + g.explode[1] * p, z);
    lidRef.current?.position.set(x, g.pos[1] + H / 2 + (g.explode[1] + lift) * p, z);
    const f = progress.fade(part.id);
    applyFade(material, clear ? 0.16 : 1, f, clear);
    setOpacity(edgeMaterial, f);
  });
  const tool = React.useContext(ToolContext);
  const handlers = {
    onClick: clickSelect(part.id, onSelect, clear, tool.measuring),
    onDoubleClick: clickSelect(part.id, onFocusPart, clear, tool.measuring),
    onPointerOver: () => setCursor("pointer"),
    onPointerOut: () => setCursor("auto"),
  };
  return (
    <>
      <group ref={trayRef} position={[g.pos[0], g.pos[1] - H / 2, g.pos[2]]}>
        <mesh geometry={tray} material={material} dispose={null} userData={{ partId: part.id, isShell: true }} renderOrder={clear ? 2 : 0} {...handlers} />
        <lineSegments geometry={trayEdges} material={edgeMaterial} dispose={null} renderOrder={clear ? 2 : 0} />
      </group>
      <group ref={lidRef} position={[g.pos[0], g.pos[1] + H / 2, g.pos[2]]}>
        <mesh geometry={lid} material={material} dispose={null} userData={{ partId: part.id, isShell: true }} renderOrder={clear ? 2 : 0} {...handlers} />
        <lineSegments geometry={lidEdges} material={edgeMaterial} dispose={null} renderOrder={clear ? 2 : 0} />
      </group>
    </>
  );
}

export function Uploaded({ mesh, color }: { mesh: Mesh; color: string }) {
  const geometry = useMemo(() => {
    // STL files are Z up by convention: stand it up in this Y-up scene, centre it and rest it on the floor.
    const geo = soupToGeometry(mesh, -Math.PI / 2);
    const b = geo.boundingBox ?? new THREE.Box3();
    geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    geo.computeBoundingBox();
    return geo;
  }, [mesh]);
  useDispose(geometry);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
    </mesh>
  );
}

const MM_SNAP = 1;
const DEG_SNAP = 15;

/**
 * Move or rotate handles on one part, from drei's TransformControls (three's own gizmo).
 * The gizmo snaps to 1 mm and 15 degrees while dragging. When the drag ends the result is snapped
 * again, written back through onTransform, and the part's own frame loop takes over.
 */
export function Handles({ part, object, mode, dragRef, onTransform }: {
  part: CanvasPart;
  object: THREE.Object3D;
  mode: "translate" | "rotate";
  dragRef: Drag;
  onTransform: ModelCanvasProps["onTransform"];
}) {
  const invalidate = useThree((s) => s.invalidate);
  const start = useRef<{ p: THREE.Vector3; r: THREE.Euler } | null>(null);
  return (
    <TransformControls
      object={object}
      mode={mode}
      translationSnap={MM_SNAP}
      rotationSnap={degToRad(DEG_SNAP)}
      size={0.8}
      onMouseDown={() => {
        dragRef.current = part.id;
        start.current = { p: object.position.clone(), r: object.rotation.clone() };
      }}
      onMouseUp={() => {
        const p = object.position;
        const r = object.rotation;
        const s0 = start.current;
        // Only an axis that was dragged is snapped; the others keep their saved value exactly.
        const at = (v: number, v0: number | undefined, step: number) => (v0 !== undefined && Math.abs(v - v0) < 1e-6 ? v0 : snap(v, step));
        const pos: [number, number, number] = [at(p.x, s0?.p.x, MM_SNAP), at(p.y, s0?.p.y, MM_SNAP), at(p.z, s0?.p.z, MM_SNAP)];
        const rotation: [number, number, number] = [
          [r.x, s0?.r.x],
          [r.y, s0?.r.y],
          [r.z, s0?.r.z],
        ].map(([v, v0]) => (v0 !== undefined && Math.abs(v! - v0) < 1e-6 ? snap(wrapDegrees(radToDeg(v0)), 1e-3) : snap(wrapDegrees(radToDeg(v!)), DEG_SNAP))) as [number, number, number];
        // Put the object exactly where the snapped numbers say, so nothing jumps when the saved values arrive.
        object.position.set(...pos);
        object.rotation.set(degToRad(rotation[0]), degToRad(rotation[1]), degToRad(rotation[2]), "XYZ");
        dragRef.current = null;
        onTransform(part.id, { pos, rotation });
        invalidate();
      }}
    />
  );
}
