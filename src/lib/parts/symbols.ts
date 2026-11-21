// Symbol drawings and where each pin lands, in millimetres, y pointing down, origin at the
// symbol's anchor. The symbol view of the schematic draws these (scaled to pixels) and the KiCad
// export writes the same shapes into the file's lib_symbols, so both show the same symbol.
//
// Two-pin and speaker drawings are copied from the `schematic-symbols` package (MIT; origins
// checked, see docs/third-party.manual.json). The capacitor and motor are our own drawings: the
// package's capacitor had its dimensions matched to KiCad's library symbol, so it is not used.
// Every other part is a box with its pins around it, placed by pin side.
import DATA from "./symbols.data.json";
import type { Side, SymbolId } from "./kinds";
import type { Pin } from "./pins";

export const GRID = 2.54;
const HALF = GRID / 2;

export type Stroke = { points: [number, number][]; fill?: boolean; closed?: boolean };
export type Circle = { x: number; y: number; r: number; fill?: boolean };
export type SymText = { x: number; y: number; text: string; size: number };
export type SymPin = {
  name: string;
  number: string;
  /** connection point: where a wire ends */
  x: number;
  y: number;
  /** the direction from the connection point towards the body */
  toward: "right" | "left" | "down" | "up";
  length: number;
  side: Side;
  pin: Pin;
};
export type SymbolLayout = {
  symbol: SymbolId;
  /** the body: a rectangle for a box, strokes and circles for a drawn symbol */
  rect: { x1: number; y1: number; x2: number; y2: number } | null;
  strokes: Stroke[];
  circles: Circle[];
  texts: SymText[];
  pins: SymPin[];
  /** everything, pins included */
  bbox: { x1: number; y1: number; x2: number; y2: number };
};

type Raw = { size: { w: number; h: number }; center: { x: number; y: number }; ports: { x: number; y: number; labels: string[] }[]; paths: { points: number[][]; fill?: boolean; closed?: boolean }[]; circles: { x: number; y: number; r: number; fill?: boolean }[] };
const RAW = DATA as unknown as Record<string, Raw>;

/** Our own drawings, in the package's units (y up), for the two shapes not taken from it. */
const OWN: Record<string, Raw> = {
  capacitor: {
    size: { w: 0.6, h: 0.5 },
    center: { x: 0, y: 0 },
    ports: [{ x: -0.3, y: 0, labels: ["1"] }, { x: 0.3, y: 0, labels: ["2"] }],
    paths: [
      { points: [[-0.3, 0], [-0.06, 0]] },
      { points: [[0.06, 0], [0.3, 0]] },
      { points: [[-0.06, -0.22], [-0.06, 0.22]] },
      { points: [[0.06, -0.22], [0.06, 0.22]] },
    ],
    circles: [],
  },
  motor: {
    size: { w: 1, h: 0.6 },
    center: { x: 0, y: 0 },
    ports: [{ x: -0.5, y: 0, labels: ["1", "pos"] }, { x: 0.5, y: 0, labels: ["2", "neg"] }],
    paths: [{ points: [[-0.5, 0], [-0.28, 0]] }, { points: [[0.28, 0], [0.5, 0]] }],
    circles: [{ x: 0, y: 0, r: 0.28 }],
  },
};

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const ALIASES: Record<string, string[]> = { "+": ["pos", "anode", "1"], "-": ["neg", "cathode", "2"], A: ["anode", "pos", "1"], K: ["cathode", "neg", "2"] };

function drawn(symbol: SymbolId, pins: Pin[]): SymbolLayout | null {
  const raw = RAW[symbol] ?? OWN[symbol];
  if (!raw || pins.length !== raw.ports.length) return null;
  const ox = raw.ports.reduce((a, p) => a + p.x, 0) / raw.ports.length;
  const oy = raw.ports.reduce((a, p) => a + p.y, 0) / raw.ports.length;
  const offs = raw.ports.flatMap((p) => [Math.abs(p.x - ox), Math.abs(p.y - oy)]).filter((v) => v > 1e-6);
  const k = HALF / Math.min(...offs);
  // package units are y up; ours are y down
  const tx = (x: number) => r4((x - ox) * k);
  const ty = (y: number) => r4(-(y - oy) * k);

  // which pin goes on which port: by label (pos, anode...), else in order
  const order: number[] = [];
  const free = new Set(raw.ports.map((_, i) => i));
  for (const pin of pins) {
    const want = [pin.name.toLowerCase(), ...(ALIASES[pin.name] ?? [])];
    const hit = [...free].find((i) => raw.ports[i].labels.some((l) => want.includes(l.toLowerCase())));
    const i = hit ?? [...free][0];
    order.push(i);
    free.delete(i);
  }
  const cx = raw.center.x;
  const cy = raw.center.y;
  const out: SymPin[] = pins.map((pin, j) => {
    const port = raw.ports[order[j]];
    const dx = port.x - cx;
    const dy = port.y - cy;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const px = tx(port.x);
    const py = ty(port.y);
    if (horizontal) {
      const left = dx < 0;
      return { name: pin.name, number: pin.number, x: r4(px + (left ? -GRID : GRID)), y: py, toward: left ? "right" : "left", length: GRID, side: left ? "left" : "right", pin };
    }
    const top = dy > 0; // y up in the package
    return { name: pin.name, number: pin.number, x: px, y: r4(py + (top ? -GRID : GRID)), toward: top ? "down" : "up", length: GRID, side: top ? "top" : "bottom", pin };
  });
  const strokes: Stroke[] = raw.paths.map((p) => ({ points: p.points.map(([x, y]) => [tx(x), ty(y)] as [number, number]), ...(p.fill ? { fill: true } : {}), ...(p.closed ? { closed: true } : {}) }));
  const circles: Circle[] = raw.circles.map((c) => ({ x: tx(c.x), y: ty(c.y), r: r4(c.r * k), ...(c.fill ? { fill: true } : {}) }));
  const texts: SymText[] = symbol === "motor" ? [{ x: tx(0), y: ty(0), text: "M", size: 1.27 }] : [];
  return { symbol, rect: null, strokes, circles, texts, pins: out, bbox: bboxOf(strokes, circles, out) };
}

function bboxOf(strokes: Stroke[], circles: Circle[], pins: SymPin[], rect?: SymbolLayout["rect"]) {
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (x: number, y: number) => {
    xs.push(x);
    ys.push(y);
  };
  for (const s of strokes) for (const [x, y] of s.points) add(x, y);
  for (const c of circles) {
    add(c.x - c.r, c.y - c.r);
    add(c.x + c.r, c.y + c.r);
  }
  for (const p of pins) add(p.x, p.y);
  if (rect) {
    add(rect.x1, rect.y1);
    add(rect.x2, rect.y2);
  }
  if (!xs.length) return { x1: -GRID, y1: -GRID, x2: GRID, y2: GRID };
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

/** A box: pins on four sides by their side, on the 2.54 mm grid, the body sized to fit their names. */
/**
 * Left and right for pins whose side is only the kind's default. A part with many such pins on one side (a
 * development board's two headers) would draw as a tall bar with every pin on the left; instead the pins go to
 * the side their position puts them on (each header to its own side), or, with no positions, the list is split
 * in two in its own order.
 */
export function balanceSides(pins: Pin[]): Pin[] {
  const loose = pins.filter((p) => !p.sideSet && (p.side === "left" || p.side === "right"));
  const left = loose.filter((p) => p.side === "left").length, right = loose.length - left;
  if (loose.length < 10 || Math.min(left, right) * 3 >= Math.max(left, right)) return pins;
  const placed = loose.filter((p) => p.position);
  let sideOf: (p: Pin, i: number) => Side;
  if (placed.length === loose.length) {
    // the axis the positions spread across most separates the headers
    const spread = (k: "x" | "y") => Math.max(...placed.map((p) => p.position![k])) - Math.min(...placed.map((p) => p.position![k]));
    const k = spread("y") > 0 && placed.some((p) => p.position!.y < 0) && placed.some((p) => p.position!.y > 0) ? "y" : "x";
    const mid = (Math.max(...placed.map((p) => p.position![k])) + Math.min(...placed.map((p) => p.position![k]))) / 2;
    if (spread(k) === 0) sideOf = (_p, i) => (i < loose.length / 2 ? "left" : "right");
    else sideOf = (p) => (p.position![k] <= mid ? "left" : "right");
  } else {
    sideOf = (_p, i) => (i < Math.ceil(loose.length / 2) ? "left" : "right");
  }
  const to = new Map(loose.map((p, i) => [p, sideOf(p, i)]));
  return pins.map((p) => (to.has(p) ? { ...p, side: to.get(p)! } : p));
}

function box(input: Pin[]): SymbolLayout {
  const pins = balanceSides(input);
  const by: Record<Side, Pin[]> = { left: [], right: [], top: [], bottom: [] };
  for (const p of pins) by[p.side].push(p);
  const rows = Math.max(by.left.length, by.right.length, 1);
  const cols = Math.max(by.top.length, by.bottom.length, 1);
  const longest = (xs: Pin[]) => Math.max(0, ...xs.map((p) => p.name.length));
  // room for pin names: about 1.0 mm per character at the 1.27 mm text size
  const nameRoom = (longest(by.left) + longest(by.right)) * 1.0 + 4;
  const hw = GRID * Math.max(2, Math.ceil(Math.max((cols + 1) * GRID, nameRoom) / 2 / GRID));
  const hh = GRID * Math.max(1, Math.ceil(((rows + 1) * GRID) / 2 / GRID) + (by.top.length || by.bottom.length ? 1 : 0));
  const along = (n: number, i: number) => r4((i - (n - 1) / 2) * GRID);
  const out: SymPin[] = [];
  by.left.forEach((p, i) => out.push({ name: p.name, number: p.number, x: -hw - GRID, y: along(by.left.length, i), toward: "right", length: GRID, side: "left", pin: p }));
  by.right.forEach((p, i) => out.push({ name: p.name, number: p.number, x: hw + GRID, y: along(by.right.length, i), toward: "left", length: GRID, side: "right", pin: p }));
  by.top.forEach((p, i) => out.push({ name: p.name, number: p.number, x: along(by.top.length, i), y: -hh - GRID, toward: "down", length: GRID, side: "top", pin: p }));
  by.bottom.forEach((p, i) => out.push({ name: p.name, number: p.number, x: along(by.bottom.length, i), y: hh + GRID, toward: "up", length: GRID, side: "bottom", pin: p }));
  const rect = { x1: -hw, y1: -hh, x2: hw, y2: hh };
  return { symbol: "box", rect, strokes: [], circles: [], texts: [], pins: out, bbox: bboxOf([], [], out, rect) };
}

/** The layout of a part's symbol: its drawing if one fits its pins, else a box. */
export function symbolLayout(symbol: SymbolId, pins: Pin[]): SymbolLayout {
  if (symbol !== "box") {
    const d = drawn(symbol, pins);
    if (d) return d;
  }
  return box(pins);
}

/** The power and ground flags of the symbol view, from the package's vcc and ground drawings. */
export function flagLayout(kind: "vcc" | "ground") {
  const raw = RAW[kind];
  const port = raw.ports[0];
  const k = HALF / 0.11;
  const tx = (x: number) => r4((x - port.x) * k);
  const ty = (y: number) => r4(-(y - port.y) * k);
  const strokes: Stroke[] = raw.paths.map((p) => ({ points: p.points.map(([x, y]) => [tx(x), ty(y)] as [number, number]), ...(p.fill ? { fill: true } : {}) }));
  return { strokes, bbox: bboxOf(strokes, [], []) };
}
