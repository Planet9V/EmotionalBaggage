# Baggage Claims: rows of the owner's list settled by the 2 x AA engineering work

22 November 2026. For whoever keeps `baggage-claims-owner-decisions.md` and its CSV. This file only reports; it changes neither of them.

Scope: the 118 rows in the **Design, Prototype and Production** stages, and the 27 device-related Concept rows marked "With engineering (WS14)" in `seed/concepts/baggage-claims/content-proposal-map.json`. For the Design, Prototype and Production rows, the ones that the owner's rulings of 22 Nov settle (two AA cells; a physical off switch; the Adafruit MPU-6050 breakout; free-fall over 0.3 s; carousel about 15 s or more with the best settings; handle grab as tilt and quick motion then sustained tilt and carry; hard impact as in the documents; "what is the best way to detect a throw"; "yes we need the Arduino sketch"; "add up the prototype costs"; do not ask about engineering details, estimate and label). Each was settled by an engineering decision recorded in `docs/design/baggage-claims-device.md` and entered through the batch `seed/concepts/baggage-claims/content/2026-11-22-engineering.json` (rows E001 to E109). Rows in Research, Marketing and Sales are not touched here. The Concept rows are answered in this file (the second and third tables) but not entered: they sit under `concept/brief`, `concept/decisions` and `concept/questions`, and closing them is for whoever keeps the list.

"How" names the app row and the note's section. Nothing was marked passed, done or verified.

## Resolved

| Id | Section | Title | How |
|---|---|---|---|
| P207 | design/requirements | Detect: Hard impact | Entered. Threshold 6 g on a +/-16 g range, 94 Hz filter; an impact within 1.5 s of a flight is its landing. Note 3.2, 3.4. Settles conflict P105 by choosing the range |
| P208 | design/requirements | Detect: Weigh-in | Entered. The documents' 3.5 to 6 s kept; a lift within 3 s before the stillness added. Note 3.2, 3.5. Uses side (2) and (3) of P099 |
| P209 | design/requirements | Detect: Handle grab | Entered per the ruling: 20 degrees of tilt and quick motion within 1.5 s, then 4 s of tilted carry. Note 3.5. Settles P103 |
| P210 | design/requirements | Detect: Free-fall | Entered per the ruling: over 0.3 s, with the flight limit 0.35 g plus a spin allowance. Note 3.3, 3.4. Settles P100 with its side (1) |
| P211 | design/requirements | Detect: Carousel | Entered per the ruling: 15 s of quiet transport and 120 degrees of turn one way about the vertical. Note 3.6. Settles P101 (none of its three sides; the ruling) |
| P212 | design/requirements | Detect: Conveyor | Entered: 8 s of 0.03 to 0.30 g vibration above a walking rhythm. Note 3.2. Settles P102: the 100 to 400 Hz band cannot exist at 100 Hz sampling |
| P213 | design/requirements | Detect: Inverted | Entered: the tag's up axis within 25 degrees of down for 4 s; low confidence on a hanging tag. Note 3.2. Settles P104 by a rule of its own |
| P214 | design/requirements | Detect: Dark idle | Trigger entered: one timed wake two hours after motion stops. **Only the trigger**: the wording of the line (P106) is not an engineering matter and stays open |
| P218 | design/requirements | Power | Rewritten for two AA cells, the boost regulator, the 45 s sleep rule and the estimated 0.25 mA. Note 2. Settles P092 and P095 |
| P222 | design/requirements | Sensor configuration | Added: 100 Hz, 94 Hz filter, +/-16 g, +/-2000 deg/s, FIFO. Note 3.1. Settles P097 (neither 42 nor 44 Hz) |
| P224 | design/requirements | Firmware state machine | Not entered as its own row: the state machine is in note 3.2 and in the Rev B sketch; the requirements "Power", "Governor" and the Detect rows carry it. Drop from the list, or say if a row is wanted |
| P226 | design/requirements | Low battery | Added: three steps at 2.4, 2.2 and 2.0 V, battery read through a divider. Note 2.10. Settles P127 (the divider is now in the hardware and the behaviour in the sketch) |
| P227 | design/requirements | Audio content format | Superseded: no card and no MP3. Clips are 16-bit mono WAV in the controller's flash, `/p<pack>/<class>_<n>.wav`. Entered on "Content ships independently of firmware" and "Phase 5 - Audio". Settles P131 by removing both namings. **Consequence for Sales and Production, not decided here:** a voice pack can no longer be sold as a microSD card |
| P242 | design/wiring | Motion interrupt | Changed: active low, latched, to D1, wakes from deep sleep. Settles P129 |
| P250 | design/bom | Batteries (BAT) | Changed to two cells. The "checked-bag legal" wording (P122) is not settled here |
| P253 | design/bom | Storage (SD1) | Retired: the part is not in the 2 x AA design |
| P293 | prototype/tests | Sleep current | The 2 x AA estimate and what to do above 0.4 mA added to the pass text. The documents' 200 uA is not expected to be met; said so in the row |
| P303 | prototype/tests | Free-fall | Added with a procedure (0.6 m from rest, five times). Not run |
| P304 | prototype/tests | Carousel | Added with a procedure (turntable or carousel at 5 to 25 deg/s). Not run |
| P305 | prototype/tests | Conveyor | Added with a procedure. Not run |
| P309 | prototype/tests | Loudness | Added as "Loudness at 1 m" with a method and the expected 80 dB. Not run |
| P310 | prototype/tests | Shock survival and drop tests | Added as "Drop survival": 1.0 m onto concrete, six faces, on a case (an estimate of the requirement). Not run |
| P221 | design/requirements | Firmware sketch compiles | Rewritten, and moved from blocked to **open**: a Rev B sketch exists, its detection core passes 26 host tests, and arduino-cli compiles and links it for the XIAO ESP32S3 (418,264 bytes, no warning in its files) with a stand-in for Arduino's ctags, which could not be downloaded. Left open for the owner to mark done after a build with the real tools. The test "Sketch builds for the board" is linked to it and left not run, with the agent's result in its text |
| P239 | design/wiring | Battery negative to ground | Settled: one ground star at the regulator's GND (note 2.8); every ground wire in the batch goes there |
| P246 | design/wiring | Schematic image: what it shows | Not entered: `schematic.png` draws Rev A (DFPlayer, UART, 4.5 to 4.9 V bus), which the 2 x AA design supersedes. The app's Schematic now holds the 2 x AA wiring (34 wires, no electrical error or warning) |
| P247 | design/bom | All 16 parts: unit price and speed option | Partly: the parts the 2 x AA design changes or adds carry a unit price and price breaks at 5 and 100 (estimates, labelled). The unchanged lines keep the documents' line cost. "Speed option" not entered |
| P324 | production/economics | Prototype | The totals were added to the row's text as the owner asked: $64.80 (parts list), $64.34 (PRD table) and $58.80 (PRD cost column), and the 2 x AA design's $72.83 / $72.83 / $62.69. The row's own figure ($64.80) is unchanged |
| P275 | prototype/assembly | Phase 2, step 11 - Motion sensor on I2C | Covered for the 2 x AA design by the text added to "Phase 2 - Electronics" (pins D5, D4, D1). The Rev A step text itself was not entered |
| P276 | prototype/assembly | Phase 2, step 12 - Audio module, UART and speaker | Superseded: no DFPlayer, no UART. The amplifier's wiring is in "Phase 2 - Electronics" |
| P274 | prototype/assembly | Phase 2, step 10 - Power rail | Superseded for the 2 x AA design: the rail is 3.3 V from a regulator; the check is in "Phase 2 - Electronics" and the test "Power rail voltage" |
| P280 | prototype/assembly | Phase 4 - Firmware | The 2 x AA steps added (core 4.0.0, board, files, expected boot line). Settles P098 for Rev B: the boot line is the one the Rev B sketch prints |
| P281 | prototype/assembly | Phase 5 - Audio | The 2 x AA steps added (WAV clips in flash) |

## Conflicts (Concept stage) that the rulings answer

These rows are yours; this is only what the engineering work decided, so the "waits on" rows above could be entered.

| Conflict | Answer |
|---|---|
| P092 Sleep mode and sleep current | Deep sleep, woken by the sensor's motion interrupt or the button; estimated 0.25 mA at the battery (0.2 to 0.4). None of the documents' figures holds |
| P093, P094, P112 Prototype totals | Added up, not reconciled, as the owner asked: $64.80, $64.34, $58.80, and "$10-15" in the idea chat. The parts list's $64.80 is taken as the documents' total |
| P095 Battery count | Two AA: the owner's ruling |
| P096 Motion sensor library | Neither: raw I2C through Wire, because the FIFO and the low-power cycle are not in the sensor library |
| P097 Low-pass filter | 94 Hz |
| P098 Boot log | Rev B prints its own line; see Phase 4 |
| P099 Weigh-in duration | 3.5 to 6 s |
| P100 Free-fall duration | Over 0.3 s: the owner's ruling |
| P101 Carousel | 15 s and 120 degrees of turn one way: the owner's ruling, with the settings chosen |
| P102 Conveyor band | Vibration size and rhythm in 1 s windows |
| P103 Handle grab | The owner's ruling, with the numbers chosen |
| P104 Inverted | Up axis within 25 degrees of down, 4 s |
| P105 Hard impact against the range | Range +/-16 g, threshold 6 g |
| P091 Motion history buffer | Neither 2 s nor 10 s as such: 0.5 s and 1 s windows, 0.8 s of launch history, a 40 s turn memory |
| P126 Sketch length | No longer applies: the Rev B sketch is 590 lines plus an 807-line detection core |
| P127 Low-battery warning | In the hardware and the sketch |
| P128 Boot calibration | No boot calibration: gravity and the gyro offset are learnt whenever the tag is at rest |
| P129 Motion interrupt pin | Active low, push-pull, latched |
| P131 Clip file naming | Neither: `/p1/impact_1.wav` and so on |
| P114 SPI flash audio: Rev B or Rev C | The prototype already plays from flash (the controller's own) |

## Left open on purpose

| Id | Why |
|---|---|
| P225 Boot calibration (requirement) | The Rev B firmware has none (see P128); nothing to enter unless the owner wants the Rev A step recorded |
| P230 Environment | Temperature, humidity and ingress are not settled by the rulings; "40 g survival" is used as the basis of the drop requirement only |
| P232, P250 (wording), P354, P355 Battery chemistry, compliance card, PackSafe | The ruling says the device need not be off for flight with AA cells and has a switch in case it is asked for. The card's wording and the regulatory row are compliance text, not engineering |
| P215, P216 Stretch detections | Not ruled on |
| P237 Rev B hardware scope | The roadmap's "Rev B" is a custom board; this note's "Rev B" is the 2 x AA prototype. The naming clash needs the owner |
| P257 to P262 Parts not on the list | Not ruled on. Note for P259: the design note keeps the hydrophobic mesh as a line in the speaker cavity inputs, with no part row |
| P298, P302, P306, P307, P308, P311 Other tests | No ruling; the Rev B log and logging mode make them possible, and "Calibration drops at three heights" is step 1 of the tuning list (note 3.7) |
| P264, P272, P300, P263, P265 to P269, P282, P283, P285, P301, P220, P255, P260 | The enclosure and the strap: the enclosure agent's rows. The envelope it needs is `docs/design/baggage-claims-device-envelope.json` |
| P277, P278 Assembly steps 13 and 14 | The button and wire-dressing steps of Rev A; unchanged in substance, not entered |
| P312 to P316, P325 to P353, P356 to P367 | Builds, batches, suppliers, methods and compliance: no ruling of 22 Nov bears on them |
| P318 to P323 | The PRD's cost columns by volume (electronics, speaker and storage, holder and hardware, enclosure, strap and packaging, labour). Not entered: the app adds the part prices itself, so the electronics lines would count twice, and the 1,000 and 10,000 figures assume a custom board that is not designed. The 2 x AA module design's own figures at 1, 5 and 100 are in the BOM (note section 5) |

## The device-related Concept rows ("With engineering (WS14)")

The 27 rows of the map whose resolution says "With engineering (WS14): a question about the device, its firmware, its parts or its print". Thirteen are conflicts already answered in the table above (P091, P092, P097, P098, P099, P102, P104, P114, P126, P127, P128, P129, P131); the other fourteen:

| Id | Section | Title | Answer from the engineering work | Settled? |
|---|---|---|---|---|
| P009 | concept/brief | How it works | The sheet's added text (+/-8 g, +/-500 dps, 44 Hz, a ten-second history, DFPlayer, three AA) describes Rev A. The 2 x AA design: +/-16 g, +/-2000 dps, 94 Hz filter, 0.5 s and 1 s windows, an I2S amplifier with clips in flash, two AA. Note 3.1 and 2.3. Enter the Rev B wording, not the sheet's | Yes, by the note |
| P011 | concept/brief | Power strategy | Two AA alkaline cells; deep sleep woken by the motion interrupt or the button; about 0.25 mA asleep (est), not 30 to 60 uA; about 6 months at four travel days a month (est). The "no lithium" argument stands for the device itself (the tracker's coin cell is the tag designer's open point). Note 2.5, 2.6 | Yes, by the note; the figures are estimates |
| P064 | concept/decisions | Which enclosure build? | The owner ruled an integrated print (another agent's Rev C, a one-piece print-in-place shell). Engineering adds only the inputs (note 6, the envelope file) and the conflicts with Rev C (note 6.6) | By the ruling; the choice of build is the tag designer's |
| P068 | concept/decisions | Which 3D printer? | Not an engineering question: the tolerances in note 6.5 assume a 0.4 mm nozzle at 0.2 mm layers on PETG, which both the A1 and the A1 mini print | No: a purchase |
| P069 | concept/decisions | Rev A sleep: light-sleep poll or deep sleep | Deep sleep with wake on the latched motion interrupt or the button, after 45 s without motion; light sleep only between FIFO batches while awake. Note 2.5, sketch `goToDeepSleep` | Yes |
| P070 | concept/decisions | Audio storage: microSD or SPI flash, and which revision | The controller's own 8 MB flash, in Rev B (the 2 x AA prototype): the DFPlayer and the card are gone because two cells cannot run them (note 2.2). Consequence: packs cannot be sold as a card | Yes for the device; the selling consequence is for Sales |
| P073 | concept/decisions | Sensor mount: mid-plate on standoffs or printed posts | Printed posts in the shell half that carries the loop, M2 self-tapping screws, flat tops; Rev C's two screws and two pegs are acceptable with tight pegs. Note 6.4, 6.6 | Yes |
| P076 | concept/decisions | Dark idle: add a light sensor? | No: motion only, one timed wake two hours after motion stops. A light sensor needs a window in the case and a part, and the hold is dark whether or not the bag is in it | Yes, by the note |
| P081 | concept/questions | How does a unit get its serial number? | Not settled. A proposal: the ESP32-S3's factory MAC (read with `ESP.getEfuseMac()`) printed on the serial log at boot as `BC-` and its last six hex digits, so the card can be printed from the unit itself. Not in the Rev B sketch; the format is the business's to fix | No |
| P110 | concept/questions | Hinge test coupon: sizes and print time differ | The two coupons test different things and both are useful: the build guide's pins 1.3 / 1.4 / 1.5 in 1.8 bores test the print-in-place hinge; the note's 0.20 to 0.35 clearances test the slip fits. Recommended clearances in note 6.5 (print-in-place 0.40 radial, 0.30 only after a coupon frees). The print time is the slicer's to say | Yes, by the note |
| P111 | concept/questions | Cost at 1,000 units: under $8, $4-6, or $19.00 | Not settled. The 2 x AA module design is $62.69 a unit at 100 with the kits at their one-off prices, about $44 with per-unit shares of the kits (est). Every 1,000-unit figure in the documents assumes a custom board with bare chips, which is not designed; under $8 is not plausible with modules | No: needs the custom board |
| P132 | concept/questions | Bambu Lab A1: two Micro Center numbers | Not an engineering question | No |
| P133 | concept/questions | Enclosure saving "from about $11.50" | Not settled by engineering. In the 2 x AA BOM the printed enclosure stays at the documents' $5.00, and the screws and standoffs kit at $6.99; the integrated print removes most of the screws (two left, for the sensor) | No |
| P134 | concept/questions | Ingress rating "IP424" | Not settled: no IP rating is claimed by this design, and none is tested. Rev C notes "splash-resistant at best" (hinge gaps, slots, grille without its mesh). Use no IP figure in any copy until a test is run | No; no rating should be claimed |

## Firmware requests from the lines and the voice packs

Listed for WS14 in `docs/design/baggage-claims-lines.md` ("What the lines ask of the firmware") and `docs/research/baggage-claims-voice-packs.md` (six requirements). Implemented in the Rev B sketch and core unless said; detail in note section 4.1.

| Request | Done |
|---|---|
| Count impacts in a journey; clips for the first, the second, "too many" | Yes: `impact_c1/_c2/_c3`, each once a journey phase; a landing counts as an impact [host] |
| Count carousel laps; clips for the second and third | Yes: each further 360 degrees of the same ride is reported; `carousel_c1/_c2/_c3` [host] |
| Dark-hold clips quieter | Yes: 10 dB under the volume step [host] |
| Several clips a moment, never the same twice running | Yes (`_1` to `_9`) [host] |
| A goodbye on mute | **No**: the off switch is a true disconnect; there is no power left to speak with |
| First-start flag | Yes: `box_1.wav` once, flag in flash |
| Clip numbers kept apart for later moments | Yes, by file stem instead of number; a missing stem falls back to pack 1, then the related moment |
| Find packs never seen | Yes, `/p1` to `/p9` |
| Say which pack is on | Yes: `name_1.wav` after a long press |
| Fall back to the first pack | Yes |
| Remember the choice across power-off | Yes (already) |
| A pack over USB without a card reader | Partly: a LittleFS image over USB with the maker's tools; not a buyer's path |
| Packs on a card | **No**: no card in the 2 x AA design |

## Things the engineering work found that someone should know

1. **Loudness.** About 80 dB at 1 m is the estimate for two AA cells, against "~85 dBA" in the documents; Rev A as drawn would be no louder. Marketing lines that lean on loudness should wait for the bench test.
2. **Voice packs on a card** are not possible in this build (P227 above). The Production row "Voice pack (DLC)" still says "sold as a microSD"; it was not changed.
3. **Sleep current** of 200 uA was never achievable with Rev A's parts (the DFPlayer idles at about 20 mA). The requirement text now says so.
4. **The Design stage is no longer shown as blocked** on the status page: its one blocked requirement (Firmware sketch compiles) is open.
5. **The speaker is 20 mm deep**, not 5. The redrawn two-cell Rev C keeps a 5 mm speaker in its stack; with it the tag would be about 8 to 10 dB quieter (est). The trade, and the other differences, are in the note (6.6) and the envelope file (`revCConflicts`).
6. **The governor's "one gag per class per journey phase"** now has one exception, so the score and the laps can run: impacts and carousel laps may play once per count step (one, two, too many). The cooldown and six-an-hour cap still hold.
