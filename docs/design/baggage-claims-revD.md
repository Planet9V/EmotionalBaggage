# Baggage Claims MK1, Rev D: the slim tag in the example

22 November 2026. What the owner chose, how it is powered, the airline rules it is built inside, and what changed in the example from the 2 x AA design ([baggage-claims-device.md](baggage-claims-device.md), now superseded). The full engineering and design are the Rev D notes in the example's Files, folder Design and build: `BaggageClaims_Tag_RevD_Engineering.md` and `BaggageClaims_Tag_RevD_Design.md` (copies in `seed/concepts/baggage-claims/files/`). **Nothing in Rev D has been built or measured**; every figure below is read on a maker's page, calculated or estimated, as those notes mark it.

## The decision

On 22 Nov 2026 the owner asked for "more like a leather-looking, high-quality baggage tag ... change the double-A batteries to a watch battery to make it smaller ... We cannot have a large dangling object. It must have a pocket to fit an AirTag and be a little larger". Rev D answered with three directions in two colourways each, all 62 x 92 x 12.8 mm with the same inside. At 19:00 he chose **direction A, Heritage, colourway A1, Saddle**: "yes this is perfect, a perfect design".

| | |
|---|---|
| Form | Flat luggage tag, 62 x 92 x 12.8 mm, about 62 to 64 g with the tracker (estimate); square shoulders, saddle stitching, a blind-stamped oval maker's mark, a perforated panel over the speaker |
| Colours (A1) | Body Bambu Lab PETG HF Peanut Brown; stitches and lettering Bambu Lab PETG HF Cream; strap Bambu Lab TPU for AMS Black |
| Lines | Front: BAGGAGE CLAIMS / MK1 and "Your luggage finally talks back."; tracker door: "FRAGILE — and emotionally unstable." |
| Inside | Tracker pocket behind a bayonet door in the back, name-card pocket in the back plate, CR2032 under a bayonet coin door in the front, speaker in a sealed 5.6 cm3 chamber, a 24 x 35 mm board, side off switch and mode button |
| Print | Job 1: body, back plate and two doors in two PETG colours on one bed; job 2: the TPU strap. About 37 g of PETG with the purge and 6.3 g of TPU, about $1.00 of filament (estimate, not sliced). No screws, no glue, no paint |
| Checks | 20 of 20 pass in the design's own generator (closed solids, fit of every part with 0.3 mm or more, the thickness stack, the doors, the snap hooks, printing flat without supports); not measured by this app |

In the example these are four decided rows in Decisions, each quoting him: "Which enclosure design ships?" (A1), "Which form factor ships?" (the slim tag), "Which lines go on the tag?" and "Which cell powers the tag?"; "Which enclosure build?" is decided with the Rev D option.

## Power: a coin cell and a buffer

One **CR2032** (0.07 g of lithium metal) with a **1 F, 2.7 V supercapacitor** (Eaton HV0810-2R7105-R). A coin cell alone gives about 3 mA and would make about 53 dB at 1 m: inaudible in a terminal. So the cell never drives the speaker: it runs the controller, the motion sensor and the flash directly and refills the capacitor through 470 ohm at up to 2.6 mA; a boost converter, enabled only for a clip, raises the capacitor to 3.3 V for the MAX98357A, which drives a 28 mm, 4 ohm speaker with 1 W peaks.

| | Rev D (estimates) | 2 x AA design |
|---|---|---|
| Loudness at 1 m, full level | about 70 dB (67 to 73) | about 80 dB |
| Clips | 2 to 3 back to back from a full capacitor, then one every about 154 s (one every 49 s at 5 dB down) | not limited |
| Asleep / awake | about 12.5 uA / 0.74 mA | about 0.25 mA / 9 mA |
| Battery life, four travel days a month | about 9 months (4 in the bad case) | about 6 months |
| Lithium | 0.07 g | none |
| Thickness | 12.8 mm tag | 42 mm box |
| Electronics a unit at 1 / 5 / 100 | $29.02 / $27.02 / $16.68 | $72.83 / $72.83 / $62.69 with the kit lines |

The quieter voice is the speaker's (28 mm, 7.5 mm deep against 40 mm, 20 mm deep), not the cell's: lithium ion would be no louder with the same speaker, and would add a port, a charger and a pouch cell in a bag that is thrown.

## The airline rules

Read on 22 Nov 2026 (the Rev D engineering note, section 1, has the wording and the links): IATA's Dangerous Goods Regulations, Table 2.3.A, and FAA PackSafe allow baggage with installed lithium batteries in the hold if they "contain no more than 0.3 g lithium metal" (or 2.7 Wh of lithium ion); above that, a device in checked baggage "must be completely switched off". The CR2032's 0.07 g keeps the tag under the line, so it may stay on and heckle the trip; the tracker in the pocket is its own device. The side off switch disconnects the cell for when the airport asks. Still to watch: FAA PackSafe says to check with the airline, and airlines may set stricter rules; no rule names a device that talks.

## What changed in the example

The batch `seed/concepts/baggage-claims/content/2026-11-22-revD.json` (applied after the engineering batch, once per database, never over a row a person changed):

- **Parts.** The 2 x AA design's 21 parts are retired (the XIAO ESP32S3, the MPU-6050 breakout, the amplifier breakout, the 40 mm speaker, the AA holder and cells, the 1 A switch, the boost module, the perfboard, the kits, the box and the hook-and-loop straps). In their place 34: the custom board PCB1 with its components listed (U1 nRF52832, U2 LSM6DSO-class sensor, U3 8 MB flash, U4 MAX98357A, U5 boost, Q1 and Q2, R1 to R6, C1, C2, crystals, inductors, the other passives, the side switches S1 and S2, the cell contacts), board assembly, the supercapacitor, speaker, CR2032, gasket, the buyer's tracker (not costed), and the printed body, back plate, two doors and strap. Prices at 1, 5 and 100 units are the Rev D note's estimates. Unit cost: $72.83 / $72.83 / $62.69 before, $30.01 / $28.01 / $17.67 after (the electronics plus $0.99 of filament).
- **Schematic.** 52 wires on the board's nets (VCELL, V_SC, 3V3A, one ground, I2S, an SPI bus each for the sensor and the flash, the interrupts, the sense dividers, the button). The app's electrical checks find no error and no warning. New library entries for the parts on the board: `src/lib/parts/library/chips.ts`.
- **Requirements and tests.** Power, battery life, loudness, the off switch, low battery, reverse cell, the sensor's set-up, drop survival and the enclosure rewritten to Rev D, each open; new: the clips from the capacitor buffer, the lithium limit, and the firmware changes for Rev D (the eight changes of the engineering note, section 3; the firmware itself is not rewritten). Bench tests carry Rev D's pass marks, all not run.
- **Enclosure.** The concept's enclosure row now holds an **authored design** (`enclosureSource: "authored"`, `src/lib/enclosure/authored.ts`): the Enclosure page shows its renders and 3MF downloads from Files and its 20 checks, and hides the generators (one button switches back). The row also keeps settings for running the app's own generator on the same parts, which the welcome page does for comparison. The clamshell's print jobs are retired; two Rev D jobs are queued, each naming its 3MF in Files.
- **Files.** Twelve files in Files, folder Design and build: the two notes, the parts envelope, the assembly and two print-plate 3MFs, five renders and the comparison sheet (renders as JPEG).

## Layout frame

The parts' boxes are in the app's Physical layout frame: x across the tag (centred), y up from the enclosure floor, z along the tag (centred). Rev D's own frame (x across, y along from the bottom, z through from the front face) maps as x' = -x, y' = 12.8 - z, z' = 46 - y: the back plate is the floor and the perforated front the lid, as the earlier design had its grille at the lid. The shell is 62 x 12.8 x 92 at (0, 6.4, 0); the side switches cross the wall at x = -31.
