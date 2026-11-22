// Wiring check 7: the schematic's net list and its checks agree with the drawing when wires have no
// net name. A net is the pins the wires join (src/lib/parts/circuit.ts); the net list, the netlist
// files, the row checks and the electrical checks all read that one answer. Before, the net list
// grouped by the name typed on each wire, so every unnamed wire fell into one net.
import { describe, expect, it } from "vitest";
import { buildCircuit } from "@/lib/parts/circuit";
import { electricalFindings } from "@/lib/parts/erc";
import { computeChecks, computeNets, electricalNets, netList, netlistText, readWires, refParts } from "@/components/schematic/model";
import { part, seeded, wire } from "../parts/fixtures";

const s = seeded();
/** The example's wires as drawn, with no net name typed on any of them. */
const bare = s.wires.map((w) => ({ ...w, data: { ...w.data, net: "" } }));
const pinsOf = (nets: { members: string[] }[]) => nets.map((n) => [...n.members].sort().join(" ")).sort();

describe("unnamed wires", () => {
  const named = computeNets(readWires(s.wires));
  const unnamed = computeNets(readWires(bare));

  it("make the same nets as the drawing: the pins each wire joins, not one lump", () => {
    expect(named).toHaveLength(14);
    expect(unnamed).toHaveLength(14);
    expect(pinsOf(unnamed)).toEqual(pinsOf(named));
    expect(unnamed.some((n) => n.name === "(no net name)")).toBe(false);
    // two wires, two nets, each with its own two pins
    const two = computeNets(readWires([wire("U1", "A", "U2", "A", { net: "" }), wire("U1", "B", "U2", "B", { net: "" })]));
    expect(two.map((n) => n.members)).toEqual([["U1.A", "U2.A"], ["U1.B", "U2.B"]]);
    expect(two.map((n) => n.name)).toEqual(["Net-(U1-A)", "Net-(U1-B)"]);
  });

  it("raise no finding the named circuit does not: no net marked as four classes at once", () => {
    const checks = (wires: typeof s.wires) => computeChecks(refParts(s.parts), readWires(wires)).map((c) => c.id.replace(/:.*/, "")).sort();
    expect(checks(bare)).toEqual(checks(s.wires));
    expect(checks(bare)).not.toContain("mixed");
    const rules = (wires: typeof s.wires) => electricalFindings({ parts: s.parts, wires, pins: [] }).map((f) => `${f.severity}:${f.rule}:${f.pins.join(",")}`).sort();
    expect(rules(bare)).toEqual(rules(s.wires));
  });

  it("the net list, the netlist files and the electrical checks count the same nets with the same pins", () => {
    const circuit = buildCircuit(s.parts, bare, []);
    const list = netList(circuit.nets);
    expect(list.map((n) => n.name)).toEqual(circuit.nets.map((n) => n.name));
    expect(pinsOf(list)).toEqual(pinsOf(unnamed));
    expect(pinsOf(electricalNets(readWires(bare)).map((n) => ({ members: n.members.map((m) => `${m.ref}.${m.pin}`) })))).toEqual(pinsOf(unnamed));
    const text = netlistText(readWires(bare), { concept: "X", generatedAt: new Date(0) });
    expect(text.match(/^Net /gm)).toHaveLength(14);
  });
});

describe("a name typed on wires that do not touch", () => {
  it("does not join them: the list shows two nets, as the drawing does, and a class clash is reported per net", () => {
    const wires = readWires([wire("U1", "A", "U2", "A", { net: "BUS", netClass: "signal" }), wire("U3", "A", "U4", "A", { net: "BUS", netClass: "power" })]);
    const nets = computeNets(wires);
    expect(nets.map((n) => n.name)).toEqual(["BUS-(U1-A)", "BUS-(U3-A)"]);
    expect(computeChecks([], wires).filter((c) => c.id.startsWith("mixed"))).toEqual([]);
    // one net whose wires carry two classes is still reported
    const clash = readWires([wire("U1", "A", "U2", "A", { netClass: "signal" }), wire("U2", "A", "U3", "A", { netClass: "power" })]);
    expect(computeChecks(refParts([part("U1"), part("U2"), part("U3")]), clash).filter((c) => c.id.startsWith("mixed"))).toHaveLength(1);
  });
});
