# Code use

Generated from package-lock.json at commit eaa25f1 by `npm run notices`; do not edit by hand.

## What this page is

A record of the third-party code and material this workbench uses, and how each piece is used. The library lists are generated from the installed dependencies, and a test fails when this page no longer matches them. Container images, fonts and copied source are listed by hand in `docs/third-party.manual.json`. The full list, including every transitive package and the licence texts, is in `THIRD_PARTY_NOTICES.md` at the root of the repository.

How a component can be used here:

- **Linked library**: installed by npm or pip and loaded into the web app or the planner process, unmodified.
- **Separate process**: a program that runs on its own and is called over the network or the command line; it is not linked or copied into this code.
- **Container image**: a published image the Docker build or Compose file starts from or runs.
- **Font files**: font files served to the browser, unmodified.
- **Copied source**: source copied into this repository, listed with its origin and changes.

## Summary by licence

Web app, npm production tree: 557 packages (40 direct, 517 transitive, of which 33 are platform-specific builds).

| Licence | npm packages |
| --- | --- |
| MIT | 430 |
| ISC | 47 |
| Apache-2.0 | 43 |
| LGPL-3.0-or-later | 10 |
| BSD-3-Clause | 8 |
| BlueOak-1.0.0 | 5 |
| Apache-2.0 AND LGPL-3.0-or-later | 3 |
| OFL-1.1 | 2 |
| (AFL-2.1 OR BSD-3-Clause) | 1 |
| (MPL-2.0 OR Apache-2.0) | 1 |
| 0BSD | 1 |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 |
| BSD-2-Clause | 1 |
| CC-BY-4.0 | 1 |
| EPL-2.0 OR GPL-3.0-or-later | 1 |
| MIT AND ISC AND BSD-3-Clause | 1 |
| Unlicense | 1 |

[//]: # (python:start)
Planner, Python packages: 19 (3 direct, 16 transitive).

| Licence | Python packages |
| --- | --- |
| MIT | 9 |
| BSD-3-Clause | 6 |
| BSD License (classifier) | 1 |
| MIT License | 1 |
| MIT License (classifier) | 1 |
| PSF-2.0 | 1 |

[//]: # (python:end)

## Web app: direct dependencies

From `package.json` "dependencies", at the versions installed by package-lock.json. "Imported in src/" says whether a source file of this repository imports it at this version of the code; "no" can still mean it is loaded by another package (react-dom is loaded by next) or that it was added for a planned item.

| Package | Version | Licence | How it is used | Imported in src/ |
| --- | --- | --- | --- | --- |
| @ai-sdk/openai-compatible | 3.0.94 | Apache-2.0 | linked library | yes |
| @ai-sdk/react | 4.0.183 | Apache-2.0 | linked library | yes |
| @fontsource-variable/inter | 5.3.0 | OFL-1.1 | font files | yes |
| @fontsource-variable/jetbrains-mono | 5.3.0 | OFL-1.1 | font files | yes |
| @radix-ui/react-dialog | 1.3.1 | MIT | linked library | yes |
| @radix-ui/react-slot | 1.5.0 | MIT | linked library | yes |
| @react-three/drei | 10.7.9 | MIT | linked library | yes |
| @react-three/fiber | 9.8.2 | MIT | linked library | yes |
| @streamdown/cjk | 1.0.5 | Apache-2.0 | linked library | yes |
| @streamdown/code | 2.0.1 | Apache-2.0 | linked library | yes |
| @streamdown/math | 1.0.4 | Apache-2.0 | linked library | yes |
| @streamdown/mermaid | 1.0.4 | Apache-2.0 | linked library | yes |
| @tanstack/react-query | 5.108.2 | MIT | linked library | yes |
| @xyflow/react | 13.0.2 | MIT | linked library | yes |
| ai | 7.0.179 | Apache-2.0 | linked library | yes |
| class-variance-authority | 0.7.1 | Apache-2.0 | linked library | yes |
| clsx | 2.1.1 | MIT | linked library | yes |
| cmdk | 1.1.1 | MIT | linked library | yes |
| cn | 0.5.2 | MIT | linked library | yes |
| embla-carousel-react | 8.6.0 | MIT | linked library | yes |
| framer-motion | 14.14.0 | MIT | linked library | yes |
| lucide-react | 1.77.0 | ISC | linked library | yes |
| mermaid | 12.3.0 | MIT | linked library | yes |
| motion | 14.14.0 | MIT | linked library | yes |
| nanoid | 6.0.2 | MIT | linked library | yes |
| next | 16.4.6 | MIT | linked library | yes |
| node-pg-migrate | 9.0.0 | MIT | linked library | yes |
| pg | 8.23.1 | MIT | linked library | yes |
| radix-ui | 1.8.1 | MIT | linked library | yes |
| react | 19.3.0 | MIT | linked library | yes |
| react-dom | 19.3.0 | MIT | linked library | no |
| react-markdown | 10.1.0 | MIT | linked library | yes |
| recharts | 3.8.0 | MIT | linked library | yes |
| remark-gfm | 4.0.1 | MIT | linked library | yes |
| sonner | 2.0.8 | MIT | linked library | yes |
| streamdown | 2.8.0 | Apache-2.0 | linked library | yes |
| tailwind-merge | 3.7.1 | MIT | linked library | yes |
| three | 0.187.0 | MIT | linked library | yes |
| use-stick-to-bottom | 1.1.6 | MIT | linked library | yes |
| zod | 4.6.7 | MIT | linked library | yes |

[//]: # (python:start)
## Planner: direct dependencies

From `planner/requirements.txt`, at the versions installed where this page was generated.

| Package | Requirement | Installed | Licence | How it is used |
| --- | --- | --- | --- | --- |
| fastapi | fastapi==0.115.* | 0.115.14 | MIT License (classifier) | linked library |
| networkx | networkx==3.4.* | 3.4.2 | BSD License (classifier) | linked library |
| uvicorn | uvicorn[standard]==0.32.* | 0.32.1 | BSD-3-Clause | linked library |

[//]: # (python:end)

## Not from a package manager

| Name | Version or tag | Licence | How it is used | Source |
| --- | --- | --- | --- | --- |
| AI Elements components | as fetched from https://elements.ai-sdk.dev/api/registry on 2026-11-20 | Apache-2.0 | copied source | https://github.com/vercel/ai-elements |
| Inter (typeface) | Fontsource metadata version v20 (2025-09-10), as packaged in @fontsource-variable/inter 5.3.0 | OFL-1.1 | font files | https://github.com/rsms/inter |
| JetBrains Mono (typeface) | Fontsource metadata version v24 (2025-09-11), as packaged in @fontsource-variable/jetbrains-mono 5.3.0 | OFL-1.1 | font files | https://github.com/JetBrains/JetBrainsMono |
| Node.js (official Docker image node) | 22-bookworm-slim | MIT (Node.js; its LICENSE also lists bundled libraries under their own licences); image build files MIT (nodejs/docker-node); the image also contains Debian bookworm packages under their own licences | container image | https://github.com/nodejs/docker-node |
| pgvector (Docker image pgvector/pgvector) | 0.8.7-pg19-trixie (default; PG_IMAGE may override it) | PostgreSQL | container image | https://github.com/pgvector/pgvector |
| pgvector (Docker image pgvector/pgvector, CI only) | pg17 | PostgreSQL | container image | https://github.com/pgvector/pgvector |
| PostgreSQL | 19 (inside pgvector/pgvector:0.8.7-pg19-trixie) | PostgreSQL | separate process | https://www.postgresql.org |
| Python (official Docker image python) | 3.13-slim | PSF-2.0 (Python); image build files unverified; the image also contains Debian packages under their own licences | container image | https://hub.docker.com/_/python |
| shadcn/ui components added by its CLI | as fetched by `npx shadcn@latest add` on 2026-11-20 | MIT | copied source | https://github.com/shadcn-ui/ui |
| UI components (Button, Dialog, Input, Table, Card, StatusBadge) | as committed in eb362b6 (2026-11-20) | owner's own work (Planet9V/eigenia); four files follow shadcn/ui's structure (MIT) | copied source | https://github.com/shadcn-ui/ui |

**AI Elements components**: origin Vercel's AI Elements registry, written into this repository by the shadcn CLI. None. The files are as the CLI wrote them.

**shadcn/ui components added by its CLI**: origin https://ui.shadcn.com registry, written into this repository by the shadcn CLI. None. The files are as the CLI wrote them; colours come from the theme variables in src/app/globals.css.

**UI components (Button, Dialog, Input, Table, Card, StatusBadge)**: origin Planet9V/eigenia, the owner's own project (owner's statement, 20 November 2026). Re-themed to Eigenia design tokens (per the file headers). On 20 November 2026 button.tsx gained the variant and size names shadcn/ui components pass, and dialog.tsx gained DialogHeader.

The file that references each entry, and the evidence for its licence, are in `THIRD_PARTY_NOTICES.md`.

### Planned, not yet included

OrcaSlicer, WireViz, OpenSCAD, CaseMaker and YAPP_Box are planned and are not in the repository yet. Each will be added to this page in the same change that introduces it: OrcaSlicer, WireViz and OpenSCAD run as separate processes, and CaseMaker and YAPP_Box as forked code with the changes listed.

## Development-only tooling

From `package.json` "devDependencies": used to build, check and test the code; not part of the production dependency tree.

| Package | Version | Licence |
| --- | --- | --- |
| @axe-core/playwright | 4.14.0 | MPL-2.0 |
| @playwright/test | 1.65.1 | Apache-2.0 |
| @tailwindcss/postcss | 4.3.5 | MIT |
| @testing-library/dom | 10.4.2 | MIT |
| @testing-library/react | 16.3.3 | MIT |
| @types/node | 22.20.5 | MIT |
| @types/pg | 8.23.1 | MIT |
| @types/react | 19.3.0 | MIT |
| @types/react-dom | 19.3.0 | MIT |
| @types/three | 0.187.0 | MIT |
| eslint | 9.39.5 | MIT |
| eslint-config-next | 16.4.6 | MIT |
| jsdom | 31.0.1 | MIT |
| license-checker-rseidelsohn | 4.4.2 | BSD-3-Clause |
| postcss | 8.5.33 | MIT |
| tailwindcss | 4.3.5 | MIT |
| tw-animate-css | 1.4.0 | MIT |
| typescript | 5.9.3 | Apache-2.0 |
| vitest | 5.1.1 | MIT |

## Attestation

The owner, Jim McKenney, approved the wording of this statement on 20 November 2026. The lists it refers to are regenerated on every change, and a test fails when they are out of date.

> I attest that:
>
> 1. The lists of npm and Python packages on this page and in `THIRD_PARTY_NOTICES.md` were generated from the dependencies installed for the commit stated at the top of this page.
> 2. Components marked "linked library" are used unmodified, under their own licences.
> 3. Components marked "separate process" are invoked as separate programs; they are not linked into or copied into this code.
> 4. Components marked "container image" are used as published, as the base of or alongside this application's containers.
> 5. Source copied or forked into this repository is listed above with its origin and the changes made to it.
> 6. This repository's own code is licensed as stated in its `LICENSE` file (Apache License, Version 2.0).
>
> Wording approved: Jim McKenney, 20 November 2026

## Full list

`THIRD_PARTY_NOTICES.md` at the root of the repository lists every package of the production tree, direct and transitive, with its version, licence and repository, the text of each licence once, and the evidence for each entry listed by hand.
