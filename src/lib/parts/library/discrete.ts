import type { LibraryEntryInput } from "../schema";
import { p, row } from "./helpers";

type Entry = LibraryEntryInput;

const ends = (a: string, b: string, kind: "passive" = "passive", half = 3) => [
  { name: a, kind, position: { x: -half, y: 0 } },
  { name: b, kind, position: { x: half, y: 0 } },
];

export const DISCRETE: Entry[] = [
  { id: "resistor-axial", kind: "resistor", name: "Resistor, through-hole, 1/4 W", description: "Set the value in the part's specification.", size: { w: 6.3, d: 2.5 }, basis: "typical", symbol: "resistor", sources: [], pins: ends("1", "2", "passive", 3.15) },
  { id: "capacitor-ceramic", kind: "capacitor", name: "Capacitor, ceramic", description: "Not polarised. Set the value in the part's specification.", size: { w: 5, d: 2.5 }, basis: "typical", symbol: "capacitor", sources: [], pins: ends("1", "2", "passive", 2.5) },
  { id: "capacitor-electrolytic", kind: "capacitor", name: "Capacitor, electrolytic", description: "Polarised: + to the higher voltage.", size: { w: 6.3, d: 6.3 }, basis: "typical", symbol: "capacitor_polarized", sources: [], pins: ends("+", "-", "passive", 1.25) },
  { id: "led-5mm", kind: "led", name: "LED, 5 mm", description: "Needs a series resistor. The forward voltage depends on the colour, so none is stated.", size: { w: 5.8, d: 5.8 }, basis: "typical", symbol: "led", sources: [], pins: ends("A", "K", "passive", 1.27) },
  { id: "slide-switch-spst", kind: "switch", name: "Slide switch, SPST", description: "On or off. A closed switch passes the supply on.", size: { w: 9, d: 4 }, basis: "typical", symbol: "switch", sources: [], pins: ends("1", "2", "passive", 2.54) },
  {
    id: "slide-switch-spdt",
    kind: "switch",
    name: "Slide switch, SPDT",
    description: "The common pin 2 joins pin 1 or pin 3.",
    size: { w: 12, d: 4 },
    basis: "typical",
    symbol: "switch",
    sources: [],
    pins: row([p("1", "passive"), p("2", "passive"), p("3", "passive")], { pitch: 2.54, axis: "x", at: 0 }),
  },
  { id: "tactile-button-6mm", kind: "button", name: "Tactile push button, 6 mm", description: "Four legs joined in pairs, shown as two pins.", size: { w: 6, d: 6 }, basis: "typical", symbol: "push_button", sources: [], pins: ends("1", "2", "passive", 3) },
  { id: "speaker-small", kind: "speaker", name: "Speaker, small, with leads", description: "Either polarity for a single speaker. The impedance and power are in the part's specification.", size: { w: 36, d: 36, h: 5 }, basis: "typical", symbol: "speaker", sources: [], pins: ends("+", "-", "passive", 5) },
  {
    id: "sg90-servo",
    kind: "motor",
    name: "Micro servo, SG90 size",
    description: "Three-wire hobby servo: signal, supply, ground. No supply range is stated: makers differ.",
    size: { w: 23, d: 12.2, h: 29 },
    basis: "typical",
    symbol: "motor",
    sources: [],
    pins: row([p("PWM", "input"), p("VCC", "power_in"), p("GND", "ground")], { pitch: 2.54, axis: "x", at: 6 }),
  },
  {
    id: "jst-ph-2",
    kind: "connector",
    name: "JST PH connector, 2 pins",
    description: "2.0 mm pitch wire-to-board connector, often used for a battery.",
    size: { w: 6, d: 4.5 },
    basis: "typical",
    symbol: "box",
    sources: [],
    pins: row([p("1", "passive"), p("2", "passive")], { pitch: 2, axis: "x", at: 0 }),
  },
  {
    id: "pin-header-1x4",
    kind: "connector",
    name: "Pin header, 1 x 4, 2.54 mm",
    description: "Straight male header.",
    size: { w: 10.2, d: 2.5 },
    basis: "typical",
    symbol: "box",
    sources: [],
    pins: row([p("1", "passive"), p("2", "passive"), p("3", "passive"), p("4", "passive")], { pitch: 2.54, axis: "x", at: 0 }),
  },
];
