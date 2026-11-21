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
// tests/parts/kicad.test.ts reads the file back and rebuilds the nets from the coordinates alone;
// tests/parts/kicad-format.test.ts compares every node with a schematic KiCad 10 wrote itself, and the
// layout below (property flags, pin_numbers before pin_names, sheet items grouped by type) follows
// KiCad 10's own writer so a re-save in KiCad does not reorder the file.
import { pinKey, type Circuit, type CircuitPart } from "./circuit";
import type { PinKind } from "./kinds";
import { qs, write, type SNode } from "./sexpr";
import { GRID, symbolLayout, type SymbolLayout } from "./symbols";
import { slugify } from "@/lib/format";

export const KICAD_SCH_VERSION = "20260306";
const KICAD_GENERATOR = "concept_to_realization";

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
function uuidFrom(seed: string): string {
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

// Property layout as KiCad 10 writes it (format 20251028: show_name and do_not_autoplace always written).
// In a library symbol: at, show_name, do_not_autoplace, hide, effects (SCH_IO_KICAD_SEXPR_LIB_CACHE::saveField).
const libProperty = (name: string, value: string, x: number, y: number, hide = false): SNode => [
  "property",
  qs(name),
  qs(value),
  ["at", fmt(x), fmt(y), "0"],
  ["show_name", "no"],
  ["do_not_autoplace", "no"],
  ...(hide ? [["hide", "yes"] as SNode] : []),
  font(),
];
// On a placed symbol: at, hide, show_name, do_not_autoplace, effects (SCH_IO_KICAD_SEXPR::saveField).
const schProperty = (name: string, value: string, x: number, y: number, hide = false): SNode => [
  "property",
  qs(name),
  qs(value),
  ["at", fmt(x), fmt(y), "0"],
  ...(hide ? [["hide", "yes"] as SNode] : []),
  ["show_name", "no"],
  ["do_not_autoplace", "no"],
  font(),
];

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
    // KiCad 10's writer puts pin_numbers before pin_names (sch_io_kicad_sexpr_lib_cache.cpp, SaveSymbol)
    ...(drawn ? [["pin_numbers", ["hide", "yes"]] as SNode, ["pin_names", ["offset", "0"], ["hide", "yes"]] as SNode] : [["pin_names", ["offset", "1.016"]] as SNode]),
    ["exclude_from_sim", "no"],
    ["in_bom", "yes"],
    ["on_board", "yes"],
    ["in_pos_files", "yes"],
    ["duplicate_pin_numbers_are_jumpers", "no"],
    libProperty("Reference", refPrefix(part.ref), 0, -(top - 2.54)),
    libProperty("Value", part.title || part.ref, 0, -(bottom + 2.54)),
    libProperty("Footprint", "", 0, 0, true),
    libProperty("Datasheet", "", 0, 0, true),
    libProperty("Description", part.item.body || "", 0, 0, true),
    ["symbol", qs(`${name}_0_1`), ...body],
    ["symbol", qs(`${name}_1_1`), ...pins],
    ["embedded_fonts", "no"],
  ];
}

/** Where each pin's connection point lands on the sheet (schematic coordinates are y down, like ours). */
function pinPoint(pl: { at: { x: number; y: number } }, p: { x: number; y: number }) {
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
  // keep everything on the sheet: the top-left symbol starts one inch in, room left for its labels
  if (out.length) {
    const minX = Math.min(...out.map((p) => p.at.x + p.layout.bbox.x1));
    const minY = Math.min(...out.map((p) => p.at.y + p.layout.bbox.y1));
    const dx = snap(38.1 - minX);
    const dy = snap(25.4 - minY);
    for (const p of out) p.at = { x: p.at.x + dx, y: p.at.y + dy };
  }
  return out;
}

/** The uuid of a sheet item (its direct `(uuid "...")` child). */
const uuidOf = (n: SNode): string => {
  const u = Array.isArray(n) ? n.find((x) => Array.isArray(x) && x[0] === "uuid") : undefined;
  const v = Array.isArray(u) ? u[1] : undefined;
  return v && typeof v === "object" && !Array.isArray(v) ? v.q : "";
};
const byUuid = (xs: SNode[]) => [...xs].sort((a, b) => (uuidOf(a) < uuidOf(b) ? -1 : uuidOf(a) > uuidOf(b) ? 1 : 0));

/** The .kicad_sch text for a circuit. */
export function kicadSchematic(c: Circuit, meta: KicadMeta): string {
  const project = meta.project ?? slugify(meta.title, { max: Infinity, fallback: "concept" });
  const root = uuidFrom(`root:${project}`);
  const placed = place(c, meta);
  // KiCad 10 saves sheet items grouped by type (no_connect, then wires, then labels, then symbols:
  // the order of KICAD_T), each group sorted by uuid (SCH_IO_KICAD_SEXPR::Format). The parser takes
  // any order; writing KiCad's own keeps a re-save by KiCad free of reordering noise.
  const noConnects: SNode[] = [];
  const wires: SNode[] = [];
  const labels: SNode[] = [];
  const symbols: SNode[] = [];

  for (const pl of placed) {
    pl.layout.pins.forEach((p) => {
      const at = pinPoint(pl, p);
      const net = c.netOf.get(pinKey(pl.part.ref, p.name));
      const id = `${pl.part.ref}.${p.name}`;
      if (!net) {
        noConnects.push(["no_connect", ["at", fmt(at.x), fmt(at.y)], ["uuid", qs(uuidFrom(`nc:${id}`))]]);
        return;
      }
      // a stub away from the body, and the net's label at its end
      const away = { right: [-1, 0], left: [1, 0], down: [0, -1], up: [0, 1] }[p.toward];
      const end = { x: at.x + away[0] * GRID, y: at.y + away[1] * GRID };
      wires.push(["wire", ["pts", ["xy", fmt(at.x), fmt(at.y)], ["xy", fmt(end.x), fmt(end.y)]], ["stroke", ["width", "0"], ["type", "default"]], ["uuid", qs(uuidFrom(`w:${id}`))]]);
      const angle = away[0] < 0 ? "180" : away[0] > 0 ? "0" : away[1] < 0 ? "90" : "270";
      const justify = angle === "180" || angle === "270" ? ["right", "bottom"] : ["left", "bottom"];
      labels.push(["label", qs(net.name), ["at", fmt(end.x), fmt(end.y), angle], fontJ(justify), ["uuid", qs(uuidFrom(`l:${id}`))]]);
    });
  }

  for (const pl of placed) {
    const { part, at, layout, name } = pl;
    const top = layout.bbox.y1;
    const bottom = layout.bbox.y2;
    symbols.push([
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
      schProperty("Reference", part.ref, at.x, at.y + top - 2.54),
      schProperty("Value", part.title || part.ref, at.x, at.y + bottom + 2.54),
      schProperty("Footprint", "", at.x, at.y, true),
      schProperty("Datasheet", "", at.x, at.y, true),
      schProperty("Description", part.item.body || "", at.x, at.y, true),
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
    ...byUuid(noConnects),
    ...byUuid(wires),
    ...byUuid(labels),
    ...byUuid(symbols),
    ["sheet_instances", ["path", qs("/"), ["page", qs("1")]]],
    ["embedded_fonts", "no"],
  ];
  return write(doc) + "\n";
}
