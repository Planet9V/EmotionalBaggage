/**
 * Everything the app does around the planner's wire router (planner/routing.py, POST /route):
 * work out where each wire's two ends are, which boxes are in the way and how big the free space
 * is, and read the answer back into what is stored on each wire row. Pure functions.
 *
 * The planner works in plain boxes. A part is its bounding box after rotation (the same box the
 * layout editor checks). The enclosure shell is the space, pulled in by its wall.
 */
import { boxOf, type Box } from "@/components/layout/geom";
import { SHELL_DEFAULTS } from "@/components/three/stl";
import type { Geometry } from "@/lib/domain";
import { applyMatrix, rotationMatrix, type V3 } from "./rotation";

export type RoutePart = {
  id: number;
  ref: string;
  geometry: Geometry;
  /** pins with a position in the part's own frame ({ name, pos: [x, y, z] }), from `pinPoints` in ./pins3d.ts */
  pins?: unknown;
};

export type RouteWire = {
  id: number;
  name: string;
  from: string;
  fromPin: string;
  to: string;
  toPin: string;
};

type PinSource = "pin" | "face";
export type PinPoint = { pos: V3; source: PinSource };

type PinObject = { name?: unknown; position?: unknown; pos?: unknown };

const isVec3 = (v: unknown): v is V3 => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));

/** The part's own position for a pin, in mm from the part's centre, when the part library gave one. */
function declaredPin(part: RoutePart, pin: string): V3 | null {
  if (!pin || !Array.isArray(part.pins)) return null;
  for (const p of part.pins as (string | PinObject)[]) {
    if (!p || typeof p !== "object") continue;
    if (String((p as PinObject).name ?? "").trim() !== pin.trim()) continue;
    const at = (p as PinObject).position ?? (p as PinObject).pos;
    if (isVec3(at)) return at;
  }
  return null;
}

/**
 * Where a wire ends on a part: the pin's position (from the part's pin rows or its library entry,
 * worked out by `pinPoints` in ./pins3d.ts), turned with the part's rotation and added to its
 * position. When the pin has no position, the end is the centre of the box face that looks toward
 * the other end of the wire, and the result says so (`source: "face"`).
 */
export function pinPosition(part: RoutePart, pin: string, towards: readonly number[]): PinPoint {
  const g = part.geometry;
  const local = declaredPin(part, pin);
  if (local) {
    const turned = applyMatrix(rotationMatrix(g.rotation), local);
    return { pos: [g.pos[0] + turned[0], g.pos[1] + turned[1], g.pos[2] + turned[2]], source: "pin" };
  }
  const b = boxOf(g);
  const c = g.pos;
  const d = [towards[0] - c[0], towards[1] - c[1], towards[2] - c[2]];
  let k = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(d[i]) > Math.abs(d[k])) k = i;
  const pos: V3 = [c[0], c[1], c[2]];
  pos[k] = d[k] >= 0 ? b.max[k] : b.min[k];
  return { pos, source: "face" };
}

export type Space = { box: Box; source: "shell" | "parts"; shellId: number | null };

/** The free space: the shell's inside, else a box around every part with 10 mm to spare. */
export function routingSpace(parts: RoutePart[], wallMm = SHELL_DEFAULTS.wallMm): Space | null {
  const shell = parts.find((p) => p.geometry.shape === "shell");
  if (shell) {
    const b = boxOf(shell.geometry);
    const w = wallMm;
    const box: Box = {
      min: [b.min[0] + w, b.min[1] + w, b.min[2] + w],
      max: [b.max[0] - w, b.max[1] - w, b.max[2] - w],
    };
    if (box.min.some((v, i) => v >= box.max[i])) return null;
    return { box, source: "shell", shellId: shell.id };
  }
  const bodies = parts.filter((p) => p.geometry.shape !== "shell");
  if (!bodies.length) return null;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of bodies) {
    const b = boxOf(p.geometry);
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], b.min[k]);
      hi[k] = Math.max(hi[k], b.max[k]);
    }
  }
  const pad = 10;
  return { box: { min: lo.map((v) => v - pad) as V3, max: hi.map((v) => v + pad) as V3 }, source: "parts", shellId: null };
}

type Skipped = { wireId: number; name: string; reason: string };

type PlannerRequest = {
  space: { min: V3; max: V3 };
  obstacles: { id: string; min: V3; max: V3 }[];
  nets: { id: string; terminals: { id: string; pos: V3 }[] }[];
  cell: number;
  clearance: number;
  allowance: number;
  round_to: number;
};

export type RouteOptions = { cell?: number; wallMm?: number; clearance?: number };
export type Built = { request: PlannerRequest | null; skipped: Skipped[]; space: Space | null; fingerprints: Map<number, string>; pinSources: Map<number, [PinSource, PinSource]> };

/** A short stable hash of the inputs, to tell when a stored route no longer matches the model. */
export function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The planner request for the wires that can be routed, and the reasons the others cannot.
 * Wires are routed one by one (a net of two ends each); the planner makes later wires prefer the
 * cells earlier ones used, so they bundle.
 *
 * Each wire's fingerprint covers the space, every part's box and that wire's two ends (not the grid
 * cell: the cell is stored beside the length).
 */
export function buildRouteRequest(parts: RoutePart[], wires: RouteWire[], opts: RouteOptions = {}): Built {
  const byRef = new Map<string, RoutePart>();
  for (const p of parts) if (p.ref && !byRef.has(p.ref)) byRef.set(p.ref, p);
  const space = routingSpace(parts, opts.wallMm);
  const skipped: Skipped[] = [];
  const nets: PlannerRequest["nets"] = [];
  const sources = new Map<number, [PinSource, PinSource]>();
  const ends = new Map<number, string>();
  for (const w of wires) {
    const a = byRef.get(w.from);
    const b = byRef.get(w.to);
    if (!a || !b) skipped.push({ wireId: w.id, name: w.name, reason: `${!a ? w.from : w.to} is not in the bill of materials` });
    else if (a.id === b.id) skipped.push({ wireId: w.id, name: w.name, reason: "both ends are on the same part" });
    else if (a.geometry.shape === "shell" || b.geometry.shape === "shell") skipped.push({ wireId: w.id, name: w.name, reason: "an end is on the enclosure shell, which is the space, not a part in it" });
    else {
      const pa = pinPosition(a, w.fromPin, b.geometry.pos);
      const pb = pinPosition(b, w.toPin, a.geometry.pos);
      sources.set(w.id, [pa.source, pb.source]);
      nets.push({ id: `w${w.id}`, terminals: [{ id: `${w.from}.${w.fromPin || "?"}`, pos: pa.pos.map(r3) as V3 }, { id: `${w.to}.${w.toPin || "?"}`, pos: pb.pos.map(r3) as V3 }] });
      ends.set(w.id, `${pa.pos.map(r3).join(",")}>${pb.pos.map(r3).join(",")}`);
    }
  }
  const bodies = parts.filter((p) => p.geometry.shape !== "shell");
  const obstacles = bodies.map((p) => {
    const b = boxOf(p.geometry);
    return { id: p.ref || String(p.id), min: b.min.map(r3) as V3, max: b.max.map(r3) as V3 };
  });
  const cell = opts.cell ?? 2;
  const common = JSON.stringify([space ? [space.box.min.map(r3), space.box.max.map(r3)] : null, obstacles.map((o) => [o.min, o.max])]);
  const fingerprints = new Map<number, string>([...ends].map(([id, e]) => [id, hash(common + e)]));
  if (!space) return { request: null, skipped, space, fingerprints, pinSources: sources };
  if (!nets.length) return { request: null, skipped, space, fingerprints, pinSources: sources };
  return {
    request: {
      space: { min: space.box.min.map(r3) as V3, max: space.box.max.map(r3) as V3 },
      obstacles,
      nets,
      cell,
      clearance: opts.clearance ?? 1,
      // The build sheet adds its own strip and slack allowance, so the planner returns the run itself.
      allowance: 0,
      round_to: 1,
    },
    skipped,
    space,
    fingerprints,
    pinSources: sources,
  };
}

/** The planner's answer for one net. */
export type PlannerNet =
  | { id: string; ok: true; branches: { points: V3[]; length: number }[]; length: number }
  | { id: string; ok: false; problems: { terminal: string; reason: string }[] };

export type PlannerResult = {
  cell: number;
  requested_cell: number;
  grid: { dims: number[]; cells: number; free: number };
  nets: PlannerNet[];
  routed: number;
  failed: number;
};

/** What is written onto a wire row when it routed. */
export type RoutedFields = {
  routedLengthMm: number;
  routedCellMm: number;
  routedAt: string;
  routedFingerprint: string;
  routedPath: V3[];
};

/** Thins a long path to at most `max` points, keeping the ends and every turn. */
export function thinPath(points: V3[], max = 400): V3[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

export function toRoutedFields(net: Extract<PlannerNet, { ok: true }>, cell: number, at: string, fingerprint: string): RoutedFields {
  const path = net.branches[0]?.points ?? [];
  return {
    routedLengthMm: Math.round(net.length * 10) / 10,
    routedCellMm: Math.round(cell * 1000) / 1000,
    routedAt: at,
    routedFingerprint: fingerprint,
    routedPath: thinPath(path).map((p) => p.map((v) => Math.round(v * 10) / 10) as V3),
  };
}

export const ROUTED_KEYS = ["routedLengthMm", "routedCellMm", "routedAt", "routedFingerprint", "routedPath"] as const;

/** A route is current when the fingerprint it was made from is the one the model gives now. */
export function routeState(w: { routedLengthMm?: number | null; routedFingerprint?: string | null }, current: string): "none" | "current" | "stale" {
  if (w.routedLengthMm == null) return "none";
  return w.routedFingerprint === current ? "current" : "stale";
}

/**
 * Tube radius per wire, in mm: a wire running alone is 0.6 mm; where wires share a run the tube
 * grows with how many share it, up to 1.6 mm, so a bundle looks like a bundle. Two wires share a
 * place when their paths pass within the same 2 mm cube.
 */
export function bundleRadius(paths: ReadonlyMap<number, readonly (readonly number[])[]>): Map<number, number> {
  const STEP = 2;
  const cells = new Map<string, Set<string>>();
  const cellsOf = (path: readonly (readonly number[])[]) => {
    const out = new Set<string>();
    for (let i = 0; i < path.length; i++) {
      const a = path[i];
      const b = path[Math.min(i + 1, path.length - 1)];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / STEP));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        out.add([0, 1, 2].map((d) => Math.floor((a[d] + (b[d] - a[d]) * t) / STEP)).join(","));
      }
    }
    return out;
  };
  const per = new Map<number, Set<string>>();
  for (const [id, path] of paths) {
    const set = cellsOf(path);
    per.set(id, set);
    for (const key of set) {
      let w = cells.get(key);
      if (!w) cells.set(key, (w = new Set()));
      w.add(String(id));
    }
  }
  const out = new Map<number, number>();
  for (const [id, set] of per) {
    let share = 1;
    for (const key of set) share = Math.max(share, cells.get(key)?.size ?? 1);
    out.set(id, Math.min(1.6, 0.6 + 0.25 * (share - 1)));
  }
  return out;
}

/** What the route-wires API answers with. */
export type RouteOutcome = {
  routed: number;
  failed: { wireId: number; name: string; reasons: string[] }[];
  skipped: { wireId: number; name: string; reason: string }[];
  /** wires whose ends were placed on a box face because the part has no pin position */
  faceEnds: number;
  cell: number;
  requestedCell: number;
  cells: number;
  /** how long the planner took, measured here from the request to the answer, ms */
  plannerMs: number;
};
