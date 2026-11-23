// Chips and parts placed on a product's own circuit board (the Baggage Claims Rev D board, 22 Nov 2026), as
// opposed to the breakout boards elsewhere in the library. No supply range is stated on these: the figures in the
// Rev D note are recalled from data sheets, not read, and the library states only what a named source gives.
// Pin positions are the package's pads in a typical order, so the 3D and symbol views have somewhere to put them.
import type { LibraryEntryInput } from "../schema";
import { p, row } from "./helpers";

type Entry = LibraryEntryInput;

const spi = (line: "SCK" | "MOSI" | "MISO" | "CS") => ({ bus: { type: "spi" as const, line } });
const i2s = (line: "BCLK" | "WS" | "SD") => ({ bus: { type: "i2s" as const, line } });

export const CHIPS: Entry[] = [
  {
    id: "nrf52832-qfn48",
    kind: "microcontroller",
    name: "Nordic nRF52832 (QFN-48), its GPIO named by use",
    description: "Bluetooth controller used with its radio never started. Any GPIO can take any of these jobs; the port pins are fixed when the board is laid out, so the pins are named by what they do. The motion sensor and the flash each have an SPI bus of their own.",
    size: { w: 6, d: 6 },
    basis: "typical",
    symbol: "box",
    sources: [],
    note: "Its supply range (about 1.7 to 3.6 V) is recalled, not read from Nordic's data sheet, so no voltage is stated. The pad positions are a typical order, not the package drawing.",
    pins: [
      ...row([p("VDD", "power_in"), p("GND", "ground"), p("RESET", "input", { optional: true }), p("SWDIO", "bidirectional", { optional: true }), p("SWDCLK", "input", { optional: true })], { pitch: 1, axis: "x", at: -2.9 }),
      ...row(
        [
          p("IMU_SCK", "output", spi("SCK")),
          p("IMU_MOSI", "output", spi("MOSI")),
          p("IMU_MISO", "input", spi("MISO")),
          p("IMU_CS", "output", spi("CS")),
          p("IMU_INT1", "input"),
          p("IMU_INT2", "input", { optional: true }),
          p("FLASH_SCK", "output", spi("SCK")),
          p("FLASH_MOSI", "output", spi("MOSI")),
          p("FLASH_MISO", "input", spi("MISO")),
          p("FLASH_CS", "output", spi("CS")),
        ],
        { pitch: 0.5, axis: "y", at: -2.9 }
      ),
      ...row(
        [
          p("I2S_SCK", "output", i2s("BCLK")),
          p("I2S_LRCK", "output", i2s("WS")),
          p("I2S_SDOUT", "output", i2s("SD")),
          p("AMP_SD", "output"),
          p("BOOST_EN", "output"),
          p("CHG_EN", "output"),
          p("MODE", "input"),
        ],
        { pitch: 0.8, axis: "y", at: 2.9 }
      ),
      ...row([p("ADC_VCELL", "input", { analog: true }), p("ADC_VSC", "input", { analog: true })], { pitch: 1, axis: "x", at: 2.9 }),
    ],
  },
  {
    id: "lsm6dso-class-imu",
    kind: "sensor",
    name: "6-axis motion sensor, LSM6DSO class (LGA-14), on SPI",
    description: "Accelerometer and gyro with a FIFO and a wake-up interrupt, wired for SPI (4-wire). INT1 wakes the controller; INT2 tells it the FIFO has filled to its mark.",
    size: { w: 3, d: 2.5 },
    basis: "typical",
    symbol: "box",
    sources: [],
    note: "Its supply range (about 1.71 to 3.6 V) and currents are recalled, not read from the maker's data sheet, so none is stated. Pad positions are a typical order.",
    pins: [
      ...row([p("VDD", "power_in"), p("VDDIO", "power_in"), p("GND", "ground"), p("INT1", "output"), p("INT2", "output", { optional: true })], { pitch: 0.5, axis: "x", at: -1.2 }),
      ...row([p("SPC", "input", spi("SCK")), p("SDI", "input", spi("MOSI")), p("SDO", "output", spi("MISO")), p("CS", "input", spi("CS"))], { pitch: 0.5, axis: "x", at: 1.2 }),
    ],
  },
  {
    id: "spi-nor-flash-wide",
    kind: "module",
    name: "SPI NOR flash, 8 MB, wide supply (MX25R6435F class)",
    description: "Holds the clips. Runs from a coin cell's whole range, which most 3.3 V flash parts do not; WP and HOLD are not used and are tied high inside on most parts of the class.",
    size: { w: 5, d: 6 },
    basis: "typical",
    symbol: "box",
    sources: [],
    note: "The wide supply range (about 1.65 to 3.6 V) is recalled, not read, so no voltage is stated. The pads are a typical SOP-8 order.",
    pins: [
      ...row([p("CS", "input", spi("CS")), p("SO", "output", spi("MISO")), p("WP", "input", { optional: true }), p("GND", "ground")], { pitch: 1.27, axis: "y", at: -2.4 }),
      ...row([p("VCC", "power_in"), p("HOLD", "input", { optional: true }), p("SCLK", "input", spi("SCK")), p("SI", "input", spi("MOSI"))], { pitch: 1.27, axis: "y", at: 2.4 }),
    ],
  },
  {
    id: "max98357a-tqfn16",
    kind: "module",
    name: "MAX98357A I2S class-D amplifier chip (TQFN-16)",
    description: "The chip of the MAX98357A breakout, placed on the board. SD_MODE low shuts it down; it drives the speaker directly from OUTP and OUTN.",
    size: { w: 3, d: 3 },
    basis: "typical",
    symbol: "box",
    sources: [],
    note: "No supply range is stated here: the breakout's 2.7 to 5.5 V (its own entry) is the board's figure, not read for the chip. Pad positions are a typical order.",
    pins: [
      ...row([p("VDD", "power_in"), p("GND", "ground"), p("SD_MODE", "input"), p("GAIN_SLOT", "input", { optional: true })], { pitch: 0.5, axis: "x", at: -1.4 }),
      ...row([p("BCLK", "input", i2s("BCLK")), p("LRCLK", "input", i2s("WS")), p("DIN", "input", i2s("SD"))], { pitch: 0.5, axis: "y", at: -1.4 }),
      ...row([p("OUTP", "output", { analog: true }), p("OUTN", "output", { analog: true })], { pitch: 0.5, axis: "x", at: 1.4 }),
    ],
  },
  {
    id: "boost-0v5-3v3-class",
    kind: "regulator",
    name: "Boost converter, 0.5 V start-up class, 3.3 V out (TPS61023 class)",
    description: "Raises a supercapacitor's 1.8 to 2.6 V to 3.3 V for the amplifier, only while EN is high. Its inductor goes between VIN and SW.",
    size: { w: 2, d: 1.5 },
    basis: "typical",
    symbol: "box",
    sources: [],
    note: "Start-up voltage and switch current are recalled, not read, so no figure is stated; the output's 3.3 V is the design's setting, not a measured value.",
    pins: [
      ...row([p("VIN", "power_in"), p("SW", "passive", { optional: true }), p("EN", "input")], { pitch: 0.5, axis: "x", at: -0.7 }),
      ...row([p("GND", "ground"), p("VOUT", "power_out")], { pitch: 0.5, axis: "x", at: 0.7 }),
    ],
  },
  {
    id: "supercap-1f-2v7",
    kind: "capacitor",
    name: "Supercapacitor 1 F, 2.7 V (Eaton HV0810-2R7105-R)",
    description: "Stores the energy for a clip: a coin cell refills it slowly through a resistor and it gives the speaker's bursts through a boost converter. + is marked as a supply because, during a clip, it is the converter's supply.",
    size: { w: 8.5, d: 13.5 },
    basis: "doc",
    symbol: "capacitor_polarized",
    sources: [{ label: "Eaton HV0810-2R7105-R product page", url: "https://www.eaton.com/us/en-us/skuPage.HV0810-2R7105-R.html" }],
    figures: "Rated 2.7 V at the + terminal: the maker's product page (1 F, 2.7 V, 8.5 by 13.5 mm), read 22 Nov 2026.",
    pins: [
      { name: "+", kind: "power_out", voltage: { max: 2.7 }, position: { x: -1.75, y: 6.75 } },
      { name: "-", kind: "ground", position: { x: 1.75, y: 6.75 } },
    ],
  },
  {
    id: "coin-cell-contacts-2032",
    kind: "battery",
    name: "Coin cell contacts for a CR2032, on a board",
    description: "A rim spring (+) and a centre spring (-) soldered to the board; the cell sits in a cup of the case and the springs press it onto its door. The voltage depends on the cell and how far it is run down, so none is stated.",
    size: { w: 20, d: 20 },
    basis: "typical",
    symbol: "battery",
    sources: [],
    note: "Spring parts differ between makers; check the ones you buy against the cup.",
    pins: [
      { name: "+", kind: "power_out", position: { x: 9, y: 0 } },
      { name: "-", kind: "ground", position: { x: 0, y: 0 } },
    ],
  },
  {
    id: "p-mosfet-sot23",
    kind: "generic",
    name: "P-channel MOSFET (SOT-23), on a board",
    description: "A switch in a supply: source to the supply, drain to the load, gate low to conduct. As reverse-cell protection the gate goes to ground and the cell to the drain.",
    size: { w: 3, d: 2.5 },
    basis: "typical",
    symbol: "box",
    sources: [],
    note: "The drain and source state no pin kind: the supply passes through the transistor, which the electrical checks cannot follow, so they say nothing about the net behind it rather than guess.",
    pins: [
      { name: "G", kind: "input", position: { x: -0.95, y: -1 } },
      { name: "S", kind: null, position: { x: 0.95, y: -1 } },
      { name: "D", kind: null, position: { x: 0, y: 1 } },
    ],
  },
];
