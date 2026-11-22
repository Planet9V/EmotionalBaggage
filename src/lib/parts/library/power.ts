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
    id: "battery-holder-2xaa",
    kind: "battery",
    name: "Battery holder, 2 x AA, with leads",
    description: "Two cells in series. The voltage depends on the cells fitted and how far they are run down (two alkaline cells: about 3.2 V new, 2.0 V at 1.0 V a cell), so none is stated.",
    size: { w: 58, d: 32, h: 16 },
    basis: "typical",
    symbol: "battery",
    sources: [],
    note: "A generic holder: sizes are typical and makers differ; check the one you buy.",
    pins: row([p("+", "power_out"), p("-", "ground")], { pitch: 10, axis: "x", at: 15 }),
  },
  {
    id: "boost-3v3-module",
    kind: "regulator",
    name: "3.3 V step-up regulator module, 0.5 V to 5.5 V in",
    description: "Raises one to three alkaline cells to a regulated 3.3 V, and regulates down when the input is above 3.3 V. Of the class of the Pololu U1V11F3. The current it can give depends on the input voltage, so none is stated.",
    size: { w: 12, d: 15, h: 3 },
    basis: "typical",
    symbol: "box",
    sources: [{ label: "Pololu 3.3V Step-Up Voltage Regulator U1V11F3, product 2561", url: "https://www.pololu.com/product/2561" }],
    figures: "VIN 0.5 V to 5.5 V and the fixed 3.3 V output (4 % accuracy): the maker's product page. SHDN is pulled up to VIN through 100 k on the board: the same page.",
    note: "The 12 by 15 by 3 mm outline is the maker's figure; the pin positions are typical (2.54 mm pitch).",
    pins: row(
      [
        p("SHDN", "input", { optional: true, pullUp: true }),
        p("VIN", "power_in", { voltage: { min: 0.5, max: 5.5 } }),
        p("GND", "ground"),
        p("VOUT", "power_out", { voltage: { nominal: 3.3 } }),
      ],
      { pitch: 2.54, axis: "x", at: -6 }
    ),
  },
  {
    id: "p-mosfet-reverse-battery",
    kind: "generic",
    name: "P-channel MOSFET as reverse-battery protection (SOT-23 on an adapter)",
    description: "Drain to the battery side, source to the load, gate to ground: it conducts when the cells are the right way round and blocks when they are not. Needs a logic-level part that is fully on at 1.8 V gate drive.",
    size: { w: 10, d: 10 },
    basis: "typical",
    symbol: "box",
    sources: [],
    note: "The drain and source state no pin kind: the supply passes through the transistor, which the electrical checks cannot follow, so they say nothing about the net behind it rather than guess.",
    pins: [
      { name: "D", kind: null, position: { x: -2.54, y: 0 } },
      { name: "S", kind: null, position: { x: 2.54, y: 0 } },
      { name: "G", kind: "input", position: { x: 0, y: -2.54 } },
    ],
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
