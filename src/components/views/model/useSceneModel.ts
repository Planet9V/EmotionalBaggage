"use client";

// What the 3D model view works out from the parts and wires: what is drawn, what is faded while a part is in
// focus, how wires are planned and which routes are current. Pure derivations; nothing here saves or sets state.
import { useMemo } from "react";
import { NET_COLOR, toWire, type NetClass, type Part, type Wire } from "@/lib/domain";
import type { Item } from "@/lib/types";
import type { CanvasPart, CanvasWire, RoutedDraw } from "@/components/three/ModelCanvas";
import type { PartGeometry } from "@/components/three/layout";
import type { ConnectionRow } from "@/components/three/PartPanel";
import { bundleRadius, buildRouteRequest, routeState } from "@/lib/geometry/routing";
import { routePartsOf } from "@/lib/geometry/pins3d";
import type { PinRow } from "@/lib/parts/pins";

const CLASS_ORDER: NetClass[] = ["power", "ground", "signal", "audio"];
const FADED = 0.12;
const NEIGHBOUR = 0.6;

const pin = (ref: string, p: string) => (p ? `${ref}.${p}` : ref);

export function useSceneModel({
  parts,
  hidden,
  shapes,
  wireItems,
  focusId,
  sub,
  explodeBy,
  routeCell,
  explodePct,
  classOff,
  pinRows,
}: {
  parts: Part[];
  hidden: ReadonlySet<number>;
  shapes: ReadonlyMap<number, Float32Array | null>;
  wireItems: Item[];
  focusId: number | null;
  sub: boolean;
  explodeBy: string;
  routeCell: number;
  explodePct: number;
  classOff: ReadonlySet<NetClass>;
  /** the concept's saved pin rows; the route request reads pin positions from them, else from the library entry */
  pinRows: PinRow[];
}) {
  const canvasParts = useMemo<CanvasPart[]>(
    () =>
      parts
        .filter((p) => p.geometry && !hidden.has(p.item.id))
        .map((p) => ({ id: p.item.id, ref: p.ref, title: p.item.title, geometry: p.geometry as PartGeometry, shape: shapes.get(p.item.id) ?? null })),
    [parts, hidden, shapes]
  );

  const wires = useMemo(
    () =>
      [...wireItems]
        .sort((a, b) => a.sort - b.sort || a.id - b.id)
        .map(toWire)
        .filter((w): w is Wire => w !== null),
    [wireItems]
  );
  const partByRef = useMemo(() => {
    const m = new Map<string, Part>();
    for (const p of parts) if (p.ref && !m.has(p.ref)) m.set(p.ref, p);
    return m;
  }, [parts]);
  const classesPresent = useMemo(() => CLASS_ORDER.filter((c) => wires.some((w) => w.netClass === c)), [wires]);
  const netsPresent = useMemo(() => [...new Set(wires.map((w) => w.net).filter(Boolean))].sort(), [wires]);

  const focus = focusId === null ? null : (parts.find((p) => p.item.id === focusId && p.geometry) ?? null);
  // A focused part that was deleted or lost its geometry simply stops being focused (focus is null).
  const focused = focus !== null;

  /** Wires that touch the focused part. A part in series is its own part with a wire to each pin. */
  const touching = useMemo(() => (focus && focus.ref ? wires.filter((w) => w.from === focus.ref || w.to === focus.ref) : []), [focus, wires]);
  const neighbourIds = useMemo(() => {
    const ids = new Set<number>();
    if (!focus) return ids;
    for (const w of touching) {
      for (const r of [w.from, w.to]) {
        const p = r ? partByRef.get(r) : undefined;
        if (p && p.item.id !== focus.item.id && p.geometry) ids.add(p.item.id);
      }
    }
    return ids;
  }, [focus, touching, partByRef]);

  const fade = useMemo<ReadonlyMap<number, number> | null>(() => {
    if (!focus) return null;
    const m = new Map<number, number>();
    for (const p of parts) {
      const id = p.item.id;
      m.set(id, id === focus.item.id ? 1 : neighbourIds.has(id) ? (sub ? 1 : NEIGHBOUR) : FADED);
    }
    return m;
  }, [focus, parts, neighbourIds, sub]);
  const focusIds = useMemo(() => (focus ? [focus.item.id, ...(sub ? [...neighbourIds] : [])] : null), [focus, sub, neighbourIds]);

  // Explode by net: only parts on the chosen class or net move with the slider.
  const explodeByValid = explodeBy.startsWith("class:") ? classesPresent.includes(explodeBy.slice(6) as NetClass) : explodeBy.startsWith("net:") ? netsPresent.includes(explodeBy.slice(4)) : false;
  const weights = useMemo<ReadonlyMap<number, number> | null>(() => {
    if (!explodeByValid) return null;
    const match = (w: Wire) => (explodeBy.startsWith("class:") ? w.netClass === explodeBy.slice(6) : w.net === explodeBy.slice(4));
    const refs = new Set<string>();
    for (const w of wires) if (match(w)) for (const r of [w.from, w.to]) if (r) refs.add(r);
    return new Map(parts.map((p) => [p.item.id, p.ref && refs.has(p.ref) ? 1 : 0]));
  }, [explodeByValid, explodeBy, wires, parts]);

  // Which wires have a current route, and which are out of date.
  const routeBuilt = useMemo(
    () =>
      buildRouteRequest(
        // the same pin positions the route request uses (pin rows, else the library entry), so a fresh route reads as current
        routePartsOf(parts, pinRows),
        wires.map((w) => ({ id: w.item.id, name: w.name, from: w.from, fromPin: w.fromPin, to: w.to, toPin: w.toPin })),
        { cell: routeCell, bomRefs: new Set(parts.map((p) => p.ref).filter(Boolean)) }
      ),
    [parts, wires, routeCell, pinRows]
  );
  const fingerprints = routeBuilt.fingerprints;
  /** wire ends placed at the middle of a part face because the part has no position for that pin */
  const approximateEnds = useMemo(() => [...routeBuilt.pinSources.values()].reduce((n, [a, b]) => n + (a === "face" ? 1 : 0) + (b === "face" ? 1 : 0), 0), [routeBuilt]);
  const routeCounts = useMemo(() => {
    let routed = 0;
    let stale = 0;
    for (const w of wires) {
      if (!w.routed) continue;
      const st = routeState({ routedLengthMm: w.routed.lengthMm, routedFingerprint: w.routed.fingerprint }, fingerprints.get(w.item.id) ?? "");
      if (st === "current") routed++;
      else stale++;
    }
    return { routed, stale, total: wires.length };
  }, [wires, fingerprints]);

  // Wires that can be drawn, and why the rest cannot. Routed wires with a current path are tubes
  // while assembled; the rest (and every wire while exploded) are straight curves between centres.
  const wirePlan = useMemo(() => {
    const draw: CanvasWire[] = [];
    const routed: RoutedDraw[] = [];
    let noGeometry = 0;
    let unknown = 0;
    let hiddenEnd = 0;
    const assembled = explodePct === 0;
    for (const w of wires) {
      const a = partByRef.get(w.from);
      const b = partByRef.get(w.to);
      if (!a || !b) unknown++;
      else if (!a.geometry || !b.geometry) noGeometry++;
      else if (hidden.has(a.item.id) || hidden.has(b.item.id)) hiddenEnd++;
      else if (!classOff.has(w.netClass)) {
        const ends = `${pin(w.from, w.fromPin)} \u2192 ${pin(w.to, w.toPin)}`;
        const current = w.routed && w.routed.path.length >= 2 && routeState({ routedLengthMm: w.routed.lengthMm, routedFingerprint: w.routed.fingerprint }, fingerprints.get(w.item.id) ?? "") === "current";
        if (assembled && current && w.routed) {
          routed.push({ id: w.item.id, name: w.name || w.net || "Wire", ends, length: w.routed.lengthMm, color: NET_COLOR[w.netClass], path: w.routed.path, radius: 0.6 });
        } else {
          draw.push({ id: w.item.id, name: w.name || w.net || "Wire", ends, color: NET_COLOR[w.netClass], a: a.item.id, b: b.item.id });
        }
      }
    }
    const radii = bundleRadius(new Map(routed.map((r) => [r.id, r.path])));
    for (const r of routed) r.radius = radii.get(r.id) ?? 0.6;
    const reasons: [number, string][] = [
      [noGeometry, "a part has no geometry"],
      [unknown, "a part is not in the bill of materials"],
      [hiddenEnd, "a part is hidden"],
    ];
    const active = reasons.filter(([n]) => n > 0);
    const total = noGeometry + unknown + hiddenEnd;
    const note =
      total === 0
        ? ""
        : active.length === 1
          ? `${total} wire${total === 1 ? "" : "s"} not drawn: ${active[0][1]}.`
          : `${total} wires not drawn: ${active.map(([n, r]) => `${n} where ${r}`).join(", ")}.`;
    return { draw, routed, note };
  }, [wires, partByRef, hidden, classOff, fingerprints, explodePct]);

  const connections = useMemo<ConnectionRow[]>(() => {
    if (!focus) return [];
    return touching.map((w) => {
      const fromSide = w.from === focus.ref;
      const otherRef = fromSide ? w.to : w.from;
      const other = otherRef ? partByRef.get(otherRef) : undefined;
      return {
        key: w.item.id,
        pin: fromSide ? w.fromPin : w.toPin,
        otherRef,
        otherPin: fromSide ? w.toPin : w.fromPin,
        otherTitle: other ? other.item.title : otherRef ? "Not in the bill of materials" : "",
        otherId: other && other.geometry ? other.item.id : null,
        net: w.net,
        color: NET_COLOR[w.netClass],
        status: w.status,
      };
    });
  }, [focus, touching, partByRef]);

  return { canvasParts, wires, partByRef, classesPresent, netsPresent, focus, focused, touching, neighbourIds, fade, focusIds, explodeByValid, weights, fingerprints, approximateEnds, routeCounts, wirePlan, connections };
}
