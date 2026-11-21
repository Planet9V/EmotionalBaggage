import { describe, expect, it } from "vitest";
import { electricalFindings, ercSummary, RULES, type Rule } from "@/lib/parts/erc";
import { part, pinsFor, seeded, wire } from "./fixtures";

const rules = (fs: { rule: Rule }[]) => fs.map((f) => f.rule);

describe("electrical checks, rule by rule", () => {
  it("unknown-part: a wire to a reference that is not in the bill of materials", () => {
    const u1 = part("U1", { library: "gy-521-mpu6050" });
    const f = electricalFindings({ parts: [u1], wires: [wire("U1", "VCC", "X9", "1")], pins: [] });
    const hit = f.find((x) => x.rule === "unknown-part")!;
    expect(hit.severity).toBe("error");
    expect(hit.text).toContain("X9");
    expect(hit.link).toMatch(/^\/s\/design\/schematic\?select=wire%3A\d+$/);
  });

  it("unknown-pin: a wire to a pin the part does not have, only when the part's pins are known", () => {
    const u1 = part("U1", { library: "gy-521-mpu6050" });
    const u2 = part("U2"); // nobody described it: its pins are its wires' names
    const w = wire("U1", "VDD", "U2", "anything");
    const f = electricalFindings({ parts: [u1, u2], wires: [w], pins: [] });
    const hits = f.filter((x) => x.rule === "unknown-pin");
    expect(hits).toHaveLength(1);
    expect(hits[0].pins).toEqual(["U1.VDD"]);
    expect(hits[0].items).toEqual(expect.arrayContaining([u1.id, w.id]));
  });

  it("no-connect-wired: a wire to a pin marked not connected", () => {
    const s = part("S1", { library: "dht22" });
    const u = part("U1", { library: "raspberry-pi-pico" });
    const f = electricalFindings({ parts: [s, u], wires: [wire("S1", "NC", "U1", "GP2")], pins: [] });
    expect(rules(f)).toContain("no-connect-wired");
  });

  it("outputs-together: two outputs, or two supplies, on one net", () => {
    const a = part("U1", { library: "hc-sr04" });
    const b = part("U2", { library: "gy-521-mpu6050" });
    const f = electricalFindings({ parts: [a, b], wires: [wire("U1", "Echo", "U2", "INT")], pins: [] });
    expect(f.find((x) => x.rule === "outputs-together")?.pins.sort()).toEqual(["U1.Echo", "U2.INT"]);
    const r1 = part("U3", { library: "ams1117-3v3" });
    const r2 = part("U4", { library: "mcp1700-3302e" });
    const g = electricalFindings({ parts: [r1, r2], wires: [wire("U3", "VOUT", "U4", "VOUT")], pins: [] });
    expect(g.find((x) => x.rule === "outputs-together")?.text).toMatch(/supply outputs/);
  });

  it("unpowered: a power-in pin on a net with nothing that supplies power; a closed switch passes supply on", () => {
    const bat = part("BT1", { library: "battery-holder-3xaa" });
    const sw = part("S1", { library: "slide-switch-spst" });
    const s = part("U1", { library: "dht22" });
    const direct = electricalFindings({ parts: [s, part("U2", { library: "gy-521-mpu6050" })], wires: [wire("U1", "VDD", "U2", "VCC")], pins: [] });
    expect(direct.filter((x) => x.rule === "unpowered")).toHaveLength(1);
    const through = electricalFindings({ parts: [bat, sw, s], wires: [wire("BT1", "+", "S1", "1"), wire("S1", "2", "U1", "VDD")], pins: [] });
    expect(rules(through)).not.toContain("unpowered");
  });

  it("no-power and power-pin-open: a wired part with no supply wire; a required supply pin left open", () => {
    const s = part("U1", { library: "dht22" });
    const u = part("U2", { library: "raspberry-pi-pico" });
    const f = electricalFindings({ parts: [s, u], wires: [wire("U1", "DATA", "U2", "GP2")], pins: [] });
    expect(f.find((x) => x.rule === "no-power" && x.refs[0] === "U1")?.severity).toBe("error");
    // the Pico's supply inputs are both optional (VBUS or VSYS), so it has no-power but no power-pin-open
    expect(f.filter((x) => x.rule === "power-pin-open")).toHaveLength(0);
    const own = part("U3");
    const pins = pinsFor(own, [{ name: "VA", kind: "power_in" }, { name: "VB", kind: "power_in" }, { name: "IO", kind: "bidirectional" }]);
    const g = electricalFindings({ parts: [own, part("BT1", { library: "battery-holder-3xaa" })], wires: [wire("BT1", "+", "U3", "VA")], pins });
    expect(g.find((x) => x.rule === "power-pin-open")?.pins).toEqual(["U3.VB"]);
  });

  it("no-ground and ground-pin-open", () => {
    const own = part("U1");
    const pins = pinsFor(own, [{ name: "GND", kind: "ground" }, { name: "GND2", kind: "ground" }, { name: "IO", kind: "bidirectional" }]);
    const none = electricalFindings({ parts: [own, part("U2")], wires: [wire("U1", "IO", "U2", "X")], pins });
    expect(rules(none)).toContain("no-ground");
    const one = electricalFindings({ parts: [own, part("U2")], wires: [wire("U1", "GND", "U2", "X")], pins });
    expect(one.find((x) => x.rule === "ground-pin-open")?.pins).toEqual(["U1.GND2"]);
  });

  it("voltage: a supply outside a pin's stated range, in both directions", () => {
    const tp = part("U1", { library: "tp4056-module-protected" }); // B+ supplies 4.2 V
    const mcp = part("U2", { library: "mcp1700-3302e" }); // VIN accepts 2.3 to 6.0 V
    const ok = electricalFindings({ parts: [tp, mcp], wires: [wire("U1", "B+", "U2", "VIN")], pins: [] });
    expect(rules(ok)).not.toContain("voltage");
    const pico = part("U3", { library: "raspberry-pi-pico" }); // 3V3 supplies 3.3 V
    const hcsr = part("U4"); // own pins: accepts 4.5 to 5.5 V
    const pins = pinsFor(hcsr, [{ name: "VCC", kind: "power_in", voltage: { min: 4.5, max: 5.5 } }, { name: "GND", kind: "ground" }]);
    const low = electricalFindings({ parts: [pico, hcsr], wires: [wire("U3", "3V3", "U4", "VCC"), wire("U3", "GND", "U4", "GND")], pins });
    const hit = low.find((x) => x.rule === "voltage")!;
    expect(hit.text).toContain("accepts 4.5 V to 5.5 V");
    expect(hit.text).toContain("supplies 3.3 V");
    expect(hit.text).toMatch(/too low/i);
    const nano = part("U5", { library: "arduino-nano" }); // VIN max 15 V
    const big = part("BT2");
    const bpins = pinsFor(big, [{ name: "+", kind: "power_out", voltage: { min: 16, max: 18 } }, { name: "-", kind: "ground" }]);
    const high = electricalFindings({ parts: [nano, big], wires: [wire("BT2", "+", "U5", "VIN"), wire("BT2", "-", "U5", "GND")], pins: bpins });
    expect(high.find((x) => x.rule === "voltage")?.text).toMatch(/too high/i);
  });

  it("current: more drawn than the supply gives, where the figures are set, and says when figures are missing", () => {
    const reg = part("U1", { library: "mcp1700-3302e" }); // 250 mA
    const loads = ["U2", "U3"].map((r) => part(r));
    const pins = loads.flatMap((l) => pinsFor(l, [{ name: "VCC", kind: "power_in", current: { max: 150 } }, { name: "GND", kind: "ground" }]));
    const unknown = part("U4", { library: "gy-521-mpu6050" });
    const f = electricalFindings({ parts: [reg, ...loads, unknown], wires: [wire("U1", "VOUT", "U2", "VCC"), wire("U1", "VOUT", "U3", "VCC"), wire("U1", "VOUT", "U4", "VCC")], pins });
    const hit = f.find((x) => x.rule === "current")!;
    expect(hit.text).toContain("250 mA");
    expect(hit.text).toContain("300 mA");
    expect(hit.text).toContain("1 more pin");
    const light = pinsFor(loads[0], [{ name: "VCC", kind: "power_in", current: { max: 100 } }]);
    expect(rules(electricalFindings({ parts: [reg, loads[0]], wires: [wire("U1", "VOUT", "U2", "VCC")], pins: light }))).not.toContain("current");
  });

  it("pull-up: an I2C line with no pull-up warns; a resistor to a supply or a pulled-up pin clears it", () => {
    const mcu = part("U1", { library: "raspberry-pi-pico" });
    const s = part("U2", { library: "gy-521-mpu6050" });
    const bare = electricalFindings({ parts: [mcu, s], wires: [wire("U1", "GP4", "U2", "SDA")], pins: [] });
    expect(bare.find((x) => x.rule === "pull-up")?.text).toMatch(/I2C line SDA/);
    const r = part("R1", { library: "resistor-axial" });
    const pulled = electricalFindings({ parts: [mcu, s, r], wires: [wire("U1", "GP4", "U2", "SDA"), wire("R1", "1", "U2", "SDA"), wire("R1", "2", "U1", "3V3")], pins: [] });
    expect(rules(pulled)).not.toContain("pull-up");
    const own = pinsFor(s, [{ name: "SDA", kind: "bidirectional", bus: { type: "i2c", line: "SDA" }, pullUp: true }]);
    expect(rules(electricalFindings({ parts: [mcu, s], wires: [wire("U1", "GP4", "U2", "SDA")], pins: own }))).not.toContain("pull-up");
    // a UART line needs none
    const u = part("U3", { library: "dfplayer-mini" });
    expect(rules(electricalFindings({ parts: [mcu, u], wires: [wire("U1", "GP0", "U3", "RX")], pins: [] }))).not.toContain("pull-up");
  });

  it("floating-input, single-pin-net, same-part and idle-part", () => {
    const hc = part("U1", { library: "hc-sr04" });
    const other = part("U2", { library: "raspberry-pi-pico" });
    const f = electricalFindings({ parts: [hc, other, part("U9", { library: "led-5mm" })], wires: [wire("U1", "Echo", "U2", "GP2"), wire("U2", "GP3", "U2", "GP3"), wire("U2", "GP4", "U2", "GP5")], pins: [] });
    expect(f.find((x) => x.rule === "floating-input")?.pins).toEqual(["U1.Trig"]);
    expect(rules(f)).toContain("single-pin-net");
    expect(f.find((x) => x.rule === "same-part")?.pins).toEqual(["U2.GP4", "U2.GP5"]);
    expect(f.find((x) => x.rule === "idle-part")?.refs).toEqual(["U9"]);
    // two ground pins of one part tied together is not a short
    const df = part("U3", { library: "dfplayer-mini" });
    expect(rules(electricalFindings({ parts: [df], wires: [wire("U3", "GND", "U3", "GND_2")], pins: [] }))).not.toContain("same-part");
  });

  it("orders findings worst first, and every rule's name is known", () => {
    const f = electricalFindings({ parts: [part("U1", { library: "hc-sr04" })], wires: [wire("U1", "Echo", "X1", "1")], pins: [] });
    const order = f.map((x) => x.severity);
    expect(order).toEqual([...order].sort((a, b) => ["error", "warning", "info"].indexOf(a) - ["error", "warning", "info"].indexOf(b)));
    for (const x of f) expect(RULES).toContain(x.rule);
  });
});

describe("the example concept", () => {
  it("runs the checks on the seeded parts and wires and reports only what the data shows", () => {
    const { parts, wires } = seeded();
    const s = ercSummary({ parts, wires, pins: [] }, { projectId: "example" });
    // U1 has no library entry, so its pins are its wires' names and nothing is said about them
    expect(s.findings.some((f) => f.rule === "unknown-pin")).toBe(false);
    expect(s.findings.some((f) => f.rule === "unpowered")).toBe(false);
    // the I2C lines have no pull-up in the data
    expect(s.findings.filter((f) => f.rule === "pull-up").map((f) => f.text).join(" ")).toMatch(/SCL[\s\S]*SDA|SDA[\s\S]*SCL/);
    for (const f of s.findings) expect(f.link).toContain("concept=example");
    expect(s.ok).toBe(s.errors === 0);
  });
});

describe("pins nobody has described", () => {
  it("say nothing about supply when a pin on the net has no stated kind", () => {
    const s = part("U1", { library: "dht22" });
    const mcu = part("U2"); // undescribed: its pin 3V3 has no kind
    const f = electricalFindings({ parts: [s, mcu], wires: [wire("U2", "3V3", "U1", "VDD")], pins: [] });
    expect(rules(f)).not.toContain("unpowered");
  });
});
