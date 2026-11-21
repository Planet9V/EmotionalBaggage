import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCircuit, pinLabel } from "@/lib/parts/circuit";
import { KICAD_SCH_VERSION, kicadSchematic, powerFlagNets } from "@/lib/parts/kicad";
import { child, children, num, parse, text, write, type SNode } from "@/lib/parts/sexpr";
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
  // power flags (#FLG..) are KiCad's business, not a member of the circuit's nets
  const real = (g: string[]) => g.filter((p) => !p.startsWith("#"));
  return { doc, nets: [...groups.values()].map(real).filter((g) => g.length > 1).map((g) => g.sort()).sort((a, b) => a[0].localeCompare(b[0])), pinAt, noConnect, lib, flags: [...groups.values()].flat().filter((p) => p.startsWith("#")) };
}

/** A circuit that is not the seed: a USB-powered board, a regulator, an LED on a switched supply and a sensor. */
function secondCircuit() {
  const mcu = part("U1", { library: "raspberry-pi-pico" });
  const s = part("U2", { library: "dht22" });
  const sw = part("S1", { library: "slide-switch-spst" });
  const led = part("D1", { library: "led-5mm" });
  const r = part("R1", { library: "resistor-axial" });
  const wires = [
    wire("U1", "3V3", "S1", "1"),
    wire("S1", "2", "U2", "VDD"),
    wire("U1", "GND", "U2", "GND"),
    wire("U1", "GP2", "U2", "DATA"),
    wire("U1", "GP15", "R1", "1"),
    wire("R1", "2", "D1", "A"),
    wire("D1", "K", "U1", "GND"),
  ];
  return buildCircuit([mcu, s, sw, led, r], wires, []);
}

describe("power flags", () => {
  it("flag the example's ground return and its switched supply, and nothing already driven", () => {
    const { parts, wires } = seeded();
    const c = buildCircuit(parts, wires, []);
    const flagged = powerFlagNets(c).map((n) => n.name);
    expect(flagged.length).toBeGreaterThan(0);
    for (const n of powerFlagNets(c)) expect(n.members.some((m) => m.def?.kind === "power_out")).toBe(false);
    const { flags, nets } = netsFromFile(kicadSchematic(c, META));
    expect(flags.length).toBe(flagged.length);
    // the flags join their nets without changing the circuit's nets
    expect(nets).toEqual(c.nets.map((n) => n.members.map((m) => pinLabel(m.ref, m.pin)).sort()).sort((a, b) => a[0].localeCompare(b[0])));
  });
  it("on a second circuit: the supply behind the switch is flagged", () => {
    const c = secondCircuit();
    const flagged = powerFlagNets(c);
    expect(flagged.some((n) => n.members.some((m) => m.ref === "U2" && m.pin === "VDD"))).toBe(true);
  });
});

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
    const unwired = all.filter((p) => !wired.has(p) && !p.startsWith("#"));
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
    // Our file is version 20260306, which only KiCad 10 reads: KiCad 9.0 stops at 20250114 and refuses
    // anything newer (sch_file_versions.h; SCH_IO_KICAD_SEXPR_PARSER::ParseSchematic throws
    // FUTURE_FORMAT_ERROR), and kicad-cli then says only "Failed to load schematic".
    const version = has.stdout.trim();
    const major = Number(version.split(".")[0]);
    console.info(`kicad-cli version ${version}`);
    if (!(major >= 10)) {
      const why = `kicad-cli ${version} is older than KiCad 10 and cannot read file version ${KICAD_SCH_VERSION}.`;
      if (process.env.KICAD_CLI_REQUIRED) throw new Error(`${why} Install KiCad 10 (KICAD_CLI_REQUIRED is set).`);
      console.warn(`${why} The KiCad load check did not run.`);
      return;
    }
    // CI sets KICAD_KEEP_DIR so the exported file is kept and uploaded when KiCad refuses it.
    const dir = process.env.KICAD_KEEP_DIR ?? mkdtempSync(join(tmpdir(), "c2r-kicad-"));
    mkdirSync(dir, { recursive: true });
    const run = (args: string[]) => {
      const r = spawnSync("kicad-cli", args, { encoding: "utf8" });
      return { status: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
    };

    // Control: a schematic KiCad 10 wrote itself (the demo kept as tests/parts/fixtures/kicad), with its
    // two sub-sheet references taken out so it stands alone. If this fails, the KiCad install is at
    // fault, not our export.
    const ref = parse(readFileSync(join(__dirname, "fixtures/kicad/complex_hierarchy.kicad_sch"), "utf8")) as SNode[];
    const control = join(dir, "kicad-control.kicad_sch");
    writeFileSync(control, write(ref.filter((n) => !(Array.isArray(n) && n[0] === "sheet"))) + "\n");
    const c1 = run(["sch", "export", "netlist", "--output", join(dir, "kicad-control.net"), control]);
    expect(c1.status, `kicad-cli could not load a file KiCad 10 wrote itself, so the install is at fault: ${c1.out}`).toBe(0);

    const { parts, wires } = seeded();
    const circuit = buildCircuit(parts, wires, []);
    const file = join(dir, "example.kicad_sch");
    const src = kicadSchematic(circuit, { ...META, project: "example" });
    writeFileSync(file, src);
    const net = run(["sch", "export", "netlist", "--output", join(dir, "example.net"), file]);
    expect(net.status, `kicad-cli refused our export: ${net.out}`).toBe(0);
    expect(net.out).not.toMatch(/error/i);

    // KiCad's own connectivity must give the circuit's nets: read its netlist, map each node's pin
    // number back to our pin name through the file's library symbols.
    const doc = parse(src) as SNode[];
    const pinName = new Map<string, string>();
    const libPins = new Map(children(child(doc, "lib_symbols")!, "symbol").map((s) => [text(s[1]), children(s, "symbol").flatMap((u) => children(u, "pin"))]));
    for (const s of children(doc, "symbol")) {
      const r = text(child(child(child(child(s, "instances")!, "project")!, "path")!, "reference")![1]);
      for (const p of libPins.get(text(child(s, "lib_id")![1])) ?? []) pinName.set(`${r}#${text(child(p, "number")![1])}`, text(child(p, "name")![1]));
    }
    const netlist = parse(readFileSync(join(dir, "example.net"), "utf8")) as SNode[];
    const kicadNets = children(child(netlist, "nets")!, "net")
      .map((n) => children(n, "node").filter((d) => !text(child(d, "ref")![1]).startsWith("#")).map((d) => pinLabel(text(child(d, "ref")![1]), pinName.get(`${text(child(d, "ref")![1])}#${text(child(d, "pin")![1])}`) ?? `#${text(child(d, "pin")![1])}`)).sort())
      .filter((g) => g.length > 1)
      .sort((a, b) => a[0].localeCompare(b[0]));
    const expected = circuit.nets.map((n) => n.members.map((m) => pinLabel(m.ref, m.pin)).sort()).sort((a, b) => a[0].localeCompare(b[0]));
    expect(kicadNets).toEqual(expected);

    // ERC: every finding is listed for review; errors fail the test. With the power flags the example has no
    // "input power pin not driven" errors. --exit-code-violations makes kicad-cli exit non-zero on a violation
    // of the severity asked for (kicad/cli/command_sch_erc.cpp).
    const rpt = join(dir, "erc.json");
    const erc = run(["sch", "erc", "--format", "json", "--severity-all", "--output", rpt, file]);
    expect(erc.status, erc.out).toBe(0);
    const report = JSON.parse(readFileSync(rpt, "utf8")) as { sheets?: { violations?: { type: string; severity: string; description?: string }[] }[] };
    const counts = new Map<string, number>();
    for (const v of (report.sheets ?? []).flatMap((s) => s.violations ?? [])) counts.set(`${v.severity} ${v.type}`, (counts.get(`${v.severity} ${v.type}`) ?? 0) + 1);
    const errorsOnly = run(["sch", "erc", "--format", "json", "--severity-error", "--exit-code-violations", "--output", join(dir, "erc-errors.json"), file]);
    expect(errorsOnly.status, `KiCad's ERC found errors in the export: ${[...counts].filter(([k]) => k.startsWith("error")).map(([k, n]) => `${n} x ${k}`).join("; ")}`).toBe(0);

    // a second circuit, not the seed: it loads, its nets are KiCad's nets, and ERC finds no errors
    const second = secondCircuit();
    const file2 = join(dir, "second.kicad_sch");
    const src2 = kicadSchematic(second, { ...META, title: "Second circuit", project: "second" });
    writeFileSync(file2, src2);
    const net2 = run(["sch", "export", "netlist", "--output", join(dir, "second.net"), file2]);
    expect(net2.status, `kicad-cli refused the second export: ${net2.out}`).toBe(0);
    const doc2 = parse(src2) as SNode[];
    const pinName2 = new Map<string, string>();
    const libPins2 = new Map(children(child(doc2, "lib_symbols")!, "symbol").map((s) => [text(s[1]), children(s, "symbol").flatMap((u) => children(u, "pin"))]));
    for (const s of children(doc2, "symbol")) {
      const r = text(child(child(child(child(s, "instances")!, "project")!, "path")!, "reference")![1]);
      for (const p of libPins2.get(text(child(s, "lib_id")![1])) ?? []) pinName2.set(`${r}#${text(child(p, "number")![1])}`, text(child(p, "name")![1]));
    }
    const kicadNets2 = children(child(parse(readFileSync(join(dir, "second.net"), "utf8")) as SNode[], "nets")!, "net")
      .map((n) => children(n, "node").map((d) => ({ ref: text(child(d, "ref")![1]), pin: text(child(d, "pin")![1]) })).filter((x) => !x.ref.startsWith("#")).map((x) => pinLabel(x.ref, pinName2.get(`${x.ref}#${x.pin}`) ?? `#${x.pin}`)).sort())
      .filter((g) => g.length > 1)
      .sort((a, b) => a[0].localeCompare(b[0]));
    expect(kicadNets2).toEqual(second.nets.map((n) => n.members.map((m) => pinLabel(m.ref, m.pin)).sort()).sort((a, b) => a[0].localeCompare(b[0])));
    const erc2 = run(["sch", "erc", "--format", "json", "--severity-error", "--exit-code-violations", "--output", join(dir, "erc-second.json"), file2]);
    expect(erc2.status, `KiCad's ERC found errors in the second export: ${readFileSync(join(dir, "erc-second.json"), "utf8").slice(0, 2000)}`).toBe(0);
    console.info(`KiCad ERC on the export: ${counts.size ? [...counts].map(([k, n]) => `${n} x ${k}`).join("; ") : "no violations"}`);
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
