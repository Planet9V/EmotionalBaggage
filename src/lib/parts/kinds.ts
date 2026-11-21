// Part kinds and pin kinds (docs/design/wiring.md, "The model").
// A part's kind picks its symbol and supplies default pins, so adding a resistor gives two pins
// without typing. Each kind also sits in one browsing category of the part library.
// Kinds are code, not a table: they are fixed definitions tied to the symbol drawings in this
// folder, and a table would only repeat them.

/** How a pin behaves electrically. The electrical checks read this. */
export const PIN_KINDS = ["power_in", "power_out", "ground", "input", "output", "bidirectional", "passive", "no_connect"] as const;
export type PinKind = (typeof PIN_KINDS)[number];

export const PIN_KIND_LABEL: Record<PinKind, string> = {
  power_in: "Power in",
  power_out: "Power out",
  ground: "Ground",
  input: "Input",
  output: "Output",
  bidirectional: "Bidirectional",
  passive: "Passive",
  no_connect: "Not connected",
};

export const SIDES = ["left", "right", "top", "bottom"] as const;
export type Side = (typeof SIDES)[number];

/** Power at the top, ground at the bottom, inputs left, outputs right (wiring.md). */
export function defaultSide(kind: PinKind | null): Side {
  switch (kind) {
    case "power_in":
    case "power_out":
      return "top";
    case "ground":
      return "bottom";
    case "output":
      return "right";
    default:
      return "left";
  }
}

/** Shared buses a pin can belong to, with the lines each one has. */
export const BUSES = {
  i2c: { label: "I2C", lines: ["SDA", "SCL"], pullUp: true },
  spi: { label: "SPI", lines: ["SCK", "MOSI", "MISO", "CS"], pullUp: false },
  uart: { label: "UART", lines: ["TX", "RX"], pullUp: false },
  i2s: { label: "I2S", lines: ["BCLK", "WS", "SD"], pullUp: false },
  onewire: { label: "1-Wire / single-bus", lines: ["DQ"], pullUp: true },
  usb: { label: "USB", lines: ["D+", "D-"], pullUp: false },
} as const;
export type BusType = keyof typeof BUSES;
export const BUS_TYPES = Object.keys(BUSES) as [BusType, ...BusType[]];

/** Browsing categories of the part library (plan 5.1). */
export const CATEGORIES = [
  "microcontroller",
  "sensor",
  "display",
  "actuator",
  "power source",
  "regulator",
  "connector",
  "passive",
  "switch",
  "module",
  "mechanical",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Symbol drawings this app has (see ./symbols.ts). "box" is a rectangle with the part's pins around it. */
export const SYMBOL_IDS = ["resistor", "capacitor", "capacitor_polarized", "diode", "led", "switch", "push_button", "battery", "speaker", "motor", "box"] as const;
export type SymbolId = (typeof SYMBOL_IDS)[number];

export type KindPin = { name: string; kind: PinKind };

export type PartKindInfo = {
  id: string;
  label: string;
  category: Category;
  symbol: SymbolId;
  /** pins a part of this kind has when nobody has said otherwise; empty when they differ per part */
  defaultPins: KindPin[];
  /** a closed switch passes its supply on, so a supply on one side reaches the other in the checks */
  conducts?: boolean;
  /** a two-pin series part: a resistor between a bus line and a supply is a pull-up */
  resistor?: boolean;
};

const two = (a: string, b: string, kind: PinKind = "passive"): KindPin[] => [
  { name: a, kind },
  { name: b, kind },
];

/** The kinds named in docs/design/wiring.md, plus microcontroller, display and mechanical from plan 5.1. */
export const PART_KINDS: readonly PartKindInfo[] = [
  { id: "resistor", label: "Resistor", category: "passive", symbol: "resistor", defaultPins: two("1", "2"), resistor: true },
  { id: "capacitor", label: "Capacitor", category: "passive", symbol: "capacitor", defaultPins: two("1", "2") },
  { id: "diode", label: "Diode", category: "passive", symbol: "diode", defaultPins: two("A", "K") },
  { id: "led", label: "LED", category: "passive", symbol: "led", defaultPins: two("A", "K") },
  { id: "switch", label: "Switch", category: "switch", symbol: "switch", defaultPins: two("1", "2"), conducts: true },
  { id: "button", label: "Push button", category: "switch", symbol: "push_button", defaultPins: two("1", "2") },
  { id: "battery", label: "Battery", category: "power source", symbol: "battery", defaultPins: [{ name: "+", kind: "power_out" }, { name: "-", kind: "ground" }] },
  { id: "speaker", label: "Speaker", category: "actuator", symbol: "speaker", defaultPins: two("+", "-") },
  { id: "motor", label: "Motor", category: "actuator", symbol: "motor", defaultPins: two("+", "-") },
  { id: "connector", label: "Connector", category: "connector", symbol: "box", defaultPins: [] },
  { id: "sensor", label: "Sensor", category: "sensor", symbol: "box", defaultPins: [] },
  { id: "module", label: "Module", category: "module", symbol: "box", defaultPins: [] },
  { id: "regulator", label: "Regulator", category: "regulator", symbol: "box", defaultPins: [{ name: "VIN", kind: "power_in" }, { name: "VOUT", kind: "power_out" }, { name: "GND", kind: "ground" }] },
  { id: "microcontroller", label: "Microcontroller", category: "microcontroller", symbol: "box", defaultPins: [] },
  { id: "display", label: "Display", category: "display", symbol: "box", defaultPins: [] },
  // The enclosure needs to tell these apart: a microphone gets a sound hole, a circuit board gets standoffs.
  { id: "microphone", label: "Microphone", category: "sensor", symbol: "box", defaultPins: [] },
  { id: "circuit board", label: "Circuit board", category: "mechanical", symbol: "box", defaultPins: [] },
  { id: "mechanical", label: "Mechanical", category: "mechanical", symbol: "box", defaultPins: [] },
  { id: "enclosure", label: "Enclosure", category: "mechanical", symbol: "box", defaultPins: [] },
  { id: "printed part", label: "Printed part", category: "mechanical", symbol: "box", defaultPins: [] },
  { id: "fastener", label: "Fastener", category: "mechanical", symbol: "box", defaultPins: [] },
  { id: "material", label: "Material", category: "mechanical", symbol: "box", defaultPins: [] },
  { id: "generic", label: "Generic", category: "other", symbol: "box", defaultPins: [] },
];

export const PART_KIND_IDS = PART_KINDS.map((k) => k.id) as [string, ...string[]];

export function partKind(id: string | null | undefined): PartKindInfo | null {
  return PART_KINDS.find((k) => k.id === id) ?? null;
}
