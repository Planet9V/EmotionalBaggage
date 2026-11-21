import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCircuit, pinLabel } from "@/lib/parts/circuit";
import { KICAD_SCH_VERSION, kicadSchematic } from "@/lib/parts/kicad";
import { child, children, num, parse, text, type SNode } from "@/lib/parts/sexpr";
import { part, pinsFor, seeded, wire } from "./fixtures";

const META = { title: "Example concept", revision: "A", date: "2026-11-21" };

/**
 * Reads a .kicad_sch back and works out its nets from coordinates alone: a pin's connection point
 * (symbol position plus the library pin's position, library y up), wire end points, and local
 * labels (same text, same net). Returns each net as sorted "REF.PIN" strings.
 */
function netsFromFile(src: string) {
  const doc = parse(src) as SNode[];
  const lib = new Map<string, { name: string; number: string; x: number; y: number }[]>();
  for (const s of children(child(doc, "lib_symbols")!, "symbol")) {
    const pins = children(s, "symbol").flatMap((u) => children(u, "pin")).map((p) => {
      const at = child(p, "at")!;
      return { name: text(child(p, "name")![1]), number: text(child(p, "number")![1]), x: num(at[1]), y: num(at[2]) };
    });
    lib.set(text(s[1]), pins);
  }
  const key = (x: number, y: number) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    if (!parent.has(k)) parent.set(k, k);
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  const join2 = (a: string, b: string) => parent.set(find(a), find(b));
  const pinAt = new Map<string, string[]>();
  for (const s of children(doc, "symbol")) {
    const id = text(child(s, "lib_id")![1]);
    const at = child(s, "at")!;
    expect(num(at[3])).toBe(0);
    const ref = text(child(child(child(child(s, "instances")!, "project")!, "path")!, "reference")![1]);
    for (const p of lib.get(id) ?? []) {
      const k = key(num(at[1]) + p.x, num(at[2]) - p.y);
      pinAt.set(k, [...(pinAt.get(k) ?? []), `${ref}.${p.name}`]);
      find(k);
    }
  }
  for (const w of children(doc, "wire")) {
    const pts = children(child(w, "pts")!, "xy");
    join2(key(num(pts[0][1]), num(pts[0][2])), key(num(pts[1][1]), num(pts[1][2])));
  }
  const byLabel = new Map<string, string>();
  for (const l of children(doc, "label")) {
    const at = child(l, "at")!;
    const k = key(num(at[1]), num(at[2]));
    const name = text(l[1]);
    if (byLabel.has(name)) join2(k, byLabel.get(name)!);
    else byLabel.set(name, k);
  }
  const groups = new Map<string, string[]>();
  for (const [k, pins] of pinAt) groups.set(find(k), [...(groups.get(find(k)) ?? []), ...pins]);
  const noConnect = new Set(children(doc, "no_connect").map((n) => key(num(child(n, "at")![1]), num(child(n, "at")![2]))));
  return { doc, nets: [...groups.values()].filter((g) => g.length > 1).map((g) => g.sort()).sort((a, b) => a[0].localeCompare(b[0])), pinAt, noConnect, lib };
}

describe("KiCad schematic export", () => {
  it("writes the current KiCad file version with a title block and our own embedded symbols", () => {
    const { parts, wires } = seeded();
    const c = buildCircuit(parts, wires, []);
    const src = kicadSchematic(c, META);
    const doc = parse(src) as SNode[];
    expect(doc[0]).toBe("kicad_sch");
    expect(child(doc, "version")![1]).toBe(KICAD_SCH_VERSION);
    expect(text(child(doc, "generator")![1])).not.toBe("eeschema");
    const tb = child(doc, "title_block")!;
    expect(text(child(tb, "title")![1])).toBe("Example concept");
    expect(text(child(tb, "rev")![1])).toBe("A");
    expect(text(child(tb, "date")![1])).toBe("2026-11-21");
    const libIds = children(child(doc, "lib_symbols")!, "symbol").map((s) => text(s[1]));
    for (const id of libIds) expect(id.startsWith("C2R:")).toBe(true);
    for (const s of children(doc, "symbol")) expect(libIds).toContain(text(child(s, "lib_id")![1]));
    // every symbol has the four mandatory properties
    for (const s of children(child(doc, "lib_symbols")!, "symbol")) {
      expect(children(s, "property").map((p) => text(p[1]))).toEqual(expect.arrayContaining(["Reference", "Value", "Footprint", "Datasheet"]));
    }
    // uuids are unique
    const uuids: string[] = [];
    const walk = (n: SNode) => {
      if (!Array.isArray(n)) return;
      if (n[0] === "uuid") uuids.push(text(n[1]));
      n.forEach(walk);
    };
    walk(doc);
    expect(new Set(uuids).size).toBe(uuids.length);
    // the same circuit writes the same file
    expect(kicadSchematic(buildCircuit(parts, wires, []), META)).toBe(src);
  });

  it("round trip: the nets read back from coordinates and labels are the circuit's nets", () => {
    const { parts, wires } = seeded();
    const c = buildCircuit(parts, wires, []);
    const { nets } = netsFromFile(kicadSchematic(c, META));
    const expected = c.nets.map((n) => n.members.map((m) => pinLabel(m.ref, m.pin)).sort()).sort((a, b) => a[0].localeCompare(b[0]));
    expect(nets).toEqual(expected);
    expect(nets.length).toBeGreaterThan(8);
  });

  it("puts every pin on the 1.27 mm grid and flags each unwired pin as not connected", () => {
    const mcu = part("U1", { library: "raspberry-pi-pico" });
    const s = part("U2", { library: "dht22" });
    const own = part("U3");
    const pins = pinsFor(own, [{ name: "IN \"quoted\"", kind: "input" }, { name: "GND", kind: "ground" }]);
    const c = buildCircuit([mcu, s, own], [wire("U1", "3V3", "U2", "VDD"), wire("U1", "GND", "U2", "GND"), wire("U1", "GP2", "U2", "DATA"), wire("U3", "GND", "U1", "GND")], pins);
    const src = kicadSchematic(c, META);
    const { pinAt, noConnect, nets } = netsFromFile(src);
    for (const k of pinAt.keys()) {
      const [x, y] = k.split(",").map((v) => Number(v) / 1000);
      expect(Math.abs(x / 1.27 - Math.round(x / 1.27))).toBeLessThan(1e-6);
      expect(Math.abs(y / 1.27 - Math.round(y / 1.27))).toBeLessThan(1e-6);
    }
    const wired = new Set(nets.flat());
    const all = [...pinAt.values()].flat();
    const unwired = all.filter((p) => !wired.has(p));
    expect(unwired).toContain("U3.IN \"quoted\"");
    expect(noConnect.size).toBe(unwired.length);
    expect(nets).toContainEqual(["U1.GND", "U2.GND", "U3.GND"]);
  });

  it("is loaded without error by kicad-cli where it is installed", () => {
    const has = spawnSync("kicad-cli", ["version"], { encoding: "utf8" });
    if (has.error || has.status !== 0) {
      if (process.env.KICAD_CLI_REQUIRED) throw new Error("kicad-cli is required here (KICAD_CLI_REQUIRED) but was not found.");
      console.warn("kicad-cli is not installed here; the KiCad load check did not run.");
      return;
    }
    // CI sets KICAD_KEEP_DIR so the exported file is kept and uploaded when KiCad refuses it.
    const dir = process.env.KICAD_KEEP_DIR ?? mkdtempSync(join(tmpdir(), "c2r-kicad-"));
    mkdirSync(dir, { recursive: true });
    const { parts, wires } = seeded();
    const file = join(dir, "example.kicad_sch");
    writeFileSync(file, kicadSchematic(buildCircuit(parts, wires, []), { ...META, project: "example" }));
    const out = execFileSync("kicad-cli", ["sch", "export", "netlist", "--output", join(dir, "example.net"), file], { encoding: "utf8" });
    expect(out).not.toMatch(/error/i);
    const erc = spawnSync("kicad-cli", ["sch", "erc", "--output", join(dir, "erc.rpt"), file], { encoding: "utf8" });
    expect(erc.status, erc.stderr).toBe(0);
  });
});

describe("KiCad export placement", () => {
  it("keeps symbols placed from the symbol view on the sheet, even from negative positions", () => {
    const { parts, wires } = seeded();
    const c = buildCircuit(parts, wires, []);
    const positions = Object.fromEntries(c.parts.map((p, i) => [p.ref, { x: -500 + i * 40, y: -300 }]));
    const doc = parse(kicadSchematic(c, { ...META, positions })) as SNode[];
    for (const s of children(doc, "symbol")) {
      const at = child(s, "at")!;
      expect(num(at[1])).toBeGreaterThan(0);
      expect(num(at[2])).toBeGreaterThan(0);
      expect(Math.abs(num(at[1]) / 2.54 - Math.round(num(at[1]) / 2.54))).toBeLessThan(1e-6);
    }
    expect(netsFromFile(kicadSchematic(c, { ...META, positions })).nets.length).toBe(c.nets.length);
  });
});
