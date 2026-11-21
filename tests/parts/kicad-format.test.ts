// Our .kicad_sch export compared, node by node, with a schematic KiCad 10 itself wrote.
//
// The reference is tests/parts/fixtures/kicad/complex_hierarchy.kicad_sch: KiCad's own demo
// demos/complex_hierarchy/complex_hierarchy.kicad_sch at tag 10.0.8 (file version 20260306,
// generator "eeschema" 10.0), CC BY-SA 4.0 per KiCad's LICENSE.README; see the README beside it.
// Where the demo does not contain a construct our export uses, the supplement below adds exactly
// what KiCad's parser accepts there, citing eeschema/sch_io/kicad_sexpr/sch_io_kicad_sexpr_parser.cpp
// at tag 10.0.8 by function and line.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCircuit } from "@/lib/parts/circuit";
import { KICAD_SCH_VERSION, kicadSchematic } from "@/lib/parts/kicad";
import { child, children, parse, text, type SNode } from "@/lib/parts/sexpr";
import { compareShape, shapeModel, supplement, type AtomForm, type Supplement } from "./kicadShape";
import { part, pinsFor, seeded, wire } from "./fixtures";

const REFERENCE = readFileSync(join(__dirname, "fixtures/kicad/complex_hierarchy.kicad_sch"), "utf8");
const META = { title: "Example concept", revision: "A", date: "2026-11-21", company: "Example company", project: "example" };

const kw = (...xs: string[]) => xs.map((x) => `keyword:${x}` as AtomForm);
const PIN = "kicad_sch/lib_symbols/symbol/symbol/pin";
const SUPPLEMENT: Supplement[] = [
  { path: "kicad_sch/title_block", children: ["rev", "company", "comment"], cite: "parseTITLE_BLOCK, lines 2179-2280: title, date, rev, company, comment 1 to 9" },
  { path: "kicad_sch/title_block/rev", atoms: { 0: ["string"] }, cite: "parseTITLE_BLOCK: NextTok then FromUTF8" },
  { path: "kicad_sch/title_block/company", atoms: { 0: ["string"] }, cite: "parseTITLE_BLOCK: NextTok then FromUTF8" },
  { path: "kicad_sch/title_block/comment", atoms: { 0: ["number"], 1: ["string"] }, cite: "parseTITLE_BLOCK: parseInt(\"comment\") 1 to 9, then the text" },
  {
    path: PIN,
    atoms: {
      0: kw("input", "output", "bidirectional", "tri_state", "passive", "unspecified", "power_in", "power_out", "open_collector", "open_emitter", "free", "no_connect"),
      1: kw("line", "inverted", "clock", "inverted_clock", "input_low", "clock_low", "output_low", "edge_clock_high", "non_logic"),
    },
    cite: "parseSymbolPin, lines 1587-1650: parseType and parseShape keyword lists",
  },
  {
    path: "kicad_sch/lib_symbols/symbol/symbol",
    children: ["rectangle", "polyline", "circle", "text", "pin"],
    // KiCad's own files show both (polyline)(circle) and (circle)(polyline): the writer sorts drawings by
    // content (SCH_IO_KICAD_SEXPR_LIB_CACHE::SaveSymbol, "Enforce item ordering"), not by kind
    unordered: ["arc", "bezier", "circle", "polyline", "rectangle", "text", "text_box"],
    cite: "parseLibSymbol unit sub-symbol, lines 571-588: arc, bezier, circle, pin, polyline, rectangle, text, text_box in any order",
  },
  { path: "kicad_sch/lib_symbols/symbol/symbol/text", children: ["at", "effects"], atoms: { 0: ["string"] }, cite: "parseSymbolText, lines 1944-2000: a string, then at and effects" },
  { path: "kicad_sch/lib_symbols/symbol/symbol/text/at", atoms: { 0: ["number"], 1: ["number"], 2: ["number"] }, cite: "parseSymbolText: parseXY then the angle in tenths of a degree" },
  { path: "kicad_sch/lib_symbols/symbol/symbol/text/effects", children: ["font"], cite: "parseEDA_TEXT, lines 768-904" },
  { path: "kicad_sch/lib_symbols/symbol/symbol/text/effects/font", children: ["size"], cite: "parseEDA_TEXT" },
  { path: "kicad_sch/lib_symbols/symbol/symbol/text/effects/font/size", atoms: { 0: ["number"], 1: ["number"] }, cite: "parseEDA_TEXT: size height width" },
  ...["rectangle", "polyline", "circle"].map((s) => ({
    path: `kicad_sch/lib_symbols/symbol/symbol/${s}/fill/type`,
    atoms: { 0: kw("none", "outline", "background", "color", "hatch", "reverse_hatch", "cross_hatch") },
    cite: "parseFill, lines 709-766: fill type keywords",
  })),
  ...["kicad_sch/wire/stroke/type", "kicad_sch/lib_symbols/symbol/symbol/rectangle/stroke/type", "kicad_sch/lib_symbols/symbol/symbol/polyline/stroke/type", "kicad_sch/lib_symbols/symbol/symbol/circle/stroke/type"].map((path) => ({
    path,
    atoms: { 0: kw("default", "solid", "dash", "dot", "dash_dot", "dash_dot_dot") },
    cite: "common/stroke_params.cpp STROKE_PARAMS_PARSER::ParseStroke, lines 395-409 (KiCad 10's own wires are written (type default), e.g. qa/data/eeschema/issue25406/meter.kicad_sch)",
  })),
  { path: "kicad_sch/label/effects/justify", atoms: { 0: kw("left", "right", "top", "bottom"), 1: kw("left", "right", "top", "bottom") }, cite: "parseEDA_TEXT justify, lines 848-862" },
];

const model = () => supplement(shapeModel(REFERENCE), SUPPLEMENT);

/** A circuit that uses every drawn symbol, a box, an unwired pin, and every pin kind. */
function everyKind() {
  const { parts, wires } = seeded();
  const own = part("U9", {}, "Odd \"quoted\" part\nsecond line");
  const pins = pinsFor(own, [
    { name: "IN", kind: "input" },
    { name: "OUT", kind: "output" },
    { name: "IO", kind: "bidirectional" },
    { name: "PWR", kind: "power_out" },
    { name: "NC", kind: "no_connect" },
    { name: "GND", kind: "ground" },
    { name: "P", kind: "passive" },
  ]);
  return buildCircuit([...parts, own], [...wires, wire("U9", "GND", "U1", "GND")], pins);
}

describe("KiCad export compared with a file KiCad 10 wrote", () => {
  it("the reference really is a KiCad 10 file of the version we write", () => {
    const doc = parse(REFERENCE) as SNode[];
    expect(child(doc, "version")![1]).toBe(KICAD_SCH_VERSION);
    expect(text(child(doc, "generator")![1])).toBe("eeschema");
    expect(text(child(doc, "generator_version")![1])).toBe("10.0");
  });

  it("the comparison passes the reference against itself and catches a planted difference", () => {
    expect(compareShape(model(), REFERENCE)).toEqual([]);
    const src = kicadSchematic(everyKind(), META);
    // an unknown token, a number with an exponent, and a property before the pin flags
    const planted = src
      .replace("(in_bom yes)", "(in_bom yes)\n\t\t(not_a_kicad_token yes)")
      .replace("(size 1.27 1.27)", "(size 1.27e0 1.27)")
      .replace(/(\t\t\t\(exclude_from_sim no\)\n)/, "$1\t\t\t(property \"X\" \"\" (at 0 0 0) (effects (font (size 1.27 1.27))))\n");
    const problems = compareShape(model(), planted);
    expect(problems.some((p) => p.includes("not_a_kicad_token"))).toBe(true);
    expect(problems.some((p) => p.includes("1.27e0"))).toBe(true);
    expect(problems.some((p) => p.includes("comes before"))).toBe(true);
  });

  it("every node our export writes uses only tokens, child order and value forms KiCad's own file shows", () => {
    for (const src of [kicadSchematic(everyKind(), META), kicadSchematic(buildCircuit(seeded().parts, seeded().wires, []), { ...META, company: undefined })]) {
      expect(compareShape(model(), src)).toEqual([]);
    }
  });

  it("follows the parser's naming rules for library symbols, units and placed symbols", () => {
    const doc = parse(kicadSchematic(everyKind(), META)) as SNode[];
    const libs = children(child(doc, "lib_symbols")!, "symbol");
    const names = new Set(libs.map((s) => text(s[1])));
    for (const s of libs) {
      const id = text(s[1]);
      // parseLibSymbol, lines 340-365: the name is a LIB_ID; nickname and item name are split on ':'
      expect(id).toMatch(/^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
      const item = id.split(":")[1];
      // parseLibSymbol, lines 521-560: unit names start with the item name, then _<unit>_<body style>
      for (const u of children(s, "symbol")) expect(text(u[1])).toMatch(new RegExp(`^${item}_\\d+_\\d+$`));
      const pins = children(s, "symbol").flatMap((u) => children(u, "pin"));
      for (const p of pins) expect(["0", "90", "180", "270"]).toContain(child(p, "at")![3]);
      const numbers = pins.map((p) => text(child(p, "number")![1]));
      // every placed symbol of this lib symbol lists exactly its pin numbers
      for (const placed of children(doc, "symbol").filter((x) => text(child(x, "lib_id")![1]) === id)) {
        expect(children(placed, "pin").map((p) => text(p[1])).sort()).toEqual([...numbers].sort());
      }
    }
    for (const placed of children(doc, "symbol")) {
      expect(names).toContain(text(child(placed, "lib_id")![1]));
      // parseSchematicSymbol instances, lines 3260-3300: project, then path, then reference and unit
      const path = child(child(child(placed, "instances")!, "project")!, "path")!;
      expect(text(path[1])).toBe(`/${text(child(doc, "uuid")![1])}`);
    }
    // a root sheet carries its own instance (parseSchSheetInstances) and the embedded fonts flag
    const si = child(doc, "sheet_instances")!;
    expect(text(child(si, "path")![1])).toBe("/");
    expect(text(child(child(si, "path")!, "page")![1])).toBe("1");
    expect(child(doc, "embedded_fonts")![1]).toBe("no");
  });

  it("orders sheet items as KiCad's writer does: no_connect, wire, label, symbol, each by uuid", () => {
    const doc = parse(kicadSchematic(everyKind(), META)) as SNode[];
    const kinds = doc.filter((n): n is SNode[] => Array.isArray(n) && ["no_connect", "wire", "label", "symbol"].includes(n[0] as string));
    const rank = { no_connect: 0, wire: 1, label: 2, symbol: 3 } as Record<string, number>;
    for (let i = 1; i < kinds.length; i++) {
      const a = kinds[i - 1];
      const b = kinds[i];
      expect(rank[a[0] as string]).toBeLessThanOrEqual(rank[b[0] as string]);
      if (a[0] === b[0]) expect(text(child(a, "uuid")![1]) < text(child(b, "uuid")![1])).toBe(true);
    }
  });
});
