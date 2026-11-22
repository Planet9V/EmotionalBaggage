# Baggage Claims: rows of the owner's list settled by the 2 x AA engineering work

22 November 2026. For whoever keeps `baggage-claims-owner-decisions.md` and its CSV. This file only reports; it changes neither of them.

Scope: rows in the **Design, Prototype and Production** stages that the owner's rulings of 22 Nov settle (two AA cells; a physical off switch; the Adafruit MPU-6050 breakout; free-fall over 0.3 s; carousel about 15 s or more with the best settings; handle grab as tilt and quick motion then sustained tilt and carry; hard impact as in the documents; "what is the best way to detect a throw"; "yes we need the Arduino sketch"; "add up the prototype costs"; do not ask about engineering details, estimate and label). Each was settled by an engineering decision recorded in `docs/design/baggage-claims-device.md` and entered through the batch `seed/concepts/baggage-claims/content/2026-11-22-engineering.json` (rows E001 to E109). Rows in Concept, Research, Marketing and Sales are not touched here, including the conflict rows themselves (P092 to P131), which sit under `concept/questions`: the second table says which of them the rulings answer, for you to close.

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
| P221 | design/requirements | Firmware sketch compiles | Rewritten, and moved from blocked to **open**: a Rev B sketch exists, its detection core passes 23 host tests, and it type-checks against the board's core. A full board build is **not** proved. A test "Sketch builds for the board" is linked to it, not run |
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
| P126 Sketch length | No longer applies: the Rev B sketch is 553 lines plus a 750-line detection core |
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

## Things the engineering work found that someone should know

1. **Loudness.** About 80 dB at 1 m is the estimate for two AA cells, against "~85 dBA" in the documents; Rev A as drawn would be no louder. Marketing lines that lean on loudness should wait for the bench test.
2. **Voice packs on a card** are not possible in this build (P227 above). The Production row "Voice pack (DLC)" still says "sold as a microSD"; it was not changed.
3. **Sleep current** of 200 uA was never achievable with Rev A's parts (the DFPlayer idles at about 20 mA). The requirement text now says so.
4. **The Design stage is no longer shown as blocked** on the status page: its one blocked requirement (Firmware sketch compiles) is open.
5. **The speaker is 20 mm deep**, not 5. The Rev C enclosure's depth stack has to be redone; one packing that closes on paper, with 0.9 mm spare, is in the note (6.2) and the envelope file.
