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
| Vector index at 4,096 | pgvector one-bit HNSW index with a second pass on the full vectors | exact search only | measured on PostgreSQL 19.0, `docs/design/vector-search.md`; pgvectorscale and VectorChord considered and not used (no stated PostgreSQL 19 support; VectorChord's licence needs sign-off) |
| Sign-in | built in (scrypt from Node, sessions in PostgreSQL); a named exception, because the `demo` default password is below every framework's minimum | none | built and tested, item 2.3 |
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
- [x] 0.4 First-run setup: Admin, Setup lists what is not configured, each with a button to where it is set and a Test there. Done 20 Nov. It does not open by itself after the first sign-in; the sidebar shows the password warning and features link to Admin.

### Phase 1: foundations, by replacement

- [x] 1.1 One definition of each object in `src/lib/domain`: a zod schema per section for the fields inside a row, and one reader each for `Part`, `Wire`, `Decision` and `Step`. The four part readers, the two geometry casts and the old `lib/design.ts` are deleted; every view reads through the domain layer. The API checks a row's fields against its section's schema on create and on change and stores them normalised (numbers as numbers, key lists as arrays). Older rows holding comma strings are converted at start-up. An unset quantity or cost is now null and shows as "not set", where one view used to show 0 and another 1. Done 20 Nov: 68 tests pass, including every seeded row against its schema; the eleven affected screens load in a browser with no console errors. Left for 1.4: the duplicate slug, download and number-format helpers.
- [x] 1.2 Route wrapper: every route validates its input with zod, answers 400, 404, 409 or 504 as JSON, runs multi-statement writes in one transaction, and times out outbound calls. Fixed: row corruption on PATCH, concept ID collision (including two creates at once), unknown concept returning 500, non-numeric IDs returning 500, search wildcards, missing `nosniff` on downloads, the wizard's pre-filled sales channel. Done 20 Nov: 34 tests pass against a real PostgreSQL (`npm test`). Per-section `data` schemas arrive with 1.1.
- [x] 1.3 Data loading on TanStack Query. A save the server refuses now rolls back on screen and shows its reason; a refused delete puts the row back; two edits to one row no longer overwrite each other; screens that share a store update each other without a reload; unneeded requests are cancelled. Done 20 Nov: 21 new tests (10 of them fail against the old code), and a browser check with forced server failures on three screens. Left: file uploads and concept creation still call the server directly and then refresh; two edits in flight to the same field of one row roll back imperfectly until the refresh lands.
- [ ] 1.4 Move to Tailwind 4 and initialise shadcn/ui, carrying the Eigenia colours and fonts as variables; every existing screen renders as before in light and dark. UI kit completed on shadcn/ui and the local copies deleted: field, select, textarea, modal, empty state, error line, toast, download helper. **Done 20 Nov:** Tailwind 4.3 with the theme in CSS; shadcn/ui set up with its colour names mapped onto the Eigenia tokens; 20 shadcn components and 7 AI Elements chat components added. Twenty pages compared before and after in light and dark: 22 of 40 identical, the rest differ by a few pixels of vertical spacing or by the 3D view. **Still to do:** delete the four local kits and move every screen onto the shared components.
- [ ] 1.5 Kanban, tables, wizard and forms moved to the adopted libraries.
- [ ] 1.6 dagre and elkjs replace the three hand-computed layouts.
- [x] 1.7 One planner: the NetworkX service is the only implementation; the web app's own version is deleted. Decisions are milestones that wait on the decisions they depend on and come before every step in the sections they unlock. Finished steps count as zero; the plan gives remaining and planned time. Loops are found in linear time, and everything downstream of a loop is blocked. With the service down the page shows the steps with no order and says so. Done 20 Nov: 20 service tests and the web tests pass against the real service; on the example, the go decision now heads the critical path (go, p0, p1, p6, p7, p8; 430 minutes). Not built, moved to 3.1: drawing decisions as milestones, the lines from a decision to what it unlocks, remaining beside planned time, and the list of ignored links.
- [x] 1.8 Migrations: SQL files in `migrations/`, applied at start-up by node-pg-migrate. An existing database adopts them without loss. The database now enforces: unique part references and unique keys per concept, object-shaped data, non-blank titles and names, cascade on concept delete. New tables for Phase 2: settings, credentials, printers, gates, and product type, stage and archive on concepts. The example concept loads once per database and does not return if deleted. Embeddings moved to their own table with no fixed width. Done 20 Nov: 85 tests pass, including an upgrade from a pre-migration database with repeated references, repeated keys and comma-string lists; the standalone build was started against a fresh database and against the older development database. Design: `docs/design/database.md`.
- [x] 1.9 Tests: Vitest on the domain layer, routes on a real PostgreSQL and components in jsdom (572 tests); a Playwright smoke test of every screen in light and dark with sign-in, a save, sign-out and an accessibility check (12 tests, 46 pages); three CI jobs. Done 20 Nov. Tests now run on PostgreSQL 19 with pgvector locally, so the pgvector tests are no longer skipped. One serious accessibility finding is listed, not fixed: low contrast on the empty-column hint of the boards.
- [ ] 1.10 The four oversized components split.
- [x] 1.12 Documentation in the app for the user, the admin and the developer, plus a system-context page with a diagram, at Documentation in the sidebar. The pages are the markdown files in `docs/guide`, so the repository and the app show the same text. Each says what is not built yet. Tests fail if the user guide misses a menu section or the admin guide misses a setting. Done 20 Nov; pages and both diagrams checked in a browser. Rule from here on: a change to behaviour updates its guide in the same commit.
- [x] 1.11 Code use: `npm run notices` generates `THIRD_PARTY_NOTICES.md` (413 web packages, 19 planner packages, licence texts) and the Code use page in the app; a check in the test suite fails when either is stale. Eight hand-listed entries for images and fonts. Done 20 Nov. The owner approved the attestation wording and confirmed the six copied UI components come from Eigenia (20 Nov). The planner's packages are now pinned exactly in `planner/requirements.lock`, after the first CI run showed the record going stale when a package released a new version.

### Phase 2: concepts, sign-in and admin

- [x] 2.0 Concept management API: read, edit, delete (the exact name must be typed), duplicate, archive and restore, and a full JSON export; three product types that hide the sections a product does not need. Done 20 Nov, 39 tests, including the example concept staying deleted across a restart. The screens are items 2.1 and 2.2.
- [x] 2.1 Concepts page: list, search, sort, open; `?concept=<id>` on any address opens that concept. Done 20 Nov.
- [x] 2.2 Edit, delete (type the name; JSON download offered first; recorded in the audit log), duplicate, archive and restore. Deleting the default concept clears that setting. Done 20 Nov, 19 tests and a browser run of every flow.
- [x] 2.3 Sign-in: one account, `demo` / `demo` at install, changed in Account. Every API route answers 401 without a session (a test walks every route file on disk), state-changing requests from another site are refused, 5 wrong passwords lock a name for 15 minutes, sessions last 30 days. Built in, not a framework (the default password is below every framework's minimum). Done 20 Nov, 101 tests and a browser run of 35 pages. Not run behind a real HTTPS proxy. No limit per network address, no roles. What it does not protect is written in the Admin guide.
- [x] 2.3a Admin API: credentials (never returned in full; last four characters only for keys of 12 or more), model and planner settings, any number of printers by family, a connection test per kind, a first-run status, and a record of the last 200 saves, removals and tests. Done 20 Nov, 57 tests against the stand-ins. Printer families that can be tested today: OctoPrint, Moonraker and file-only. Prusa, Duet and Bambu can be saved but are not driven; Creality and Elegoo have no documented fields yet. The screens are items 2.4 to 2.6.
- [x] 2.3b Integrations and Challenge pages point to Admin; environment variables are described as fallbacks. Done 20 Nov.
- [x] 2.3c Install-wide audit log (owner, 20 Nov): every change with time, user, concept and what changed, kept when the concept is deleted; deleting a concept is itself recorded. Read and downloaded as a file through the Admin API. Done 20 Nov, 4 tests. The screen is item 2.6a.
- [x] 2.4 Admin, Credentials: one card per provider built from the provider list, last four characters only, Test connection, recent activity. Done 20 Nov.
- [x] 2.5 Admin, Models: reasoning and embedding model with provider, address, name and width; presets for Qwen3 Embedding 8B at 4,096; Test; Index the current concept. Done 20 Nov.
- [x] 2.6 Admin, Printers: add, edit, switch on and off, remove, Test; the form is built from each family's definition and says what the app can do with that family today. Done 20 Nov.
- [x] 2.6a Admin, Audit log: filters by concept (deleted ones marked), kind of change and text; detail per line; download. Done 20 Nov. Not verified for 2.4 to 2.6a: no connection test has been pressed against a real service.
- [x] 2.7 Product types: each type sets its sections, its requirement columns and its gates; the sidebar and pages hide what a type does not use; a wooden-toy concept shows no schematic or soldering section (tested). Done 21 Nov.

### Phase 3: a guided process

- [x] 3.1 Stage state per concept and one next step on every page (under the title), in full on the overview and the Process page. Done 21 Nov.
- [x] 3.2 Gates per product type as data (six kinds of check), evaluated by one pure function in browser and server; an unmet gate warns and can be overridden with a typed reason, recorded with who and when; advancing is refused with the unmet checks listed. Done 21 Nov. Open: the concept API can still set the stage directly; an override cannot be withdrawn.
- [x] 3.3 A section whose unlocking decision is not made shows a warning naming the decision; it stays usable. Done 21 Nov.
- [x] 3.4 Change history: every write path records before and after per field (tested path by path); a History tab on every row with who, when, before and after and Restore; an Activity page for the concept. Done 21 Nov. Long text shows side by side, not as a diff.
- [x] 3.5 Requirements linked to acceptance tests and parts, checked on the server; coverage shown per requirement; a Traceability page with the matrix and three lists of gaps; deleting a linked row removes the dangling links in the same transaction. Done 21 Nov.
- [x] 3.6 Computed economics: unit cost from parts and cost lines, margin per channel, break-even, unit cost by batch size with price breaks; a part with no price is named, never counted as zero; every figure shows how it was worked out. Done 21 Nov, 74 tests.
- [x] 3.7 Named builds with exit criteria and linked tests; "Mark passed" is refused on the server while a criterion is unmet or a test has not passed. Done 21 Nov.
- [x] 3.8 Compliance checklist per concept and sales region, drafted by the reasoning model from the brief and parts and confirmed row by row; stated on the page and the report as a prompt for the user's own checking, not advice. Done 21 Nov. Drafting has run against a stand-in only.
- [ ] 3.9 Wizard rebuilt on Stepperize; it ends on the first "next step", not the overview. **Done 21 Nov:** it ends on the first next step. **Still to do:** the rebuild (wave C), and asking for the product type.

### Phase 4: the assistant across the pipeline

Every draft is saved as a draft, records what it was generated from, and needs approval.

- [x] 4.1 Reviewer works on whichever reasoning model Admin sets, and is reachable from any row ("challenge this", "verify this"). **Done 20 Nov:** one model layer (`src/lib/ai/models.ts`) for Ollama, LM Studio and OpenRouter, with plain-sentence failures and time limits; the reviewer uses it and every Anthropic setting is gone; rows can be embedded and searched by meaning (`POST /api/index`, search `mode=meaning` or `auto`). 72 tests against the stand-in. **Still to do:** reach the reviewer from any row; a button for indexing; research answers embedded; a run against a real Ollama, LM Studio and OpenRouter (whether each accepts structured output is unconfirmed); the pgvector tests have only ever run in GitHub Actions. **Done 21 Nov: "Challenge this" on any row and "Verify this" on claims and requirements, saved with a link back to the row. Run against stand-in models only.**
- [x] 4.1a Chat with the concept (owner, 20 Nov): questions answered from the concept's rows and research, found in pgvector by meaning, streamed, with numbered sources linking to their sections; built from the AI Elements components. PostgreSQL 19.0 with pgvector 0.8.7, tuned for 4,096 numbers per vector (Qwen3 Embedding 8B): small concepts searched exactly, large ones through a one-bit index and a second pass; settings and measurements in `docs/design/vector-search.md`. Done 20 Nov, tested on PostgreSQL 19 with real pgvector at 4,096. Not verified: a real model host, real Qwen3 vectors, more than 130 rows through the app. Open: a saved answer does not record how its sources were found; a broken stream saves the question without an answer.
- [x] 4.1b Search and indexes on PostgreSQL 19 with pgvector (owner, 20 Nov): a stored one-bit copy of every vector, compared across the whole concept and re-ranked (10,000 rows in 4 to 6 ms against 158 ms, same rows found); full-text search with GIN indexes replacing substring matching in chat, including questions that name a section; chat joins the meaning and word rankings; missing indexes added; `random_page_cost` set for solid-state storage. Done 20 Nov, 584 tests on PostgreSQL 19. An earlier figure (the one-bit index finding 59% inside a concept) was a fault in my first test data and is corrected in `docs/design/vector-search.md`. Not verified: real Qwen3 vectors. Not changed: the sidebar search box still matches substrings.
- [x] 4.2 Brief to press release and FAQ; the reviewer attacks it. **Done 21 Nov (stand-in models only). The attack-once rule is enforced in the browser, not yet on the server.**
- [x] 4.3 Brief to requirements. **Done 21 Nov (stand-in models only).**
- [x] 4.4 Requirements to a candidate parts list, with a kind, pins and typical size per part. **Done 21 Nov (stand-in models only); drafted pins become pin rows on approval.**
- [x] 4.5 Parts to candidate wiring, using each part's pin definitions. **Done 21 Nov (stand-in models only).**
- [x] 4.6 Parts and wiring to assembly steps with order and time, and to acceptance tests. **Done 21 Nov (stand-in models only).**
- [x] 4.6a Research client moved to Perplexity's current interface. Read from Perplexity's own documentation on 20 Nov: support for the old interface ended 27 September 2026; old-style requests are still answered by being translated, with no end date given. The client, its stand-in and a page-by-page reference (`docs/research/perplexity-api.md`) are written to the new interface. Not run against the real service.
- [x] 4.7 Research: a claim is verified only against a named source the user judges; the rule is enforced on the server; evidence shows on the claims board; source titles survive a reload; research answers are embedded and searched by meaning; Perplexity has a connection test (billed, a fraction of a cent). Done 20 Nov. Not run against the real Perplexity.
- [x] 4.8 Realignment: when a decision, requirement or part changes, NetworkX lists everything downstream and the assistant proposes the edits. **Done 21 Nov: `POST /impact` in the planner, a notice after a change, the list by section with why, and proposed updates as drafts shown before and after. Unit economics and the decision tree are "Review by hand".**
- [x] 4.9 Optimisation actions with a measured before and after: lower parts cost, fewer parts (design-for-assembly check), shorter print time. **Done 21 Nov: cost only when every part is priced, print time only from sliced times.**

### Phase 5: design tools to engineering grade

- [x] 5.1 Part kinds and a part library with pin definitions and pin positions. **Done 21 Nov: kinds in code, pins as rows (migration 0014), 28 library entries with every voltage and current sourced from a datasheet; pin positions on header boards are typical, marked so.**
- [x] 5.2 Geometry gains rotation; STL and STEP files can be attached as a part's real shape. **Done 21 Nov; a file in the wrong unit is flagged and never rescaled without the user choosing.**
- [x] 5.3 Schematic with proper symbols (per 0.3) and a toggle to pins-and-wires; net labels, power and ground symbols, title block. **Done 21 Nov. The Blocks view is not built.**
- [x] 5.4 Electrical checks: supply voltage against each part's range, unconnected power pins, missing pull-ups on shared buses. **Done 21 Nov. A part with no library entry gets fewer checks and the panel says so.**
- [ ] 5.5 KiCad schematic export. **Done when** `kicad-cli` in CI loads the file without error. **21 Nov: the export is written, but KiCad 10 in CI refused the file ("Failed to load schematic"). Being fixed.**
- [x] 5.6 3D view: drag and rotate handles, section cut, measurement, STL from the built-in exporter. **Done 21 Nov, checked in software-rendered Chrome only.**
- [x] 5.7 Enclosure, CaseMaker-based generator: forked into the app, driven by the concept's parts and layout. Standoffs, bosses, wall cutouts, lid types. **Done 21 Nov: CaseMaker forked as source at a pinned commit (Apache-2.0). A defect in its custom cut-outs is worked around with our own cutters.**
- [x] 5.8 Enclosure, YAPP_Box generator: OpenSCAD in the planner container, parameters written from the same parts and layout. **Done 21 Nov: ran for real in OpenSCAD here; the planner image with OpenSCAD has not been built.**
- [x] 5.9 Generator choice per concept, both shown side by side on the Baggage Claims example. **Done when** both produce a watertight base and lid whose cutouts line up with the parts. **Done 21 Nov: both produce a watertight base and lid with all five checks met on the example, as an automated test.**
- [x] 5.10 Only if 5.9 shows both fall short on a named need: write our own on Manifold and publish it as a separate repository. **Decided 21 Nov: not built. Neither generator failed a named need on the example.**
- [x] 5.11 3MF export. **Done 21 Nov; re-opened by a 3MF reader in a test.**
- [x] 5.12 NetworkX wire routing inside the enclosure, pin to pin around parts; routed lengths feed the build sheet and the 3D view. Speed measured on the example before the grid size is fixed. **Service built and measured 20 Nov** (`POST /route`, 16 tests: paths go round parts, never through them; multi-pin nets as one tree with splices; buried or unreachable ends reported by name; 0.7 s for the example-sized job, about 4 s per 100,000 cells). Still to do: connect it to the app, which needs pin positions from 5.1 and 5.2. **Done 21 Nov: 17 wires routed in 0.89 s on the example. Each wire is its own two-ended run; wire ends sit at part face centres until pin positions are joined.**
- [x] 5.13 Harness drawing from the wiring through WireViz. **Done 21 Nov: WireViz run as a separate program.**
- [ ] 5.14 Engineering-diagram view for non-electronic process products, only if a concept needs it.

### Phase 6: prototype, from sourcing to a finished print

- [x] 6.1 Sourcing: price, supplier, alternates and order status per part; search and cart links kept. No automated buying. **Done 21 Nov. Distributor search addresses have not been opened; Perplexity was a stand-in.**
- [x] 6.0 Supported-printer list (D14): for each family, the models released from November 2024 onward, the connection each one uses, and what must be switched on at the printer. Built from the makers' own pages, not from memory. **Done when** every listed model names its adapter and its source page, and the list is shown in Admin, Printers. **Done 21 Nov: 37 models, every fact with a source; shown at /printers.**
- [x] 6.2 Printer adapters, one interface: OctoPrint, Moonraker and Klipper, PrusaLink, Duet. Each confirmed against its own documentation first. **Done 21 Nov against stand-ins written from each maker's documentation. No real printer.**
- [x] 6.3 Bambu Lab adapter over the local network, covering the current A, P, X and H series as listed in 6.0. Requires the printer in LAN-only and Developer Mode; setup steps shown in Admin. Confirmed against Bambu's wiki first. **Done 21 Nov against a stand-in. Message bodies are from community notes, not Bambu's own pages. The certificate check is skipped for this local connection only, and the screen says so. No real printer.**
- [x] 6.4 Creality (through its Moonraker interface where exposed) and Elegoo adapters, marked experimental. **Done 21 Nov, marked experimental.**
- [x] 6.5 Slicer check, then OrcaSlicer command line in a container with a pinned version and a profile per printer. The check compares it with Bambu Studio's command line for Bambu printers, which was not evaluated. **Done 21 Nov: OrcaSlicer 2.5.0 chosen with reasons; the real program sliced a cube here (20 min, 3.7 g from its own output). The container and its CI job have not run.**
- [x] 6.6 Print flow: choose printer, slice, preview time and material, send, track to completion, record the result against the build. **Done 21 Nov; send and start proven against a stub printer only.**
- [x] 6.7 File-only path for any printer without an adapter. **Done 21 Nov.**
- [x] 6.8 Build sheet with routed lengths, wire gauge from current, strip lengths and connector details. **Done 21 Nov. Strip lengths are bench-practice starting values, not from data sheets, and the sheet says so.**

### Phase 7: production

- [x] 7.1 Batch plan with worked-out unit cost and cash needed per batch. Done 21 Nov.
- [x] 7.2 Suppliers, part prices with price breaks, and manufacturing methods feeding the economics. Done 21 Nov.
- [x] 7.3 Production readiness: four checks (tests, compliance, parts priced and sourced, economics complete) on the batch plan. Done 21 Nov. Still to wire into the production gate.

### Phase 8: going to market

The review found stages 5 to 7 are lists filled in by hand, and version 2 of this plan gave them six items at the very end. This is the full phase. It does not depend on the design tools in Phase 5: it needs the assistant (4.1) and an approved brief, so it is built alongside Phases 5 and 6, not after them. Every generated piece is a draft, records what it was generated from, and needs approval. Nothing is published or spent without an explicit approval in the app.

**Market and positioning**

- [x] 8.1 Personas drafted from the brief, verified claims and research; edited and approved. Done 21 Nov; model-backed parts have run against stand-ins only.
- [x] 8.2 Competitors and alternatives as a sortable table; prices and claims only from a cited research answer or the user; unsourced rows marked. Done 21 Nov; model-backed parts have run against stand-ins only.
- [x] 8.3 Positioning line and three messages with proof flags; the reviewer must attack it once before approval. Done 21 Nov; model-backed parts have run against stand-ins only.
- [x] 8.4 Pricing worked out against unit cost, channel fees and competitor prices. Done 21 Nov; model-backed parts have run against stand-ins only.

**Brand**

- [x] 8.5 Names and taglines with reasons and a checklist of links the user follows; the app never claims a name is available. Done 21 Nov; model-backed parts have run against stand-ins only.
- [x] 8.6 Brand kit: voice rules, colours with computed contrast, type, logos, boilerplate, a voice-check tool, and brand context for other generators. Done 21 Nov; model-backed parts have run against stand-ins only.
- [x] 8.7 Imagery list with uploads; hero and detail shots can be rendered from the 3D model. Done 21 Nov; model-backed parts have run against stand-ins only.

**Content and ads**

- [x] 8.8 Ad generation per channel (Amazon Sponsored, Meta, X, search): variants written to each channel's length limits, each tied to one message from 8.3, each with its stop and scale rule. **Done 21 Nov: ten channels; a limit is enforced only where the platform's own page was read, others warn and say "Not verified". Generators not run against a real model.**
- [x] 8.9 Landing page: generated as structured sections, rendered with pre-built blocks at a preview address per concept, in the brand kit. Export as a static page. **Done 21 Nov.**
- [x] 8.10 Amazon listing: title, bullets, description and search terms generated to Amazon's field limits, with an image checklist. **Done 21 Nov. The flat file is one generic row, not a category template.**
- [x] 8.11 Social posts and a content calendar: posts generated per channel and scheduled on a calendar view. **Done 21 Nov. Nothing posts. Dragging on the calendar was not exercised in a browser.**
- [x] 8.12 Launch email and press note drafts from the press release (4.2). **Done 21 Nov. Nothing is sent.**

**Campaigns**

- [x] 8.13 Campaign planner: objective, audience, channel, budget, dates, creative, measure of success and the rule for stopping or scaling. Campaigns sit on a calendar and a board. **Done 21 Nov.**
- [x] 8.14 Launch plan as a dated checklist per channel (the example concept's Kickstarter and Amazon route are its first two templates), with its steps in the order of operations. **Done 21 Nov: five templates; platform rules without a source are worded as checks.**
- [x] 8.15 Results: spend, clicks, orders and cost per order entered or imported per campaign, compared with its target; the assistant proposes stop, hold or scale against the rule set in 8.13. **Done 21 Nov. Platform CSV column names are not verified against real export files.**
- [x] 8.16 Tracked links per campaign and creative, so results can be tied back to the piece that produced them. **Done 21 Nov.**

**Sales and channels**

- [ ] 8.17 Amazon sales read through SP-API into the sales monitor. Needs a Professional selling account.
- [ ] 8.18 X: approved posts sent, cost shown first; replies drafted for approval.
- [ ] 8.19 Instagram: posting after Meta App Review; replies drafted for approval. The review is started as soon as an account exists.
- [ ] 8.20 Reviews and questions log with drafted replies, and a list of what customers keep asking that feeds back into Requirements (4.8).

## Unverified, to be checked before the item that needs it

- Printer protocols and Bambu's current rules were read from single pages; none was exercised.
- OrcaSlicer's licence and whether a newer slicer suits current printers better.
- Licences of tscircuit's symbol set, the kanban kits, Stepperize, dagre and elkjs.
- The model layer against a real Ollama, LM Studio and OpenRouter (tested against a stand-in only).
- Research against the real Perplexity service (tested against a stand-in only).
- Sign-in behind a real HTTPS reverse proxy.
- Amazon buying: no permitted automated route is known.

## Open decisions

None. O1 (Tailwind), O2 (licences) and O3 (Bambu models) were settled on 20 November as D12, D13 and D14.

## Sources

Research evidence and links from 20 November are in `docs/deep-dive/2026-11-20-remediation-plan.md`. The five review reports of 20 November are summarised in the quality bar and adoption table above; their page reads are marked in the Status column.
