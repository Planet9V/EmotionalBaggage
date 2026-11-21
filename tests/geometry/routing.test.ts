import { describe, expect, it } from "vitest";
import { geometry } from "@/lib/domain/schemas";
import { boxOf } from "@/components/layout/geom";
import { bundleRadius, buildRouteRequest, hash, pinPosition, routeState, routingSpace, thinPath, toRoutedFields, type RoutePart, type RouteWire } from "@/lib/geometry/routing";
import { buildHarnessRequest, declaredPins } from "@/lib/geometry/harness";
import { toPart, toWire } from "@/lib/domain";
import type { Item } from "@/lib/types";

const g = (o: object) => geometry.parse({ basis: "typical", pos: [0, 0, 0], ...o });
const P = (id: number, ref: string, o: object, pins?: unknown): RoutePart => ({ id, ref, geometry: g(o), pins });
const W = (id: number, from: string, to: string, fromPin = "A", toPin = "B"): RouteWire => ({ id, name: `w${id}`, from, fromPin, to, toPin });

const shell = P(1, "ENC", { shape: "shell", size: [80, 42, 60], pos: [0, 21, 0] });
const left = P(2, "U1", { shape: "box", size: [10, 6, 10], pos: [-25, 5, 0] });
const right = P(3, "U2", { shape: "box", size: [10, 6, 10], pos: [25, 5, 0] });

describe("where a wire ends", () => {
  it("falls back to the centre of the box face that looks toward the other end", () => {
    const a = pinPosition(left, "A", right.geometry.pos);
    expect(a.source).toBe("face");
    expect(a.pos).toEqual([-20, 5, 0]); // right face of U1
    const b = pinPosition(right, "B", left.geometry.pos);
    expect(b.pos).toEqual([20, 5, 0]); // left face of U2
    // another direction picks another face
    expect(pinPosition(left, "A", [-25, 5, 40]).pos).toEqual([-25, 5, 5]);
    expect(pinPosition(left, "A", [-25, -40, 0]).pos).toEqual([-25, 2, 0]);
  });

  it("uses a pin position when the part declares one, turned with the part", () => {
    const pins = [{ name: "VCC", position: [4, 1, -2] }, "GND"];
    const plain = P(9, "M1", { shape: "box", size: [10, 6, 10], pos: [10, 20, 30] }, pins);
    expect(pinPosition(plain, "VCC", [0, 0, 0])).toEqual({ pos: [14, 21, 28], source: "pin" });
    // a quarter turn about y sends local x to -z and local z to x
    const turned = P(9, "M1", { shape: "box", size: [10, 6, 10], pos: [10, 20, 30], rotation: [0, 90, 0] }, pins);
    const t = pinPosition(turned, "VCC", [0, 0, 0]);
    expect(t.source).toBe("pin");
    expect(t.pos[0]).toBeCloseTo(10 + -2, 9);
    expect(t.pos[1]).toBeCloseTo(21, 9);
    expect(t.pos[2]).toBeCloseTo(30 - 4, 9);
  });

  it("a plain pin name with no position still falls back to the face", () => {
    expect(pinPosition(P(9, "M1", { shape: "box", size: [2, 2, 2], pos: [0, 1, 0] }, ["GND"]), "GND", [10, 1, 0]).source).toBe("face");
  });
});

describe("the space and the request", () => {
  it("the space is the shell pulled in by its wall", () => {
    const s = routingSpace([shell, left, right], 2);
    expect(s?.source).toBe("shell");
    expect(s?.box).toEqual({ min: [-38, 2, -28], max: [38, 40, 28] });
  });
  it("without a shell it is a box around the parts with 10 mm to spare", () => {
    const s = routingSpace([left, right]);
    expect(s?.source).toBe("parts");
    expect(s?.box.min).toEqual([-40, -8, -15]);
    expect(s?.box.max).toEqual([40, 18, 15]);
  });
  it("no parts and no shell: no space", () => {
    expect(routingSpace([])).toBeNull();
  });

  it("builds nets of two ends with every part as an obstacle and says why a wire is skipped", () => {
    const built = buildRouteRequest([shell, left, right], [W(1, "U1", "U2"), W(2, "U1", "NOPE"), W(3, "U1", "U1"), W(4, "ENC", "U2")]);
    expect(built.request?.nets.map((n) => n.id)).toEqual(["w1"]);
    expect(built.request?.obstacles.map((o) => o.id).sort()).toEqual(["U1", "U2"]);
    expect(built.request?.space).toEqual({ min: [-38, 2, -28], max: [38, 40, 28] });
    expect(built.request?.allowance).toBe(0);
    expect(built.skipped.map((s) => [s.wireId, s.reason])).toEqual([
      [2, "NOPE is not in the bill of materials"],
      [3, "both ends are on the same part"],
      [4, "an end is on the enclosure shell, which is the space, not a part in it"],
    ]);
    expect(built.pinSources.get(1)).toEqual(["face", "face"]);
  });
  it("tells a part with no position apart from one not on the parts list, and points to Physical layout", () => {
    const built = buildRouteRequest([shell, left, right], [W(1, "U1", "R1"), W(2, "U1", "NOPE")], { bomRefs: new Set(["U1", "U2", "R1"]) });
    expect(built.skipped).toEqual([
      { wireId: 1, name: expect.any(String), reason: "R1 has no position in the model; place it in Physical layout", fix: { href: "/s/design/layout", label: "Physical layout" } },
      { wireId: 2, name: expect.any(String), reason: "NOPE is not in the bill of materials" },
    ]);
  });
  it("no request when nothing can be routed", () => {
    expect(buildRouteRequest([shell, left], [W(1, "U1", "NOPE")]).request).toBeNull();
    expect(buildRouteRequest([], [W(1, "U1", "U2")]).request).toBeNull();
  });
});

describe("fingerprints and stale routes", () => {
  const fp = (parts: RoutePart[], id = 1) => buildRouteRequest(parts, [W(1, "U1", "U2")]).fingerprints.get(id) as string;
  it("is stable for the same model and changes when a part moves, turns or resizes", () => {
    const base = fp([shell, left, right]);
    expect(fp([shell, left, right])).toBe(base);
    expect(fp([shell, P(2, "U1", { shape: "box", size: [10, 6, 10], pos: [-24, 5, 0] }), right])).not.toBe(base);
    expect(fp([shell, P(2, "U1", { shape: "box", size: [10, 6, 10], pos: [-25, 5, 0], rotation: [90, 0, 0] }), right])).not.toBe(base);
    expect(fp([P(1, "ENC", { shape: "shell", size: [90, 42, 60], pos: [0, 21, 0] }), left, right])).not.toBe(base);
  });
  it("does not depend on the grid cell", () => {
    const a = buildRouteRequest([shell, left, right], [W(1, "U1", "U2")], { cell: 2 }).fingerprints.get(1);
    const b = buildRouteRequest([shell, left, right], [W(1, "U1", "U2")], { cell: 5 }).fingerprints.get(1);
    expect(a).toBe(b);
  });
  it("routeState tells none, current and stale", () => {
    expect(routeState({}, "x")).toBe("none");
    expect(routeState({ routedLengthMm: 10, routedFingerprint: "x" }, "x")).toBe("current");
    expect(routeState({ routedLengthMm: 10, routedFingerprint: "x" }, "y")).toBe("stale");
    expect(hash("a")).not.toBe(hash("b"));
  });
});

describe("reading the planner's answer", () => {
  it("rounds a routed run and thins a long path, keeping both ends", () => {
    const path: [number, number, number][] = Array.from({ length: 1000 }, (_, i) => [i, 0, 0]);
    const thin = thinPath(path, 50);
    expect(thin).toHaveLength(50);
    expect(thin[0]).toEqual([0, 0, 0]);
    expect(thin[49]).toEqual([999, 0, 0]);
    const f = toRoutedFields({ id: "w1", ok: true, length: 123.456, branches: [{ points: [[0, 0, 0], [1.04, 2, 3]], length: 123.456 }] }, 2, "2026-11-20T00:00:00Z", "ff");
    expect(f).toEqual({ routedLengthMm: 123.5, routedCellMm: 2, routedAt: "2026-11-20T00:00:00Z", routedFingerprint: "ff", routedPath: [[0, 0, 0], [1, 2, 3]] });
  });
  it("wires that share a run get thicker tubes", () => {
    const run = (y: number): [number, number, number][] => [[0, y, 0], [40, y, 0]];
    const r = bundleRadius(new Map([[1, run(0)], [2, run(0)], [3, run(0)], [4, run(30)]]));
    expect(r.get(4)).toBeCloseTo(0.6, 9);
    expect(r.get(1)).toBeGreaterThan(r.get(4) as number);
    expect(r.get(1)).toBeCloseTo(1.1, 9);
    expect(bundleRadius(new Map(Array.from({ length: 9 }, (_, i) => [i, run(0)] as const))).get(0)).toBe(1.6);
  });
});

describe("the harness request", () => {
  const item = (id: number, section: string, title: string, data: Record<string, unknown>): Item => ({ id, projectId: "p", section, title, body: "", status: "", sort: id, data }) as Item;
  const parts = [
    item(1, "design/bom", "Controller", { ref: "U1", pins: ["VCC", { name: "GND" }] }),
    item(2, "design/bom", "Battery", { ref: "J1" }),
  ].map(toPart);
  const wires = [
    item(10, "design/wiring", "Power", { from: "J1", fromPin: "+", to: "U1", toPin: "VCC", netClass: "power", net: "VBAT", order: 1 }),
    item(11, "design/wiring", "Ground", { from: "J1", fromPin: "-", to: "U1", toPin: "GND", netClass: "ground", order: 2 }),
    item(12, "design/wiring", "Lost", { from: "J1", fromPin: "-", to: "X9", toPin: "1", order: 3 }),
  ].map(toWire).filter((w) => w !== null);
  it("names the connectors, colours the wires and carries only routed lengths", () => {
    const { request, problems } = buildHarnessRequest("Baggage", parts, wires, new Map([[10, 123.4]]));
    expect(request?.connectors.map((c) => [c.ref, c.pins])).toEqual([["J1", []], ["U1", ["VCC", "GND"]]]);
    expect(request?.wires.map((w) => [w.id, w.colour, w.lengthMm])).toEqual([["10", "red", 123.4], ["11", "black", undefined]]);
    expect(request?.wires[0].net).toBe("VBAT");
    expect(problems).toEqual(["Lost: X9 is not in the bill of materials"]);
  });
  it("reads pin names from strings and objects", () => {
    expect(declaredPins(["A", { name: "B" }, "A", 5, null, { name: "" }])).toEqual(["A", "B"]);
    expect(declaredPins("x")).toEqual([]);
  });
  it("nothing to draw when no wire joins known parts", () => {
    expect(buildHarnessRequest("x", parts, wires.slice(2), new Map()).request).toBeNull();
  });
});

describe("boxOf agrees with the router's obstacles", () => {
  it("a turned part's obstacle is its rotated box", () => {
    const turned = P(5, "T1", { shape: "box", size: [10, 6, 30], pos: [0, 3, 0], rotation: [0, 90, 0] });
    const o = buildRouteRequest([shell, turned, left], [W(1, "T1", "U1")]).request?.obstacles.find((x) => x.id === "T1");
    const b = boxOf(turned.geometry);
    expect(o?.min).toEqual(b.min.map((v) => Math.round(v * 1000) / 1000));
    expect(o && o.max[0] - o.min[0]).toBeCloseTo(30, 6);
  });
});

describe("pin positions from the part library (integration item 4)", () => {
  it("a library part's pins are scaled to the part's size, put on its top face, and turned with it", async () => {
    const { pinPoints, routePartsOf } = await import("@/lib/geometry/pins3d");
    const { toPart } = await import("@/lib/domain");
    const { pinPosition, buildRouteRequest } = await import("@/lib/geometry/routing");
    // battery-holder-3xaa: 58 x 48 outline, "+" at x -5, y 24 and "-" at x 5, y 24
    const item = { id: 1, projectId: "p", section: "design/bom", title: "Cells", body: "", status: "to buy", sort: 1, data: { ref: "BT1", library: "battery-holder-3xaa", geometry: { shape: "box", size: [116, 20, 96], pos: [0, 10, 0], basis: "typical" } } };
    const g = toPart(item).geometry!;
    expect(pinPoints(item, [], g)).toEqual([{ name: "+", pos: [-10, 10, 48] }, { name: "-", pos: [10, 10, 48] }]);
    const [part] = routePartsOf([toPart(item)], []);
    expect(pinPosition(part, "+", [100, 0, 0])).toEqual({ pos: [-10, 20, 48], source: "pin" });
    // turned a quarter round the vertical axis: x and z swap
    const turned = { ...part, geometry: { ...part.geometry, rotation: [0, 90, 0] as [number, number, number] } };
    const at = pinPosition(turned, "+", [100, 0, 0]);
    expect(at.source).toBe("pin");
    expect(at.pos.map((v) => Math.round(v))).toEqual([48, 20, 10]);
    // a pin with no position falls back to the face that looks toward the other end
    expect(pinPosition(part, "NC", [100, 10, 0]).source).toBe("face");
    // in a route request, the count of face ends follows
    const other = { ...toPart({ ...item, id: 2, data: { ref: "U1", geometry: { shape: "box", size: [10, 10, 10], pos: [100, 5, 0], basis: "typical" } } }) };
    const built = buildRouteRequest(routePartsOf([toPart(item), other], []), [{ id: 9, name: "w", from: "BT1", fromPin: "+", to: "U1", toPin: "VIN" }]);
    expect(built.pinSources.get(9)).toEqual(["pin", "face"]);
  });
});
