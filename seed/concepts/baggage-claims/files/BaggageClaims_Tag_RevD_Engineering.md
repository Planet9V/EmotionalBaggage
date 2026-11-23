# Baggage Claims MK1, Rev D: engineering for a slim leather-look tag

22 November 2026. Rev D replaces Rev C's 60 x 80 x 42 mm box with a flat luggage tag (owner, 22 Nov: "more like a leather-looking, high-quality baggage tag ... change the double-A batteries to a watch battery to make it smaller ... We cannot have a large dangling object. It must have a pocket to fit an AirTag and be a little larger"). Rev B (`seed/.../BaggageClaims_MK1_RevB.ino`, `docs/design/baggage-claims-device.md`) and Rev C (`work/tag/revC`) are untouched. The form is in `DESIGN.md`; the parts envelope for the enclosure is `baggage-claims-device-envelope-revD.json` beside this file; the numbers below come from `src/power_budget.py` and `src/bom.py` (run them to reproduce).

**Nothing here has been built or measured.** Marks: **[page]** read on a maker's, reseller's or regulator's page on 22 Nov 2026 (list in section 9); **[recalled]** a data-sheet figure from memory, not re-read; **[calc]** calculated here; **[est]** engineering estimate; **[doc]** the owner's or the device engineer's documents.

## 0. Summary

| | Rev B (2 x AA, device note) | **Rev D (this note)** |
| :-- | :-- | :-- |
| Power | 2 x AA alkaline, 3.3 V boost | **one CR2032 lithium coin cell + a 1 F supercapacitor** that carries the speaker bursts |
| Lithium | none | 0.07 g lithium metal [page]: under the 0.3 g that lets a device stay on in checked baggage (section 1) |
| Controller | XIAO ESP32S3 board | **nRF52832 chip on a custom board**, radio never started |
| Motion sensor | Adafruit MPU-6050 breakout | **LSM6DSO-class 6-axis IMU** on the same board (reasons in 2.3) |
| Speaker | 40 x 20 mm cone, about 80 dB at 1 m | **28 x 7.5 mm, 4 ohm**: about **70 dB at 1 m** at full level [calc], **10 dB quieter** (about half as loud to the ear) |
| Clips | about 190 s in the ESP32's flash | 8 MB flash: about 260 s as 16 kHz PCM or about 1,000 s as 4-bit ADPCM [calc] |
| Battery life, four travel days a month | about 6 months | **about 9 months** (4 months in the bad case) [est] |
| Electronics, per unit at 1 / 5 / 100 | $72.83 / $72.83 / $62.69 (incl. kits, enclosure) | **$29.02 / $27.02 / $16.68** electronics only [est] |
| Thickness the electronics need | 42 mm box | **12.8 mm tag**; the AirTag-style tracker (8.0) sets it, not the cell |

## 1. Airline rules: the decisive constraint

The tag rides on the outside of **checked** luggage and must be **on** in the hold to heckle the trip. The rules found, in their own words (all retrieved 22 Nov 2026):

| # | Rule | Source | Retrieved |
| :-- | :-- | :-- | :-- |
| R1 | Baggage with installed lithium batteries may go as checked baggage only if the batteries "contain no more than 0.3 g lithium metal or for lithium ion must not exceed 2.7 Wh"; above that, non-removable batteries are "FORBIDDEN" | IATA Dangerous Goods Regulations, 66th edition (1 Jan 2025), Table 2.3.A, <https://www.iata.org/contentassets/6fea26dd84d24b26a7a1fd5788561d6e/dgr-66-en-2.3.a.pdf> | 22 Nov 2026 |
| R2 | Portable electronic devices with lithium cells: lithium metal "must not exceed 2 g", lithium ion "must not exceed 100 Wh"; "Devices in checked baggage must be completely switched off and must be protected from damage" | same table, PED row | 22 Nov 2026 |
| R3 | In checked baggage "the device must be completely switched off (not in sleep or hibernation mode)" and protected from damage and unintentional activation; **the table's footnote exempts devices with 0.3 g or less of lithium metal, or 2.7 Wh or less, per device**. Smart luggage is treated as a PED; 2.7 Wh or less installed is allowed checked and carry-on without operator approval | IATA Guidance Document for Passengers Travelling with Lithium Batteries 2026 (dated 31/03/2026, for DGR 67th edition), <https://www.iata.org/contentassets/6fea26dd84d24b26a7a1fd5788561d6e/passengers_travelling_with_lithium_batteries.pdf> | 22 Nov 2026 |
| R4 | US: checked bags may carry lithium batteries only with "lithium content not exceeding 0.3 grams" (metal) or "a Watt-hour rating not exceeding 2.7 Wh" (ion); "If you choose to equip a checked bag with a baggage tracking device, then it must meet the size limits above"; powered devices "must be completely switched off (not in sleep or hibernation mode)" and protected; "Check with the airline before traveling with these devices" (page last updated 13 Apr 2026) | FAA PackSafe, Baggage Equipped with Lithium Batteries, <https://www.faa.gov/hazmat/packsafe/baggage-with-lithium-batteries> | 22 Nov 2026 |
| R5 | Devices with lithium batteries in checked bags "must be completely powered off and protected to prevent unintentional activation or damage"; spare (uninstalled) lithium batteries "are always prohibited in checked baggage" (49 CFR 175.10(a)(18); page last updated 23 Sep 2025) | FAA PackSafe, Portable Electronic Devices Containing Batteries, <https://www.faa.gov/hazmat/packsafe/portable-electronic-devices-with-batteries> | 22 Nov 2026 |
| R6 | Lithium metal "limited to 2 grams of lithium content per battery"; lithium ion "100 watt hours (Wh) per battery"; spares carry-on only (page last updated 11 Aug 2026) | FAA PackSafe, Lithium Batteries, <https://www.faa.gov/hazmat/packsafe/lithium-batteries> | 22 Nov 2026 |

Not fetched: `faa.gov/hazmat/packsafe/portable-electronic-devices-containing-batteries` (the site returned an error; R5 is the page that replaced it) and the IATA PDFs by `curl` (the proxy refused); both IATA documents were read through the web reader, so the wording above is as that reader quoted it. I have not stated any rule I could not read.

**What follows for this product.**

1. **The device's own lithium must be at most 0.3 g metal or 2.7 Wh ion** (R1, R3, R4). That is the line between "may stay on in the hold" (which is how AirTag-type tags travel) and "must be completely switched off" (R2, R5), and a heckling tag that has to be off in the hold has lost its point. Everything below is chosen inside that line.
2. Coin cells, by lithium content: CR2032 0.07 g [page: Duracell CR2032 sheet]; CR2450 about 0.19 g and CR2477 about 0.31 g [calc: scaled from the Duracell figure by capacity, 0.31 g per Ah]. **CR2477 is over 0.3 g on that estimate and is excluded.** Two CR2032 (0.14 g) would pass. The tracker in the pocket is its own device with its own coin cell (a CR2032-class cell is typical, 0.07 g) and does not count against the tag; even counted together a CR2032 tag and tracker make 0.14 g.
3. Lithium-ion: an LIR2450 is 0.43 Wh and a 150 mAh pouch 0.56 Wh [calc], both under 2.7 Wh, so both are allowed on in checked baggage by R1, R3 and R4. Lithium ion is not ruled out by the rules found; it loses on size, the charging port and user effort (section 2.1).
4. AA and AAA alkaline cells are not lithium and are outside these rules (as Rev B argued).
5. **Still the owner's to watch:** R4 says "check with the airline"; airlines may set stricter rules than IATA and the FAA, and "baggage tracking device" is the closest category in the rules for this product; a device that talks is not named anywhere. The physical off switch stays ("in case the airport asks"): with it off, the cell is disconnected and the tag is "completely switched off" in the sense of R2 and R5.

## 2. Power for a slim tag

### 2.1 Options compared

Peak level is at 1 m with the Rev D speaker (28 mm, 4 ohm, 71.7 dB at 1 W and 1 m [calc from the maker's 76.5 dBA at 3 W, 1 m, page: DigiKey listing of PUI AS02804PR-N50-R]) less 1.5 dB for a small sealed box and a perforated skin [est]. Battery life is for the Rev B trip profile (section 2.4). Lithium and Wh against the 0.3 g / 2.7 Wh line of section 1.

| Option | Thickness | Energy | Lithium | What the cell can give | Peak level at 1 m | Clips | Life, 4 travel days / month | Cost, 1 / 100 | Verdict |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| a1. One CR2032, straight to the amplifier | 3.2 [page] | 0.68 Wh | 0.07 g | 3 mA continuous, 10 mA for 1 s, 20 ohm at 1 kHz [page: Duracell] | about 53 dB: 20 mW of peaks [calc] | not the limit | about 9 months | $0.60 / $0.25 | **Inaudible** in a terminal (ambient 65 to 75 dB [est]) |
| a2. Two CR2032 in parallel | 3.2 (side by side) | 1.35 Wh | 0.14 g | twice a1 | about 56 dB | | about 18 months | $1.20 / $0.50 | Inaudible |
| a3. One CR2477 | 7.7 [page: Jauch] | 3.0 Wh | about 0.31 g [calc] | 2 mA continuous, 15 mA pulse [page: Jauch] | about 54 dB | | years | $1.80 / $0.90 | Inaudible, and over 0.3 g |
| **b1. One CR2032 + 1 F supercapacitor buffer (chosen)** | cell 3.2; capacitor 8.5 dia x 13.5 [page: Eaton HV0810-2R7105-R] lies beside the tracker | 0.68 Wh in the cell; 1.76 J in the capacitor between 2.6 and 1.8 V [calc] | **0.07 g** | cell charges the capacitor at 2 mA (inside its 3 mA); the capacitor gives the 1 W peaks (1.1 A for 1 s, 0.2 ohm [page]) | **about 70 dB** at full level, 65 dB one step down [calc] | 2.5 full-level clips back to back from a full capacitor, then one every 154 s; at -5 dB one every 49 s [calc] | **about 9 months**; 6 at eight travel days; 4 in the bad case [est] | $2.20 / $1.20 (cell + capacitor) | **Chosen** |
| b2. One CR2450 + the same buffer | cell 5.0 | 1.86 Wh | about 0.19 g [calc] | as b1 | about 70 dB | as b1 | about 26 months | $2.50 / $1.35 | Same thickness (the tracker sets it); the 24.5 mm cell does not fit beside the 28 mm speaker inside a 62 mm tag. Adds about 4.5 mm of width for 3 x the life: the owner put size first |
| c1. LIR2450 rechargeable + USB-C | 5.0 [typical] | 0.43 Wh [calc from 120 mAh, 3.6 V, page: Multicomp] | 0.43 Wh (ion) | 2 C = 240 mA [page] | about 70 dB | no practical limit | about 4 to 5 months per charge; 500 cycles [page] | $3 to $4 with charger, protection, USB-C [est] | A charging port in a leather-look face, a charger IC and a protection IC, and the user has to charge it. No louder: the 28 mm speaker is the limit |
| c2. Flat LiPo 4.0 x 20 x 30, 150 mAh + USB-C | 4.0 [typical] | 0.56 Wh | 0.56 Wh (ion) | about 1 C = 150 mA [typical] | about 70 dB | no practical limit | about 6 months per charge | $4 to $5 [est] | As c1; a pouch cell in a bag that is thrown and crushed is the worst place for a swelling lithium-ion cell |
| d. Two AAA alkaline (size reference) | 10.5 each [typical] | 2.5 Wh | none | 0.5 A and more | about 70 dB with this speaker; 80 dB with Rev B's 40 x 20 cone | | about a year | $1.00 / $0.50 | Thickest: 10.5 mm cells beside an 8 mm tracker make a 14 to 15 mm tag and a 2 x 46 mm battery bay. Rev B's loudness needs Rev B's 20 mm-deep speaker, which is the box |

**Why b1.** It is the thinnest and smallest (the coin cell lies under the circuit board, the capacitor lies beside the tracker, both inside the 8 mm the tracker needs anyway); it has no port, no charger and nothing for the user to do but change one CR2032 about every nine months; it is the same cell class as the tracker in its pocket, well under the 0.3 g line, and stays allowed on in the hold. A coin cell alone cannot make an audible sound (a1 to a3: about 53 to 56 dB), so the buffer is not optional: **the cell never drives the speaker; it refills the capacitor at 2 mA, and the capacitor delivers the bursts.** What the buffer costs: the capacitor's 8.5 mm diameter, about 10 uA of leakage while it is kept full (handled in 2.4), and a wait between loud clips.

**Loudness, honestly.** About **70 dB at 1 m** at full level (67 to 73 [est]) against Rev B's 80 dB: **10 dB quieter**, which a listener hears as about half as loud. It is still a clear voice at arm's length (about 79 dB at 0.35 m [calc]) and at the carousel when the bag comes past; it will not carry across a busy hall. The loss is the speaker (28 mm, 7.5 deep, against Rev B's 40 mm, 20 deep), not the cell: lithium-ion (c1, c2) is no louder with the same speaker. The device note's 85 dB target [doc] was already 5 dB out of reach in Rev B.

### 2.2 The buffer, designed

```
CR2032 ─ S1 (off switch) ─ Q1 (reverse-cell P-FET) ─┬─ VCELL 2.0..3.2 V ─ nRF52832 (DC/DC), IMU, flash   (100 uF + 10 uF)
                                                      └─ Q2 (P-FET, MCU-switched) ─ R1 470 ohm ─┬─ SC1 1 F 2.7 V ─ U5 boost (EN from MCU) ─ 3V3A ─ U4 MAX98357A ─ SPK1 4 ohm
                                                                                              └─ divider to the ADC (V_SC)
```

| Item | Value | Reason |
| :-- | :-- | :-- |
| Charge current | 470 ohm from the cell: 2.6 mA at 1.8 V on the capacitor, 0.85 mA at 2.6 V [calc]; the firmware opens Q2 at 2.6 V | Inside the CR2032's 3 mA continuous [page]; no charger IC; the cell never sees the speaker |
| Capacitor | 1 F, 2.7 V, 0.2 ohm, 10 uA leakage, 8.5 x 13.5 [page: Eaton HV0810-2R7105-R] | 1.76 J between 2.6 and 1.8 V: 2.5 clips at full level (0.69 J each [calc]: 1 W peaks, 6:1 peak-to-average speech, 3 s, 72 % boost and amplifier) |
| Boost | TPS61023 class: starts from 0.5 V, 3.7 A switch [recalled]; 3.3 V out; enabled only for a clip | At 1.8 V and 1 W peaks it draws about 0.8 A from the capacitor; 0.16 V lost in the 0.2 ohm ESR [calc]. Off, it draws nothing (amplifier unpowered) |
| Refill time | one full-level clip 154 s; one clip at -5 dB 49 s; empty to full about 8.5 min [calc] | The governor already allows six gags an hour and 3 s between gags [doc]; the firmware plays at -5 dB when the capacitor is under 2.2 V and skips the clip under 1.9 V (logged, as Rev B's "busy") |
| Leakage | 10 uA while kept full [page] | The firmware stops topping up after 2 h without motion; the capacitor then self-discharges (about 0.4 V in 12 h at 10 uA [calc]) and costs the cell nothing; it refills on the next wake |
| Off switch S1 | in the cell's lead, before everything | Off = cell disconnected. The capacitor keeps its charge but nothing can draw it: the boost's enable comes from the unpowered controller and has a pull-down |
| Brown-out | none expected: the controller runs from the cell, the audio from the capacitor | Rev B's brown-out count becomes a capacitor-voltage gate |

### 2.3 Electronics, re-selected

| Ref | Rev B | Rev D | Why changed |
| :-- | :-- | :-- | :-- |
| U1 controller | XIAO ESP32S3 board, 3.3 V from a boost | **nRF52832 (QFN-48, 6 x 6 mm) on the custom board**, from the cell directly | The ESP32-S3 needs 3.0 to 3.6 V and about 30 mA awake [recalled]: a coin cell sags under 3.0 V and gives 3 mA. The nRF52 runs from 1.7 to 3.6 V [recalled] with about 2 uA asleep with the clock running [recalled] and keeps its RAM, so the detector's state survives sleep without the ESP32's deep-sleep restart. ESP32-C3 modules were considered: same 3.0 V floor and tens of mA awake [recalled]. The radio is never started (no antenna is fitted), so Rev B's "no RF certification scope" argument stands; nRF52840 is the drop-in if native USB is wanted later |
| U2 motion sensor | Adafruit MPU-6050 breakout #3886 | **LSM6DSO-class IMU** (2.5 x 3 x 0.83 mm), on the board | The breakout is 26 x 17.8 x 4.6 [page, device note] (a third of the tag's inside), carries a regulator that cannot work from a 3.0 V cell (it needs headroom above 3.3 V [est]) and the MPU-6050 itself draws about 3.9 mA with the gyro on [recalled], more than the CR2032's 3 mA. The LSM6DSO class: 1.71 to 3.6 V, about 0.55 mA accel + gyro at 104 Hz, a few uA in low-power accelerometer mode, hardware wake-up interrupt, 9 kB FIFO, +/-16 g and +/-2000 dps (the ranges Rev B chose) [recalled]. The owner's MPU-6050 remains the reference for the prototype on the bench: the detection logic does not depend on the chip |
| U3 clip storage | ESP32's 8 MB flash, LittleFS | **8 MB SPI NOR, 1.65 to 3.6 V (MX25R6435F class)**, deep power-down well under 1 uA [recalled] | The nRF52832 has 512 kB. 8 MB holds 262 s of 16 kHz 16-bit PCM or about 1,050 s of 4-bit IMA-ADPCM [calc]: three packs of ten to fifteen clips as in Rev B, or more with ADPCM |
| U4 amplifier | MAX98357A breakout | MAX98357A chip (TQFN 3 x 3) | Same part, no board; runs from the boosted 3.3 V |
| U5 | 3.3 V boost for everything | Boost for the amplifier only, from the capacitor | Section 2.2 |
| SPK1 | 40 mm cone, 20 deep, 4 ohm, 3 W | **28 mm, 7.5 mm seated, 4 ohm, 3 W** [page: PUI AS02804PR-N50-R] | Deepest speaker that fits the tracker-set 9.0 mm inside; 4 ohm takes 1 W from 3.3 V. Thinner speakers were rejected: a 28 x 4 mm, 8 ohm, 0.3 W max part [page: CUI GC0281M] would be about 5 dB quieter again |
| S1 off switch | 1 A slide switch in a wall | Side-actuated SPDT slide switch on the board edge (C&K PCM12 class), lever recessed 0.5 mm in the right-hand edge | The cell's current is milliamps, so a small switch is enough (the amperes are downstream of the capacitor); the lever is below the edge surface so a knock cannot move it |
| S2 mode button | 6 mm tactile behind a tongue | Side-actuated tactile 3.5 x 2.9 (SKRT class) on the board edge, behind the right-hand edge | Same functions (volume, pack, reset) |
| USB-C | on the XIAO | **none** | No charging; clips and firmware go in once at the maker through SWD pads (Tag-Connect TC2030 footprint) |
| Battery sense | divider on D0 | two ADC inputs: V_CELL (under the 2 mA load, so a tired cell shows) and V_SC | |

### 2.4 Current budget and battery life (Rev B trip profile)

Rev B's travel day [doc]: 3 h awake, six clips of 3 s, 21 h asleep. Figures at the cell.

| State | Load | Current | Basis |
| :-- | :-- | :-- | :-- |
| Asleep | nRF52832 System ON idle, RTC, RAM kept | 1.9 uA | recalled |
| | IMU accelerometer low-power, 12.5 Hz, wake-up interrupt | about 10 uA | recalled |
| | Flash deep power-down; boost off; dividers switched off; leakage | about 0.6 uA | recalled, est |
| | **Asleep, capacitor left alone** | **about 12.5 uA** | calc |
| | Asleep, capacitor kept full (first 2 h after motion) | about 22.5 uA | + 10 uA leakage [page] |
| Awake, watching | IMU accel + gyro 104 Hz | about 0.55 mA | recalled |
| | nRF52832, 64 MHz, awake about 5 % to empty the FIFO | about 0.18 mA | est |
| | **Awake** | **about 0.74 mA** | calc (Rev B: 9 mA) |
| Playing | from the capacitor; refilled from the cell at up to 2.6 mA | 0.077 mAh from the cell per full-level clip | calc |
| Peak at the cell | charge 2.6 mA + awake 0.7 + CPU bursts | about 10 mA for milliseconds, carried by 100 uF | est |

A travel day: 3 h x 0.74 + six clips 0.5 + asleep 0.3 = **about 3.0 mAh** (Rev B: about 33 mAh). A day at home, on, asleep: 0.30 mAh. Usable CR2032 capacity at these loads, down to 2.0 V, allowing for cold: 180 mAh [est; 225 mAh nominal at 15 kohm, page].

| Use | Per month | Life of one CR2032 | Rev B (2 x AA) |
| :-- | :-- | :-- | :-- |
| Four travel days a month | 19.7 mAh | **about 9 months** | about 6 months |
| Eight travel days a month | 30.5 mAh | about 6 months | about 5 months |
| Switched on, never moved | 9.0 mAh | about 20 months | about 11 months |
| If the cruise keeps it awake 8 h more per travel day (four days) | 43.4 mAh | about 4 months | about 3.5 months |

The IMU's awake current is three quarters of the budget; if the gyro is kept off until the accelerometer sees handling (a firmware choice, see 3), the four-day figure rises to over a year [est]. Not counted: the cell's self-discharge (about 1 % a year [recalled]).

### 2.5 Clip storage

8 MB flash, less 0.5 MB for the log and settings: 7.5 MB = 245 s of 16 kHz 16-bit mono, or about 980 s as 16 kHz 4-bit IMA-ADPCM [calc]. The nRF52832 decodes ADPCM in software with time to spare [est]. The 28 mm speaker gives little below its 350 Hz resonance [page], so speech mastered with a 300 Hz high-pass loses nothing it could play.

### 2.6 Bill of materials (electronics, estimates)

Output of `src/bom.py` (`out/bom.json`). The tracker is the owner's and is not included. Printed parts are in `DESIGN.md` and each direction's `report.json`.

| Ref | Part | Qty | 1 | 5 | 100 | Basis |
| :-- | :-- | --: | --: | --: | --: | :-- |
| PCB1 | Custom board 24 x 35 mm, 2 layers, 0.8 mm FR-4, ENIG (pads for the cell springs) | 1 | 4.00 | 2.00 | 0.45 | est (prototype-house pricing, 5 boards minimum) |
| PCBA | Board assembly: stencil and reflow by hand at 1 to 5; turnkey assembly at 100 | 1 | 0.00 | 0.00 | 1.80 | est (own labour at 1 to 5 not costed) |
| U1 | nRF52832-QFAA, QFN-48 6 x 6 (radio never started) | 1 | 3.40 | 3.40 | 2.60 | est |
| Y1, Y2 | 32 MHz crystal 2016 and 32.768 kHz crystal 2012 | 2 | 0.35 | 0.35 | 0.15 | est |
| L1, L2 | nRF52 DC/DC inductors 10 uH and 15 nH | 2 | 0.12 | 0.12 | 0.05 | est |
| U2 | 6-axis IMU, LSM6DSO class | 1 | 3.20 | 3.20 | 2.00 | est |
| U3 | 8 MB SPI NOR flash, 1.65 to 3.6 V (MX25R6435F class) | 1 | 1.40 | 1.40 | 0.90 | est |
| U4 | MAX98357A (TQFN-16 3 x 3) | 1 | 2.10 | 2.10 | 1.30 | est |
| U5 | Boost, 0.5 V-in class, 3.3 V, >= 3 A switch (TPS61023 class) | 1 | 0.90 | 0.90 | 0.45 | est |
| L3 | Boost inductor 1 uH, 3 A, 2520 | 1 | 0.30 | 0.30 | 0.12 | est |
| Q1, Q2 | P-MOSFETs SOT-23 | 2 | 0.25 | 0.25 | 0.06 | est |
| R, C | Passives, about 16 parts | 1 | 0.80 | 0.80 | 0.20 | est |
| SC1 | Supercapacitor 1 F, 2.7 V (Eaton HV0810-2R7105-R) | 1 | 1.60 | 1.60 | 0.95 | spec page; price est |
| SPK1 | Speaker 28 mm, 4 ohm, 3 W, 7.5 mm (PUI AS02804PR-N50-R) | 1 | 7.33 | 7.33 | 4.38 | page (DigiKey) |
| S1 | Slide switch, side-actuated (C&K PCM12 class) | 1 | 0.70 | 0.70 | 0.35 | est |
| S2 | Tactile switch, side-actuated (SKRT class) | 1 | 0.35 | 0.35 | 0.15 | est |
| BT1 | Cell contacts, centre and rim springs | 2 | 0.30 | 0.30 | 0.10 | est |
| BAT | CR2032 | 1 | 0.60 | 0.60 | 0.25 | est |
| J1 | TC2030 programming footprint | 1 | 0.00 | 0.00 | 0.00 | footprint only |
| GSK | Speaker gasket 0.5 foam; chamber foam tape | 1 | 0.30 | 0.30 | 0.06 | est |
| | **Electronics per unit** | | **29.02** | **27.02** | **16.68** | est |

Against Rev B's $72.83 / $72.83 / $62.69: Rev B's figure includes the documents' kit lines ($23) and a $5 enclosure line; on like-for-like electronics (without the wire kit, screw kit, perfboard, enclosure and strap lines) Rev B is $43.35 at one unit [calc from the device note's table], so Rev D's electronics are about $14 cheaper at one and much cheaper at a hundred, because breakout boards (sensor $12.95, amplifier $5.95, controller $7.49, regulator $5.75) become chips on one board. What Rev D adds is the custom board: a design, a layout and a first order of five (about $20 plus a stencil), and the soldering of 0.4 mm-pitch parts, which is not perfboard work.

## 3. Firmware: what changes (not rewritten here)

1. **Board and core.** nRF52832 (Arduino nRF5 / Adafruit nRF52 core, or Zephyr), not the ESP32 core. `Preferences` becomes the nRF's own flash store; LittleFS on the external SPI flash replaces LittleFS on the internal one.
2. **Pins.** New pin map on the custom board (to be fixed with the layout): I2C or SPI to the IMU, IMU INT1 (wake-up) and INT2 (FIFO watermark), QSPI/SPI to the flash, I2S (SCK, LRCK, SDOUT) to the amplifier, AMP_SD, BOOST_EN, CHG_EN (Q2), two ADC inputs (V_CELL, V_SC), MODE button, SWD.
3. **Sensor driver.** Replace the MPU-6050 register code (PWR_MGMT_1, ACCEL_CONFIG, the motion-interrupt sequence) with the LSM6DSO class: ODR 104 Hz (not 100: `SAMPLE_HZ` and every window counted in samples in `bc_detect.h` scale by 1.04, or resample in the driver), +/-16 g, +/-2000 dps, FIFO with a watermark interrupt, wake-up interrupt with its own threshold units. Scale factors change (mg and mdps per LSB). `bc_detect.*` takes g and deg/s and needs nothing else; the `upX/upY/upZ` axis setting is re-done for the board's orientation (IMU on the board, board flat in the tag: +Y toward the strap).
4. **Sleep.** System ON idle with the RTC and a GPIO sense on INT1 (no ESP32 deep-sleep reset; state stays in RAM). The two-hour dark-hold wake is an RTC compare. Optional saving: gyro off until the accelerometer sees handling.
5. **Audio path.** Before a clip: read V_SC; at 1.9 V or under, skip (logged as busy); under 2.2 V, play 5 dB down. Enable the boost (BOOST_EN), wait about 2 ms, enable the amplifier (AMP_SD), stream from SPI flash through an ADPCM or PCM decoder to I2S at 16 kHz; then amplifier off, boost off, charging on (CHG_EN) until 2.6 V. Full-level limit set so peaks stay at 1 W into 4 ohm.
6. **Battery policy.** Rev B's AA thresholds (2.4 / 2.2 / 2.0 V) become cell thresholds measured under the 2 mA charge load (about 2.7 / 2.5 / 2.3 V [est], set on the bench). The brown-out counter goes; the capacitor gate replaces it.
7. **Loading clips.** Through SWD at the maker (a flash image), or a later USB variant (nRF52840). The Rev B "USB drive" idea is not possible without a USB port.
8. **Unchanged.** The event rules, the governor, the picker, the clip naming, the counts and the button meanings.

## 4. Parts, keep-outs and the board

Frame of the tag (as in `DESIGN.md`): x across (0 on the centre line), y along the tag (0 at the bottom, strap end up), z through the thickness (0 = front face, 12.8 = back face). Back view: x as drawn; front view: mirrored.

| Ref | Part | Size used (mm) | Where (centre, or box) | Keep-out / clearance | Basis |
| :-- | :-- | :-- | :-- | :-- | :-- |
| TRK | AirTag-style tracker | 31.9 dia x 8.0, domed both sides | pocket centre (-6.0, 23.0), z 2.0 to 10.0; door in the back | 0.3 all round; door bosses 0.3 above | owner's brief; profile assumed |
| SPK1 | Speaker | 28.0 dia x 7.5 (rim 28 x 2.0, body 24 dia behind) | centre (-13.2, 60.4), z 2.1 to 9.6 on a 0.5 gasket | sealed back chamber about 5 cm3; grille inside the gasket's 23 ID | page (28, 7.5); body profile assumed |
| PCB1 | Board | 24.0 x 35.0 x 0.8, corners R 1.5 | x 3.6 to 27.6, y 42.6 to 77.6, z 6.4 to 7.2 | components 1.2 high on the back side; cell springs on the front side | design |
| BAT | CR2032 | 20.0 dia x 3.2 | cup centre (14.6, 60.0), z 2.05 to 5.25; door in the front | 0.3 in the cup | page (Murata) |
| SC1 | Supercapacitor | 8.5 dia x 13.5, lying, leads toward the board | x 14.4 to 22.9, y 22.0 to 35.5, z 1.9 to 10.4 | 0.3 | page (Eaton) |
| S1 | Slide switch, side-actuated | body 6.7 x 2.6 x 1.4, lever 1.0 x 1.0 x 1.5 | on the board's +x edge at y 50 | lever 0.5 below the edge surface in a 4.4 x 2.0 slot | typical, unverified |
| S2 | Tactile, side-actuated | 3.5 x 2.9 x 1.6 | on the board's +x edge at y 68 | plunger 0.5 below the surface | typical, unverified |
| CARD | Name-and-address card | 50.0 x 32.0 x 0.5 | back, pocket y 43.7 to 76.3 | 0.3 all round | my choice |

**Thickness stack, through the tracker (the thickest point):** front skin 1.6 + pads 0.4 + tracker 8.0 + 0.4 to the door + back plate and door 2.4 = **12.8 mm.** Through the speaker: 1.6 + gasket 0.5 + 7.5 + 0.8 + 2.4 = 12.8. Through the capacitor: 1.6 + 0.3 + 8.5 + 0.3 + plate (locally thinned to 2.0 over it, a 0.4 relief inside) = 12.8 with 0.1 spare.

**The board.** One 24 x 35 mm, two-layer, 0.8 mm board carries everything except the speaker, the capacitor and the tracker:

```
 +x edge (tag's right-hand edge, back view) ->          y
 +--------------------------------------------+ 77.6   ^
 |  S2 tactile >|   [U4 amp]  [U5 boost][L3]  |        |
 |              |   [U3 flash 8MB]            |        |
 |  ( cell springs on the FRONT side, under ) |
 |  (   the CR2032 in its cup: rim + centre  )| 60
 |  S1 slide   >|   [U1 nRF52832] [Y1][Y2]    |
 |              |   [U2 IMU]  [L1][L2]        |
 |  TC2030 pads |   Q1 Q2 R C ...   SC1 leads |
 +--------------------------------------------+ 42.6
 x 3.6                                     x 27.6
```

Components on the back side (toward the back plate, 1.2 mm), the two cell springs on the front side (toward the front skin and the coin door), switches on the right-hand edge. Speaker leads come through a 1.2 mm notch in the chamber wall, sealed by the chamber's foam tape. Estimated cost in section 2.6. **The app's schematic and BOM for Baggage Claims (Rev B parts) will need updating to these parts later**; this note does not change the app.

## 5. Mechanical consequences (for DESIGN.md)

- Tag **62 x 92 x 12.8 mm** in every direction (outline differs; inside identical), against Rev C's 60 x 80 x 42: about a third of Rev C's volume and 30 % of its thickness. Mass about 62 to 64 g with the tracker [est], against Rev C's 155 g.
- The tracker sets the thickness: 8.0 of the 12.8 mm. Nothing else is thicker than 8.5 (the capacitor, beside it).
- Drop survival: walls 3.0 (TPU edge band 1.2 + PETG 1.8, or PETG 3.0), outside corners R >= 4, the back plate held by eight snap hooks inside the body's rim (a knock on the edge hits the body, not the plate), the speaker and the board clamped between ribs, the cell in a cup under a bayonet door, nothing hinged, the strap TPU.

## 6. Unverified, in one place

- Every **[recalled]** current (nRF52832, LSM6DSO class, MX25R, TPS61023 class) and every typical part size; the speaker's body profile behind its rim; the switch bodies.
- Lithium content of CR2450 and CR2477 (scaled from one maker's CR2032 figure).
- The loudness: one maker's 1 m figure, an estimated 1.5 dB box loss, and an assumed speech crest factor. Measure in the printed tag.
- The capacitor's leakage at temperature, and the cell's capacity at -10 C under a 2.6 mA charge load.
- Whether airlines accept a talking tag on a checked bag: the rules found allow the lithium; R4 tells passengers to check with the airline.
- Nothing has been built, flashed or measured.

## 9. Pages read on 22 November 2026

- IATA DGR 66th edition Table 2.3.A (PDF, via the web reader), URL in section 1.
- IATA Guidance Document for Passengers Travelling with Lithium Batteries 2026 (PDF, via the web reader).
- FAA PackSafe: Baggage Equipped with Lithium Batteries; Portable Electronic Devices Containing Batteries; Lithium Batteries (URLs in section 1).
- Duracell CR2032 225 mAh sheet: <https://www.duracell.com/wp-content/uploads/2021/06/CR2032CH_225mAh.pdf> (0.07 g lithium, 3 mA continuous, 10 mA 1 s pulse, 20 ohm at 1 kHz, 3.03 g).
- Murata CR2032 data sheet: <https://www.murata.com/products/productdata/8808561147934/CR2032-DATASHEET.pdf> (220 mAh, 20.0 x 3.2, 3.1 g, -30 to 70 C).
- Jauch CR2477: <https://www.jauch.com/downloadfile/5bf5284ea1f2d94d1ec1a4be5173ad396/cr2477.pdf> (1000 mAh, 2 mA continuous, 15 mA pulse, 24.5 x 7.7); Panasonic CR2477 page <https://energy.panasonic.com/na/business/products/lithium/models/CR2477>.
- Multicomp LIR2450: <https://www.farnell.com/datasheets/3159492.pdf> (120 mAh, 3.6 V, 2 C, 500 cycles).
- Eaton HV0810-2R7105-R: <https://www.eaton.com/us/en-us/skuPage.HV0810-2R7105-R.html> (1 F, 2.7 V, 0.2 ohm, 10 uA, 8.5 x 13.5, 1.1 A 1 s, -40 to 65 C).
- DigiKey, PUI Audio AS02804PR-N50-R: <https://www.digikey.com/en/products/detail/pui-audio-inc/AS02804PR-N50-R/7622242> (28 mm, 7.5 mm, 4 ohm, 3 W, 76.5 dBA at 3 W / 1 m, 350 Hz, $7.33 / $4.38).
- CUI GC0281M: <https://cuidevices.com/product/audio/speakers/miniature-(10-mm~40-mm)/gc0281m> (28 x 4, 8 ohm, 0.2 W, 112 dB at 0.1 W / 1 cm); RS PRO 28 x 4 mm 0.5 W speaker listing <https://uk.rs-online.com/web/p/miniature-speakers/0102745>.
- Blocked: the Energizer CR2032 sheet (permission not answered in time).
