import type { LibraryEntryInput } from "../schema";
import { p, row } from "./helpers";

type Entry = LibraryEntryInput;

const i2c = (line: "SDA" | "SCL") => ({ bus: { type: "i2c" as const, line } });

export const SENSORS: Entry[] = [
  {
    id: "gy-521-mpu6050",
    kind: "sensor",
    name: "GY-521 MPU-6050 breakout",
    description: "Six-axis motion sensor board on I2C. The board's own regulator and resistors vary by maker, so no supply range is stated.",
    size: { w: 21, d: 16 },
    basis: "typical",
    symbol: "box",
    sources: [],
    note: "No maker's document: GY-521 boards come from many makers. Many carry their own I2C pull-up resistors and a regulator, some do not; check your board.",
    pullUpsVary: true,
    pins: row(
      [
        p("VCC", "power_in"),
        p("GND", "ground"),
        p("SCL", "input", i2c("SCL")),
        p("SDA", "bidirectional", i2c("SDA")),
        p("XDA", "bidirectional", { optional: true }),
        p("XCL", "output", { optional: true }),
        p("AD0", "input", { optional: true }),
        p("INT", "output"),
      ],
      { pitch: 2.54, axis: "x", at: -6.73 }
    ),
  },
  {
    id: "adafruit-mpu6050",
    kind: "sensor",
    name: "Adafruit MPU-6050 6-DoF accelerometer and gyro breakout (product 3886)",
    description: "Six-axis motion sensor board on I2C, address 0x68, with its own 3.3 V regulator, level shifting and pull-ups. 26.0 by 17.8 by 4.6 mm with four 2.5 mm mounting holes (the maker's product page).",
    size: { w: 26, d: 17.8, h: 4.6 },
    basis: "typical",
    symbol: "box",
    sources: [
      { label: "Adafruit MPU-6050 6-DoF Accel and Gyro Sensor, product 3886", url: "https://www.adafruit.com/product/3886" },
      { label: "MPU6050 6-DoF Accelerometer and Gyro, Adafruit learning guide, Pinouts", url: "https://learn.adafruit.com/mpu6050-6-axis-accelerometer-and-gyro/pinouts" },
    ],
    figures: "VIN 3 V to 5 V: the guide's pinout page (\"3-5VDC\"). 3Vo is the 3.3 V regulator output, up to 100 mA: the same page. SCL and SDA each have a 10 k pull-up: the same page.",
    note: "The outline is the maker's figure; the pin positions along the edge are typical (2.54 mm pitch) and not from the drawing.",
    pins: [
      ...row(
        [
          p("VIN", "power_in", { voltage: { min: 3, max: 5 } }),
          p("3Vo", "power_out", { voltage: { nominal: 3.3 }, current: { max: 100 }, optional: true }),
          p("GND", "ground"),
          p("SCL", "input", { ...i2c("SCL"), pullUp: true }),
          p("SDA", "bidirectional", { ...i2c("SDA"), pullUp: true }),
          p("INT", "output"),
        ],
        { pitch: 2.54, axis: "x", at: -7.6 }
      ),
      { name: "AD0", kind: "input", optional: true, position: { x: -6.35, y: 7.6 } },
    ],
  },
  {
    id: "dht22",
    kind: "sensor",
    name: "DHT22 (AM2302) temperature and humidity sensor",
    description: "Four-pin sensor on a single-wire bus. The data line needs a pull-up.",
    size: { w: 15.1, d: 25 },
    basis: "typical",
    symbol: "box",
    sources: [{ label: "DHT22 datasheet, Aosong (as hosted by SparkFun)", url: "https://cdn.sparkfun.com/assets/f/7/d/9/c/DHT22.pdf" }],
    figures: "Supply 3.3 V to 6 V DC: datasheet, technical specification.",
    pins: row(
      [
        p("VDD", "power_in", { number: "1", voltage: { min: 3.3, max: 6 } }),
        p("DATA", "bidirectional", { number: "2", bus: { type: "onewire", line: "DQ" } }),
        p("NC", "no_connect", { number: "3" }),
        p("GND", "ground", { number: "4" }),
      ],
      { pitch: 2.54, axis: "x", at: -12 }
    ),
  },
  {
    id: "hc-sr04",
    kind: "sensor",
    name: "HC-SR04 ultrasonic distance sensor",
    description: "Trigger in, echo out. Rated for a 5 V supply.",
    size: { w: 45, d: 20 },
    basis: "typical",
    symbol: "box",
    sources: [{ label: "HC-SR04 user guide (as hosted by SparkFun)", url: "https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf" }],
    figures: "Working voltage DC 5 V and working current 15 mA: the guide's electric parameters table.",
    pins: row(
      [
        p("VCC", "power_in", { voltage: { nominal: 5 }, current: { max: 15 } }),
        p("Trig", "input"),
        p("Echo", "output"),
        p("GND", "ground"),
      ],
      { pitch: 2.54, axis: "x", at: -9 }
    ),
  },
  {
    id: "hx711-module",
    kind: "sensor",
    name: "HX711 load cell amplifier board",
    description: "24-bit bridge amplifier for a load cell. E+ and E- excite the bridge, A+ and A- read it.",
    size: { w: 34, d: 21 },
    basis: "typical",
    symbol: "box",
    sources: [{ label: "HX711 datasheet, Avia Semiconductor (as hosted by SparkFun)", url: "https://cdn.sparkfun.com/datasheets/Sensors/ForceFlex/hx711_english.pdf" }],
    figures: "VCC 2.6 V to 5.5 V: the chip's operating supply range (AVDD and DVDD) in the datasheet. Check that your board feeds VCC straight to the chip.",
    pins: [
      ...row([p("GND", "ground"), p("DT", "output"), p("SCK", "input"), p("VCC", "power_in", { voltage: { min: 2.6, max: 5.5 } })], { pitch: 2.54, axis: "y", at: 15 }),
      ...row([p("E+", "passive"), p("E-", "passive"), p("A-", "passive", { analog: true }), p("A+", "passive", { analog: true })], { pitch: 2.54, axis: "y", at: -15 }),
    ],
  },
];

export const DISPLAYS: Entry[] = [
  {
    id: "ssd1306-oled-i2c",
    kind: "display",
    name: "SSD1306 OLED 128x64, I2C, four pins",
    description: "Small monochrome display board. Boards differ in their regulator, so no supply range is stated.",
    note: "No maker's document: these boards come from many makers and differ in regulator and pull-ups; check your board.",
    pullUpsVary: true,
    size: { w: 27, d: 27 },
    basis: "typical",
    symbol: "box",
    sources: [],
    pins: row([p("GND", "ground"), p("VCC", "power_in"), p("SCL", "input", i2c("SCL")), p("SDA", "bidirectional", i2c("SDA"))], { pitch: 2.54, axis: "x", at: -12 }),
  },
  {
    id: "lcd1602-i2c",
    kind: "display",
    name: "16x2 character LCD with I2C backpack",
    description: "Character display driven through a PCF8574 backpack. No supply range is stated: backpacks differ.",
    note: "No maker's document: backpacks come from many makers; some carry pull-ups, some do not; check your board.",
    pullUpsVary: true,
    size: { w: 80, d: 36 },
    basis: "typical",
    symbol: "box",
    sources: [],
    pins: row([p("GND", "ground"), p("VCC", "power_in"), p("SDA", "bidirectional", i2c("SDA")), p("SCL", "input", i2c("SCL"))], { pitch: 2.54, axis: "y", at: -38 }),
  },
];

export const MODULES: Entry[] = [
  {
    id: "max98357a-breakout",
    kind: "module",
    name: "MAX98357A I2S class-D amplifier breakout (mono)",
    description: "Takes I2S audio (no master clock needed) and drives one speaker directly from + and -. SD low shuts it down; the gain pin sets 3 to 15 dB.",
    size: { w: 19.4, d: 17.8 },
    basis: "typical",
    symbol: "box",
    sources: [{ label: "Adafruit MAX98357 I2S Class-D Mono Amp, learning guide", url: "https://learn.adafruit.com/adafruit-max98357-i2s-class-d-mono-amp" }],
    figures: "Vin 2.7 V to 5.5 V: the guide's overview (\"able to run from 2.7V-5.5VDC\").",
    note: "The outline and pin positions are typical of the breakout and not from a drawing.",
    pins: [
      ...row(
        [
          p("LRC", "input", { bus: { type: "i2s", line: "WS" } }),
          p("BCLK", "input", { bus: { type: "i2s", line: "BCLK" } }),
          p("DIN", "input", { bus: { type: "i2s", line: "SD" } }),
          p("GAIN", "input", { optional: true }),
          p("SD", "input", { optional: true }),
          p("GND", "ground"),
          p("Vin", "power_in", { voltage: { min: 2.7, max: 5.5 } }),
        ],
        { pitch: 2.54, axis: "x", at: -7.6 }
      ),
      ...row([p("+", "output", { analog: true }), p("-", "output", { analog: true })], { pitch: 5, axis: "x", at: 7 }),
    ],
  },
  {
    id: "dfplayer-mini",
    kind: "module",
    name: "DFPlayer Mini MP3 player",
    description: "Plays audio files from a microSD card, driven over a serial line. Drives a small speaker directly from SPK_1 and SPK_2.",
    size: { w: 20, d: 20 },
    basis: "doc",
    symbol: "box",
    sources: [{ label: "DFPlayer Mini (DFR0299) wiki, DFRobot", url: "https://wiki.dfrobot.com/DFPlayer_Mini_SKU_DFR0299" }],
    figures: "Working voltage DC 3.2 V to 5 V and the 20 by 20 mm size: the wiki's specification list. The pins left unconnected in the wiki's serial-mode wiring are marked optional.",
    pins: [
      ...row(
        [
          p("VCC", "power_in", { number: "1", voltage: { min: 3.2, max: 5 } }),
          p("RX", "input", { number: "2", bus: { type: "uart", line: "RX" } }),
          p("TX", "output", { number: "3", bus: { type: "uart", line: "TX" } }),
          p("DAC_R", "output", { number: "4", analog: true }),
          p("DAC_L", "output", { number: "5", analog: true }),
          p("SPK_1", "output", { number: "6", analog: true }),
          p("GND", "ground", { number: "7" }),
          p("SPK_2", "output", { number: "8", analog: true }),
        ],
        { pitch: 2.54, axis: "y", at: -8.89 }
      ),
      ...row(
        [
          p("BUSY", "output", { number: "16" }),
          p("USB-", "bidirectional", { number: "15", bus: { type: "usb", line: "D-" }, optional: true }),
          p("USB+", "bidirectional", { number: "14", bus: { type: "usb", line: "D+" }, optional: true }),
          p("ADKEY_2", "input", { number: "13", analog: true, optional: true }),
          p("ADKEY_1", "input", { number: "12", analog: true, optional: true }),
          p("IO_2", "input", { number: "11", optional: true }),
          p("GND_2", "ground", { number: "10", optional: true }),
          p("IO_1", "input", { number: "9", optional: true }),
        ],
        { pitch: 2.54, axis: "y", at: 8.89 }
      ),
    ],
  },
];
