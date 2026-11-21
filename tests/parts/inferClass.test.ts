// D11: a new wire's class comes from its pins (kinds first, then common names) instead of always Signal.
// And a large box symbol splits its pins over both sides as its headers are laid out.
import { describe, expect, it } from "vitest";
import { inferNetClass } from "@/lib/domain";
import { balanceSides, symbolLayout } from "@/lib/parts/symbols";
import { partPins } from "@/lib/parts/pins";
import type { Item } from "@/lib/types";

describe("a new wire's class", () => {
  it.each([
    [[{ pin: "GND", kind: "ground" }, { pin: "GND", kind: "ground" }], "", "ground"],
    [[{ pin: "3V3", kind: "power_out" }, { pin: "VCC", kind: "power_in" }], "", "power"],
    [[{ pin: "VBAT" }, { pin: "1" }], "", "power"],
    [[{ pin: "-" }, { pin: "2" }], "", "ground"],
    [[{ pin: "SPK_1" }, { pin: "+" }], "", "power"],
    [[{ pin: "SPK_1" }, { pin: "1" }], "", "audio"],
    [[{ pin: "GPIO8", kind: "bidirectional" }, { pin: "SCL", kind: "input" }], "", "signal"],
    [[{ pin: "A" }, { pin: "B" }], "GND", "ground"],
  ] as const)("%j on net %s is %s", (ends, net, cls) => {
    expect(inferNetClass(ends as never, net)?.netClass).toBe(cls);
  });
  it("says why", () => {
    expect(inferNetClass([{ pin: "GND", kind: "ground" }, { pin: "X" }])?.why).toBe("GND is a ground pin");
  });
});

describe("pins of a large board go to both sides", () => {
  const esp: Item = { id: 1, projectId: "p", section: "design/bom", title: "ESP32", body: "", status: "to buy", sort: 1, data: { ref: "U1", library: "esp32-s3-devkitc-1" } };
  it("the ESP32-S3-DevKitC-1 headers are split left and right", () => {
    const { pins, symbol } = partPins(esp, []);
    const layout = symbolLayout(symbol, pins);
    const left = layout.pins.filter((p) => p.side === "left").length;
    const right = layout.pins.filter((p) => p.side === "right").length;
    expect(left).toBeGreaterThan(10);
    expect(right).toBeGreaterThan(10);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(6);
  });
  it("a pin's stated side is kept", () => {
    const pins = Array.from({ length: 12 }, (_, i) => ({ name: `P${i}`, number: String(i), kind: null, side: "left" as const, sideSet: i === 11, position: null, voltage: null, currentMax: null, bus: null, analog: false, pullUp: false, optional: false }));
    const out = balanceSides(pins);
    expect(out[11].side).toBe("left");
    expect(out.filter((p) => p.side === "right").length).toBeGreaterThan(3);
  });
});

describe("library entries with no maker's document (D18)", () => {
  it("every entry without a source says so in a note, and the GY-521 is marked as varying in pull-ups", async () => {
    const { LIBRARY } = await import("@/lib/parts/library");
    for (const e of LIBRARY) if (!e.sources.length) expect(e.note, `${e.id} has no source and no note`).toBeTruthy();
    expect(LIBRARY.find((e) => e.id === "gy-521-mpu6050")?.pullUpsVary).toBe(true);
    expect(LIBRARY.find((e) => e.id === "jst-ph-2")?.sources[0]?.url).toMatch(/jst-mfg\.com/);
  });
});
