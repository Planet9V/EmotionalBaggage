// Pure schematic logic: parts and wires in, graph, checks, nets and generated files out.
// No React here, so the generators can be run and checked outside the browser.
// Relative imports on purpose: a plain Node check can load this file without path aliases.
import type { Item } from "@/lib/types";
import { CLASS_LABEL, NET_CLASSES, NET_COLOR, pinsOf, readParts, readWires, type NetClass, type Part, type Wire, type XY } from "@/lib/domain";
import { toCsvText } from "@/lib/csv";
import { esc } from "@/lib/html";
import { fmtFileStamp } from "@/lib/format";
import { wireNets, type Net } from "@/lib/parts/circuit";

export { CLASS_LABEL, readWires };
export type { Part, XY };

// Shared geometry: the React nodes and the SVG export use the same numbers, so they match.
export const NODE_W = 216;
export const HEADER_H = 48;
export const ROW_H = 24;
export const FOOT_H = 30;

export const CLASSES = NET_CLASSES;
export const WIRE_STATUSES = ["to solder", "soldered", "tested"];
/** Shown in place of a pin name a wire leaves empty. */
export const MISSING_PIN = "?";

export const refParts = (items: Item[]): Part[] => readParts(items).filter((p) => p.ref);

export const pinLabel = (p: string) => p || MISSING_PIN;
export const pinKey = (ref: string, pin: string) => `${ref}.${pinLabel(pin)}`;
export const nodeId = (ref: string) => `p:${ref}`;
export const handleId = (pin: string) => `pin:${pinLabel(pin)}`;
export const nodeHeight = (pinCount: number) => HEADER_H + ROW_H * Math.max(pinCount, 1) + FOOT_H;

/** Every pin of a ref, in wire order, then the stored extra pins. Empty pin names show as "?". */
export function pinsFor(ref: string, wires: Wire[], extra: string[] = []) {
  const named = pinsOf(ref, wires);
  const missing = wires.some((w) => (w.from === ref && !w.fromPin) || (w.to === ref && !w.toPin));
  const all = [...named, ...(missing ? [MISSING_PIN] : []), ...extra];
  return [...new Set(all)];
}

/** The net class carried on a pin: the class of the first wire that lands on it. */
function pinClass(ref: string, pin: string, wires: Wire[]): NetClass | null {
  for (const w of wires) {
    if ((w.from === ref && pinLabel(w.fromPin) === pin) || (w.to === ref && pinLabel(w.toPin) === pin)) return w.netClass;
  }
  return null;
}

// ───────── automatic layout

/** Where a part sits until elkjs has laid the schematic out (a row, in ref order), or if it cannot. */
const placeholder = (refs: string[]): Record<string, XY> => Object.fromEntries(refs.map((r, i) => [r, { x: i * (NODE_W + 60), y: 0 }]));

// ───────── the graph the canvas and the SVG both draw

export type PinRow = { name: string; side: "left" | "right"; netClass: NetClass | null; extra: boolean; wired: boolean };

type SNode = { kind: "part"; id: string; ref: string; title: string; ghost: boolean; pins: PinRow[]; pos: XY; saved: boolean; part: Part | null };

type Segment = {
  id: string;
  wire: Wire;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
  /** carry the net label (one segment per wire) */
  label: boolean;
};

export type Graph = { nodes: SNode[]; segments: Segment[]; byId: Map<string, SNode> };

/** `ignoreSaved` lays every node out afresh (the Tidy action); the overlay still wins. */
/** `layout`: positions by ref from the elkjs layout (@/lib/graphLayout); refs it lacks wait in a row. */
export function buildGraph(parts: Part[], wires: Wire[], overlay: Record<string, XY>, ignoreSaved = false, layout?: Record<string, XY>): Graph {
  const byRef = new Map<string, Part>();
  for (const p of parts) if (!byRef.has(p.ref)) byRef.set(p.ref, p);

  // refs drawn as part nodes: BOM parts with a pin, plus wire ends that are not in the BOM
  const refs: string[] = [];
  const pinList = new Map<string, string[]>();
  for (const p of byRef.values()) {
    const pins = pinsFor(p.ref, wires, p.pins);
    if (pins.length) {
      refs.push(p.ref);
      pinList.set(p.ref, pins);
    }
  }
  for (const w of wires) {
    for (const r of [w.from, w.to]) {
      if (!byRef.has(r) && !pinList.has(r)) {
        refs.push(r);
        pinList.set(r, pinsFor(r, wires));
      }
    }
  }

  const auto = { ...placeholder(refs), ...(layout ?? {}) };
  const pos = new Map<string, XY>();
  for (const r of refs) pos.set(r, overlay[nodeId(r)] ?? (ignoreSaved ? null : byRef.get(r)?.schematic) ?? auto[r] ?? { x: 0, y: 0 });

  const centreX = (r: string) => pos.get(r)!.x + NODE_W / 2;

  // side of each pin: each wire end votes for the side facing what it connects to. When two
  // boxes overlap left to right (one above the other), both ends take the same outer side,
  // so the wire runs round the outside instead of through a part.
  const midX = refs.length ? refs.reduce((a, r) => a + centreX(r), 0) / refs.length : 0;
  const prefer = (r: string, o: { x: number; w: number }): number => {
    const l = pos.get(r)!.x;
    const rr = l + NODE_W;
    if (o.x + o.w <= l) return -1;
    if (o.x >= rr) return 1;
    return (l + NODE_W / 2 + o.x + o.w / 2) / 2 < midX ? -1 : 1;
  };
  const votes = new Map<string, number[]>();
  const vote = (k: string, v: number) => votes.set(k, [...(votes.get(k) ?? []), v]);
  const box = (r: string) => ({ x: pos.get(r)!.x, w: NODE_W });
  for (const w of wires) {
    const fk = pinKey(w.from, w.fromPin);
    const tk = pinKey(w.to, w.toPin);
    if (w.from === w.to) {
      vote(fk, 1);
      vote(tk, 1);
    } else {
      vote(fk, prefer(w.from, box(w.to)));
      vote(tk, prefer(w.to, box(w.from)));
    }
  }

  const nodes: SNode[] = [];
  for (const r of refs) {
    const part = byRef.get(r) ?? null;
    const extra = new Set(part?.pins ?? []);
    const pins: PinRow[] = (pinList.get(r) ?? []).map((name) => {
      const vs = votes.get(`${r}.${name}`) ?? [];
      return {
        name,
        side: vs.reduce((a, b) => a + b, 0) < 0 ? "left" : "right",
        netClass: pinClass(r, name, wires),
        extra: extra.has(name),
        wired: vs.length > 0,
      };
    });
    nodes.push({
      kind: "part",
      id: nodeId(r),
      ref: r,
      title: part ? part.title : "Not in the bill of materials",
      ghost: !part,
      pins,
      pos: pos.get(r)!,
      saved: !!part?.schematic,
      part,
    });
  }

  const segments: Segment[] = [];
  for (const w of wires) {
    const src = nodeId(w.from);
    const dst = nodeId(w.to);
    const sh = handleId(w.fromPin);
    const th = handleId(w.toPin);
    segments.push({ id: `w:${w.item.id}`, wire: w, source: src, sourceHandle: sh, target: dst, targetHandle: th, label: true });
  }
  return { nodes, segments, byId: new Map(nodes.map((n) => [n.id, n])) };
}

// ───────── checks (computed from the rows, never invented)

export type Check = { id: string; tone: "danger" | "warning" | "neutral"; text: string; wireIds: number[]; refs: string[] };

const wireLabel = (w: Wire) => `Wire ${w.order} (${w.name || "unnamed"})`;
const listRefs = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export function computeChecks(parts: Part[], wires: Wire[], nets: NetInfo[] = computeNets(wires)): Check[] {
  const out: Check[] = [];
  const counts = new Map<string, number>();
  for (const p of parts) counts.set(p.ref, (counts.get(p.ref) ?? 0) + 1);
  const known = new Set(counts.keys());

  for (const [ref, n] of counts) {
    if (n > 1) out.push({ id: `dupref:${ref}`, tone: "danger", text: `${n} parts in the bill of materials share the ref ${ref}. The schematic uses the first one.`, wireIds: [], refs: [ref] });
  }

  for (const w of wires) {
    const missing = [...new Set([w.from, w.to].filter((r) => r && !known.has(r)))];
    if (missing.length) {
      out.push({
        id: `unknown:${w.item.id}`,
        tone: "danger",
        text: `${wireLabel(w)} names ${listRefs(missing)}, which ${missing.length > 1 ? "are" : "is"} not in the bill of materials.`,
        wireIds: [w.item.id],
        refs: missing,
      });
    }
    const ends = [!w.fromPin && `the ${w.from} end`, !w.toPin && `the ${w.to} end`].filter(Boolean) as string[];
    if (ends.length) {
      out.push({ id: `nopin:${w.item.id}`, tone: "warning", text: `${wireLabel(w)} has no pin name at ${ends.join(" or ")}.`, wireIds: [w.item.id], refs: [w.from, w.to] });
    }
    if (w.from === w.to && w.fromPin === w.toPin) {
      out.push({ id: `self:${w.item.id}`, tone: "warning", text: `${wireLabel(w)} joins ${pinKey(w.from, w.fromPin)} to itself.`, wireIds: [w.item.id], refs: [w.from] });
    }
  }

  for (const p of parts) {
    const used = new Set(pinsOf(p.ref, wires));
    const loose = p.pins.filter((pin) => !used.has(pin));
    if (loose.length) {
      out.push({
        id: `loose:${p.ref}`,
        tone: "warning",
        text: `${p.ref} has ${loose.length > 1 ? "pins" : "a pin"} with no wire: ${loose.join(", ")}.`,
        wireIds: [],
        refs: [p.ref],
      });
    }
  }

  const pairs = new Map<string, Wire[]>();
  for (const w of wires) {
    const ends = [pinKey(w.from, w.fromPin), pinKey(w.to, w.toPin)].sort();
    const k = ends.join("|");
    pairs.set(k, [...(pairs.get(k) ?? []), w]);
  }
  for (const [k, ws] of pairs) {
    if (ws.length < 2) continue;
    const [a, b] = k.split("|");
    out.push({
      id: `dup:${k}`,
      tone: "warning",
      text: `Wires ${listRefs(ws.map((w) => String(w.order)))} ${ws.length === 2 ? "both" : "all"} join ${a} and ${b}.`,
      wireIds: ws.map((w) => w.item.id),
      refs: [],
    });
  }

  for (const n of nets) {
    if (n.classes.length > 1) {
      out.push({
        id: `mixed:${n.name}`,
        tone: "warning",
        text: `Net ${n.name} is marked as ${listRefs(n.classes.map((c) => CLASS_LABEL[c].toLowerCase()))} on different wires (${n.wires.map((w) => w.order).join(", ")}).`,
        wireIds: n.wires.map((w) => w.item.id),
        refs: [],
      });
    }
  }

  const touched = new Set(wires.flatMap((w) => [w.from, w.to]).filter(Boolean));
  const idle = [...known].filter((r) => !touched.has(r));
  if (idle.length) {
    out.push({
      id: "idle",
      tone: "neutral",
      text: `${idle.length === 1 ? "1 part" : `${idle.length} parts`} in the bill of materials ${idle.length === 1 ? "has" : "have"} no connection: ${idle.join(", ")}.`,
      wireIds: [],
      refs: idle,
    });
  }
  return out;
}

// ───────── the net list: pins joined by wires (src/lib/parts/circuit.ts), never the name typed on a wire

export type NetInfo = { name: string; classes: NetClass[]; members: string[]; wires: Wire[] };

/**
 * The circuit's nets as the net list shows them. One entry per electrical net: an unnamed wire is a net
 * of the pins it joins (named after its first pin), not part of one lump of every unnamed wire, and a
 * name typed on wires that do not touch does not join them. `classes` are the classes its wires carry.
 */
export function netList(nets: Net[]): NetInfo[] {
  return nets.map((n) => ({
    name: n.name,
    classes: [...new Set(n.wires.map((w) => w.netClass))],
    members: n.members.map((m) => pinKey(m.ref, m.pin)).sort(byPinKey),
    wires: n.wires,
  }));
}

/** The net list of a set of wires alone. With the parts at hand, use netList(circuit.nets): the names then also follow the pins. */
export function computeNets(wires: Wire[]): NetInfo[] {
  return netList(wireNets(wires));
}

function byPinKey(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

// ───────── generated files

export type FileMeta = { concept: string; generatedAt: Date };

export const CSV_HEADER = ["order", "name", "net", "class", "from ref", "from pin", "to ref", "to pin", "cut length mm", "length basis", "gauge", "note", "status"];

/** What the build sheet works out for a wire: the length to cut (and whether it is routed or estimated) and the gauge. */
export type WireCut = { cutMm: number | null; basis: "routed" | "estimate" | ""; gauge: string };

/** (a) Wiring list, one row per wire in soldering order, with the cut length, its basis and the gauge from the build sheet. */
export function wiringCsv(wires: Wire[], cuts: ReadonlyMap<number, WireCut> = new Map()): string {
  const rows = [...wires]
    .sort((a, b) => a.order - b.order || a.item.id - b.item.id)
    .map((w) => {
      const c = cuts.get(w.item.id);
      return [w.order, w.name, w.net, w.netClass, w.from, w.fromPin, w.to, w.toPin, c?.cutMm ?? "", c?.basis ?? "", c?.gauge ?? "", w.note, w.status];
    });
  return toCsvText([CSV_HEADER, ...rows]);
}

/** (b1) Netlist as plain text: one block per electrical net. */
export function netlistText(wires: Wire[], meta: FileMeta): string {
  const lines = [
    `Netlist: ${meta.concept}`,
    `Generated ${fmtFileStamp(meta.generatedAt)}`,
    "Pins joined by wires are one net. A net with no name typed on its wires is named after its first pin.",
    "",
  ];
  for (const n of computeNets(wires)) {
    lines.push(`Net ${n.name} (${n.classes.join(", ")}), ${n.wires.length} ${n.wires.length === 1 ? "wire" : "wires"}`);
    for (const m of n.members) lines.push(`  ${m}`);
    lines.push("");
  }
  return lines.join("\n");
}

export type ElectricalNet = { name: string; members: { ref: string; pin: string }[] };

/**
 * Pins joined by wires form one electrical net: the circuit's own nets (src/lib/parts/circuit.ts), in the
 * shape the netlist file writes. A part in series is its own part with a wire to each of its pins, so it
 * splits the net by itself.
 */
export function electricalNets(wires: Wire[]): ElectricalNet[] {
  return wireNets(wires).map((n) => ({ name: n.name, members: n.members.map((m) => ({ ref: m.ref, pin: pinLabel(m.pin) })) }));
}

const q = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** (b2) A KiCad-style S-expression netlist. A simple netlist for reference, not a validated KiCad project. */
export function netlistKicad(parts: Part[], wires: Wire[], meta: FileMeta): string {
  const byRef = new Map<string, Part>();
  for (const p of parts) if (!byRef.has(p.ref)) byRef.set(p.ref, p);
  const nets = electricalNets(wires);
  const refs = [...new Set(nets.flatMap((n) => n.members.map((m) => m.ref)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const out: string[] = [];
  out.push('(export (version "E")');
  out.push("  (design");
  out.push(`    (source ${q(meta.concept)})`);
  out.push(`    (date ${q(fmtFileStamp(meta.generatedAt))})`);
  out.push(`    (tool ${q("Concept to realization: simple netlist for reference, not a validated KiCad project")}))`);
  out.push("  (components");
  for (const r of refs) {
    const p = byRef.get(r);
    out.push(`    (comp (ref ${q(r)})`);
    out.push(`      (value ${q(p ? p.title : "not in the bill of materials")})`);
    out.push(`      (description ${q(p ? p.spec : "")}))`);
  }
  out.push("  )");
  out.push("  (nets");
  nets.forEach((n, i) => {
    out.push(`    (net (code ${i + 1}) (name ${q(n.name)})`);
    n.members.forEach((m, j) => out.push(`      (node (ref ${q(m.ref)}) (pin ${q(m.pin)}))${j === n.members.length - 1 ? ")" : ""}`));
  });
  out.push("  ))");
  return out.join("\n") + "\n";
}

// ───────── SVG drawn from the node positions (not a screenshot)

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

type Anchor = { x: number; y: number; dir: -1 | 1 };

function anchorOf(g: Graph, nodeIdStr: string, handle: string): Anchor | null {
  const n = g.byId.get(nodeIdStr);
  if (!n) return null;
  const name = handle.replace(/^pin:/, "");
  const i = Math.max(0, n.pins.findIndex((p) => p.name === name));
  const side = n.pins[i]?.side ?? "right";
  return { x: side === "left" ? n.pos.x : n.pos.x + NODE_W, y: n.pos.y + HEADER_H + ROW_H * (i + 0.5), dir: side === "left" ? -1 : 1 };
}

function orthPath(a: Anchor, b: Anchor) {
  const stub = 22;
  const p1 = { x: a.x + a.dir * stub, y: a.y };
  const p2 = { x: b.x + b.dir * stub, y: b.y };
  let mx = (p1.x + p2.x) / 2;
  if (a.dir === b.dir) mx = a.dir > 0 ? Math.max(p1.x, p2.x) : Math.min(p1.x, p2.x);
  const pts = [a, p1, { x: mx, y: p1.y }, { x: mx, y: p2.y }, p2, b];
  return { d: pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" "), mid: { x: mx, y: (p1.y + p2.y) / 2 } };
}

export function schematicSvg(g: Graph, meta: FileMeta): string {
  const INK = "#18181B";
  const MUTED = "#71717A";
  const LINE = "#D9D2C5";
  const ORANGE = "#E05A10";
  const SANS = "Inter, Helvetica, Arial, sans-serif";
  const MONO = "'JetBrains Mono', Menlo, Consolas, monospace";

  const boxes = g.nodes.map((n) => ({ x: n.pos.x, y: n.pos.y, w: NODE_W, h: nodeHeight(n.pins.length) - FOOT_H }));
  const pad = 60;
  const minX = boxes.length ? Math.min(...boxes.map((b) => b.x)) - pad : 0;
  const minY = boxes.length ? Math.min(...boxes.map((b) => b.y)) - pad : 0;
  const maxX = boxes.length ? Math.max(...boxes.map((b) => b.x + b.w)) + pad : 600;
  const maxY = boxes.length ? Math.max(...boxes.map((b) => b.y + b.h)) + pad : 300;
  const blockW = 320;
  const blockH = 92;
  const width = Math.max(maxX - minX, blockW + 380);
  const height = maxY - minY + blockH + 30;
  const ox = -minX;
  const oy = -minY;

  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}" font-family="${esc(SANS)}">`
  );
  parts.push(`<title>${esc(`${meta.concept}: connection schematic`)}</title>`);
  parts.push(`<rect width="100%" height="100%" fill="#FFFFFF"/>`);
  parts.push(`<g transform="translate(${ox} ${oy})">`);

  // wires under the nodes
  for (const s of g.segments) {
    const a = anchorOf(g, s.source, s.sourceHandle);
    const b = anchorOf(g, s.target, s.targetHandle);
    if (!a || !b) continue;
    const color = NET_COLOR[s.wire.netClass];
    const { d, mid } = orthPath(a, b);
    parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/>`);
    if (s.label && s.wire.net) {
      const t = esc(s.wire.net);
      const w = s.wire.net.length * 6.2 + 10;
      parts.push(
        `<g><rect x="${(mid.x - w / 2).toFixed(1)}" y="${(mid.y - 8).toFixed(1)}" width="${w.toFixed(1)}" height="16" rx="3" fill="#FFFFFF" stroke="${LINE}"/><text x="${mid.x.toFixed(1)}" y="${(mid.y + 3.5).toFixed(1)}" font-family="${esc(MONO)}" font-size="9.5" fill="${color}" text-anchor="middle">${t}</text></g>`
      );
    }
  }

  for (const n of g.nodes) {
    const h = nodeHeight(n.pins.length) - FOOT_H;
    parts.push(`<g>`);
    parts.push(
      `<rect x="${n.pos.x}" y="${n.pos.y}" width="${NODE_W}" height="${h}" rx="8" fill="#FFFFFF" stroke="${n.ghost ? "#B42318" : LINE}"${n.ghost ? ' stroke-dasharray="4 3"' : ""}/>`
    );
    parts.push(`<line x1="${n.pos.x}" y1="${n.pos.y + HEADER_H}" x2="${n.pos.x + NODE_W}" y2="${n.pos.y + HEADER_H}" stroke="${LINE}"/>`);
    parts.push(`<text x="${n.pos.x + 12}" y="${n.pos.y + 20}" font-family="${esc(MONO)}" font-size="11" font-weight="600" fill="${ORANGE}">${esc(n.ref)}</text>`);
    parts.push(`<text x="${n.pos.x + 12}" y="${n.pos.y + 37}" font-size="12" fill="${INK}">${esc(clip(n.title, 30))}</text>`);
    n.pins.forEach((p, i) => {
      const y = n.pos.y + HEADER_H + ROW_H * (i + 0.5);
      const left = p.side === "left";
      const x = left ? n.pos.x : n.pos.x + NODE_W;
      const color = p.netClass ? NET_COLOR[p.netClass] : MUTED;
      parts.push(
        `<text x="${left ? n.pos.x + 12 : n.pos.x + NODE_W - 12}" y="${(y + 3.5).toFixed(1)}" font-family="${esc(MONO)}" font-size="10.5" fill="${INK}" text-anchor="${left ? "start" : "end"}">${esc(p.name)}</text>`
      );
      parts.push(`<circle cx="${x}" cy="${y.toFixed(1)}" r="3.5" fill="#FFFFFF" stroke="${color}" stroke-width="2"/>`);
    });
    parts.push(`</g>`);
  }
  parts.push(`</g>`);

  // legend and title block along the foot
  const fy = height - blockH - 14;
  let lx = 16;
  parts.push(`<g font-size="10" fill="${MUTED}">`);
  for (const c of CLASSES) {
    parts.push(`<line x1="${lx}" y1="${fy + blockH - 14}" x2="${lx + 22}" y2="${fy + blockH - 14}" stroke="${NET_COLOR[c]}" stroke-width="2.5"/>`);
    parts.push(`<text x="${lx + 28}" y="${fy + blockH - 10.5}">${CLASS_LABEL[c]}</text>`);
    lx += 86;
  }
  parts.push(`</g>`);
  const bx = width - blockW - 14;
  parts.push(`<g>`);
  parts.push(`<rect x="${bx}" y="${fy}" width="${blockW}" height="${blockH}" fill="#FFFFFF" stroke="${INK}" stroke-width="1"/>`);
  parts.push(`<line x1="${bx}" y1="${fy + 34}" x2="${bx + blockW}" y2="${fy + 34}" stroke="${INK}" stroke-width="0.6"/>`);
  parts.push(`<line x1="${bx}" y1="${fy + 62}" x2="${bx + blockW}" y2="${fy + 62}" stroke="${INK}" stroke-width="0.6"/>`);
  parts.push(`<text x="${bx + 12}" y="${fy + 22}" font-size="14" font-weight="600" fill="${INK}">${esc(clip(meta.concept, 36))}</text>`);
  parts.push(`<text x="${bx + 12}" y="${fy + 52}" font-size="12" fill="${INK}">Connection schematic</text>`);
  parts.push(`<text x="${bx + 12}" y="${fy + 80}" font-family="${esc(MONO)}" font-size="10" fill="${MUTED}">Generated ${esc(fmtFileStamp(meta.generatedAt))}</text>`);
  parts.push(`</g>`);
  parts.push(`</svg>`);
  return parts.join("\n") + "\n";
}
