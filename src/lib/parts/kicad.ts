// KiCad schematic export (plan 5.5): one .kicad_sch sheet in the file format of KiCad 10
// (version 20260306, read from KiCad's eeschema/sch_file_versions.h on the 10.0 branch and the
// format pages at dev-docs.kicad.org). Only what can be checked is written:
//
// - every symbol is drawn from this app's own symbol layouts (src/lib/parts/symbols.ts) and embedded
//   in lib_symbols; nothing comes from KiCad's symbol library;
// - every wired pin gets a short wire and a local label carrying its net name, so pins with the same
//   label are one net; every unwired pin gets a no-connect flag;
// - the title block carries the concept, the revision and the date.
//
// tests/parts/kicad.test.ts reads the file back and rebuilds the nets from the coordinates alone.
import { pinKey, type Circuit, type CircuitPart } from "./circuit";
import type { PinKind } from "./kinds";
import { qs, write, type SNode } from "./sexpr";
import { GRID, symbolLayout, type SymbolLayout } from "./symbols";

export const KICAD_SCH_VERSION = "20260306";
export const KICAD_GENERATOR = "concept_to_realization";

export type KicadMeta = {
  title: string;
  revision: string;
  /** YYYY-MM-DD */
  date: string;
  company?: string;
  /** project name used in symbol instances; defaults to a slug of the title */
  project?: string;
  /** symbol positions in millimetres by reference; missing parts are placed on a grid */
  positions?: Record<string, { x: number; y: number }>;
};

const ELECTRICAL: Record<PinKind, string> = {
  power_in: "power_in",
  power_out: "power_out",
  ground: "power_in",
  input: "input",
  output: "output",
  bidirectional: "bidirectional",
  passive: "passive",
  no_connect: "no_connect",
};

const fmt = (n: number) => {
  const r = Math.round(n * 10000) / 10000;
  return Object.is(r, -0) ? "0" : String(r);
};
const snap = (v: number) => Math.round(v / GRID) * GRID;
const font = (size = 1.27): SNode => ["effects", ["font", ["size", fmt(size), fmt(size)]]];
const fontJ = (justify: string[], size = 1.27): SNode => ["effects", ["font", ["size", fmt(size), fmt(size)]], ["justify", ...justify]];
const stroke = (width = 0.254): SNode => ["stroke", ["width", fmt(width)], ["type", "default"]];
const fill = (type: "none" | "outline" | "background"): SNode => ["fill", ["type", type]];

/** Deterministic UUIDs (version 4 layout) from a seed string, so the same circuit writes the same file. */
export function uuidFrom(seed: string): string {
  const h = (salt: number) => {
    let x = 0x811c9dc5 ^ salt;
    for (let i = 0; i < seed.length; i++) {
      x ^= seed.charCodeAt(i);
      x = Math.imul(x, 0x01000193) >>> 0;
    }
    return (x >>> 0).toString(16).padStart(8, "0");
  };
  const hex = h(1) + h(2) + h(3) + h(4);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${"89ab"[parseInt(hex[16], 16) % 4]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const libName = (ref: string) => ref.replace(/[^A-Za-z0-9_-]/g, "_") || "PART";
const refPrefix = (ref: string) => ref.match(/^[A-Za-z]+/)?.[0] ?? "U";

type Placed = { part: CircuitPart; layout: SymbolLayout; at: { x: number; y: number }; name: string; numbers: string[] };

/** Unique pin numbers for one symbol: the stated number, or its position, never repeated. */
function pinNumbers(layout: SymbolLayout): string[] {
  const used = new Set<string>();
  return layout.pins.map((p, i) => {
    let n = (p.number || String(i + 1)).replace(/\s+/g, "");
    while (used.has(n)) n = `${n}_${i + 1}`;
    used.add(n);
    return n;
  });
}

function libSymbol(pl: Placed): SNode {
  const { layout, name, part } = pl;
  const body: SNode[] = [];
  if (layout.rect) {
    const r = layout.rect;
    // library coordinates are y up: negate
    body.push(["rectangle", ["start", fmt(r.x1), fmt(-r.y1)], ["end", fmt(r.x2), fmt(-r.y2)], stroke(), fill("background")]);
  }
  for (const s of layout.strokes) {
    body.push(["polyline", ["pts", ...s.points.map(([x, y]) => ["xy", fmt(x), fmt(-y)] as SNode)], stroke(), fill(s.fill ? "outline" : "none")]);
  }
  for (const c of layout.circles) body.push(["circle", ["center", fmt(c.x), fmt(-c.y)], ["radius", fmt(c.r)], stroke(), fill(c.fill ? "outline" : "none")]);
  for (const t of layout.texts) body.push(["text", qs(t.text), ["at", fmt(t.x), fmt(-t.y), "0"], font(t.size)]);
  const angle = { right: "0", left: "180", down: "270", up: "90" } as const;
  const pins: SNode[] = layout.pins.map((p, i) => [
    "pin",
    p.pin.kind ? ELECTRICAL[p.pin.kind] : "unspecified",
    "line",
    ["at", fmt(p.x), fmt(-p.y), angle[p.toward]],
    ["length", fmt(p.length)],
    ["name", qs(p.name), font()],
    ["number", qs(pl.numbers[i]), font()],
  ]);
  const top = layout.bbox.y1;
  const bottom = layout.bbox.y2;
  const drawn = layout.symbol !== "box";
  return [
    "symbol",
    qs(`C2R:${name}`),
    ...(drawn ? [["pin_names", ["offset", "0"], ["hide", "yes"]] as SNode, ["pin_numbers", ["hide", "yes"]] as SNode] : [["pin_names", ["offset", "1.016"]] as SNode]),
    ["exclude_from_sim", "no"],
    ["in_bom", "yes"],
    ["on_board", "yes"],
    ["property", qs("Reference"), qs(refPrefix(part.ref)), ["at", "0", fmt(-(top - 2.54)), "0"], font()],
    ["property", qs("Value"), qs(part.title || part.ref), ["at", "0", fmt(-(bottom + 2.54)), "0"], font()],
    ["property", qs("Footprint"), qs(""), ["at", "0", "0", "0"], ["hide", "yes"], font()],
    ["property", qs("Datasheet"), qs(""), ["at", "0", "0", "0"], ["hide", "yes"], font()],
    ["property", qs("Description"), qs(part.item.body || ""), ["at", "0", "0", "0"], ["hide", "yes"], font()],
    ["symbol", qs(`${name}_0_1`), ...body],
    ["symbol", qs(`${name}_1_1`), ...pins],
    ["embedded_fonts", "no"],
  ];
}

/** Where each pin's connection point lands on the sheet (schematic coordinates are y down, like ours). */
export function pinPoint(pl: { at: { x: number; y: number } }, p: { x: number; y: number }) {
  return { x: Math.round((pl.at.x + p.x) * 10000) / 10000, y: Math.round((pl.at.y + p.y) * 10000) / 10000 };
}

const PAPERS: [string, number, number][] = [
  ["A4", 297, 210],
  ["A3", 420, 297],
  ["A2", 594, 420],
  ["A1", 841, 594],
  ["A0", 1189, 841],
];

function place(c: Circuit, meta: KicadMeta): Placed[] {
  const out: Placed[] = [];
  // parts that are drawn: every part with pins (a mechanical part with none is left out)
  const drawn = c.parts.filter((p) => p.pins.length);
  let x = 25.4;
  let y = 25.4;
  let rowH = 0;
  for (const part of drawn) {
    const layout = symbolLayout(part.symbol, part.pins);
    const name = libName(part.ref);
    const numbers = pinNumbers(layout);
    const given = meta.positions?.[part.ref];
    if (given) {
      out.push({ part, layout, at: { x: snap(given.x), y: snap(given.y) }, name, numbers });
      continue;
    }
    // room for labels: the longest net name on the part, about 1.1 mm per character
    const labelRoom = Math.max(0, ...layout.pins.map((p) => (c.netOf.get(pinKey(part.ref, p.name))?.name.length ?? 0))) * 1.1 + GRID * 2;
    const w = layout.bbox.x2 - layout.bbox.x1 + labelRoom * 2;
    const h = layout.bbox.y2 - layout.bbox.y1 + GRID * 4;
    if (x + w > 380 && x > 25.4) {
      x = 25.4;
      y += rowH + GRID * 2;
      rowH = 0;
    }
    out.push({ part, layout, at: { x: snap(x - layout.bbox.x1 + labelRoom), y: snap(y - layout.bbox.y1 + GRID * 2) }, name, numbers });
    x += w + GRID * 2;
    rowH = Math.max(rowH, h);
  }
  return out;
}

/** The .kicad_sch text for a circuit. */
export function kicadSchematic(c: Circuit, meta: KicadMeta): string {
  const project = meta.project ?? (meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "concept");
  const root = uuidFrom(`root:${project}`);
  const placed = place(c, meta);
  const items: SNode[] = [];

  for (const pl of placed) {
    pl.layout.pins.forEach((p) => {
      const at = pinPoint(pl, p);
      const net = c.netOf.get(pinKey(pl.part.ref, p.name));
      const id = `${pl.part.ref}.${p.name}`;
      if (!net) {
        items.push(["no_connect", ["at", fmt(at.x), fmt(at.y)], ["uuid", qs(uuidFrom(`nc:${id}`))]]);
        return;
      }
      // a stub away from the body, and the net's label at its end
      const away = { right: [-1, 0], left: [1, 0], down: [0, -1], up: [0, 1] }[p.toward];
      const end = { x: at.x + away[0] * GRID, y: at.y + away[1] * GRID };
      items.push(["wire", ["pts", ["xy", fmt(at.x), fmt(at.y)], ["xy", fmt(end.x), fmt(end.y)]], ["stroke", ["width", "0"], ["type", "default"]], ["uuid", qs(uuidFrom(`w:${id}`))]]);
      const angle = away[0] < 0 ? "180" : away[0] > 0 ? "0" : away[1] < 0 ? "90" : "270";
      const justify = angle === "180" || angle === "270" ? ["right", "bottom"] : ["left", "bottom"];
      items.push(["label", qs(net.name), ["at", fmt(end.x), fmt(end.y), angle], fontJ(justify), ["uuid", qs(uuidFrom(`l:${id}`))]]);
    });
  }

  for (const pl of placed) {
    const { part, at, layout, name } = pl;
    const top = layout.bbox.y1;
    const bottom = layout.bbox.y2;
    items.push([
      "symbol",
      ["lib_id", qs(`C2R:${name}`)],
      ["at", fmt(at.x), fmt(at.y), "0"],
      ["unit", "1"],
      ["body_style", "1"],
      ["exclude_from_sim", "no"],
      ["in_bom", "yes"],
      ["on_board", "yes"],
      ["in_pos_files", "yes"],
      ["dnp", "no"],
      ["uuid", qs(uuidFrom(`s:${part.ref}`))],
      ["property", qs("Reference"), qs(part.ref), ["at", fmt(at.x), fmt(at.y + top - 2.54), "0"], font()],
      ["property", qs("Value"), qs(part.title || part.ref), ["at", fmt(at.x), fmt(at.y + bottom + 2.54), "0"], font()],
      ["property", qs("Footprint"), qs(""), ["at", fmt(at.x), fmt(at.y), "0"], ["hide", "yes"], font()],
      ["property", qs("Datasheet"), qs(""), ["at", fmt(at.x), fmt(at.y), "0"], ["hide", "yes"], font()],
      ["property", qs("Description"), qs(part.item.body || ""), ["at", fmt(at.x), fmt(at.y), "0"], ["hide", "yes"], font()],
      ...pl.numbers.map((n) => ["pin", qs(n), ["uuid", qs(uuidFrom(`p:${part.ref}:${n}`))]] as SNode),
      ["instances", ["project", qs(project), ["path", qs(`/${root}`), ["reference", qs(part.ref)], ["unit", "1"]]]],
    ]);
  }

  // paper: the smallest A size that holds everything
  const xs = placed.flatMap((p) => [p.at.x + p.layout.bbox.x2, p.at.x + p.layout.bbox.x1]);
  const ys = placed.flatMap((p) => [p.at.y + p.layout.bbox.y2, p.at.y + p.layout.bbox.y1]);
  const needW = (xs.length ? Math.max(...xs) : 0) + 60;
  const needH = (ys.length ? Math.max(...ys) : 0) + 50;
  const paper = PAPERS.find(([, w, h]) => w >= needW && h >= needH);

  const doc: SNode = [
    "kicad_sch",
    ["version", KICAD_SCH_VERSION],
    ["generator", qs(KICAD_GENERATOR)],
    ["generator_version", qs("0.1")],
    ["uuid", qs(root)],
    paper ? ["paper", qs(paper[0])] : ["paper", qs("User"), fmt(Math.ceil(needW)), fmt(Math.ceil(needH))],
    [
      "title_block",
      ["title", qs(meta.title)],
      ["date", qs(meta.date)],
      ["rev", qs(meta.revision)],
      ...(meta.company ? [["company", qs(meta.company)] as SNode] : []),
      ["comment", "1", qs("Exported from the concept to realization workbench. Symbols are the workbench's own drawings.")],
    ],
    ["lib_symbols", ...placed.map(libSymbol)],
    ...items,
    ["sheet_instances", ["path", qs("/"), ["page", qs("1")]]],
    ["embedded_fonts", "no"],
  ];
  return write(doc) + "\n";
}
