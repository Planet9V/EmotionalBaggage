import type { LibraryEntryInput } from "../schema";
import { p, row } from "./helpers";

type Entry = LibraryEntryInput;

const ESP_GUIDE = "https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html";
const gpio = (n: number, extra = {}) => p(`GPIO${n}`, "bidirectional", { optional: true, ...extra });

export const BOARDS: Entry[] = [
  {
    id: "esp32-s3-devkitc-1",
    kind: "microcontroller",
    name: "ESP32-S3-DevKitC-1",
    description: "Espressif development board with an ESP32-S3-WROOM module. Header J1 down one side, J3 down the other. Repeated 3V3 and ground header pins are shown once.",
    size: { w: 63, d: 25.4 },
    basis: "typical",
    symbol: "box",
    sources: [{ label: "ESP32-S3-DevKitC-1 v1.1 user guide, Espressif", url: ESP_GUIDE }],
    figures: "3V3 output of 3.3 V: the user guide's 5 V to 3.3 V LDO. Pin names and header positions: the guide's J1 and J3 tables.",
    pins: [
      ...row(
        [
          p("3V3", "power_out", { number: "J1-1", voltage: { nominal: 3.3 } }),
          p("RST", "input", { number: "J1-3", optional: true }),
          gpio(4, { number: "J1-4" }), gpio(5, { number: "J1-5" }), gpio(6, { number: "J1-6" }), gpio(7, { number: "J1-7" }),
          gpio(15, { number: "J1-8" }), gpio(16, { number: "J1-9" }), gpio(17, { number: "J1-10" }), gpio(18, { number: "J1-11" }),
          gpio(8, { number: "J1-12" }), gpio(3, { number: "J1-13" }), gpio(46, { number: "J1-14" }), gpio(9, { number: "J1-15" }),
          gpio(10, { number: "J1-16" }), gpio(11, { number: "J1-17" }), gpio(12, { number: "J1-18" }), gpio(13, { number: "J1-19" }),
          gpio(14, { number: "J1-20" }),
          p("5V", "power_in", { number: "J1-21", optional: true }),
          p("GND", "ground", { number: "J1-22" }),
        ],
        { pitch: 2.54, axis: "x", at: -11.43 }
      ),
      ...row(
        [
          p("TX", "output", { number: "J3-2", bus: { type: "uart", line: "TX" }, optional: true }),
          p("RX", "input", { number: "J3-3", bus: { type: "uart", line: "RX" }, optional: true }),
          gpio(1, { number: "J3-4" }), gpio(2, { number: "J3-5" }), gpio(42, { number: "J3-6" }), gpio(41, { number: "J3-7" }),
          gpio(40, { number: "J3-8" }), gpio(39, { number: "J3-9" }), gpio(38, { number: "J3-10" }), gpio(37, { number: "J3-11" }),
          gpio(36, { number: "J3-12" }), gpio(35, { number: "J3-13" }), gpio(0, { number: "J3-14" }), gpio(45, { number: "J3-15" }),
          gpio(48, { number: "J3-16" }), gpio(47, { number: "J3-17" }), gpio(21, { number: "J3-18" }), gpio(20, { number: "J3-19" }),
          gpio(19, { number: "J3-20" }),
        ],
        { pitch: 2.54, axis: "x", at: 11.43 }
      ),
    ],
  },
  {
    id: "xiao-esp32s3-ext-3v3",
    kind: "microcontroller",
    name: "Seeed Studio XIAO ESP32S3, fed at its 3V3 pin",
    description: "Thumb-size ESP32-S3 board with 8 MB of flash, described as a battery design uses it: a regulated 3.3 V goes to the 3V3 pin, and the board's own regulator and USB port are not the supply. Do not connect USB while that supply is on.",
    size: { w: 17.5, d: 21 },
    basis: "typical",
    symbol: "box",
    sources: [
      { label: "Arduino-ESP32 core 4.0.0, variants/XIAO_ESP32S3/pins_arduino.h, Espressif", url: "https://github.com/espressif/arduino-esp32/blob/4.0.0/variants/XIAO_ESP32S3/pins_arduino.h" },
      { label: "Seeed Studio XIAO ESP32S3, a reseller's product page (Core Electronics)", url: "https://core-electronics.com.au/seeed-studio-xiao-esp32s3.html" },
    ],
    note: "The 21 by 17.5 mm outline is the maker's figure as the reseller's page gives it. The pad positions are typical of the XIAO form (two rows of seven, 2.54 mm apart) and not from a drawing. D0 to D10 are GPIO 1, 2, 3, 4, 5, 6, 43, 44, 7, 8, 9 in the core's pins file. No supply range is stated: the chip maker's data sheet was not read for this entry.",
    pins: [
      ...row(
        [
          p("D0", "bidirectional", { optional: true, analog: true }), p("D1", "bidirectional", { optional: true }), p("D2", "bidirectional", { optional: true }), p("D3", "bidirectional", { optional: true }),
          p("D4", "bidirectional", { optional: true }), p("D5", "bidirectional", { optional: true }), p("D6", "bidirectional", { optional: true }),
        ],
        { pitch: 2.54, axis: "y", at: -7.62, reverse: true }
      ),
      ...row(
        [
          p("5V", "power_in", { optional: true }), p("GND", "ground"), p("3V3", "power_in"),
          p("D10", "bidirectional", { optional: true }), p("D9", "bidirectional", { optional: true }), p("D8", "bidirectional", { optional: true }), p("D7", "bidirectional", { optional: true }),
        ],
        { pitch: 2.54, axis: "y", at: 7.62, reverse: true }
      ),
    ],
  },
  {
    id: "raspberry-pi-pico",
    kind: "microcontroller",
    name: "Raspberry Pi Pico",
    description: "RP2040 board, 51 by 21 mm, 40 pins on two edges. Repeated ground pins are shown once.",
    size: { w: 51, d: 21, h: 1 },
    basis: "doc",
    symbol: "box",
    sources: [{ label: "Raspberry Pi Pico datasheet, Raspberry Pi Ltd", url: "https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf" }],
    figures: "VSYS range 1.8 V to 5.5 V and the 3V3 output (3.3 V, keep the load under 300 mA): datasheet section 2.1. Size: datasheet, 51 by 21 mm.",
    pins: [
      ...row(
        [
          p("GP0", "bidirectional", { number: "1", bus: { type: "uart", line: "TX" } }), p("GP1", "bidirectional", { number: "2", bus: { type: "uart", line: "RX" } }),
          p("GP2", "bidirectional", { number: "4" }), p("GP3", "bidirectional", { number: "5" }), p("GP4", "bidirectional", { number: "6" }),
          p("GP5", "bidirectional", { number: "7" }), p("GP6", "bidirectional", { number: "9" }), p("GP7", "bidirectional", { number: "10" }),
          p("GP8", "bidirectional", { number: "11" }), p("GP9", "bidirectional", { number: "12" }), p("GP10", "bidirectional", { number: "14" }),
          p("GP11", "bidirectional", { number: "15" }), p("GP12", "bidirectional", { number: "16" }), p("GP13", "bidirectional", { number: "17" }),
          p("GP14", "bidirectional", { number: "19" }), p("GP15", "bidirectional", { number: "20" }),
        ],
        { pitch: 2.54, axis: "x", at: -8.89 }
      ),
      ...row(
        [
          p("VBUS", "power_in", { number: "40", optional: true }),
          p("VSYS", "power_in", { number: "39", voltage: { min: 1.8, max: 5.5 }, optional: true }),
          p("GND", "ground", { number: "38" }),
          p("3V3_EN", "input", { number: "37", pullUp: true, optional: true }),
          p("3V3", "power_out", { number: "36", voltage: { nominal: 3.3 }, current: { max: 300 } }),
          p("ADC_VREF", "passive", { number: "35", optional: true }),
          p("GP28", "bidirectional", { number: "34", analog: true }),
          p("AGND", "ground", { number: "33", optional: true }),
          p("GP27", "bidirectional", { number: "32", analog: true }), p("GP26", "bidirectional", { number: "31", analog: true }),
          p("RUN", "input", { number: "30", optional: true }),
          p("GP22", "bidirectional", { number: "29" }), p("GP21", "bidirectional", { number: "27" }), p("GP20", "bidirectional", { number: "26" }),
          p("GP19", "bidirectional", { number: "25" }), p("GP18", "bidirectional", { number: "24" }), p("GP17", "bidirectional", { number: "22" }),
          p("GP16", "bidirectional", { number: "21" }),
        ],
        { pitch: 2.54, axis: "x", at: 8.89, reverse: true }
      ),
    ],
  },
  {
    id: "arduino-nano",
    kind: "microcontroller",
    name: "Arduino Nano",
    description: "ATmega328P board, 30 pins on two edges. Repeated ground pins are shown once.",
    size: { w: 45, d: 18 },
    basis: "typical",
    symbol: "box",
    sources: [{ label: "Arduino Nano datasheet A000005, Arduino", url: "https://docs.arduino.cc/resources/datasheets/A000005-datasheet.pdf" }],
    figures: "VIN 7 V to 15 V unregulated supply (pin 30) and the 3.3 V output: datasheet, features and power sections.",
    pins: [
      ...row(
        [
          p("D1/TX", "output", { number: "1", bus: { type: "uart", line: "TX" }, optional: true }),
          p("D0/RX", "input", { number: "2", bus: { type: "uart", line: "RX" }, optional: true }),
          p("RESET", "input", { number: "3", optional: true }),
          p("GND", "ground", { number: "4" }),
          ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n, i) => p(`D${n}`, "bidirectional", { number: String(5 + i) })),
        ],
        { pitch: 2.54, axis: "x", at: -7.62 }
      ),
      ...row(
        [
          p("VIN", "power_in", { number: "30", voltage: { min: 7, max: 15 }, optional: true }),
          p("RESET_2", "input", { number: "28", optional: true }),
          p("5V", "power_in", { number: "27", optional: true }),
          ...["A7", "A6", "A5", "A4", "A3", "A2", "A1", "A0"].map((n, i) =>
            p(n, n === "A6" || n === "A7" ? "input" : "bidirectional", {
              number: String(26 - i),
              analog: true,
              optional: n === "A6" || n === "A7",
              ...(n === "A4" ? { bus: { type: "i2c" as const, line: "SDA" } } : n === "A5" ? { bus: { type: "i2c" as const, line: "SCL" } } : {}),
            })
          ),
          p("AREF", "passive", { number: "18", optional: true }),
          p("3V3", "power_out", { number: "17", voltage: { nominal: 3.3 } }),
          p("D13", "bidirectional", { number: "16" }),
        ],
        { pitch: 2.54, axis: "x", at: 7.62, reverse: true }
      ),
    ],
  },
];
