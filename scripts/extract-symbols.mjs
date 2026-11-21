// Copies the symbol drawings the schematic uses out of the `schematic-symbols` package (MIT,
// a dev dependency) into src/lib/parts/symbols.data.json. Only the drawings are copied: lines,
// circles and pin points. Each symbol's origin was checked in the package's history before it
// was added here; the record is in docs/third-party.manual.json. Run: node scripts/extract-symbols.mjs
import { writeFileSync } from "node:fs";
import { symbols } from "schematic-symbols";

/** our id -> the package's symbol name */
const PICK = {
  resistor: "resistor_right",
  capacitor_polarized: "capacitor_polarized_right",
  diode: "diode_right",
  led: "led_right",
  switch: "spst_switch_right",
  push_button: "push_button_normally_open_momentary_horz",
  battery: "battery_horz",
  speaker: "speaker_right",
  ground: "ground_down",
  vcc: "vcc_up",
};

const r = (n) => Math.round(n * 10000) / 10000;
const out = {};
for (const [id, name] of Object.entries(PICK)) {
  const s = symbols[name];
  if (!s) throw new Error(`schematic-symbols has no ${name}`);
  out[id] = {
    from: name,
    size: { w: r(s.size.width), h: r(s.size.height) },
    center: { x: r(s.center.x), y: r(s.center.y) },
    ports: s.ports.map((p) => ({ x: r(p.x), y: r(p.y), labels: p.labels })),
    paths: s.primitives.filter((p) => p.type === "path").map((p) => ({ points: p.points.map((q) => [r(q.x), r(q.y)]), ...(p.fill ? { fill: true } : {}), ...(p.closed ? { closed: true } : {}) })),
    circles: s.primitives.filter((p) => p.type === "circle" && p.radius > 0).map((c) => ({ x: r(c.x), y: r(c.y), r: r(c.radius), ...(c.fill ? { fill: true } : {}) })),
  };
}
writeFileSync(new URL("../src/lib/parts/symbols.data.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`wrote ${Object.keys(out).length} symbols`);
