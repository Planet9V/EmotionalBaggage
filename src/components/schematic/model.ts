// Pure schematic logic: parts and wires in, graph, checks, nets and generated files out.
// No React here, so the generators can be run and checked outside the browser.
// Relative imports on purpose: a plain Node check can load this file without path aliases.
import type { Item } from "@/lib/types";
import { CLASS_LABEL, NET_CLASSES, NET_COLOR, pinsOf, readParts, readWires, type NetClass, readXY, type Part, type Wire, type XY } from "@/lib/domain";

export { CLASS_LABEL, readWires };
export type { Part, XY };

// Shared geometry: the React nodes and the SVG export use the same numbers, so they match.
export const NODE_W = 216;
export const HEADER_H = 48;
export const ROW_H = 24;
export const FOOT_H = 30;
export const VIA_W = 116;
export const VIA_H = 42;

export const CLASSES = NET_CLASSES;
export const WIRE_STATUSES = ["to solder", "soldered", "tested"];
/** Shown in place of a pin name a wire leaves empty. */
export const MISSING_PIN = "?";

export const refParts = (items: Item[]): Part[] => readParts(items).filter((p) => p.ref);

export const pinLabel = (p: string) => p || MISSING_PIN;
export const pinKey = (ref: string, pin: string) => `${ref}.${pinLabel(pin)}`;
export const nodeId = (ref: string) => `p:${ref}`;
export const viaId = (wireId: number) => `v:${wireId}`;
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

type Group = "left" | "right" | "top" | "bottom" | "loose";
const GAP_X = 150;
const GAP_Y = 36;
const GAP_V = 90;

/** Where a part sits around the centre, from its nets first and its ref designator second. */
export function groupOf(ref: string, wires: Wire[]): Group {
  const classes = new Set<NetClass>();
  for (const w of wires) if (w.from === ref || w.to === ref) classes.add(w.netClass);
  if (!classes.size) return "loose";
  if ([...classes].every((c) => c === "power" || c === "ground")) return "left";
  if (classes.has("audio")) return "right";
  if (/^(S|SW|BTN|KEY|RV|POT)\d/i.test(ref)) return "bottom";
  if (/^(SPK|LS|LED|D|DS|M|BZ|K|LCD|OLED)\d/i.test(ref)) return "right";
  return "top";
}

/**
 * A tidy first arrangement: the part with the most wires in the centre, power sources to its
 * left, sensors above, outputs to the right, controls below. Parts further from the centre
 * (by wire hops) go one column or row further out. Positions are node top-left corners.
 */
export function autoLayout(refs: string[], wires: Wire[], pinCount: (ref: string) => number): Record<string, XY> {
  const out: Record<string, XY> = {};
  if (!refs.length) return out;
  const degree = (r: string) => wires.filter((w) => w.from === r || w.to === r).length;
  const centre = refs.reduce((best, r) => (degree(r) > degree(best) ? r : best), refs[0]);
  const hc = nodeHeight(pinCount(centre));
  out[centre] = { x: 0, y: 0 };

  // hops from the centre over wires
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const w of wires) {
    link(w.from, w.to);
    link(w.to, w.from);
  }
  const hops = new Map<string, number>([[centre, 0]]);
  const queue = [centre];
  while (queue.length) {
    const r = queue.shift()!;
    for (const n of adj.get(r) ?? []) {
      if (!hops.has(n)) {
        hops.set(n, hops.get(r)! + 1);
        queue.push(n);
      }
    }
  }

  const groups = new Map<Group, Map<number, string[]>>();
  for (const r of refs) {
    if (r === centre) continue;
    const g = groupOf(r, wires);
    const d = Math.max(1, hops.get(r) ?? 1);
    if (!groups.has(g)) groups.set(g, new Map());
    const byDepth = groups.get(g)!;
    byDepth.set(d, [...(byDepth.get(d) ?? []), r]);
  }
  const h = (r: string) => nodeHeight(pinCount(r));

  const column = (list: string[], x: number) => {
    const total = list.reduce((a, r) => a + h(r), 0) + GAP_Y * (list.length - 1);
    let y = hc / 2 - total / 2;
    for (const r of list) {
      out[r] = { x, y: Math.round(y) };
      y += h(r) + GAP_Y;
    }
  };
  // rows sit off the centre line (top to the left, bottom to the right) so their wires leave
  // the centre part from its sides instead of stacking on one vertical run
  const row = (list: string[], y: number, shift: number) => {
    const step = NODE_W + GAP_X / 2;
    const total = list.length * NODE_W + (list.length - 1) * (GAP_X / 2);
    list.forEach((r, i) => (out[r] = { x: Math.round(NODE_W / 2 - total / 2 + i * step + shift), y: Math.round(y) }));
  };
  const SHIFT = Math.round(NODE_W * 0.75);
  const depths = (g: Group) => [...(groups.get(g)?.entries() ?? [])].sort((a, b) => a[0] - b[0]);

  for (const [d, list] of depths("left")) column(list, -(NODE_W + GAP_X) * d);
  for (const [d, list] of depths("right")) column(list, (NODE_W + GAP_X) * d);
  let top = 0;
  for (const [, list] of depths("top")) {
    const tallest = Math.max(...list.map(h));
    top -= GAP_V + tallest;
    row(list, top, -SHIFT);
  }
  let bottom = hc;
  for (const [, list] of [...depths("bottom"), ...depths("loose")]) {
    bottom += GAP_V;
    row(list, bottom, SHIFT);
    bottom += Math.max(...list.map(h));
  }
  return out;
}

// ───────── the graph the canvas and the SVG both draw

export type PinRow = { name: string; side: "left" | "right"; netClass: NetClass | null; extra: boolean; wired: boolean };

export type SNode =
  | { kind: "part"; id: string; ref: string; title: string; ghost: boolean; pins: PinRow[]; pos: XY; saved: boolean; part: Part | null }
  | { kind: "via"; id: string; ref: string; title: string; ghost: boolean; wire: Wire; pos: XY; saved: boolean };

export type Segment = {
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
/** `layout`: positions by ref from the elkjs layout (./elk.ts); refs it lacks fall back to `autoLayout`. */
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

  const auto = { ...autoLayout(refs, wires, (r) => pinList.get(r)?.length ?? 1), ...(layout ?? {}) };
  const pos = new Map<string, XY>();
  for (const r of refs) pos.set(r, overlay[nodeId(r)] ?? (ignoreSaved ? null : byRef.get(r)?.schematic) ?? auto[r] ?? { x: 0, y: 0 });

  const pinY = (r: string, pin: string) => {
    const i = Math.max(0, (pinList.get(r) ?? []).indexOf(pin));
    return pos.get(r)!.y + HEADER_H + ROW_H * (i + 0.5);
  };
  const centreX = (r: string) => pos.get(r)!.x + NODE_W / 2;

  // vias: one inline node per wire that runs through a part in series
  const viaPos = new Map<number, XY>();
  for (const w of wires) {
    if (!w.via) continue;
    const id = viaId(w.item.id);
    const saved = overlay[id] ?? (ignoreSaved ? null : readXY(w.item.data.schematic));
    if (saved) {
      viaPos.set(w.item.id, saved);
      continue;
    }
    const a = { x: centreX(w.from), y: pinY(w.from, pinLabel(w.fromPin)) };
    const b = { x: centreX(w.to), y: pinY(w.to, pinLabel(w.toPin)) };
    if (w.from === w.to) {
      viaPos.set(w.item.id, { x: Math.round(pos.get(w.from)!.x + NODE_W + 70), y: Math.round((a.y + b.y) / 2 - VIA_H / 2) });
    } else {
      viaPos.set(w.item.id, { x: Math.round((a.x + b.x) / 2 - VIA_W / 2), y: Math.round((a.y + b.y) / 2 - VIA_H / 2) });
    }
  }

  // keep automatically placed vias clear of part nodes and of each other
  const boxes = refs.map((r) => ({ x: pos.get(r)!.x, y: pos.get(r)!.y, w: NODE_W, h: nodeHeight(pinList.get(r)?.length ?? 1) }));
  const hits = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    a.x < b.x + b.w + 12 && b.x < a.x + a.w + 12 && a.y < b.y + b.h + 12 && b.y < a.y + a.h + 12;
  for (const w of wires) {
    if (!w.via || overlay[viaId(w.item.id)] || (!ignoreSaved && readXY(w.item.data.schematic))) continue;
    const start = viaPos.get(w.item.id)!;
    let placed = start;
    for (let step = 0; step <= 16; step++) {
      const dy = step === 0 ? 0 : Math.ceil(step / 2) * 54 * (step % 2 ? 1 : -1);
      const cand = { x: start.x, y: start.y + dy, w: VIA_W, h: VIA_H };
      if (!boxes.some((b) => hits(cand, b))) {
        placed = { x: cand.x, y: cand.y };
        break;
      }
    }
    viaPos.set(w.item.id, placed);
    boxes.push({ x: placed.x, y: placed.y, w: VIA_W, h: VIA_H });
  }

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
    if (w.via) {
      const v = { x: viaPos.get(w.item.id)!.x, w: VIA_W };
      vote(fk, prefer(w.from, v));
      vote(tk, prefer(w.to, v));
    } else if (w.from === w.to) {
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
  const sideOf = (r: string, pin: string) => {
    const n = nodes.find((x) => x.kind === "part" && x.ref === r);
    return n && n.kind === "part" ? n.pins.find((p) => p.name === pin)?.side ?? "right" : "right";
  };
  for (const w of wires) {
    const src = nodeId(w.from);
    const dst = nodeId(w.to);
    const sh = handleId(w.fromPin);
    const th = handleId(w.toPin);
    if (!w.via) {
      segments.push({ id: `w:${w.item.id}`, wire: w, source: src, sourceHandle: sh, target: dst, targetHandle: th, label: true });
      continue;
    }
    const vid = viaId(w.item.id);
    const v = viaPos.get(w.item.id)!;
    const vp = byRef.get(w.via);
    nodes.push({
      kind: "via",
      id: vid,
      ref: w.via,
      title: vp ? vp.title : "Not in the bill of materials",
      ghost: !vp,
      wire: w,
      pos: v,
      saved: !!readXY(w.item.data.schematic),
    });
    const vc = v.x + VIA_W / 2;
    // each end enters the via from the side facing it
    const fromX = sideOf(w.from, pinLabel(w.fromPin)) === "left" ? pos.get(w.from)!.x : pos.get(w.from)!.x + NODE_W;
    const toX = sideOf(w.to, pinLabel(w.toPin)) === "left" ? pos.get(w.to)!.x : pos.get(w.to)!.x + NODE_W;
    segments.push({ id: `w:${w.item.id}:a`, wire: w, source: src, sourceHandle: sh, target: vid, targetHandle: fromX < vc ? "l" : "r", label: true });
    segments.push({ id: `w:${w.item.id}:b`, wire: w, source: vid, sourceHandle: toX < vc ? "l" : "r", target: dst, targetHandle: th, label: false });
  }
  return { nodes, segments, byId: new Map(nodes.map((n) => [n.id, n])) };
}

// ───────── checks (computed from the rows, never invented)

export type Check = { id: string; tone: "danger" | "warning" | "neutral"; text: string; wireIds: number[]; refs: string[] };

const wireLabel = (w: Wire) => `Wire ${w.order} (${w.name || "unnamed"})`;
const listRefs = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export function computeChecks(parts: Part[], wires: Wire[]): Check[] {
  const out: Check[] = [];
  const counts = new Map<string, number>();
  for (const p of parts) counts.set(p.ref, (counts.get(p.ref) ?? 0) + 1);
  const known = new Set(counts.keys());

  for (const [ref, n] of counts) {
    if (n > 1) out.push({ id: `dupref:${ref}`, tone: "danger", text: `${n} parts in the bill of materials share the ref ${ref}. The schematic uses the first one.`, wireIds: [], refs: [ref] });
  }

  for (const w of wires) {
    const missing = [...new Set([w.from, w.to, w.via].filter((r) => r && !known.has(r)))];
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
    if (w.from === w.to && w.fromPin === w.toPin && !w.via) {
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
    const k = `${ends.join("|")}|${w.via}`;
    pairs.set(k, [...(pairs.get(k) ?? []), w]);
  }
  for (const [k, ws] of pairs) {
    if (ws.length < 2) continue;
    const [a, b] = k.split("|");
    out.push({
      id: `dup:${k}`,
      tone: "warning",
      text: `Wires ${listRefs(ws.map((w) => String(w.order)))} ${ws.length === 2 ? "both" : "all"} join ${a} and ${b}${ws[0].via ? ` through ${ws[0].via}` : ""}.`,
      wireIds: ws.map((w) => w.item.id),
      refs: [],
    });
  }

  for (const n of computeNets(wires)) {
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

  const touched = new Set(wires.flatMap((w) => [w.from, w.to, w.via]).filter(Boolean));
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

// ───────── nets as named on the wires

export const NO_NET = "(no net name)";
export type NetInfo = { name: string; classes: NetClass[]; members: string[]; vias: { via: string; wire: Wire }[]; wires: Wire[] };

export function computeNets(wires: Wire[]): NetInfo[] {
  const map = new Map<string, NetInfo>();
  for (const w of wires) {
    const name = w.net.trim() || NO_NET;
    if (!map.has(name)) map.set(name, { name, classes: [], members: [], vias: [], wires: [] });
    const n = map.get(name)!;
    n.wires.push(w);
    if (!n.classes.includes(w.netClass)) n.classes.push(w.netClass);
    for (const m of [pinKey(w.from, w.fromPin), pinKey(w.to, w.toPin)]) if (!n.members.includes(m)) n.members.push(m);
    if (w.via) n.vias.push({ via: w.via, wire: w });
  }
  const list = [...map.values()];
  for (const n of list) n.members.sort(byPinKey);
  return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function byPinKey(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

// ───────── generated files

export type FileMeta = { concept: string; generatedAt: Date };

export function fmtDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const CSV_HEADER = ["order", "name", "net", "class", "from ref", "from pin", "to ref", "to pin", "via", "note", "status"];

/** (a) Wiring list, one row per wire in soldering order. */
export function wiringCsv(wires: Wire[]): string {
  const rows = [...wires]
    .sort((a, b) => a.order - b.order || a.item.id - b.item.id)
    .map((w) => [w.order, w.name, w.net, w.netClass, w.from, w.fromPin, w.to, w.toPin, w.via, w.note, w.status]);
  return [CSV_HEADER, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** (b1) Netlist as plain text, grouped by the net name on each wire. */
export function netlistText(wires: Wire[], meta: FileMeta): string {
  const lines = [
    `Netlist: ${meta.concept}`,
    `Generated ${fmtDate(meta.generatedAt)}`,
    "Grouped by the net name on each wire. A part in series on a wire is listed under the net as \"through\".",
    "",
  ];
  for (const n of computeNets(wires)) {
    lines.push(`Net ${n.name} (${n.classes.join(", ")}), ${n.wires.length} ${n.wires.length === 1 ? "wire" : "wires"}`);
    for (const m of n.members) lines.push(`  ${m}`);
    for (const v of n.vias) lines.push(`  through ${v.via}: ${pinKey(v.wire.from, v.wire.fromPin)} -> ${v.via} -> ${pinKey(v.wire.to, v.wire.toPin)}`);
    lines.push("");
  }
  return lines.join("\n");
}

export type ElectricalNet = { name: string; members: { ref: string; pin: string }[] };

/**
 * Pins joined by wires form one electrical net. A part in series on a wire splits it:
 * its pin 1 faces the from end and its pin 2 the to end. A net takes the net names of the
 * direct wires in it; a name shared by several electrical nets gets its first pin appended.
 */
export function electricalNets(wires: Wire[]): ElectricalNet[] {
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    if (!parent.has(k)) parent.set(k, k);
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(k, r);
    return r;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));
  const key = (ref: string, pin: string) => `${ref}\u0000${pinLabel(pin)}`;
  const direct: [string, string][] = [];
  const viaNames: [string, string][] = [];
  for (const w of wires) {
    const f = key(w.from, w.fromPin);
    const t = key(w.to, w.toPin);
    if (w.via) {
      const v1 = key(w.via, "1");
      const v2 = key(w.via, "2");
      union(f, v1);
      union(v2, t);
      viaNames.push([f, w.net], [t, w.net]);
    } else {
      union(f, t);
      direct.push([f, w.net]);
    }
  }
  const groups = new Map<string, { members: Set<string>; names: string[]; fallback: string[] }>();
  for (const k of parent.keys()) {
    const r = find(k);
    if (!groups.has(r)) groups.set(r, { members: new Set(), names: [], fallback: [] });
    groups.get(r)!.members.add(k);
  }
  for (const [k, n] of direct) if (n.trim()) groups.get(find(k))!.names.push(n.trim());
  for (const [k, n] of viaNames) if (n.trim()) groups.get(find(k))!.fallback.push(n.trim());

  const nets = [...groups.values()].map((g) => {
    const members = [...g.members]
      .map((m) => {
        const [ref, pin] = m.split("\u0000");
        return { ref, pin };
      })
      .sort((a, b) => byPinKey(`${a.ref}.${a.pin}`, `${b.ref}.${b.pin}`));
    const names = [...new Set(g.names.length ? g.names : g.fallback)];
    return { base: names.join("/") || "", members };
  });
  const uses = new Map<string, number>();
  for (const n of nets) uses.set(n.base, (uses.get(n.base) ?? 0) + 1);
  return nets
    .map((n) => {
      const first = n.members[0];
      const tag = `(${first.ref}-${first.pin})`;
      const name = !n.base ? `Net-${tag}` : (uses.get(n.base) ?? 0) > 1 ? `${n.base}-${tag}` : n.base;
      return { name, members: n.members };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
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
  out.push(`    (date ${q(fmtDate(meta.generatedAt))})`);
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

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

type Anchor = { x: number; y: number; dir: -1 | 1 };

function anchorOf(g: Graph, nodeIdStr: string, handle: string): Anchor | null {
  const n = g.byId.get(nodeIdStr);
  if (!n) return null;
  if (n.kind === "via") {
    const left = handle === "l";
    return { x: left ? n.pos.x : n.pos.x + VIA_W, y: n.pos.y + VIA_H / 2, dir: left ? -1 : 1 };
  }
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

  const boxes = g.nodes.map((n) =>
    n.kind === "via" ? { x: n.pos.x, y: n.pos.y, w: VIA_W, h: VIA_H } : { x: n.pos.x, y: n.pos.y, w: NODE_W, h: nodeHeight(n.pins.length) - FOOT_H }
  );
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
    if (n.kind === "via") {
      parts.push(
        `<g><rect x="${n.pos.x}" y="${n.pos.y}" width="${VIA_W}" height="${VIA_H}" rx="6" fill="#FFFFFF" stroke="${n.ghost ? "#B42318" : LINE}"${n.ghost ? ' stroke-dasharray="4 3"' : ""}/>` +
          `<text x="${n.pos.x + VIA_W / 2}" y="${n.pos.y + 17}" font-family="${esc(MONO)}" font-size="11" font-weight="600" fill="${ORANGE}" text-anchor="middle">${esc(n.ref)}</text>` +
          `<text x="${n.pos.x + VIA_W / 2}" y="${n.pos.y + 32}" font-size="10" fill="${MUTED}" text-anchor="middle">${esc(clip(n.title, 18))}</text></g>`
      );
      continue;
    }
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
  parts.push(`<text x="${bx + 12}" y="${fy + 80}" font-family="${esc(MONO)}" font-size="10" fill="${MUTED}">Generated ${esc(fmtDate(meta.generatedAt))}</text>`);
  parts.push(`</g>`);
  parts.push(`</svg>`);
  return parts.join("\n") + "\n";
}
