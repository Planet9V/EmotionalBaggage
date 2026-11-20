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
| Marketing and sales support | 2 | From an approved brief the app produces personas, a competitor table, positioning, a brand kit, names and taglines, ads per channel, a rendered landing page, the listing, a content calendar and a campaign plan, each approved by the user. Campaign results are compared with their targets. Sales figures arrive from Amazon. Posts and replies are drafted and sent on approval. |
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

## Design decisions

Three documents fix the decisions that the rest of the plan builds on. They are the lead's; items below implement them.

| Document | Covers |
|---|---|
| `docs/design/database.md` | Tables, the rules the database enforces, migrations, and the tables still to come |
| `docs/design/wiring.md` | Part kinds, pins, wires, nets, electrical checks, routing, the three schematic views |
| `docs/design/visual-system.md` | Foundations, the frame, four page patterns, six states, diagrams, 3D |

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
| Schematic symbols | `schematic-symbols` drawings inside our own nodes (decided after trial 0.3) | plain boxes | MIT licence file read; each symbol's origin checked before it is copied |
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

- [x] 0.1 GitHub Actions builds the three images and starts the stack on every change. 33 named checks: all three containers healthy, the app answers, the example concept is listed, pgvector active (0.8.7 on PostgreSQL 19), the planner reachable from the app, the documentation pages served, backup and restore working, data surviving a restart, and the install working both with and without a `.env`. Done 20 Nov. Proven on Linux in Actions only; not yet run on a Mac.
- [x] 0.2 Stand-in servers in `tests/standins`: OpenAI-compatible (chat, streaming, embeddings; covers Ollama, LM Studio and OpenRouter), Perplexity, OctoPrint and Moonraker. Each records what it was sent and can be told to fail or stall. Shapes were read from each maker's documentation; every field not read is marked unverified in the file. Done 20 Nov, 21 tests. The other printer families get theirs with item 6.2 to 6.4.
- [x] 0.3 Symbol library trial, on the real 18-wire example circuit. Decision: use the symbol drawings from `schematic-symbols` (MIT) inside our own schematic nodes; do not use tscircuit's layout, renderer or viewer. Evidence and reasons in `docs/trials/tscircuit`. Done 20 Nov. Carried into 5.3: check each copied symbol's origin in the library's history first.
- [ ] 0.4 First-run setup screen: after the first sign-in, Admin opens with what is not yet configured (models, research, printers), each with a Test button. Everything is skippable; a feature that is not configured says so and links back to Admin.

### Phase 1: foundations, by replacement

- [x] 1.1 One definition of each object in `src/lib/domain`: a zod schema per section for the fields inside a row, and one reader each for `Part`, `Wire`, `Decision` and `Step`. The four part readers, the two geometry casts and the old `lib/design.ts` are deleted; every view reads through the domain layer. The API checks a row's fields against its section's schema on create and on change and stores them normalised (numbers as numbers, key lists as arrays). Older rows holding comma strings are converted at start-up. An unset quantity or cost is now null and shows as "not set", where one view used to show 0 and another 1. Done 20 Nov: 68 tests pass, including every seeded row against its schema; the eleven affected screens load in a browser with no console errors. Left for 1.4: the duplicate slug, download and number-format helpers.
- [x] 1.2 Route wrapper: every route validates its input with zod, answers 400, 404, 409 or 504 as JSON, runs multi-statement writes in one transaction, and times out outbound calls. Fixed: row corruption on PATCH, concept ID collision (including two creates at once), unknown concept returning 500, non-numeric IDs returning 500, search wildcards, missing `nosniff` on downloads, the wizard's pre-filled sales channel. Done 20 Nov: 34 tests pass against a real PostgreSQL (`npm test`). Per-section `data` schemas arrive with 1.1.
- [x] 1.3 Data loading on TanStack Query. A save the server refuses now rolls back on screen and shows its reason; a refused delete puts the row back; two edits to one row no longer overwrite each other; screens that share a store update each other without a reload; unneeded requests are cancelled. Done 20 Nov: 21 new tests (10 of them fail against the old code), and a browser check with forced server failures on three screens. Left: file uploads and concept creation still call the server directly and then refresh; two edits in flight to the same field of one row roll back imperfectly until the refresh lands.
- [ ] 1.4 Move to Tailwind 4 and initialise shadcn/ui, carrying the Eigenia colours and fonts as variables; every existing screen renders as before in light and dark. UI kit completed on shadcn/ui and the local copies deleted: field, select, textarea, modal, empty state, error line, toast, download helper.
- [ ] 1.5 Kanban, tables, wizard and forms moved to the adopted libraries.
- [ ] 1.6 dagre and elkjs replace the three hand-computed layouts.
- [x] 1.7 One planner: the NetworkX service is the only implementation; the web app's own version is deleted. Decisions are milestones that wait on the decisions they depend on and come before every step in the sections they unlock. Finished steps count as zero; the plan gives remaining and planned time. Loops are found in linear time, and everything downstream of a loop is blocked. With the service down the page shows the steps with no order and says so. Done 20 Nov: 20 service tests and the web tests pass against the real service; on the example, the go decision now heads the critical path (go, p0, p1, p6, p7, p8; 430 minutes). Not built, moved to 3.1: drawing decisions as milestones, the lines from a decision to what it unlocks, remaining beside planned time, and the list of ignored links.
- [x] 1.8 Migrations: SQL files in `migrations/`, applied at start-up by node-pg-migrate. An existing database adopts them without loss. The database now enforces: unique part references and unique keys per concept, object-shaped data, non-blank titles and names, cascade on concept delete. New tables for Phase 2: settings, credentials, printers, gates, and product type, stage and archive on concepts. The example concept loads once per database and does not return if deleted. Embeddings moved to their own table with no fixed width. Done 20 Nov: 85 tests pass, including an upgrade from a pre-migration database with repeated references, repeated keys and comma-string lists; the standalone build was started against a fresh database and against the older development database. Design: `docs/design/database.md`.
- [ ] 1.9 (started 20 Nov: `npm test` and a GitHub Actions run of typecheck, lint, tests and build are green on commit `c031e12`) Vitest on the domain layer and pure modules; route tests on a real PostgreSQL; Playwright smoke test per screen; GitHub Actions running all of it. **Done when** a push is green.
- [ ] 1.10 The four oversized components split.
- [x] 1.12 Documentation in the app for the user, the admin and the developer, plus a system-context page with a diagram, at Documentation in the sidebar. The pages are the markdown files in `docs/guide`, so the repository and the app show the same text. Each says what is not built yet. Tests fail if the user guide misses a menu section or the admin guide misses a setting. Done 20 Nov; pages and both diagrams checked in a browser. Rule from here on: a change to behaviour updates its guide in the same commit.
- [x] 1.11 Code use: `npm run notices` generates `THIRD_PARTY_NOTICES.md` (413 web packages, 19 planner packages, licence texts) and the Code use page in the app; a check in the test suite fails when either is stale. Eight hand-listed entries for images and fonts. Done 20 Nov. Open with the owner: the attestation wording is a draft awaiting approval; the origin of the six copied UI components is recorded as not established; the planner's packages are now pinned exactly in `planner/requirements.lock`, after the first CI run showed the record going stale when a package released a new version.

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
- [ ] 4.6a Research client moved to Perplexity's current interface. Perplexity's own migration page says support for the interface this app calls ended on 27 September 2026 and that its Agent interface replaces it (read by a build agent on 20 Nov; not yet confirmed by a live call). The client and its stand-in are rewritten together.
- [ ] 4.7 Research: answers saved with citations; a claim is marked verified only against a named citation the user confirms; embeddings filled; search by meaning.
- [ ] 4.8 Realignment: when a decision, requirement or part changes, NetworkX lists everything downstream and the assistant proposes the edits.
- [ ] 4.9 Optimisation actions with a measured before and after: lower parts cost, fewer parts (design-for-assembly check), shorter print time.

### Phase 5: design tools to engineering grade

- [ ] 5.1 Part kinds and a part library with pin definitions and pin positions.
- [ ] 5.2 Geometry gains rotation; STL and STEP files can be attached as a part's real shape.
- [ ] 5.3 Schematic with proper symbols (per 0.3) and a toggle to pins-and-wires; net labels, power and ground symbols, title block.
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

### Phase 8: going to market

The review found stages 5 to 7 are lists filled in by hand, and version 2 of this plan gave them six items at the very end. This is the full phase. It does not depend on the design tools in Phase 5: it needs the assistant (4.1) and an approved brief, so it is built alongside Phases 5 and 6, not after them. Every generated piece is a draft, records what it was generated from, and needs approval. Nothing is published or spent without an explicit approval in the app.

**Market and positioning**

- [ ] 8.1 Audience: personas drafted from the brief and research, each with the problem, the trigger to buy and the objection. Edited and approved by the owner.
- [ ] 8.2 Competitors and alternatives: researched with citations (Perplexity), kept as a comparison table with price, claim and weakness.
- [ ] 8.3 Positioning statement and message hierarchy: one positioning line, three supporting messages, proof for each, generated from 8.1 and 8.2 and attacked by the reviewer before approval.
- [ ] 8.4 Pricing: price options against unit cost (3.6) and competitor prices, with margin per channel worked out, not typed.

**Brand**

- [ ] 8.5 Name and tagline generation, with a screening checklist per candidate (domain, marketplace, trademark search links). Marked clearly as a prompt for the owner's own checks, not a clearance.
- [ ] 8.6 Brand kit per concept: voice and tone rules with do and do-not examples, colours, type, logo files uploaded by the owner. Stored once and applied to every generated piece and to the landing page.
- [ ] 8.7 Product imagery list: the shots a listing and ads need, taken from the 3D model as renders where possible, with uploads for photographs.

**Content and ads**

- [ ] 8.8 Ad generation per channel (Amazon Sponsored, Meta, X, search): variants written to each channel's length limits, each tied to one message from 8.3, each with its stop and scale rule.
- [ ] 8.9 Landing page: generated as structured sections, rendered with pre-built blocks at a preview address per concept, in the brand kit. Export as a static page.
- [ ] 8.10 Amazon listing: title, bullets, description and search terms generated to Amazon's field limits, with an image checklist.
- [ ] 8.11 Social posts and a content calendar: posts generated per channel and scheduled on a calendar view.
- [ ] 8.12 Launch email and press note drafts from the press release (4.2).

**Campaigns**

- [ ] 8.13 Campaign planner: objective, audience, channel, budget, dates, creative, measure of success and the rule for stopping or scaling. Campaigns sit on a calendar and a board.
- [ ] 8.14 Launch plan as a dated checklist per channel (the example concept's Kickstarter and Amazon route are its first two templates), with its steps in the order of operations.
- [ ] 8.15 Results: spend, clicks, orders and cost per order entered or imported per campaign, compared with its target; the assistant proposes stop, hold or scale against the rule set in 8.13.
- [ ] 8.16 Tracked links per campaign and creative, so results can be tied back to the piece that produced them.

**Sales and channels**

- [ ] 8.17 Amazon sales read through SP-API into the sales monitor. Needs a Professional selling account.
- [ ] 8.18 X: approved posts sent, cost shown first; replies drafted for approval.
- [ ] 8.19 Instagram: posting after Meta App Review; replies drafted for approval. The review is started as soon as an account exists.
- [ ] 8.20 Reviews and questions log with drafted replies, and a list of what customers keep asking that feeds back into Requirements (4.8).

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
