# Welcome page: audit of every view that shows the example

23 November 2026, branch `ws32-all-views`. The question for each view: does it show the Rev D A1 tag and the Rev D
data (34 parts, 52 wires, CR2032, 62 x 92 x 12.8 mm), or something older (the generated box, the 2 x AA parts,
80 x 60 x 42, generic boxes and cylinders, the hub drawing)?

Evidence images are in `/home/claude/work/landing-v4/audit/` (outside the repository), captured at 1288 px with
3D forced on a software renderer, and at 390 px for the main views. "Seen" means the image was opened and looked
at after the fix. A row marked "not seen" was changed in code and tested but not looked at in a browser.

| View | Where | Before this pass | Now | Evidence | Seen |
|---|---|---|---|---|---|
| Hero, tag | `HeroStage` | Rev D tag (drawn, then live) | unchanged | `hero-schematic-1288.png`, `hero-schematic-390.png` | yes (drawn tag; live 3D seen in earlier passes) |
| Hero, Schematic card | `Artefacts` | a hub wheel of part names, not a schematic | a crop of the real schematic from the app's circuit and symbols: U1, U2, U4, SPK1, nets by class; links to the proof's Schematic tab | `hero-schematic-card-2x.png` | yes |
| Hero, cost, ad, listing cards | `Artefacts` | Rev D rows ($30.01, $17.67, $27.95) | unchanged | `hero-schematic-1288.png` | yes |
| Hero without script, reduced motion, slow device | same markup, server-drawn | drawn tag, hub wheel | drawn tag, real schematic crop | `sheet-noscript.png`, `hero-reduced-motion-still-1288.png` | yes |
| Film | `OriginScenes` | Rev D tag on the suitcase | unchanged | `film-1288.png` | yes (first frame) |
| Problem block | `ProblemArt` | no product shown | unchanged | `problem-1288.png` | yes |
| 01 Concept | `GetBrief` | text rows | unchanged | `get-01-1288.png` | yes |
| 02 Research | `GetClaim` | text rows | unchanged | `get-02-1288.png` | yes |
| 03 Design, The product | `ProductViewer` | Rev D product model | unchanged; its Exploded still (no WebGL) is now the stored exploded render, not generic shapes | `get-03-product-1288.png`, `get-03-product-390.png` | yes (live); the render still not seen in place |
| 03 Design, 3D model | `GetModel` | generic boxes and cylinders in a tag outline | removed: the product viewer is the 3D view | `sheet-get-04.png` (sub-views: The product, Schematic) | yes |
| 03 Design, Schematic | `EngSchematic` | Rev D: 20 parts with pins, 52 wires, 28 nets | unchanged | `get-03-schematic-1288.png` | yes |
| 04 Prototype, print view | `GetPrint` | the generated box: a grey base and an orange lid, 11.2 mm | the real printed pieces: plate 1 PETG (body, back plate, two doors), plate 2 TPU strap; 12.8 mm and 2.0 mm; layer cut; three looks | `sheet-get-04.png`, `get-04-print-*-1288.png`, `get-04-print-*-390.png` | yes |
| 04 Prototype, before it loads | `WhatYouGet` | outline of the shell in orange | the drawn tag | `sheet-noscript.png` | yes |
| 05 Production | `GetCost` | Rev D costs | unchanged (a duplicate key fixed) | `get-05-1288.png` | yes |
| 06 Marketing | `GetAd` | ad drafts, text | unchanged | `get-06-1288.png` | yes |
| 07 Sales | `GetChannel` | listing and channels, text | unchanged | `get-07-1288.png` | yes |
| Proof, 3D | `EngModel` | product model with tags and Parts panel | unchanged | `proof-3d-1288.png`, `proof-3d-390.png` | yes |
| Proof, Schematic | `EngSchematic` | Rev D | unchanged | `proof-schematic-1288.png`, `proof-schematic-390.png` | yes |
| Proof, Physical layout | `EngLayout` | tag outline from above, Rev D parts | unchanged | `proof-layout-1288.png` | yes |
| Proof, Enclosure and print | `EngPrinted` | authored design: plates, checks, jobs, renders | unchanged | `proof-enclosure-1288.png`, `proof-enclosure-390.png` | yes |
| Proof, Parts list | `BomTable` | 34 Rev D rows | unchanged | `proof-bom-1288.png` | yes |
| Proof, Build sheet | `EngBuildSheet` | 52 Rev D steps | unchanged | `proof-build-1288.png` | yes |
| Proof, Sell it (seven tabs) | `Market` | text and tables; no picture of the product | unchanged | `sheet-proof-sell.png` | yes |
| Proof, status row | `StageStatus` | counts from the gates | unchanged | `sheet-noscript.png` | yes |
| Proof without script | `Engineering` noscript | app screenshots of the Rev B schematic and the generated box | a still of the Rev D Schematic tab and two stored renders | `sheet-noscript.png` | yes |
| Proof 3D before it loads | `Engineering` | the drawn tag | unchanged | `sheet-noscript.png` | yes |
| Social card | `public/landing/og.png` | tag on the line, "Ready to sell" | unchanged | `/home/claude/work/landing-v4/proof3d/art/og.png` | yes (previous pass) |
| Icons | `src/app/icon.svg` and others | the tag | unchanged | previous pass | yes (previous pass) |
| `/welcome/early` | page | the form only; no product shown | unchanged | `welcome-early-1288.png` | yes |
| In the app, `/s/design/model` | `ModelView` | the box shell of the envelope for every concept | the shell drawn to the tag's outline when the concept's enclosure is authored and is the tag | none | not seen |
| In the app, `/s/prototype/printing` | `PrintFlowView` | no 3D preview on this page (job cards only) | unchanged | none | read in code |

## Removed with this pass

- `public/landing/{model,enclosure,schematic,wiring,chat,plan,process,social,launch}-{dark,light}.webp`: app
  screenshots from before Rev D, and `scripts/landing-shots.mjs`, which made them. The page shows none of them.
- The generated enclosure is no longer built for the welcome page (`exampleData.ts`).
- Rev B figures that were still in `content.ts` but shown nowhere (16 parts, 20 wires, $64.80, the 2 x AA parts list).

## What is not finished

- `/s/design/model` in the app knows one authored outline: the tag's, recognised by its size. Its parts inside
  are still the app's generic boxes and cylinders, and its doors, plate and strap are not separate pieces there.
  A general path needs the authored row to carry an outline (or the app to read it from the stored 3MF).
- Stage 01's one-liner still says "A $25 motion-reactive audio gadget": that is the example's own brief row, not a
  drawing, and was left as data.
- The hero's schematic crop is laid out for the card (the controller's edge, three parts); it is not the Schematic
  view's own layout, which is computed in the browser.
