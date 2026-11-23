// The worked example as a product you can take apart: every row of its parts list as a part of the tag, with what
// it does, its size, its cost and the nets that join it to other parts. Worked out on the server from the example's
// own rows (the parts list and the schematic's wires) and handed to the page as plain values; pure, and tested in
// tests/welcome/product-model.test.ts. Nothing is typed in here but how a kind of part is drawn.
//
// Where a part sits:
//  - "row": the part's own layout row gives its size and place (the example's Physical layout frame, turned into the
//    tag's own: x across the front, y up the tag, z through it with the front at +z);
//  - "design": the printed pieces the design's dimensioned sheet places (tagShape.ts: the doors, the back plate);
//  - "illustrative": the board's components, which have no layout rows yet. They are set out on the board's back
//    in the order of the parts list, each at the size its row states or its package class has. The viewer says so.
import type { Item } from "@/lib/types";
import { toPart } from "@/lib/domain";
import { toWires } from "@/components/buildsheet/derive";
import { cylinderAxis } from "@/components/three/layout";
import { FACE, TAG_MM } from "../scenes/film/tagShape";
import type { NetClassName } from "../get/heroArt";

export type V3 = [number, number, number];
/** How a part is drawn (product/build.ts): its geometry and its material. */
type PartLook = "shell" | "plate" | "trackerDoor" | "coinDoor" | "strap" | "board" | "cell" | "supercap" | "speaker" | "gasket" | "tracker" | "switch" | "button" | "spring" | "chip" | "passive";
export type PartGroup = "enclosure" | "board" | "power" | "audio" | "controls";
export const PART_GROUPS: PartGroup[] = ["enclosure", "board", "power", "audio", "controls"];


export type PartBody = { shape: "box" | "cylinder" | "design"; /** box: x, y, z; cylinder: diameter, length */ size: number[]; axis: "x" | "y" | "z"; at: V3 };
export type ProductPart = {
  ref: string;
  title: string;
  group: PartGroup;
  look: PartLook;
  /** the first sentence of the row's own text */
  does: string;
  spec: string;
  cost: string;
  costAt: string;
  source: string;
  qty: number | null;
  /** null: a row with no body of its own in the tag (a service, a line of small parts) */
  body: PartBody | null;
  placed: "row" | "design" | "illustrative" | null;
  /** where it goes when the tag is pulled apart, in mm */
  out: V3;
  nets: { net: string; netClass: NetClassName; to: string[] }[];
};
export type Product = { parts: ProductPart[]; size: { w: number; h: number; t: number }; illustrative: number };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const r2 = (n: number) => Math.round(n * 100) / 100;
const T = TAG_MM.t;
/** The example's layout frame (x across, y up from the back plate, z along with the strap at -z) to the tag's. */
const toTag = ([x, y, z]: number[]): V3 => [r2(x!), r2(-z!), r2(y! - T / 2)];
const turn = ([x, y, z]: number[]): V3 => [r2(x!), r2(-z!), r2(y!)];
const AXIS = { x: "x", y: "z", z: "y" } as const;

const LOOK_BY_REF: Record<string, PartLook> = { ENC1: "shell", ENC2: "plate", ENC3: "trackerDoor", ENC4: "coinDoor", STR1: "strap", BAT: "cell", TRK: "tracker", GSK: "gasket", BT1: "spring" };
const LOOK_BY_KIND: Record<string, PartLook> = { "circuit board": "board", speaker: "speaker", switch: "switch", button: "button", resistor: "passive", capacitor: "passive", generic: "passive" };
function lookOf(ref: string, kind: string, shaped: boolean): PartLook {
  if (LOOK_BY_REF[ref]) return LOOK_BY_REF[ref];
  if (kind === "capacitor" && shaped) return "supercap";
  return LOOK_BY_KIND[kind] ?? "chip";
}

/** A size the row's own text states ("6 x 6 mm", "2.5 x 3 x 0.83 mm"), else the size of its package class. */
function boardSize(text: string, look: PartLook, kind: string): V3 {
  const m = /(\d+(?:\.\d+)?) x (\d+(?:\.\d+)?)(?: x (\d+(?:\.\d+)?))?(?= mm|\))/.exec(text);
  if (m && Number(m[1]) <= 8 && Number(m[2]) <= 8) return [Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : 0.85];
  if (look === "spring") return [5, 5, 1.6];
  if (kind === "resistor") return [1, 0.5, 0.35];
  if (kind === "capacitor") return [1.6, 0.8, 0.8];
  if (kind === "regulator") return [2, 2, 0.8];
  if (look === "chip") return [3, 3, 0.8];
  return [2, 1.6, 0.9];
}

const money = (n: number) => `$${n.toFixed(2)}`;

export function productOf(partItems: Item[], wireItems: Item[]): Product {
  const rows = partItems.map(toPart).filter((p) => p.ref);
  const wires = toWires(wireItems);
  const shaped = new Map(rows.filter((p) => p.geometry).map((p) => [p.ref, p.geometry!]));
  const board = shaped.get("PCB1");
  const cell = shaped.get("BAT");
  const speaker = shaped.get("SPK1");
  const shell = [...shaped.values()].find((g) => g.shape === "shell");

  // the board's components, set out on its back in rows, largest first within the order of the parts list
  // (the board's own row names its components; a row that is only inside the board, as its assembly is, has no body)
  const boardRow = rows.find((p) => p.geometry === board);
  const named = Array.isArray(boardRow?.item.data.components) ? (boardRow.item.data.components as unknown[]).map(String) : null;
  const onBoard = rows.filter((p) => !p.geometry && (named ? named.includes(p.ref) : str(p.item.data.insideOf) === boardRow?.ref));
  const spots = new Map<string, PartBody>();
  if (board) {
    const [bw, , bl] = board.size as [number, number, number];
    const c = toTag(board.pos);
    const margin = 1.6;
    const gap = 1.1;
    let x = -bw / 2 + margin;
    let y = bl / 2 - margin;
    let rowH = 0;
    const order = [...onBoard].sort((a, b) => {
      const sa = boardSize(a.spec, lookOf(a.ref, str(a.item.data.kind), false), str(a.item.data.kind));
      const sb = boardSize(b.spec, lookOf(b.ref, str(b.item.data.kind), false), str(b.item.data.kind));
      return sb[0] * sb[1] - sa[0] * sa[1];
    });
    for (const p of order) {
      const kind = str(p.item.data.kind);
      const look = lookOf(p.ref, kind, false);
      const s = boardSize(p.spec, look, kind);
      if (look === "spring") {
        // the cell's contacts stand on the board's front, under the cell
        if (cell) spots.set(p.ref, { shape: "box", size: s, axis: "z", at: [toTag(cell.pos)[0], toTag(cell.pos)[1], r2(c[2] + (board.size[1] ?? 0.8) / 2 + s[2] / 2)] });
        continue;
      }
      if (x + s[0] > bw / 2 - margin) {
        x = -bw / 2 + margin;
        y -= rowH + gap;
        rowH = 0;
      }
      spots.set(p.ref, { shape: "box", size: s, axis: "z", at: [r2(c[0] + x + s[0] / 2), r2(c[1] + y - s[1] / 2), r2(c[2] - (board.size[1] ?? 0.8) / 2 - s[2] / 2)] });
      x += s[0] + gap;
      rowH = Math.max(rowH, s[1]);
    }
  }
  const boardOut = board ? turn(board.explode) : ([0, 0, -12] as V3);
  const far = { front: Math.max(0, ...[...shaped.values()].map((g) => turn(g.explode)[2])), back: Math.min(0, ...[...shaped.values()].map((g) => turn(g.explode)[2])) };

  const netsOf = (ref: string) => {
    const by = new Map<string, { net: string; netClass: NetClassName; to: string[] }>();
    for (const w of wires) {
      if (w.from !== ref && w.to !== ref) continue;
      const other = w.from === ref ? w.to : w.from;
      const n = by.get(w.net) ?? { net: w.net, netClass: w.netClass as NetClassName, to: [] };
      if (other !== ref && !n.to.includes(other)) n.to.push(other);
      by.set(w.net, n);
    }
    return [...by.values()].filter((n) => n.to.length > 0);
  };

  const parts: ProductPart[] = rows.map((p) => {
    const kind = str(p.item.data.kind);
    const g = p.geometry;
    const look = lookOf(p.ref, kind, !!g);
    let body: PartBody | null = null;
    let placed: ProductPart["placed"] = null;
    let out: V3 = [0, 0, 0];
    if (look === "shell" && g) {
      body = { shape: "design", size: [g.size[0]!, g.size[2]!, g.size[1]!], axis: "z", at: [0, 0, 0] };
      placed = "row";
      out = [0, 0, far.front + 12];
    } else if (look === "strap" && g) {
      body = { shape: "design", size: [g.size[0]!, g.size[2]!, g.size[1]!], axis: "y", at: [0, TAG_MM.h / 2, 0] };
      placed = "row";
      out = turn(g.explode);
    } else if (g) {
      const axis = g.shape === "cylinder" ? AXIS[cylinderAxis(g)] : "z";
      body = { shape: g.shape === "cylinder" ? "cylinder" : "box", size: g.shape === "cylinder" ? [g.size[0]!, g.size[1]!] : [g.size[0]!, g.size[2]!, g.size[1]!], axis, at: toTag(g.pos) };
      placed = "row";
      out = turn(g.explode);
    } else if (spots.has(p.ref)) {
      body = spots.get(p.ref)!;
      placed = "illustrative";
      out = boardOut;
    } else if (look === "plate" && shell) {
      const pl = FACE.plate;
      body = { shape: "design", size: [pl.x1 - pl.x0, pl.y1 - pl.y0, 2], axis: "z", at: [0, (pl.y0 + pl.y1) / 2, -T / 2 + 1] };
      placed = "design";
      out = [0, 0, far.back - 12];
    } else if (look === "trackerDoor" && shell) {
      // FACE gives the back's places as seen from the back: mirrored here, as seen from the front
      body = { shape: "design", size: [FACE.tracker.r * 2, 2], axis: "z", at: [-FACE.tracker.x, FACE.tracker.y, -T / 2 + 1] };
      placed = "design";
      out = [0, 0, far.back - 26];
    } else if (look === "coinDoor" && shell) {
      body = { shape: "design", size: [FACE.door.r * 2, 1.6], axis: "z", at: [FACE.door.x, FACE.door.y, T / 2 - 0.8] };
      placed = "design";
      out = [0, 0, far.front + 26];
    } else if (look === "gasket" && speaker) {
      const at = toTag(speaker.pos);
      body = { shape: "cylinder", size: [speaker.size[0]!, 0.5], axis: "z", at: [at[0], at[1], r2(at[2] + speaker.size[1]! / 2 + 0.25)] };
      placed = "design";
      out = [0, 0, turn(speaker.explode)[2] + 6];
    }
    const nets = netsOf(p.ref);
    const breaks = Array.isArray(p.item.data.priceBreaks) ? (p.item.data.priceBreaks as { qty?: number; unit?: number }[]) : [];
    const last = breaks.at(-1);
    const size = !body || placed === "illustrative" ? "" : body.shape === "cylinder" ? `${body.size[0]} mm across, ${body.size[1]} mm deep` : look === "trackerDoor" || look === "coinDoor" ? `${body.size[0]} mm across` : `${body.size[0]} x ${body.size[1]} x ${body.size[2]} mm`;
    return {
      ref: p.ref,
      title: p.title,
      group: groupOf(look, kind, nets),
      look,
      does: (p.spec.split(/(?<=[.!?])\s+(?=[A-Z"])/)[0] ?? "").trim(),
      spec: size,
      cost: p.line !== null && p.line > 0 ? money(p.line) : "",
      costAt: last && typeof last.unit === "number" && typeof last.qty === "number" && last.unit > 0 && last.qty > 1 ? `${money(last.unit * Math.max(1, p.qty ?? 1))} at ${last.qty}` : "",
      source: p.source,
      qty: p.qty,
      body,
      placed,
      out,
      nets,
    };
  });
  return { parts, size: { w: TAG_MM.w, h: TAG_MM.h, t: T }, illustrative: parts.filter((p) => p.placed === "illustrative").length };
}

function groupOf(look: PartLook, kind: string, nets: ProductPart["nets"]): PartGroup {
  if (["shell", "plate", "trackerDoor", "coinDoor", "strap", "tracker", "gasket"].includes(look)) return "enclosure";
  if (look === "switch" || look === "button") return "controls";
  if (look === "speaker" || nets.some((n) => n.netClass === "audio")) return "audio";
  if (look === "cell" || look === "spring" || look === "supercap" || kind === "regulator" || kind === "battery") return "power";
  if (look !== "board" && look !== "chip" && nets.length > 0 && nets.every((n) => n.netClass === "power" || n.netClass === "ground")) return "power";
  return "board";
}
