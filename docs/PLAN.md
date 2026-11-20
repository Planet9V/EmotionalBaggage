# Plan, version 2: concept-to-realization workbench

20 November 2026. Replaces `docs/deep-dive/2026-11-20-remediation-plan.md`, which is kept only for its research evidence table and sources.

Version 1 was mostly hygiene with the product capability last. A five-reviewer assessment on 20 November scored the application at about 3 out of 10. This version is ordered around what the owner asked for, uses existing libraries wherever one exists, and sets a minimum of 7 out of 10 on every topic below.

## How this plan is worked

- One item at a time: build it, verify it against its "done when", tick it, do not reopen it.
- Nothing is hand-written where a maintained library does the job. Each exception is named in this plan with its reason.
- At the end of every phase, reviewers who did not build the work re-score every topic against the rubric below, from the running application and the code. A phase is not closed on the builder's say-so.
- Anything marked **unverified** is confirmed against its own documentation, or by a trial, before it is built on.

## The quality bar

Scores are 1 to 10; the minimum for every topic is 7 (owner, 20 November; first set at 8). The right-hand column describes the passing standard. "Now" is from the 20 November review. Where the reviewers did not score a topic directly the number is my own and is marked (est.).

| Topic | Now | What passing means, testably |
|---|---|---|
| User experience | 4 (est.) | A new user creates a concept and reaches a first printed part and a first marketing draft without reading documentation. One loading, error and empty-state pattern everywhere. Works by keyboard and on a tablet. No dead ends. |
| Visualisation | 5 (est.) | 3D model with real part geometry, rotation, drag handles, exploded view, section cut and routed wires. Schematic with proper symbols and a toggle to pins-and-wires. Decision tree, build order and layout laid out automatically. |
| Helpfulness to the user | 3 | Every screen says what to do next and why. Every stage has a gate that lists what is missing. The AI assistant is reachable from every row. |
| Technical features | 4 | Every design output can be handed to a tool or a person as it is: KiCad opens the schematic, the slicer accepts the enclosure, the build sheet has routed wire lengths. |
| Support and process orientation | 3 | A defined process per product type with stages, gates, required evidence, named builds and a recorded history of what changed and why. |
| Assistance from concept to production | 3 | The AI drafts each stage from the previous one (brief to requirements, to parts, to wiring, to assembly, to tests) and the user edits and approves. Works on a blank concept. |
| Marketing and sales support | 2 | Taglines, ads, a rendered landing page and listing copy are generated from the concept and approved by the user. Sales figures arrive from Amazon. Posts and replies are drafted and sent on approval. |
| Prototype assistance, sourcing to printing | 3 | From the parts list: sourced parts with price and alternates, a generated enclosure, a sliced file, a print started on the chosen printer, a tracked job, and a wiring sheet. |
| Optimisation and realignment | 2 (est.) | Changing a decision or a part shows everything downstream that is affected and proposes the updates. Cost, part count and print time each have a "make this better" action with a measured before and after. |
| Research assistance | 2 | Questions answered with citations and saved. A claim is marked verified only when a cited source supports it. Past research is searchable by meaning. |
| Engineering robustness | 2 | Inputs validated on every route, typed data per section, tests and CI green, no known data-corrupting bug. |
| Reuse of existing components | 3 | One UI kit, one data layer, one definition of each domain object. No duplicated helpers. |

## Skills applied

The owner asked for these to be used. Each is loaded at the start of the items it covers, not all at once.

| Skill | Applied to |
|---|---|
| senior-frontend | Phase 1 (data layer, UI kit, component splits) and every screen after it |
| design:research-synthesis | The review findings behind the quality bar, and each end-of-phase re-score |
| mermaid-expert | Process and flow diagrams in the docs and in the app's help (stage flow, gates, data flow) |
| 3d-web-experience | Items 5.2 and 5.6 to 5.12: the 3D view, enclosure preview and wire routing display |

## Decisions in force

| # | Decision |
|---|---|
| D1 | Repository `Planet9V/EmotionalBaggage`, public for now. |
| D2 | Public test: default sign-in `demo` / `demo`. |
| D3 | Credentials stored in PostgreSQL. No encryption layer. |
| D4 | Printers: every family researched is supported and selectable. Bambu Lab is a priority. |
| D5 | NetworkX is used for wire routing; decision-path analysis second. |
| D6 | Gates warn and can be overridden; the override is recorded. |
| D7 | Admin sets a reasoning model and an embedding model, each from Ollama, LM Studio or OpenRouter. |
| D8 | Enclosure generator is a choice per concept: CaseMaker-based or YAPP_Box. No hand-written generator unless it is clearly better than both; if it is, it is published as its own repository. |
| D9 | Slicer: OrcaSlicer, unless the check in item 6.5 finds one better aligned to current printers. |
| D10 | Minimum score of 7 on every topic above. |
| D11 | English only. |
| D12 | Move to Tailwind 4. The Eigenia colours and fonts carry over as variables. |
| D13 | Legal sign-off is given to use OrcaSlicer and WireViz. The app and the repository carry a code-use section that lists every third-party component and attests to how each is used. |
| D14 | Printers: no specific models are owned. Support a wide variety, with the focus on models released new or within the last two years (November 2024 onward). |

## Libraries adopted, and what each replaces

| Area | Adopt | Replaces | Status |
|---|---|---|---|
| Validation and types | zod 4 | no validation; untyped `data` | page read |
| Data loading | TanStack Query 5 | `useItems`, `usePlan`, `useConcept`, nine ad hoc effects | page read |
| Forms | react-hook-form with zod | one state variable per field in eight forms | not read this session |
| UI kit | shadcn/ui blocks and components | six copied primitives, four local kits, 73 hand-written cards | Tailwind 4 per D12 |
| Tables | TanStack Table (Dice UI data table) | hand-written sorting | page read |
| Kanban | dnd-kit based kanban (Dice UI or Kibo UI) | HTML5 drag and drop, no touch | licences unverified |
| Wizard | Stepperize | hand-written steps | licence unverified |
| Toasts | sonner | 32 separate error states | not read this session |
| Graph layout | @dagrejs/dagre for trees, elkjs for build order and pins-and-wires | three hand-computed layouts | licences unverified |
| React Flow chrome | React Flow UI (base node, labelled handle, zoom) | hand-written node boxes | page read |
| Schematic symbols | tscircuit `circuit-json` and `circuit-to-svg` | hand-drawn boxes, hand-written SVG export | **trial first**; symbol licence unverified |
| Model providers | Vercel AI SDK 7 with the OpenAI-compatible provider | one-provider reviewer route | tested here against a stand-in; confirmed on the real host by Admin's Test button; needs Node 22 |
| Vectors | `pgvector` package on `pg` | nothing fills the column today | page read |
| Sign-in | Better Auth, username plugin | none | unverified on a raw `pg` pool; "demo" may be under its password minimum |
| 3D editing | drei TransformControls, PivotControls, Bounds, Outlines | none | names read only |
| Solid modelling | manifold-3d | hand-written tray and lid mesh | page read |
| STL | three.js STLExporter and STLLoader | hand-written writer and parser | page read |
| 3MF | Manifold `export-3mf` | none | page read |
| Enclosures | CaseMaker (Apache-2.0) and YAPP_Box (MIT) | hand-written tray and lid | CaseMaker is two stars old: forked, not depended on |
| Slicing | OrcaSlicer command line in a container | none | licence from memory (AGPL); flags change by version |
| Wire routing | NetworkX `astar_path` and `steiner_tree` | centre-to-centre length guess | `steiner_tree` page read; speed unmeasured |
| Harness drawing | WireViz as a separate process | none | GPL-3.0, last release July 2024 |
| CSV | papaparse | two hand-written escapers | not read this session |
| Landing sections | Launch UI or Tailark free blocks | none | page read |
| Tests | Vitest, Playwright | none | page read |

Not adopted: Babylon.js (its React bindings have an unresolved React 19 problem; its solid-cutting feature is Manifold, which three.js can use directly), Mantine, HeroUI, Payload, Refine, next-forge, Prisma, LiteLLM, GoJS, JointJS. KiCad's symbol library is not bundled, because redistributing it carries its share-alike licence.

Kept hand-written, with reason: the millimetre layout editor's geometry (no library does three-view placement with snapping), and the schematic netlist logic (it is correct and small).

## Master list

### Phase 0: prove it runs, without anyone's machine

Model hosts, model names, addresses, keys and printers are all set in Admin at or after install and saved in the local database (D3, D7, D14). Nothing in this plan needs them in advance. Each integration is built against its documented interface, tested here against a stand-in server, and confirmed on the real service by its Test button in Admin after install.

- [ ] 0.1 GitHub Actions builds the three images and starts the stack with `docker compose up`. **Done when** the job shows all three containers healthy, the app answering, and pgvector active.
- [ ] 0.2 Stand-in servers for tests: one OpenAI-compatible server (chat and embeddings), one Perplexity-shaped server, and one per printer family. Every integration test runs against these.
- [ ] 0.3 tscircuit trial: ten real parts from the Baggage Claims list rendered as a symbol schematic. **Done when** the result is shown side by side with the current view and the symbol licence is read. If it fails, item 5.3 falls back to our own SVG symbol set.
- [ ] 0.4 First-run setup screen: after the first sign-in, Admin opens with what is not yet configured (models, research, printers), each with a Test button. Everything is skippable; a feature that is not configured says so and links back to Admin.

### Phase 1: foundations, by replacement

- [ ] 1.1 zod schema per section store; one typed `Part`, `Wire`, `Decision`, `Step` in `src/lib/domain`; the five duplicate readers deleted. Relations stored as arrays, not comma strings.
- [x] 1.2 Route wrapper: every route validates its input with zod, answers 400, 404, 409 or 504 as JSON, runs multi-statement writes in one transaction, and times out outbound calls. Fixed: row corruption on PATCH, concept ID collision (including two creates at once), unknown concept returning 500, non-numeric IDs returning 500, search wildcards, missing `nosniff` on downloads, the wizard's pre-filled sales channel. Done 20 Nov: 34 tests pass against a real PostgreSQL (`npm test`). Per-section `data` schemas arrive with 1.1.
- [ ] 1.3 TanStack Query replaces the hand-written hooks. Fixes swallowed save errors and deletes that vanish without rollback.
- [ ] 1.4 Move to Tailwind 4 and initialise shadcn/ui, carrying the Eigenia colours and fonts as variables; every existing screen renders as before in light and dark. UI kit completed on shadcn/ui and the local copies deleted: field, select, textarea, modal, empty state, error line, toast, download helper.
- [ ] 1.5 Kanban, tables, wizard and forms moved to the adopted libraries.
- [ ] 1.6 dagre and elkjs replace the three hand-computed layouts.
- [ ] 1.7 One planner: the NetworkX service is the only implementation; decisions enter the plan as milestones with their dependencies; finished steps count as zero remaining time.
- [ ] 1.8 Migrations tool in place; seeding moved to a script.
- [ ] 1.9 (started 20 Nov: `npm test` and a GitHub Actions run of typecheck, lint, tests and build are green on commit `c031e12`) Vitest on the domain layer and pure modules; route tests on a real PostgreSQL; Playwright smoke test per screen; GitHub Actions running all of it. **Done when** a push is green.
- [ ] 1.10 The four oversized components split.
- [ ] 1.11 Code use and attestation (D13): `THIRD_PARTY_NOTICES.md` in the repository and an About, Code use page in the app. For every third-party component: name, version, licence, source link, and how it is used (linked library, separate process, or forked code with our changes listed). Ends with a signed-off attestation statement. The library list is generated from the installed dependencies so it cannot go stale; tools run as separate processes (OrcaSlicer, WireViz, OpenSCAD) and forked code (CaseMaker, YAPP_Box) are listed by hand and updated in the same commit that adds them.

### Phase 2: concepts, sign-in and admin

- [ ] 2.1 Concepts page: list, search, open; concept in the URL.
- [ ] 2.2 Edit, delete (type the name; JSON download offered first), duplicate, archive and restore.
- [ ] 2.3 Sign-in with the default `demo` / `demo` account; every route checks the session.
- [ ] 2.4 Admin, Credentials: one card per provider, stored in PostgreSQL, with a test-connection button.
- [ ] 2.5 Admin, Models: reasoning model and embedding model, each with provider, address and model name. Every AI feature reads from here.
- [ ] 2.6 Admin, Printers: add any number of printers, each with a family, address and access details, and a test button.
- [ ] 2.7 Product types: electronics in an enclosure, printed part only, and non-electronic product. A type sets which sections a concept shows, its requirement columns and its gates. **Done when** a wooden-toy concept shows no schematic or soldering section.

### Phase 3: a guided process

- [ ] 3.1 Stage state per concept: current stage, gate status, and one "next step" on every screen.
- [ ] 3.2 Gates per product type with required evidence; unmet gates warn and can be overridden with a recorded reason.
- [ ] 3.3 Decisions that unlock a section warn in that section until decided.
- [ ] 3.4 Change history: every edit records before and after.
- [ ] 3.5 Requirements linked to acceptance tests and to parts.
- [ ] 3.6 Computed economics: parts total to unit cost; price, platform fees and unit cost to margin per channel.
- [ ] 3.7 Named builds (works-like, looks-like, EVT, DVT, PVT) with exit criteria.
- [ ] 3.8 Compliance section per product type, as a checklist the AI drafts and the user confirms. Marked clearly as a prompt for the user's own checking, not as advice.
- [ ] 3.9 Wizard rebuilt on Stepperize; it ends on the first "next step", not the overview.

### Phase 4: the assistant across the pipeline

Every draft is saved as a draft, records what it was generated from, and needs approval.

- [ ] 4.1 Reviewer works on whichever reasoning model Admin sets, and is reachable from any row ("challenge this", "verify this").
- [ ] 4.2 Brief to press release and FAQ; the reviewer attacks it.
- [ ] 4.3 Brief to requirements.
- [ ] 4.4 Requirements to a candidate parts list, with a kind, pins and typical size per part.
- [ ] 4.5 Parts to candidate wiring, using each part's pin definitions.
- [ ] 4.6 Parts and wiring to assembly steps with order and time, and to acceptance tests.
- [ ] 4.7 Research: answers saved with citations; a claim is marked verified only against a named citation the user confirms; embeddings filled; search by meaning.
- [ ] 4.8 Realignment: when a decision, requirement or part changes, NetworkX lists everything downstream and the assistant proposes the edits.
- [ ] 4.9 Optimisation actions with a measured before and after: lower parts cost, fewer parts (design-for-assembly check), shorter print time.

### Phase 5: design tools to engineering grade

- [ ] 5.1 Part kinds and a part library with pin definitions and pin positions.
- [ ] 5.2 Geometry gains rotation; STL and STEP files can be attached as a part's real shape.
- [ ] 5.3 Schematic with proper symbols (per 0.6) and a toggle to pins-and-wires; net labels, power and ground symbols, title block.
- [ ] 5.4 Electrical checks: supply voltage against each part's range, unconnected power pins, missing pull-ups on shared buses.
- [ ] 5.5 KiCad schematic export. **Done when** `kicad-cli` in CI loads the file without error.
- [ ] 5.6 3D view: drag and rotate handles, section cut, measurement, STL from the built-in exporter.
- [ ] 5.7 Enclosure, CaseMaker-based generator: forked into the app, driven by the concept's parts and layout. Standoffs, bosses, wall cutouts, lid types.
- [ ] 5.8 Enclosure, YAPP_Box generator: OpenSCAD in the planner container, parameters written from the same parts and layout.
- [ ] 5.9 Generator choice per concept, both shown side by side on the Baggage Claims example. **Done when** both produce a watertight base and lid whose cutouts line up with the parts.
- [ ] 5.10 Only if 5.9 shows both fall short on a named need: write our own on Manifold and publish it as a separate repository.
- [ ] 5.11 3MF export.
- [ ] 5.12 NetworkX wire routing inside the enclosure, pin to pin around parts; routed lengths feed the build sheet and the 3D view. Speed measured on the example before the grid size is fixed.
- [ ] 5.13 Harness drawing from the wiring through WireViz.
- [ ] 5.14 Engineering-diagram view for non-electronic process products, only if a concept needs it.

### Phase 6: prototype, from sourcing to a finished print

- [ ] 6.1 Sourcing: price, supplier, alternates and order status per part; search and cart links kept. No automated buying.
- [ ] 6.0 Supported-printer list (D14): for each family, the models released from November 2024 onward, the connection each one uses, and what must be switched on at the printer. Built from the makers' own pages, not from memory. **Done when** every listed model names its adapter and its source page, and the list is shown in Admin, Printers.
- [ ] 6.2 Printer adapters, one interface: OctoPrint, Moonraker and Klipper, PrusaLink, Duet. Each confirmed against its own documentation first.
- [ ] 6.3 Bambu Lab adapter over the local network, covering the current A, P, X and H series as listed in 6.0. Requires the printer in LAN-only and Developer Mode; setup steps shown in Admin. Confirmed against Bambu's wiki first.
- [ ] 6.4 Creality (through its Moonraker interface where exposed) and Elegoo adapters, marked experimental.
- [ ] 6.5 Slicer check, then OrcaSlicer command line in a container with a pinned version and a profile per printer. The check compares it with Bambu Studio's command line for Bambu printers, which was not evaluated.
- [ ] 6.6 Print flow: choose printer, slice, preview time and material, send, track to completion, record the result against the build.
- [ ] 6.7 File-only path for any printer without an adapter.
- [ ] 6.8 Build sheet with routed lengths, wire gauge from current, strip lengths and connector details.

### Phase 7: production

- [ ] 7.1 Batch plan with cost per batch size from the computed economics.
- [ ] 7.2 Supplier and manufacturing-method records per product type.
- [ ] 7.3 Production readiness gate drawing on tests, compliance and builds.

### Phase 8: marketing and sales

- [ ] 8.1 Positioning, taglines and ad copy generated from the approved press release.
- [ ] 8.2 Landing page generated as structured sections and rendered with pre-built blocks at a preview address per concept.
- [ ] 8.3 Amazon listing copy generated to Amazon's field limits.
- [ ] 8.4 Amazon sales read through SP-API into the sales monitor. Needs a Professional selling account.
- [ ] 8.5 X: approved drafts posted, cost shown first; replies drafted for approval.
- [ ] 8.6 Instagram: posting after Meta App Review; replies drafted for approval. The review is started as soon as an account exists.

## Unverified, to be checked before the item that needs it

- Printer protocols and Bambu's current rules were read from single pages; none was exercised.
- OrcaSlicer's licence and whether a newer slicer suits current printers better.
- Licences of tscircuit's symbol set, the kanban kits, Stepperize, dagre and elkjs.
- Better Auth on a raw `pg` pool, and its password minimum.
- The AI SDK's OpenAI-compatible provider against all three model hosts.
- NetworkX routing speed at a useful grid size.
- Amazon buying: no permitted automated route is known.

## Open decisions

None. O1 (Tailwind), O2 (licences) and O3 (Bambu models) were settled on 20 November as D12, D13 and D14.

## Sources

Research evidence and links from 20 November are in `docs/deep-dive/2026-11-20-remediation-plan.md`. The five review reports of 20 November are summarised in the quality bar and adoption table above; their page reads are marked in the Status column.
