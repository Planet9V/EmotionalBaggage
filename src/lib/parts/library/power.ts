import type { LibraryEntryInput } from "../schema";
import { p, row } from "./helpers";

type Entry = LibraryEntryInput;

export const POWER: Entry[] = [
  {
    id: "battery-holder-3xaa",
    kind: "battery",
    name: "Battery holder, 3 x AA, with leads",
    description: "The voltage depends on the cells fitted, so none is stated. Set it on the part's own pins once the cells are chosen.",
    size: { w: 58, d: 48, h: 17 },
    basis: "typical",
    symbol: "battery",
    sources: [],
    note: "A generic holder: sizes are typical and makers differ; check the one you buy.",
    pins: row([p("+", "power_out"), p("-", "ground")], { pitch: 10, axis: "x", at: 24 }),
  },
  {
    id: "battery-holder-18650",
    kind: "battery",
    name: "Battery holder, 1 x 18650",
    description: "Single lithium-ion cell holder. The voltage depends on the cell and its charge, so none is stated.",
    size: { w: 77, d: 21, h: 19 },
    basis: "typical",
    symbol: "battery",
    sources: [],
    note: "A generic holder: sizes are typical and makers differ; check the one you buy.",
    pins: [
      { name: "+", kind: "power_out", position: { x: 38.5, y: 0 } },
      { name: "-", kind: "ground", position: { x: -38.5, y: 0 } },
    ],
  },
  {
    id: "tp4056-module-protected",
    kind: "module",
    name: "TP4056 lithium charger board with protection",
    description: "Charges one lithium-ion cell from 5 V and passes the cell to OUT+ and OUT- through a protection circuit.",
    size: { w: 26, d: 17 },
    basis: "typical",
    symbol: "box",
    sources: [{ label: "TP4056 datasheet, NanJing Top Power", url: "https://dlnmh9ip6v2uc.cloudfront.net/datasheets/Prototyping/TP4056.pdf" }],
    figures: "IN+ 4.0 V to 8.0 V: the chip's input supply voltage (VCC) in the electrical characteristics. B+ charge voltage 4.2 V: the datasheet's preset charge voltage.",
    pins: [
      ...row([p("IN+", "power_in", { voltage: { min: 4, max: 8 } }), p("IN-", "ground")], { pitch: 8, axis: "y", at: -13 }),
      ...row([p("B+", "power_out", { voltage: { nominal: 4.2 } }), p("B-", "ground", { optional: true })], { pitch: 8, axis: "y", at: 6 }),
      ...row([p("OUT+", "power_out"), p("OUT-", "ground", { optional: true })], { pitch: 8, axis: "y", at: 13 }),
    ],
  },
  {
    id: "ams1117-3v3",
    kind: "regulator",
    name: "AMS1117-3.3 linear regulator (SOT-223)",
    description: "Fixed 3.3 V linear regulator, up to 1 A.",
    size: { w: 6.5, d: 7 },
    basis: "typical",
    symbol: "box",
    sources: [{ label: "AMS1117 datasheet, Advanced Monolithic Systems", url: "http://www.advanced-monolithic.com/pdf/ds1117.pdf" }],
    figures: "Output 3.3 V and output current 1 A: the datasheet's features. VIN maximum 15 V: the absolute maximum input voltage. Pin order: the SOT-223 pin connections.",
    pins: row(
      [
        p("GND", "ground", { number: "1" }),
        p("VOUT", "power_out", { number: "2", voltage: { nominal: 3.3 }, current: { max: 1000 } }),
        p("VIN", "power_in", { number: "3", voltage: { max: 15 } }),
      ],
      { pitch: 2.3, axis: "x", at: -3.2 }
    ),
  },
  {
    id: "mcp1700-3302e",
    kind: "regulator",
    name: "MCP1700-3302E low-dropout regulator (TO-92)",
    description: "Fixed 3.3 V regulator with very low quiescent current, up to 250 mA.",
    size: { w: 5, d: 4 },
    basis: "typical",
    symbol: "box",
    sources: [{ label: "MCP1700 datasheet DS20001826E, Microchip", url: "https://ww1.microchip.com/downloads/en/DeviceDoc/MCP1700-Low-Quiescent-Current-LDO-20001826E.pdf" }],
    figures: "VIN 2.3 V to 6.0 V and 250 mA output for outputs of 2.5 V and above: the datasheet's features. Pin order: table 3-1, TO-92 column.",
    pins: row(
      [
        p("GND", "ground", { number: "1" }),
        p("VIN", "power_in", { number: "2", voltage: { min: 2.3, max: 6 } }),
        p("VOUT", "power_out", { number: "3", voltage: { nominal: 3.3 }, current: { max: 250 } }),
      ],
      { pitch: 1.27, axis: "x", at: 0 }
    ),
  },
];
