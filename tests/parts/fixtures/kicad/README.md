# KiCad reference file

`complex_hierarchy.kicad_sch` is KiCad's own demo schematic, copied unchanged:

- Source: `demos/complex_hierarchy/complex_hierarchy.kicad_sch` in https://gitlab.com/kicad/code/kicad
  at tag `10.0.8` (commit e432beac2668303194ba2040274f9e5efe773fc0; the file was last changed in
  d1a5ae8bc80c4ce7267539547d155947f704ab63, "Demo complex_hierarchy update", 20 October 2026).
- Written by KiCad itself: `(version 20260306) (generator "eeschema") (generator_version "10.0")`.
- SHA-256: a72bf0b45aef72eea5583bb1cf259a84962c62ef50d9616a716a3ec61926d13f
- Licence: CC BY-SA 4.0. KiCad's `LICENSE.README` at that tag says "Licensed under CC BY-SA 4.0:
  All the demo files provided in demos/*". Copyright the KiCad developers.
  https://creativecommons.org/licenses/by-sa/4.0/

Used only by tests: `tests/parts/kicad-format.test.ts` compares our export with it node by node, and
`tests/parts/kicad.test.ts` loads it (with its two sub-sheet references removed, in a temporary copy)
in kicad-cli as a control. It is not part of the app.
