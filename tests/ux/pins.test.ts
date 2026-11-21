// U17: "No part has pins" is judged on resolved pins (own rows, library entry, kind defaults, names the wires use),
// and names the parts that lack them.
import { describe, expect, it } from "vitest";
import { resolvedPins, wiringBlocked } from "@/lib/ai/drafts/generators/design";
import type { Item } from "@/lib/types";

const part = (id: number, ref: string, title: string, data: Record<string, unknown> = {}): Item => ({ id, projectId: "p", section: "design/bom", title, body: "", data: { ref, qty: 1, ...data }, status: "to buy", sort: id });
const wire = (id: number, from: string, fromPin: string, to: string, toPin: string): Item => ({ id, projectId: "p", section: "design/wiring", title: `w${id}`, body: "", data: { order: id, from, fromPin, to, toPin, net: "N", netClass: "signal" }, status: "to solder", sort: id });

describe("pins as the schematic resolves them", () => {
  it("a kind's default pins count", () => {
    expect(wiringBlocked([part(1, "R1", "Resistor", { kind: "resistor" })], [], [])).toBe("");
    expect(resolvedPins([part(1, "R1", "Resistor", { kind: "resistor" })], [], [])[0].pins).toEqual(["1", "2"]);
  });
  it("pins named by existing wires count", () => {
    expect(wiringBlocked([part(1, "U1", "Board"), part(2, "U2", "Sensor")], [wire(9, "U1", "GPIO4", "U2", "SDA")], [])).toBe("");
  });
  it("own pin rows count", () => {
    expect(wiringBlocked([part(1, "U1", "Board")], [], [{ id: 1, itemId: 1, sort: 0, name: "VCC", kind: "power-in" } as never])).toBe("");
  });
  it("with no pins anywhere it names the parts that lack them", () => {
    const why = wiringBlocked([part(1, "U1", "Board"), part(2, "U2", "Sensor")], [], []);
    expect(why).toMatch(/No part has pins yet: U1 Board, U2 Sensor/);
  });
});
