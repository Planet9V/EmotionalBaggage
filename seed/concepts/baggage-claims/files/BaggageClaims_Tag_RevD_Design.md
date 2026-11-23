# Baggage Claims MK1, Rev D: the slim leather-look tag

22 November 2026. Rev D answers the owner's direction of 22 Nov (in substance): *the device should look like a leather-looking, high-quality baggage tag; change the AA cells to a watch battery if that is what it takes to make it smaller; no large dangling object; it must have a pocket for an AirTag and be a little larger.* Rev B and Rev C are untouched beside this folder. The electronics, the airline rules and the power choice are in `ENGINEERING.md`; this file is the form.

**How I read "a little larger".** The tag is only a little larger than it has to be to hold the tracker pocket, the name card and the electronics: a flat, slim, premium luggage tag, not a box. In numbers: as thin as the tracker allows (the tracker is 8.0 mm; the tag is 12.8), and in plan the size of an ordinary luggage tag or a little smaller (62 x 92 mm), because the tracker, the speaker, the board and the card have to sit side by side, not stacked.

Generator `src/tagd_gen.py` (manifold3d; imports Rev C's lettering, 3MF and check helpers). Renders `src/render_d.py` (Blender 5.3 Cycles; imports Rev C's studio and materials). Sheets `src/compose_d.py`. Power and BOM figures `src/power_budget.py`, `src/bom.py`. Progress log `notes/progress.md`.

## 1. What you are choosing

Start with `out/comparison_sheet.png` and answer with a code (for example A1). Every option is **62 x 92 x 12.8 mm**, has the same inside and passes the same **20 of 20 checks**.

| Code | Direction | Colourway | Body (PETG) | Thread / lettering (PETG) | Strap (TPU) | Filaments | Printed cost, est |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| A1 | Heritage | Saddle | Bambu Lab PETG HF Peanut Brown | Bambu Lab PETG HF Cream | Bambu Lab TPU for AMS Black | 3 | $1.00 |
| A2 | Heritage | Black | Bambu Lab PETG Basic Black | Bambu Lab PETG Basic Dark Beige | TPU for AMS Black | 3 | $1.00 |
| B1 | Edge | Navy | Bambu Lab PETG Basic Navy Blue | Bambu Lab PETG HF Cream | TPU for AMS Black (strap and edge bumper) | 3 | $1.14 |
| B2 | Edge | Espresso | Bambu Lab PETG Basic Dark Brown | Bambu Lab PETG Basic Dark Beige | TPU for AMS Black (strap and edge bumper) | 3 | $1.14 |
| C1 | Envelope | Oxblood | Elegoo PETG Burgundy Red | Bambu Lab PETG HF Cream | TPU for AMS Black | 3 | $1.02 |
| C2 | Envelope | Cognac | Elegoo PETG Brown | Bambu Lab PETG Basic Dark Beige | TPU for AMS Black | 3 | $1.02 |

Colour names are from current listings read on 22 Nov 2026: Bambu Lab PETG HF and PETG Basic colour lists (SimplyPrint filament database, <https://simplyprint.io/filaments/bambu-lab/petg-hf>, <https://simplyprint.io/filaments/bambu-lab/petg-basic>), Elegoo PETG colours (3DJake, <https://www.3djake.com/elegoo/elegoo-petg-filament>); "TPU for AMS Black" as in Rev C (not confirmed by a page I read). No pages gave colour values: **the render colours are my approximations** (saddle, black, navy, espresso, oxblood, cognac). PETG, not PLA, because a tag on a case sits in hot car boots and on tarmac; PLA softens near 55 to 60 C [recalled].

**Name and tagline.** Front: "BAGGAGE CLAIMS / MK1" and "Your luggage finally talks back." (the launch video script's line under the title card, `seed/concepts/baggage-claims/files/BaggageClaims_LaunchVideo_Script_RevA.txt`, 0:06; **marked for the owner to confirm**, as in Rev C). Back: "FRAGILE — and emotionally unstable." (the owner's line, word for word) on the tracker door. No third-party name or logo anywhere; the tracker is "AirTag-style" in these documents only.

## 2. Size

| | Plan | Thickness | Volume of the envelope | Mass |
| :-- | :-- | :-- | :-- | :-- |
| **Rev D tag** (all directions) | **62 x 92** | **12.8** | 73 cm3 | about 62 to 64 g with the tracker [est] |
| AirTag-style tracker | 31.9 dia | 8.0 | 6 cm3 | about 11 g [est] |
| A typical leather luggage tag | about 70 x 110 [est] | about 4 to 6 [est] | | 20 to 40 g [est] |
| Rev C box | 60 x 80 | 42 | 202 cm3 | about 155 g [doc] |

Rev D is **a third of Rev C's volume, 30 % of its thickness and about 40 % of its mass**. Against a leather tag it is a little smaller in plan and about twice as thick: the 8 mm tracker inside sets the thickness (an "AirTag leather luggage tag" is about as thick for the same reason [est]). It hangs close: the strap holds it about 10 mm under the handle (`out/scale_on_handle_with_revC.png`).

## 3. One construction for all three directions

**Inside** (back view, x to the right; details and keep-outs in `ENGINEERING.md` section 4 and `baggage-claims-device-envelope-revD.json`):

- **Lower half:** the tracker pocket (32.5 bore, three 0.4 pads, a ring wall) behind a **bayonet door in the back** that carries the FRAGILE line; beside it the 1 F supercapacitor in two saddles.
- **Upper half:** the speaker (28 x 7.5, 4 ohm) on a gasket under three printed fingers, in a sealed 5.6 cm3 chamber; beside it the 24 x 35 board on four posts, with the CR2032 in a printed cup under a **bayonet coin door in the front**. The off switch and the mode button sit on the board's edge behind the right-hand edge of the tag.
- **Top:** a solid band with the 18 x 3.2 strap slot.
- **Back plate:** drops into the body's rim and is held by **eight printed snap hooks**; it carries the card pocket (50 x 32 card under 1.5 lips, a thumb notch to bow it out) and the tracker door's seat.

**Printed pieces and jobs.** Job 1, PETG in two colours on one 256 mm bed: body, back plate, tracker door, coin door (all four lie outside-face down; every colour change is in the first three layers). Job 2, TPU: the strap (and B's edge bumper). **Three filaments per colourway, at most four in any job.** The name, tagline, stitches and FRAGILE are all in job 1.

**After printing.** The maker (about 15 minutes, no tools but tweezers; soldering is on the board, not in the tag): lay the gasket, press the speaker under its fingers, lay the capacitor in its saddles, set the board on its posts (leads through the wall notches), snap the plate on (the eight hooks click). B only: stretch the bumper over the rim. The user: drop the tracker into its pocket and turn its door with a coin (60 degrees); drop a CR2032 into the front cup and turn that door; slide the card under the lips; thread the strap through the slot, round the handle, press the stud through a hole. **No screws, no glue, no paint, no decals.**

**Leather, honestly, in print.**

- **Grain:** a pebble grain modelled into the outer faces: the creases of a jittered Voronoi pattern (cells about 2.3 mm), 0.55 wide, one layer (0.2 mm) deep. On the front it is printed against the bed (pits in the first layer; a textured PEI sheet adds to it), on the plate and doors likewise. It is real geometry in every render.
- **Stitches:** saddle-stitch dashes 2.2 x 0.85 (A, slanted 28 degrees like a saddle stitch) or 2.0 x 0.85 (C, straight), inlaid 0.6 deep in the thread colour, 3.0 from the edge. Whole dashes are dropped near the coin door; none are clipped.
- **Maker's stamp:** A's oval mark is a blind deboss 0.4 deep with the grain left out inside the oval, as a hot stamp presses grain flat.
- **Perforations:** the speaker grille is a perforated-leather panel: 1.3 mm holes on a 2.6 mm hexagonal lattice. Only the 61 over the speaker go through; the rest are blind (0.8 deep), so the panel reads as one piece of perforated leather. The lattice is centred on the coin door, so the door, turned 60 degrees to lock, keeps the pattern.
- **Edges:** rounded 1.0 to 1.6 mm, smooth, no grain: they read as burnished edges. B adds a black TPU bumper that reads as a painted edge and takes the knocks.
- **Lettering:** serif type was tried for A and C and **fails the print checks** at tag size (hairlines under 0.6 mm: 53 to 82 % kept, `out/*/report.json`); the lettering is Montserrat Bold (A), Inter ExtraBold / Black (B) and Poppins Bold (C), all open-licence placeholders until a brand kit exists.

**Premium edition (offered, not modelled): a real leather front.** C's body with the front skin recessed 1.0 mm inside the stitch line takes a 1.0 mm vegetable-tanned leather panel, die-cut with the 61 speaker holes and a 24.4 mm opening for the coin door, fixed with contact cement. **It needs assembly** (cutting or a die, punching, gluing), the leather ages and marks as leather does, and the perforations must line up with the speaker; it is a premium kit, not the integrated print. If wanted, the change to the generator is one parameter (front recess) and a panel outline exported as a cutting file.

## 4. Direction A: Heritage

Heroes `out/A1_1_hero.png`, `out/A2_1_hero.png`; backs `A*_2_back.png`; `out/A1_3_on_handle.png`; `out/A_exploded_labelled.png`; `out/A_dimensioned_sheet.png`.

**Concept.** The classic luggage tag: square shoulders cut at 45 degrees to the strap, saddle stitching all round in the thread colour (and round the back plate), a blind-stamped oval maker's mark holding BAGGAGE CLAIMS and MK1 between two rules, the tagline stamped below it, a perforated panel across the top. Nothing on it is louder than the stitching.

**Why it sells.** It is the tag people already buy, in the material they expect; the joke is in the small print and the voice. **A1 Saddle** (tan with cream thread, black strap): the archetype, and the warmest. **A2 Black** (black, beige thread): the business-class version; the blind stamp is quiet on black, so the thread carries it.

## 5. Direction B: Edge

Heroes `out/B1_1_hero.png`, `out/B2_1_hero.png`; backs `B*_2_back.png`; `out/B1_3_on_handle.png`; `out/B_exploded_labelled.png`; `out/B_dimensioned_sheet.png`.

**Concept.** A square-cut slab with 6 mm corners and a black TPU edge bumper, like a painted edge on a modern leather card holder. No stitching; a single blind border line 3 mm in. BAGGAGE / CLAIMS in inlaid capitals set left, a short rule, MK1, the tagline blind below. The perforated panel spans the top.

**Why it sells.** The design-shop version: graphic, modern, the most robust (the bumper takes the knocks a thrown bag gives a tag). **B1 Navy** with cream lettering, **B2 Espresso** with beige.

## 6. Direction C: Envelope

Heroes `out/C1_1_hero.png`, `out/C2_1_hero.png`; backs `C*_2_back.png`; `out/C1_3_on_handle.png`; `out/C_exploded_labelled.png`; `out/C_dimensioned_sheet.png`.

**Concept.** A paper luggage tag's clipped corners, translated into leather: straight stitching round the outline and a stitched welt across the face (a pocket's top edge) with its cut edge as a groove; above the welt the perforated panel, below it "Baggage / Claims" in the thread colour, MK1 and the tagline stamped. 

**Why it sells.** It reads as a travel document as much as a tag, and the inlaid name has the most presence of the three. **C1 Oxblood** and **C2 Cognac**, both with light thread. C is the base for the real-leather edition (section 3).

## 7. Design review (what changed, and why)

I looked at the renders as a design director at each round; the bar is a tag a good leather-goods shop would sell, and the owner rejected earlier work as juvenile.

| Round | Seen | Changed |
| :-- | :-- | :-- |
| 1 (first renders) | The coin door's bayonet notches showed as three dark crescents in the front: mechanical, cheap | Each door now has a 0.6 mm flange that covers its notches; only one fine parting ring shows |
| 1 | "BAGGAGE CLAIMS" on one line ran off the face at 4.2 mm capitals (52 to 57 mm wide) | Stacked BAGGAGE / CLAIMS in every direction, like a maker's stamp |
| 1 | Serif lettering (Cardo, Crimson, Lora) lost its hairlines in the print check | Sans capitals with generous tracking (section 3) |
| 2 | **B had two round perforated fields side by side (speaker and coin door): it read as a face** | B's perforations became a full-width panel like A's |
| 2 | **C's U-shaped flap seam under the perforations read as a smile under two eyes** | The U became a straight stitched welt; the perforated panel sits above it |
| 2 | The perforations round the coin door left a wide plain ring that made the door a target | The hole-free ring narrowed to the parting line; the door's own perforations continue the lattice |
| 2 | A's stamp: the grain ran through the oval and made it muddy; "BAGGAGE" touched the oval | Grain left out inside the oval; tracking reduced, oval widened |
| 3 (final renders, 2000 px) | The first grain (2.3 mm cells, 0.55 creases) read as crackle or reptile, not pebble leather; grain between the perforations made the panel busy; the coin slot at 30 degrees in a ring of holes read as a clock hand | Grain refined to 1.8 mm cells and 0.45 creases; the perforated panel and the stamp left smooth (a separate, pressed-looking inset); the coin slot horizontal with the door's holes kept clear of it; A's tagline smaller and lifted off the stitching |

## 8. Drop survival

A tag on a checked case is thrown, dragged and crushed. Rim 3.0 mm all round (measured in plan, 2.35 behind a hook pocket), rounded edges, a 1.6 front skin and a 2.4 back plate. The back plate sits **inside** the body's rim, so a knock on the edge reaches the body, not the joint; eight hooks share the load (strain 1.9 % on fitting, under the device note's 2 % for frequent use). The heavy parts (tracker 11 g [est], cell, capacitor) are held through their own centres: pads and door bosses for the tracker with 0.3 mm play, springs pressing the cell onto its door, saddles for the capacitor; the board is clamped between posts and pads. Both doors lock by bayonet lugs bearing on a 0.6 to 0.8 mm lip; nothing is hinged. The strap is TPU and bends rather than breaks; the slot web above it is 5.6 mm. B's bumper adds a 1.2 mm TPU layer round the edge. **Not tested.**

## 9. Check results (20 per direction, all pass)

`out/checks.txt`, `out/<A|B|C>/report.json`.

| Check | A | B | C |
| :-- | :-- | :-- | :-- |
| 1-3 Closed solids; one piece each; no overlap | pass; 0.000 mm3 | same | same |
| 4 Size (strap excluded) | 62.00 x 92.00 x 12.80 | same | same |
| 5-7 Inlays 0.6 flush; strokes (inlay >= 0.8, deboss >= 0.6, 90 % kept); capitals | pass; name 4.6, smallest 3.2 | pass; 4.6, 3.2 | pass; 5.4, 3.4 |
| 8 Parts: no interference, >= 0.3 to the shell and to each other | pass (least 0.29 to 0.30 to the shell; 1.0 part to part) | same | same |
| 9 Thickness stack through the tracker | 1.6 + 0.4 + 8.0 + 0.4 + 2.4 = 12.8 | same | same |
| 10 Tracker pocket fits 31.9 x 8.0, retention | bore 32.5, pads, door bosses 0.3 above, bayonet | same | same |
| 11 Card 50 x 32 x 0.5 | 0.3 all round, 0.4 play, lips 1.5 | same | same |
| 12 Speaker: grille open area and back volume | 78 mm2 = 21 % of the cone, all inside the 23 mm gasket, webs 1.3; chamber 5.6 cm3 | same | same |
| 13 Coin cell and door | opening 20.8; cell 0.15 under the door; springs at 1.15 | same | same |
| 14 Bayonet doors free at 0, locked at 60 degrees, held when pulled | pass | pass | pass |
| 15 Snap hooks: strain, engaged, no interference | 1.88 %; held; 0.000 | same | same |
| 16 Strap slot web | 5.6 above, 3.4 below | same | same |
| 17 Rim (measured in plan) | 3.00 (2.35 at a pocket) | same | same |
| 18 Prints flat, no supports | body: 62 mm2 of flat roofs (hook pockets, slots); plate: the card pocket's roof is a **33 mm bridge** (1673 mm2); doors 16 to 27 mm2 | same | same |
| 19 Materials | 2 in job 1 (all changes in the first 0.6 mm), TPU in job 2 | same | same |
| 20 Switch and button 0.5 under the edge, slot clears the lever | pass | pass | pass |

## 10. Printing and estimates

- **Printer.** Any printer with an automatic material system; the jobs are laid out for a 256 x 256 bed (Bambu Lab A1 class, as the owner's notes name). Job 1 uses 171 x 92 mm; job 2 the strap's 190 mm (B: 201 x 139 with the bumper).
- **Settings** (from the owner's documents): PETG 0.2 mm layers, 230 to 235 C; walls are 1.6 to 3.0, so most of each part is perimeters. TPU for AMS from the AMS, as Rev C noted.
- **Bridge.** The card pocket's roof in the back plate is printed over a 0.9 mm gap, spanning the pocket's 32.6 mm width. A PETG bridge of that span sags a little; the pocket is 0.4 deeper than the card to allow for it. Print a coupon first. Fallback: two 1 mm ribs across the pocket (the card then goes in from the side).
- **Estimates (not sliced):** PETG 31 to 35 g, TPU 6.3 g (11.1 g for B with its bumper), 8 filament changes (3.2 g purge), **$1.00 to $1.14 of filament per tag** (PETG $20/kg from the owner's table, TPU $40/kg my figure). Rev C was $1.35 to $1.38.
- **Files per direction** (`out/<A|B|C>/`): `BaggageClaims_Tag_RevD_<key>_assembly.3mf` (one object, named parts: body, plate, door_tracker, door_cell, inlay_*, strap, B's bumper_tpu, with slot numbers and display colours), `..._print_plate_PETG.3mf` (job 1, as printed), `..._print_plate_TPU.3mf` (job 2); STL per body in `stl/` and as printed in `print/`; `report.json`.

## 11. Final review of the full renders

Read as a design director against the comparison sheet and the 2000 px heroes:

- **It now reads as a leather tag first and a gadget second**: grain field, smooth perforated inset, stitched or bumpered edge, a blind stamp or an inlaid name, a black strap. Nothing is cartoon; no feature pair reads as a face any more.
- **Strongest:** A1 Saddle (the archetype) and B1 Navy (the most "designed" and the most robust). C's inlaid "Baggage / Claims" has the most shelf presence but is the most graphic of the three.
- **Weakest points that remain, honestly:** the coin door is still a visible disc in the perforated panel (it is the battery door; making it disappear would mean moving the cell to the back, under the card, which the layout does not allow without growing the tag); the blind-debossed tagline is hard to read in A and B at arm's length (true of a real blind stamp too); the strap in the hero shots is a plain loop, and a stitched or tapered strap end would lift it; the grain's real look depends on the first layer (section 12).
- On the handle (`out/scale_on_handle_with_revC.png`) the tag hangs about 10 mm under the bar; Rev C's box beside it shows the change in size. Rev C's cord is drawn for Rev C's own handle and does not wrap this bar exactly.

**Files.**

- `out/comparison_sheet.png` (3500 x 3960: A1 to C2, front and back, with the Rev C scale picture and the size table).
- Per option: `out/<code>_1_hero.png`, `out/<code>_2_back.png` (codes A1, A2, B1, B2, C1, C2).
- Per direction: `out/<A1|B1|C1>_3_on_handle.png`, `out/<A|B|C>_exploded_labelled.png`, `out/<A|B|C>_dimensioned_sheet.png`; `out/scale_on_handle_with_revC.png`.
- Per direction `out/<A|B|C>/`: assembly 3MF, print-job 3MFs (PETG, TPU), `report.json`, `stl/`, `print/`, `scene/`. `out/checks.txt`, `out/power_budget.json`, `out/bom.json`.
- To regenerate: `python3 -I src/tagd_gen.py all`; `sh src/render_all.sh`; `python3 -I src/compose_d.py`.

## 12. Unverified

- Every bought part's size marked typical; the speaker's shape behind its rim; the tracker's domed profile; the switch levers' reach (the slot is drawn for a lever reaching 0.5 under the edge: choose the part to suit or add a printed lever cap).
- Nothing has been printed: the grain pits on the bed face (0.55 wide), the snap hooks, the bayonets (0.25 radial clearance), the card bridge, the speaker fingers, TPU-for-AMS for a 2 mm strap and a stretch bumper.
- The loudness, the battery life and the airline acceptance (all in `ENGINEERING.md` section 6).
- Water: splash at best (perforations, the side slots, the door rings); a hydrophobic acoustic mesh behind the grille is not modelled.
- The suitcase and handle in the "on handle" pictures are illustrative; colours are screen approximations.
