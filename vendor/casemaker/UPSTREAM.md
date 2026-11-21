# CaseMaker (forked as source)

- Project: Case Maker, https://github.com/SlyWombat/CaseMaker (web app: https://electricrv.ca/casemaker)
- Licence: Apache-2.0, Copyright 2026 Electric RV Corporation (`LICENSE` and `NOTICE` copied unchanged from the repository root)
- Pinned commit: `8988792b627dd646e5acd02017a871aee1d0616c` (2026-11-20, on the project's main branch; `git describe` says `v0.2-2062-g8988792b6`, the latest tag in the clone is `v1.0.1`)
- Copied: `casemaker-app/src/` from that commit, only the files the headless engine needs (the shell, lid, standoff, snap catch and cutter code, the project types and the Manifold operations): 118 files. No React UI, no font data, no samples, no desktop build.
- Not copied, replaced by stubs in `stubs/`: the OpenCascade STEP reader (`occt-import-js`, LGPL-2.1) and `opentype.js`, which only text labels and STEP import use. This app never calls those paths. `NOTICE` still lists them, unchanged, because it travels with the source.
- `stubs/fontAssets.mjs` stands in for `engine/fonts/fontAssets.ts` (the six font files are not copied; the bundler would otherwise fail to find them).
- `entry.ts` is ours: it re-exports the handful of engine functions the generator calls. `build.mjs` bundles it with rolldown into `dist/engine.mjs` (committed, so the web app, the tests and the Docker build need no extra step). `dist/engine.d.mts` is hand written.
- Rebuild: `node vendor/casemaker/build.mjs`. manifold-3d stays external, so the app's own copy of the kernel is used.
- Our changes to CaseMaker's source: none to the copied files. Differences are only in `entry.ts`, `stubs/`, `build.mjs` and `dist/`.
- Used by `src/lib/enclosure/casemaker.ts`, which builds a CaseMaker project from the enclosure spec and runs the engine on the server.

## A defect found at this commit, worked around

CaseMaker's custom cut-outs (`customCutouts` in the project) cut only about 1 mm into a wall: the rectangular and round cutters start 1 mm inside the outer face and run wall + 2 mm onward, so a 2 mm wall keeps its outer or inner millimetre. It showed up on the example concept as an opening check that failed by the missing millimetre. `src/lib/enclosure/casemaker.ts` therefore builds its own cutters (`openingCutters`) from CaseMaker's own `cube`, `cylinder`, `translate`, `rotate` and `difference` and subtracts them from every plan node. It has not been reported upstream.
