# BAGGAGE CLAIMS MK1 — STEP-BY-STEP BUILD GUIDE (Rev A, 19 Nov 2026)
# Companion files: schematic.png, 3d_view.png, BOM_shopping_list.csv,
# BaggageClaims_Classifier_RevA.ino, BaggageClaims_PiP_Clamshell_RevA.stl,
# pip_clamshell_gen.py
# First build: ~3.5 h total hands-on + ~5 h unattended 3D print.
# Tools: soldering iron + solder, flush cutters, small Phillips, tweezers,
# hot glue, multimeter, USB-C cable, PC w/ Arduino IDE 2.x.

## PHASE 0 — BENCH SETUP (15 min)
1. Lay out all 16 BOM line items; verify against BOM_shopping_list.csv.
2. Flash check the ESP32-S3: plug USB-C into PC, confirm a serial port appears.
3. Set multimeter to continuity; you'll use it after every solder step.
4. Soldering iron 350 C; never power the board from battery AND USB at once.

## PHASE 1 — 3D PRINT THE ENCLOSURE (~5 h unattended + 45 min coupon)
5. Slice BaggageClaims_PiP_Clamshell_RevA.stl in Bambu Studio: PETG, 0.2 mm
   layers, 4 perimeters, 25% infill, supports OFF, 230–235 C, fan 50–70%.
6. FIRST print only the stepped hinge coupon (edit pin_r/sock_ir pairs in
   pip_clamshell_gen.py: 1.3/1.4/1.5 mm pin vs 1.7/1.8/1.9 mm bore).
7. Squeeze each coupon pair once: the pair that pops free and rotates without
   grit is your calibrated clearance. Update PARAMS, regenerate, reslice.
8. Print the full clamshell flat-open. Expect ~62 g PETG, ~4–5 h.
9. Post-process: trim brim, break the hinge free with one gentle twist,
   exercise it 20×, test the snap latch — it should click and release by
   pinching the front wall. If stiff, sand the latch tooth ~0.2 mm.

## PHASE 2 — ELECTRONICS SUB-ASSEMBLY (~90 min)
Layout target: 5×7 cm perfboard, components on female headers (socketed, not
soldered directly — modules are replaceable).

10. POWER RAIL (do first, test before anything else):
    a. Solder 3xAA holder RED -> one leg of SPST slide switch S1.
    b. Other S1 leg -> perfboard VIN rail -> ESP32-S3 "5V/VIN" pin.
    c. Battery BLACK -> GND star point (one corner of the board).
    d. Insert 3xAA alkaline, switch ON, meter VIN->GND: expect 4.5–4.9 V.
       Switch OFF before continuing. FAIL = recheck switch wiring, do not
       proceed with voltage outside 4.2–5.2 V.
11. MPU-6050 (U2) — I2C:
    VCC->3V3 rail, GND->GND star, SCL->GPIO8, SDA->GPIO9, INT->GPIO6.
    IMPORTANT: mount U2 with its 2 screw holes onto the printed PCB posts
    with M2 self-tappers. Rigid mount only — foam kills the jerk signatures.
12. DFPlayer Mini (U3) — UART + audio:
    a. VCC -> VIN rail (4.5–5 V — NOT 3.3 V).
    b. GND -> GND star.
    c. ESP32 GPIO17 (TX) -> 1 kΩ resistor -> DFPlayer RX. The resistor is
       mandatory; without it you get random phantom triggers.
    d. DFPlayer TX -> GPIO16 (RX).
    e. DFPlayer BUSY -> GPIO4.
    f. SPK_1/SPK_2 -> speaker leads (either polarity).
13. MODE button (S2): one leg -> GPIO5, other leg -> GND, plus 10 kΩ pull-up
    from GPIO5 -> 3V3.
14. Dress wires flat, zip-tie bundles, re-run continuity on every net against
    schematic.png. Check for shorts VIN<->GND and 3V3<->GND (should be open).

## PHASE 3 — FIRST POWER-ON (10 min)
15. Modules seated, switch ON, meter 3V3 rail: expect 3.28–3.35 V.
16. MPU-6050 power LED lit. No hot spots by touch after 30 s.
17. Switch OFF.

## PHASE 4 — FIRMWARE (20 min)
18. Arduino IDE: install "esp32" boards core 3.x; Library Manager:
    DFRobotDFPlayerMini (v1.0.6+).
19. Board = "ESP32S3 Dev Module", Tools -> USB CDC On Boot = Enabled.
20. Open BaggageClaims_Classifier_RevA.ino, verify, upload via USB-C.
21. Open Serial Monitor @115200. Expected boot log:
    "CAL OK g=(0.00,0.00,1.00)" (±0.05) -> "DF OK" -> "IDLE".
    - If "DF FAIL": check microSD inserted, wiring, and the 1 kΩ resistor.
22. Wave the board: you should see "EVT:IMPACT..." etc. in the log.

## PHASE 5 — AUDIO / microSD (15 min)
23. Format microSD FAT32. Create folders /01 /02 /03 (voice packs).
24. Record 10 starter clips, mono 64 kbps MP3, name 0001.mp3…0010.mp3:
    0001/0002 impact groans, 0003 "Are you calling me FAT?", 0004 dinner line,
    0005 Wilhelm, 0006 carousel, 0007 conveyor, 0008 inverted, 0009 dark-idle,
    0010 low-battery rasp. Copy same set into each folder for now.
25. Insert card into DFPlayer BEFORE power-on.

## PHASE 6 — INTEGRATION (~30 min)
26. Hot-glue speaker to inside of TOP shell, cone over the honeycomb grille.
27. Route speaker leads down the side wall channel to the board.
28. Seat perfboard onto the 4 printed posts; M2 self-tap screws into pilots.
29. Seat 3xAA holder between the tray ribs; foam pad on top of batteries.
30. Thread both Velcro straps through the base strap slots.
31. Fold the print-in-place lid closed; snap the latch. Done mechanically.

## PHASE 7 — ACCEPTANCE TESTS (30 min)
Pass all five before declaring the unit done:
32. DROP: 0.5 m onto carpet -> impact gag within 1 s.
33. WEIGH-IN: lift to waist, hold 4 s dead still, set down -> weigh gag.
34. CARRY: carry by handle 15 s -> dinner gag.
35. IDLE: leave untouched 2 h (or temporarily set DARK_IDLE_MS=120000 for
    the test) -> dark-idle gag at wake poll.
36. SLEEP CURRENT: after 5 min motionless, meter in series with battery
    <200 µA. If higher, check BUSY pin wiring and that DFPlayer is idle.

## PHASE 8 — PACK-OUT (10 min)
37. Strap device to suitcase handle; bag the spare AAs + tiny screwdriver.
38. Stick the compliance card inside the shell: "Alkaline AA only. Switch OFF
    before checking bag per airline lithium-device policy."
39. Luggage tag: "FRAGILE — and emotionally unstable."
40. Log build time and any reworks — feed into Rev B BOM/assembly update.

# TROUBLESHOOTING CHEAT SHEET
# Boot loop: battery + USB both connected -> use one source only.
# No gags, log shows events: microSD format / folder names / file numbering.
# Gags at random: missing 1 kΩ on DFPlayer RX (step 12c).
# Weigh-in never fires: U2 mounted on foam or loose — remount rigid (step 11).
# High sleep current: DFPlayer BUSY floating -> check step 12e.
