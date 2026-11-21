import { describe, expect, it } from "vitest";
import type { Item } from "@/lib/types";
import { partsByRef } from "@/lib/domain";
import { DEFAULT_ALLOWANCE, DEFAULT_ROUTING, cutList, estimateLength, routedLengthMm, sequence, toWires, totalsByClass } from "@/components/buildsheet/derive";
import { AMPACITY_CHASSIS, AMPACITY_SOURCE, DEFAULT_STRIP, gaugeFor, gaugeOf, specRows, stripSummary, totalsByColour, wireCurrent } from "@/components/buildsheet/wiresheet";

let id = 1;
const row = (section: string, title: string, data: Record<string, unknown>, status = "to solder"): Item => ({ id: id++, projectId: "p", section, title, body: "", data, status, sort: id });
const part = (ref: string, extra: Record<string, unknown> = {}) => row("design/bom", ref, { ref, ...extra, geometry: { shape: "box", pos: [0, 0, 0], size: [10, 10, 10], ...(extra.geometry as object) } });
const wire = (name: string, from: string, to: string, extra: Record<string, unknown> = {}) => row("prototype/wiring", name, { from, to, netClass: "signal", ...extra });

function setup(parts: Item[], wires: Item[]) {
  const map = partsByRef(parts);
  const steps = sequence(toWires(wires));
  return { map, steps, wires: toWires(wires) };
}

describe("gauge from current, from a named table", () => {
  it("names its source", () => {
    expect(AMPACITY_SOURCE.url).toBe("https://www.powerstream.com/Wire_Size.htm");
    expect(AMPACITY_CHASSIS.map((r) => r.awg)).toEqual([30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10]);
  });

  it.each([
    [100, 30], [860, 30], [861, 28], [2000, 26], [2200, 26], [2201, 24], [3500, 24], [3501, 22], [7000, 22], [11000, 20], [16000, 18], [32000, 14], [55000, 10],
  ])("%i mA takes %i AWG, the thinnest that carries it", (mA, awg) => {
    const g = gaugeFor(mA);
    expect(g.kind).toBe("chosen");
    if (g.kind === "chosen") expect(g.awg).toBe(awg);
  });

  it("says so, and does not guess, when the current is unknown", () => {
    for (const bad of [null, 0, -5, NaN]) expect(gaugeFor(bad).kind).toBe("unknown");
  });

  it("says over table when the current is past the last row", () => {
    expect(gaugeFor(60000)).toEqual({ kind: "above", mA: 60000, maxAmps: 55 });
  });
});

describe("the current of a wire", () => {
  it("takes the wire's own figure first, as typed text or number", () => {
    const { wires, map } = setup([part("U1", { currentMa: 500 })], [wire("w", "U1", "U1", { currentMa: "1500" })]);
    expect(wireCurrent(wires[0], map)).toEqual({ mA: 1500, basis: "wire" });
  });

  it("else takes the larger of the two end parts, and names which", () => {
    const { wires, map } = setup([part("U1", { currentMa: 500 }), part("M1", { currentMa: 2500 })], [wire("w", "U1", "M1")]);
    expect(wireCurrent(wires[0], map)).toEqual({ mA: 2500, basis: "part", from: "M1" });
  });

  it("is none when nothing says", () => {
    const { wires, map } = setup([part("U1"), part("M1")], [wire("w", "U1", "M1")]);
    expect(wireCurrent(wires[0], map)).toEqual({ mA: null, basis: "none" });
    expect(gaugeOf(wires[0], wireCurrent(wires[0], map))).toMatchObject({ awg: null, label: "not set", set: "none" });
  });

  it("lets a typed gauge win over the table and says it was set by hand", () => {
    const { wires, map } = setup([part("U1", { currentMa: 100 })], [wire("w", "U1", "U1", { gauge: "18" })]);
    expect(gaugeOf(wires[0], wireCurrent(wires[0], map))).toMatchObject({ awg: 18, set: "user" });
  });
});

describe("wire length with and without a route", () => {
  const A = part("A", { geometry: { pos: [0, 0, 0] } });
  const B = part("B", { geometry: { pos: [30, 40, 0] } });

  it("estimates centre to centre x routing factor + allowance, rounded up to 5 mm, and says it is an estimate", () => {
    const { wires, map } = setup([A, B], [wire("w", "A", "B")]);
    const l = estimateLength(wires[0], map, DEFAULT_ROUTING, DEFAULT_ALLOWANCE);
    expect(l).toMatchObject({ straight: 50, source: "estimate" });
    expect(l?.raw).toBeCloseTo(50 * 1.5 + 20);
    expect(l?.mm).toBe(95);
  });

  it("uses the routed length plus the service allowance when the router wrote one, and says routed", () => {
    const { wires, map } = setup([A, B], [wire("w", "A", "B", { routedLengthMm: 61 })]);
    const l = estimateLength(wires[0], map, DEFAULT_ROUTING, DEFAULT_ALLOWANCE);
    expect(l).toMatchObject({ source: "routed", straight: 61, raw: 81, mm: 85 });
  });

  it("does not round an exact multiple of 5 up again", () => {
    const { wires, map } = setup([A, B], [wire("w", "A", "B", { routedLengthMm: 80 })]);
    expect(estimateLength(wires[0], map, 1.5, 20)?.mm).toBe(100);
  });

  it("works with no part positions at all when it is routed, and gives no length when it is neither", () => {
    const noGeo = row("design/bom", "C", { ref: "C" });
    const routed = setup([noGeo], [wire("w", "C", "C", { routedLengthMm: 10 })]);
    expect(estimateLength(routed.wires[0], routed.map, 1.5, 20)?.mm).toBe(30);
    const none = setup([noGeo], [wire("w", "C", "C")]);
    expect(estimateLength(none.wires[0], none.map, 1.5, 20)).toBeNull();
  });

  it.each([[0], [-4], ["abc"], [null], [""]])("does not treat %j as a route", (v) => {
    const { wires } = setup([A, B], [wire("w", "A", "B", { routedLengthMm: v })]);
    expect(routedLengthMm(wires[0])).toBeNull();
  });

  it("counts routed and estimated wires apart in the class totals", () => {
    const { steps, map } = setup([A, B], [wire("r", "A", "B", { routedLengthMm: 61 }), wire("e", "A", "B")]);
    const t = totalsByClass(cutList(steps, map, 1.5, 20));
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ wires: 2, routed: 1, estimated: 1, mm: 85 + 95 });
  });
});

describe("the cut list and strip lengths", () => {
  const parts = [
    part("U1", { connection: "jst-xh", currentMa: 300 }),
    part("M1", { connection: "ferrule", currentMa: 4000 }),
    part("S1", { currentMa: 20 }),
  ];
  const wires = [
    wire("sig", "U1", "S1", { routedLengthMm: 100 }),
    wire("pwr+", "U1", "M1", { netClass: "power", colour: "red", routedLengthMm: 200 }),
    wire("pwr2", "U1", "M1", { netClass: "power", colour: "red", routedLengthMm: 100 }),
  ];
  const { steps, map } = setup(parts, wires);
  const rows = specRows(steps, map, 1.5, 20);

  it("sorts by colour, then the thicker gauge first, then step", () => {
    expect(rows.map((r) => r.colour)).toEqual(["red", "red", "yellow"]);
    expect(rows[0].gauge.awg).toBe(22);
  });

  it("gives each end the strip for its part's connection, and null where the part has none", () => {
    const sig = rows.find((r) => r.wire.name === "sig")!;
    expect(sig.stripFrom).toBe(DEFAULT_STRIP["jst-xh"]);
    expect(sig.stripTo).toBeNull();
    expect(rows.find((r) => r.wire.name === "pwr+")!.stripTo).toBe(8);
  });

  it("uses an edited strip length over the starting value", () => {
    const edited = specRows(steps, map, 1.5, 20, { ...DEFAULT_STRIP, ferrule: 10 });
    expect(edited.find((r) => r.wire.name === "pwr+")!.stripTo).toBe(10);
  });

  it("totals wire per colour and gauge, counting only wires that have a length", () => {
    const t = totalsByColour(rows);
    const red = t.find((x) => x.colour === "red")!;
    expect(red).toMatchObject({ wires: 2, withLength: 2, routed: 2, mm: 220 + 120 });
    const bare = [row("design/bom", "X1", { ref: "X1" }), row("design/bom", "X2", { ref: "X2" })];
    const u = setup(bare, [wire("n", "X1", "X2")]);
    const noLen = specRows(u.steps, u.map, 1.5, 20);
    expect(totalsByColour(noLen)[0]).toMatchObject({ wires: 1, withLength: 0, mm: 0 });
  });

  it("summarises which connection types are used and which parts have none set", () => {
    const s = stripSummary(rows, map);
    expect(s.used.map((u) => [u.key, u.ends])).toEqual([["jst-xh", 3], ["ferrule", 2]]);
    expect(s.unset).toEqual(["S1"]);
  });
});
