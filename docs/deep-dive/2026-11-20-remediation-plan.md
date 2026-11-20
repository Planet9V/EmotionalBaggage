# Remediation plan: concept-to-realization workbench

20 November 2026. Covers the 15 gaps found in the audit, plus three new requirements from Jim: an admin area for API keys and credentials, English only, and full concept management (many concepts; create, edit, delete).

## How to read this

- This is a master list. Work goes one item at a time: build it, verify it, tick it, do not reopen it.
- "Done when" is the test that must pass before the box is ticked.
- Evidence labels: **checked** = I read it in search results from the primary or a named source on 20 Nov 2026; **agent-read** = a research agent read the page; **unverified** = from model knowledge only, because the research agents were blocked from fetching pages. Unverified items must be confirmed before they are built on.

## What the research settled

| Topic | Finding | Evidence |
|---|---|---|
| Request interception in Next.js 16 | `middleware` is renamed `proxy` and runs on the Node.js runtime only. The docs say to verify authentication and authorization inside each Server Function and not rely on Proxy alone; Proxy is for optimistic checks such as redirects. | checked (nextjs.org proxy reference, upgrade guide, authentication guide) |
| Auth libraries | Auth.js is now maintained by the Better Auth team. Vercel announced it was acquiring Better Auth on 7 July 2026. Better Auth stays MIT and self-hostable; commentators note the roadmap is shifting toward agent identity. | checked (better-auth.com, vercel.com, The New Stack) |
| Secrets | OWASP's Secrets Management Cheat Sheet says environment variables are generally accessible to all processes and may appear in logs or dumps, and are not recommended unless other methods are not possible. Mounted files or a secrets manager are preferred. | checked via a co-author's quotation of the cheat sheet (CyberArk developer blog); the cheat sheet page itself was not opened |
| Testing | Next.js docs: Vitest does not support async Server Components; use end-to-end tests for those. Playwright should run against a production build. | checked (nextjs.org Vitest and testing guides) |
| Amazon sales data | SP-API has not required AWS IAM or Signature Version 4 since 2 Oct 2023; calls use a Login with Amazon access token. A Professional selling account is required to register. Private developers self-authorize to get a refresh token. | checked (Amazon's GitHub discussion #3701 and SP-API FAQ wiki; two 2026 walkthroughs) |
| Amazon SP-API fees | Amazon's announcement page says sellers using SP-API directly for only their own business will not incur the new fees, and that the third-party developer fees are delayed. | agent-read (developer.amazonservices.com/spp-announcement) |
| Amazon buying | No official API for placing consumer orders was found. The Product Advertising API is deprecated in favour of the Creators API, which covers catalogue data only. | agent-read for the deprecation; the Amazon Business ordering API, the add-to-cart URL's status and the Conditions of Use were **not** checked |
| X | Pay-per-use since 6 Feb 2026: $0.015 to create a post, $0.20 if the post contains a URL, $0.005 per post read. | checked across several secondary sources; X's own pricing page was not opened |
| Instagram | Publishing by API needs a Business or Creator account and Meta App Review; about 100 API posts per rolling 24 hours. | checked in secondary sources only |
| Schematic symbols | KiCad's libraries are CC-BY-SA 4.0 with an exception: using them in a design does not put the design under that licence, but redistributing the libraries as a collection does. tscircuit publishes Circuit JSON tooling with KiCad converters. KiCanvas is an MIT browser viewer for KiCad files. | checked (kicad.org licence page, Debian copyright file, tscircuit docs, Hackaday) |
| Enclosure CAD | Browser CAD projects in 2026 commonly pair Manifold (WASM) for booleans, which gives watertight meshes, with OpenCascade (WASM) for STEP export. replicad wraps OpenCascade and exports STL and STEP. | checked (project pages and forum posts; no benchmark of our own) |
| Embeddings | Ollama serves local embedding models; nomic-embed-text is 768 dimensions, bge-m3 and mxbai-embed-large are 1024. Our `items.embedding` column is `vector(1024)`. | checked (several 2026 documentation pages) |
| 3D printers | OctoPrint and Moonraker have documented HTTP APIs for upload and start. Bambu Lab's local MQTT/FTPS protocol is community reverse-engineered; since 2025 third-party control needs LAN mode with Developer Mode on, and Bambu printers need sliced files, so a slicer command-line step is required. | **unverified** (agent could not open any page; endpoints, ports and firmware details are from model knowledge to mid-2026) |
| Password hashing and session cookies | OWASP parameters (Argon2id and scrypt settings, cookie flags). | **unverified** (pages not opened) |

## Decisions needed from Jim before the phase that uses them

| # | Decision | Needed by | My recommendation |
|---|---|---|---|
| D1 | Repository name: "EmotionalBagge" or "EmotionalBaggage" | Phase 1 | Confirm spelling |
| D2 | Sign-in approach | Phase 3 | A small owner sign-in built in the app (password hash, session table in Postgres, HttpOnly cookie, check in every API route), with Better Auth as the upgrade path if a second user is ever needed. Judgment, not a standard. |
| D3 | Where the master encryption key lives | Phase 3 | A key file mounted into the web container through Compose `secrets:`, outside the repo and backed up separately from the database |
| D4 | Which 3D printer | Phase 8 | None; this decides the adapter |
| D5 | What "NetworkX for routing" means | Phase 9 | None; options are decision-path analysis, wire routing, or both |
| D6 | Gates block or warn | Phase 4 | Block, with an override that records the reason |
| D7 | Local embeddings (adds an Ollama container) or none for now | Phase 8 | None for now; text search works |

## Master list

### Phase 1: safety net (audit items 1, 2, 3, 6)

- [ ] 1.1 API validation. Reject unknown sections and statuses not allowed for that section; validate field types. **Done when** the `not/a-section` + `banana` request returns 400 and a test covers it.
- [ ] 1.2 Not-found handling. Writes and reads for a concept or item that does not exist return 404 with a plain message. **Done when** the unknown-concept request returns 404, not 500.
- [ ] 1.3 Wizard saves only what was typed. Remove the pre-filled "Amazon" channel. **Done when** a wizard run with only name and one-liner creates no channel row.
- [ ] 1.4 Unit tests (Vitest) for the pure modules already in the repo: STL writer and mesh builders, schematic generators and checks, build-sheet derivations, layout checks, decision-tree model, plan fallback, wizard item builder, BOM CSV. The agents' throwaway checks become these tests. **Done when** `npm test` runs them and the figures match the ones reported (tray 28 triangles and 30,272 mm³; 18 wires; 40 joints; BOM total 64.80).
- [ ] 1.5 API tests against a real PostgreSQL: every route, including the validation and not-found cases. **Done when** they pass locally and in CI.
- [ ] 1.6 Planner tests (pytest): order, waves, critical path, a cycle. **Done when** they pass in CI.
- [ ] 1.7 Browser tests (Playwright, against a production build): every route loads with no console errors for the seeded concept and for an empty one; six interactions (choose a decision, drag a part in the layout, move a kanban card, wizard create, mark a wire soldered, generate and save an STL). **Done when** they pass in CI.
- [ ] 1.8 CI on GitHub Actions: typecheck, lint, unit, API with a Postgres service, planner, browser. **Done when** a push shows all green.
- [ ] 1.9 Create the private repository and push. **Done when** the repo exists under Planet9V and CI has run once.

### Phase 2: concept management (audit item 5, new requirement)

- [ ] 2.1 Concepts page: every concept as a row with name, one-liner, stage reached, last activity; search; open. **Done when** it lists the seeded concept and any created one.
- [ ] 2.2 Edit a concept: name and one-liner. **Done when** the change shows in the switcher, overview and report.
- [ ] 2.3 Delete a concept: type the name to confirm; offer "Download everything as JSON" first; deletes its rows, files and events. **Done when** a deleted concept is gone from the API and its files are gone from the database.
- [ ] 2.4 Duplicate a concept (a new product variant starts from an existing one). **Done when** the copy has the same rows and independent edits.
- [ ] 2.5 Archive and restore, so finished or parked concepts leave the switcher without being destroyed.
- [ ] 2.6 Concept in the URL (`/c/<concept>/...`) instead of browser storage, so a link opens the right concept. **Done when** a pasted link opens the same concept in a fresh browser.
- [ ] 2.7 Second seeded example is **not** added; new concepts come from the wizard or a duplicate. (Nothing invented.)

### Phase 3: owner sign-in and the admin area (new requirement; audit item 8 depends on it)

- [ ] 3.1 Owner sign-in (per D2). First-run setup creates the owner; setup closes once an owner exists. Every API route checks the session; Proxy only redirects. **Done when** every API route returns 401 without a session and tests cover it.
- [ ] 3.2 Secrets store: a `secrets` table holding ciphertext only. AES-256-GCM in the app, fresh nonce per write, the provider and field name bound in as associated data, key version stored. Master key per D3; the app refuses to start the admin area without it. **Done when** a database dump contains no plaintext key and a test proves a row copied to another name fails to decrypt.
- [ ] 3.3 Admin → Credentials page: one card per provider (AI reviewer, Perplexity, 3D printer, Amazon Seller Central, X, Instagram). Fields are write-only; the page shows "set", the last four characters and when it changed; blank means unchanged; remove clears it. **Done when** no API response ever contains a stored secret.
- [ ] 3.4 Test connection per provider: one cheap read-only call, returns pass or a cleaned error; can test a value before saving it. **Done when** a wrong key shows a clear failure and a right key shows pass (needs Jim's keys).
- [ ] 3.5 Integrations read from the secrets store first, environment second. `.env` keeps only the database password and the key file path.
- [ ] 3.6 Audit trail: who set, replaced, removed or tested which credential and when; never the value.
- [ ] 3.7 Admin → Settings: model names, planner address, printer kind and address, default concept.

### Phase 4: integrity and gates (audit items 4, 11, 13 in part)

- [ ] 4.1 Part delete is blocked while wires reference it, with the list of wires and a "delete the wires too" choice. Renaming a part's ref updates its wires in one transaction. **Done when** tests cover both.
- [ ] 4.2 Stage gates: each stage has a gate with required evidence, a go / rework / stop decision, who and when (per D6). Decisions in the tree that "unlock" a section actually lock it until decided.
- [ ] 4.3 Predictions on claims: prediction, threshold set before the test, test, result.
- [ ] 4.4 "Next" on the overview: the cheapest open item that unblocks the current gate.
- [ ] 4.5 Decisions appear on the overview and in the order of operations as milestones.

### Phase 5: run it for real (audit items 7, 8)

- [ ] 5.1 `docker compose up --build` on the MacBook. **Done when** the three containers are healthy and the app loads. Needs the Mac session.
- [ ] 5.2 Confirm pgvector is active in that database (the Integrations page reports it).
- [ ] 5.3 AI reviewer: one real exchange through Credentials → Test, then in Concept → Challenge.
- [ ] 5.4 Perplexity: one real query with citations saved.
- [ ] 5.5 Write up anything the live runs change (model names, response shapes).

### Phase 6: the two approved design features

- [ ] 6.1 Part kind on every part (resistor, capacitor, switch, button, connector, IC/module, sensor, speaker, battery, LED, motor, generic). Drives the symbol.
- [ ] 6.2 Schematic symbols drawn in our own SVG set for those kinds (not bundled from KiCad's libraries, because redistributing that collection carries its licence). Pins placed by convention: power top, ground bottom, inputs left, outputs right.
- [ ] 6.3 View toggle on the schematic: Symbols / Pins and wires / (later) Block diagram. Same data, same wires, positions saved per view.
- [ ] 6.4 Net labels, power and ground symbols, junction dots, title block; export SVG and PDF.
- [ ] 6.5 KiCad schematic export (`.kicad_sch`) that opens in KiCad. **Done when** Jim opens one in KiCad and it loads. Until then it is labelled untested.
- [ ] 6.6 Enclosure generator with features, using Manifold for booleans: floor standoffs under the board from the layout, screw bosses, wall cutouts for parts that pass through a wall (switch, button, USB), speaker grille, strap slots, lid lip. Each feature comes from a part's geometry and a "passes through wall / mounts on floor" flag set in the layout view. **Done when** the generated tray and lid are watertight, the cutouts line up with the parts in the 3D view, and tests check volume and manifoldness.
- [ ] 6.7 3MF export alongside STL. STEP export (OpenCascade) only if Jim needs to edit the enclosure in CAD.
- [ ] 6.8 Fix the placeholder positions in the Baggage Claims example once real positions exist; until then the layout checks keep flagging them.

### Phase 7: generation and the remaining process items (audit items 9, 13)

- [ ] 7.1 Press release and FAQ as the first artefact of a concept; the reviewer attacks it.
- [ ] 7.2 Demand-test section before Design.
- [ ] 7.3 Marketing generation: taglines, ad copy and a landing-page draft produced by the AI from the brief and press release, saved as drafts that need approval. Every draft records what it was generated from. Nothing is published by the app.
- [ ] 7.4 Landing-page preview route per concept, rendered from the approved draft.
- [ ] 7.5 "Challenge this" and "Verify this" on rows.
- [ ] 7.6 Design-for-assembly check on the parts list.
- [ ] 7.7 Named builds in Prototype (works-like, looks-like, EVT, DVT, PVT) with exit criteria.

### Phase 8: outside integrations (audit item 8, in part 10)

- [ ] 8.1 Printer adapter per D4. OctoPrint and Moonraker: upload and start, confirmed against their docs first. Bambu Lab: confirm the current rules (LAN mode, Developer Mode) on Bambu's wiki first; needs a slicer step; highest risk of breaking on a firmware update.
- [ ] 8.2 Amazon Seller Central: register as a private developer (needs a Professional selling account), self-authorize, store the three credentials in Admin, read orders and order metrics into the Sales monitor.
- [ ] 8.3 Amazon buying stays as search and cart links unless a checked, permitted route turns up. Open research: Amazon Business ordering API, the cart URL's status, Conditions of Use on automation.
- [ ] 8.4 X posting: approved drafts post through the API; cost shown before posting (a post with a link costs about thirteen times a plain one).
- [ ] 8.5 Instagram posting: needs a Business or Creator account and Meta App Review; start the review early because it takes weeks.
- [ ] 8.6 Embeddings per D7.

### Phase 9: housekeeping (audit items 10, 12, 14, 15)

- [ ] 9.1 Split the four files over 500 lines.
- [ ] 9.2 Build record in the Claude project and in the repo (`docs/STATUS.md`), updated at the end of each phase.
- [ ] 9.3 NetworkX beyond build order, per D5.
- [ ] 9.4 English only is the rule: no translation layer is added. (Recorded so nobody adds one.)
- [ ] 9.5 What was taken from Eigenia is written down (tokens, fonts, six UI components) and what was not (its app shell, tests, translation layer).

## Audit item to phase

| Audit item | Phase |
|---|---|
| 1 No tests | 1.4 to 1.8 |
| 2 API accepts anything | 1.1 |
| 3 Unknown concept gives a server error | 1.2 |
| 4 Part delete or rename orphans wires | 4.1 |
| 5 Cannot delete a concept | 2.3 |
| 6 Wizard pre-fills Amazon | 1.3 |
| 7 Docker never run | 5.1 |
| 8 No live integration exercised | 3.4, 5.3, 5.4, 8.x |
| 9 Marketing is lists only | 7.3, 7.4 |
| 10 NetworkX only does build order | 9.3 |
| 11 Decisions do not gate anything | 4.2, 4.5 |
| 12 Eigenia styling, not codebase | 9.5 |
| 13 Eight process improvements unbuilt | 4.2 to 4.4, 7.1, 7.2, 7.5 to 7.7 |
| 14 Files over 500 lines | 9.1 |
| 15 No build record | 9.2 |

## What this plan does not know

- Whether this session can create a GitHub repository. If not, Jim creates the empty repo and the push follows.
- Anything marked unverified above. The research agents could not open web pages in this session; only search results were readable.
- How long the phases take. No estimates are given because none would be grounded.

## Sources

- Next.js proxy reference: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Next.js upgrade guide for version 16: https://nextjs.org/docs/app/guides/upgrading/version-16
- Next.js authentication guide: https://nextjs.org/docs/pages/guides/authentication
- Next.js Vitest guide: https://nextjs.org/docs/app/guides/testing/vitest
- Better Auth joins Vercel: https://better-auth.com/blog/better-auth-joins-vercel
- Vercel acquires Better Auth: https://vercel.com/blog/vercel-acquires-better-auth
- Auth.js is now part of Better Auth: https://better-auth.com/blog/authjs-joins-better-auth
- OWASP Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- CyberArk developer blog quoting the cheat sheet: https://developer.cyberark.com/?p=2096
- SP-API no longer requires AWS IAM or SigV4: https://github.com/amzn/selling-partner-api-models/discussions/3701
- SP-API general FAQs: https://github.com/amzn/selling-partner-api-docs/wiki/SP-API---General-FAQs/0903acd37f30841505d4432bc3fd09b4852086e3
- SP-API fee announcement (agent-read): https://developer.amazonservices.com/spp-announcement
- PA-API 5 deprecation (agent-read): https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation
- X API pricing summaries: https://bundle.social/blog/x-api-pricing-2026-costs-limits and https://invisibleapi.ai/blog/x-api-pricing/
- Social API comparison (Instagram requirements): https://www.blotato.com/blog/social-media-api
- KiCad library licence: https://kicad.org/libraries/license/
- tscircuit KiCad export: https://docs.tscircuit.com/guides/kicad/exporting-kicad-library
- KiCanvas: https://hackaday.com/2023/01/31/kicanvas-helps-teach-and-share-kicad-projects-in-browsers
- replicad: https://github.com/sgenoud/replicad
- Manifold versus JSCAD discussion: https://github.com/jscad/OpenJSCAD.org/discussions/1158
- Ollama embedding model sizes: https://docs.percona.com/percona-search-for-mongodb/configure-automatic-embedding-ollama.html
- Printer pages named by the research agent but not opened: https://wiki.bambulab.com/en/knowledge-sharing/enable-developer-mode , https://docs.octoprint.org/en/main/api/files.html , https://moonraker.readthedocs.io/en/latest/external_api/introduction/
