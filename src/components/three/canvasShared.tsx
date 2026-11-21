"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import { type ThreeEvent } from "@react-three/fiber";

/** What the parts need to know about the tool in use, without re-rendering the canvas for it. */
export const ToolContext = React.createContext<{ measuring: boolean; cutting: boolean }>({ measuring: false, cutting: false });

/**
 * Explosion progress plus per-part fade and explode weight, all stepped inside the render loop
 * so changes never cause React re-renders.
 */
export class Progress {
  private v: number;
  private t: number;
  private fadeV = new Map<number, number>();
  private fadeT = new Map<number, number>();
  private weightV = new Map<number, number>();
  private weightT = new Map<number, number>();
  constructor(start: number) {
    this.v = start;
    this.t = start;
  }
  get value() {
    return this.v;
  }
  get target() {
    return this.t;
  }
  setTarget(t: number) {
    this.t = t;
  }
  /** Sets fade and weight targets for the parts in the scene. */
  setTargets(ids: number[], fade: ReadonlyMap<number, number> | null, weights: ReadonlyMap<number, number> | null) {
    const keep = new Set(ids);
    for (const m of [this.fadeV, this.fadeT, this.weightV, this.weightT]) for (const k of [...m.keys()]) if (!keep.has(k)) m.delete(k);
    for (const id of ids) {
      this.fadeT.set(id, fade?.get(id) ?? 1);
      this.weightT.set(id, weights?.get(id) ?? 1);
      if (!this.fadeV.has(id)) this.fadeV.set(id, this.fadeT.get(id) ?? 1);
      if (!this.weightV.has(id)) this.weightV.set(id, this.weightT.get(id) ?? 1);
    }
  }
  fade(id: number) {
    return this.fadeV.get(id) ?? 1;
  }
  fadeTarget(id: number) {
    return this.fadeT.get(id) ?? 1;
  }
  /** Explosion factor for one part right now. */
  f(id: number) {
    return this.v * (this.weightV.get(id) ?? 1);
  }
  /** Explosion factor for one part once everything has settled. */
  settled(id: number) {
    return this.t * (this.weightT.get(id) ?? 1);
  }
  private static move(cur: Map<number, number>, tgt: Map<number, number>, dt: number, instant: boolean) {
    let moving = false;
    for (const [k, t] of tgt) {
      const c = cur.get(k) ?? t;
      const diff = t - c;
      if (diff === 0) continue;
      moving = true;
      cur.set(k, instant || Math.abs(diff) < 0.003 ? t : c + diff * Math.min(1, dt * 8));
    }
    return moving;
  }
  /** Moves toward the targets; returns true while still moving. */
  step(dt: number, instant: boolean) {
    let moving = false;
    const diff = this.t - this.v;
    if (diff !== 0) {
      moving = true;
      if (instant || Math.abs(diff) < 0.0015) this.v = this.t;
      else this.v += diff * Math.min(1, dt * 7);
    }
    if (Progress.move(this.fadeV, this.fadeT, dt, instant)) moving = true;
    if (Progress.move(this.weightV, this.weightT, dt, instant)) moving = true;
    return moving;
  }
}

/** Fades a material without a React render. Faded parts stop writing depth so they never hide what is behind. */
export function applyFade(m: THREE.Material, base: number, f: number, glass: boolean) {
  const o = base * f;
  if (m.opacity !== o) m.opacity = o;
  const tr = glass || f < 0.999;
  if (m.transparent !== tr) {
    m.transparent = tr;
    m.depthWrite = !tr;
    m.needsUpdate = true;
  }
}

export const ORANGE = "#E05A10";

export function palette(dark: boolean) {
  return dark
    ? { body: ["#7c838e", "#646b75"], shell: "#a8b0bb", edge: "#c7ccd3", leader: "#6b717b", cell: "#22252c", section: "#3a3f48", uploaded: "#8e98a6" }
    : { body: ["#b9b3a8", "#9f998e"], shell: "#8d877c", edge: "#6f6a61", leader: "#a9a39a", cell: "#e8e3da", section: "#cfc8bb", uploaded: "#a7aeb8" };
}

/** Disposes a three.js resource when it is replaced or the component unmounts. */
export function useDispose(value: { dispose: () => void }) {
  useEffect(() => () => value.dispose(), [value]);
}

/** Moves a two-point line. */
export function setSegment(line: THREE.Line, x0: number, x1: number, y: number, z: number) {
  const a = line.geometry.attributes.position as THREE.BufferAttribute;
  a.setXYZ(0, x0, y, z);
  a.setXYZ(1, x1, y, z);
  a.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

export function setOpacity(m: THREE.Material, o: number) {
  m.opacity = o;
}

export function touch(a: THREE.BufferAttribute) {
  a.needsUpdate = true;
}

/** Sets the line picking reach on a raycaster and returns the previous value. */
export function setLineReach(rc: THREE.Raycaster, v: number) {
  const was = rc.params.Line?.threshold ?? 1;
  if (rc.params.Line) rc.params.Line.threshold = v;
  return was;
}

export function setCursor(v: string) {
  if (typeof document !== "undefined") document.body.style.cursor = v;
}

export function clickSelect(id: number, onSelect: (id: number) => void, shell = false, measuring = false) {
  return (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return;
    // While measuring a click picks a point: let it reach the scene's handler instead of selecting.
    if (measuring) return;
    if (shell) {
      // A see-through shell lets clicks reach the part behind it.
      const behind = e.intersections.some((h) => typeof h.object.userData.partId === "number" && h.object.userData.partId !== id);
      if (behind) return;
    }
    e.stopPropagation();
    onSelect(id);
  };
}
