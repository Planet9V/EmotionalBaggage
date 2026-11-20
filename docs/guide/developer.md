# Developer guide

How the code is organised and how to change it. The system context is on its own page.

## Stack

| Part | What |
|---|---|
| Web app | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 3.4 |
| 3D | three.js with React Three Fiber and drei |
| Diagrams | React Flow (`@xyflow/react`) |
| Database | PostgreSQL with pgvector, through `pg` |
| Validation | zod 4 |
| Planner | Python, FastAPI, NetworkX (`planner/`) |
| Tests | Vitest; GitHub Actions runs typecheck, lint, tests and build |

The plan (`docs/PLAN.md`) lists the libraries being adopted next and the hand-written code each replaces.

## Run it locally

```
npm ci
createdb c2r
DATABASE_URL=postgresql://localhost/c2r npm run dev
```

The planner works out the order of operations: `cd planner && pip install -r requirements-dev.txt && uvicorn main:app --port 8811`, then set `PLANNER_URL=http://localhost:8811`. Without it the plan page shows the steps with no order.

## Tests

```
createdb c2r_test
DATABASE_URL=postgresql://localhost/c2r_test npm test
```

The API tests call the route handlers directly against a real PostgreSQL, so point `DATABASE_URL` at a database you can throw away. `npm run typecheck` and `npm run lint` must also pass; CI runs all three plus the build.

## Layout

| Path | What lives there |
|---|---|
| `src/lib/menu.ts` | The seven stages and their sections. The menu is data. |
| `src/lib/domain/` | The one definition of each object: zod schemas and readers for parts, wires, decisions and steps. |
| `src/lib/api/` | The route wrapper and the request schemas. |
| `src/lib/db.ts` | The connection pool, table creation, seeding, `q()` and `tx()`. |
| `src/app/api/` | Route handlers. |
| `src/app/` | Pages. |
| `src/components/views/` | One view per kind of section. |
| `src/components/ui/` | Shared UI components. |
| `planner/` | The order-of-operations service. |
| `migrations/` | Database migrations, applied at start-up. |
| `tests/` | Vitest suites. |
| `docs/guide/` | These pages. They are rendered in the app at `/docs`. |

## The data model

One table, `items`, holds every row of every section: `project_id`, `section`, `title`, `body`, `data` (JSON), `status`, `sort`. The `section` value is a store key such as `design/bom`. Other tables: `projects`, `files` (bytes in the database), `messages`, `research`, `events`.

What goes inside `data` is defined per section in `src/lib/domain/schemas.ts`:

- `design/bom`: a part (`ref`, `qty`, `source`, `search`, `line`, `asin`, `geometry`, `schematic`, `pins`)
- `design/wiring`: a wire (`order`, `net`, `netClass`, `from`, `fromPin`, `to`, `toPin`, `via`)
- `concept/decisions`: a decision (`key`, `parent`, `options`, `chosen`, `dependsOn`, `unlocks`)
- every section: the step fields (`key`, `after`, `minutes`)

Schemas are loose: columns a schema does not name are kept. TypeScript types are inferred from the schemas, so there is one source for each shape.

**Read rows through the domain readers** (`toPart`, `readWires`, `toDecision`, `stepsFromItems`). Do not read `item.data` fields directly in a view.

## The API

Every handler is wrapped with `route()` from `src/lib/api/route.ts`:

- a request body is parsed with `body(req, schema)`; a failure is a 400 that names the field
- `requireProject(id)` answers 404 for an unknown concept
- database errors map to 400, 404 or 409; anything else is a 500 with a plain message
- writes that touch more than one row run inside `tx()`

A row's `section` must be a store the menu defines, its `status` must be one that section allows, and its `data` must satisfy that section's schema.

## Concepts and product types

`/api/projects` lists concepts: active ones by default, `?archived=1` for archived only, `?archived=all` for both. Each comes with its product type, stage, timestamps, the time of its latest event and row counts by stage, from one query (`CONCEPT_SELECT` in `src/lib/api/concepts.ts`).

`/api/projects/[id]` answers GET, PATCH (name, one-liner, product type, stage; recorded with before and after) and DELETE (body `{ "confirm": "<exact name>" }`; the database removes everything the concept owns). `POST …/archive` and `…/restore` can be repeated safely. `GET …/export` is a JSON download of every owned row, with file bytes as base64. `POST …/duplicate` `{ name }` copies rows and files in one transaction, not history, chat, research or gates.

Product types are defined in `src/lib/productTypes.ts`. Each lists the menu sections it hides. Use `sectionsFor(type)` to build a concept's menu and `sectionVisible(type, stage, section)` to guard a page. Hiding never deletes rows. Never edit `menu.ts` to hide a section for one type.

The screens for all of this are not built yet.

## Loading and changing data in the browser

The browser loads and changes data with TanStack Query. One provider sits at the root (`src/components/Providers.tsx`). Every query key and fetcher is in `src/lib/queries.ts`. Two components that ask for the same key share one request and one cached copy. Read data through these keys; do not fetch inside a `useEffect`.

`useItems(projectId, store)` from `src/lib/client.ts` returns `{ items, loading, error, writeError, reload, add, patch, remove }`. Views on the same store share its cache: the parts list is shown by the parts, layout, 3D, sourcing and printing screens, so a change in one is visible in the others at once.

- `patch` and `remove` change the screen first, then the server. If the server refuses, the screen goes back to what it was and the call **rejects**, so wrap it in `try/catch` when you show your own message.
- A write you do not wait for puts its failure in `writeError`; show that in the screen's error line.
- For an inline field, pass `saveOrMessage(patch(...))` so the field stays open and shows the error.
- After uploading or deleting a file, call the function from `useFilesChanged(projectId)`.

Tests for the hooks are in `tests/client/`. One of them checks the on-screen merge against the real route on PostgreSQL.

## Third-party code

The planner's Python packages are pinned exactly in `planner/requirements.lock`, which the image, the tests and the code-use record all install from. `planner/requirements.txt` states what is wanted; after changing it, install, rewrite the lock from what was installed, and run `npm run notices`.

`npm run notices` regenerates `THIRD_PARTY_NOTICES.md` and the Code use page from the installed packages. `npm run notices:check` fails if either is out of date, and the test suite runs the same check. Anything a package manager does not know about (container images, fonts, copied source, tools run as separate processes) goes in `docs/third-party.manual.json`, in the same change that introduces it.

## Research

Research talks to Perplexity only through `src/lib/research/perplexity.ts` (`POST {PERPLEXITY_BASE_URL}/v1/agent`; key from `getCredential("perplexity","apiKey")`; effort from the setting `research.model`, default `fast`; 60 second limit). What the interface looks like, page by page, is in `docs/research/perplexity-api.md`, and `tests/standins/perplexity.ts` is written to it.

Claim evidence lives in a claim's `data.evidence` and changes only through `POST` and `DELETE /api/research/evidence`, which set the claim's status from `claimStatus()` (`src/lib/research/status.ts`) in the same transaction and record the change with before and after.

## Admin

Everything under `/api/admin/` is the Admin area's back end: credentials (`src/lib/admin/credentials.ts`; no response ever contains a full secret, and a test scans for it), settings, printers, and `POST /api/admin/test`, which makes one cheap read-only call per kind and always answers with `{ ok, message }`. The provider and printer-family registries (`src/lib/admin/providers.ts`, `printerFamilies.ts`) are what the screens build their forms from. Anything that talks to an outside service reads its key with `getCredential` and its address or model from `src/lib/settings.ts`, never from `process.env` directly.

## The planner

The order of operations has one implementation: the NetworkX service in `planner/`.

- `planGraph(items)` in `src/lib/plan.ts` builds the graph with no I/O. Nodes are steps (keyed rows outside the decision tree; zero remaining when the status is closed) and decisions (keyed rows in the decision tree; no duration; done when an option is chosen). Edges come from a step's `after`, a decision's `dependsOn`, and a decision's `unlocks` to every step in that section's store. Links to unknown keys and self-links go to `dropped`.
- The plan route posts the graph to `POST /plan`. The service finds loops with strongly connected components, blocks every node in or downstream of a loop, and returns waves, earliest start and finish over remaining minutes, the critical path, and remaining and planned totals.
- If `PLANNER_URL` is unset or the service does not answer, the route answers 200 with `engine: "unavailable"`, the nodes and a note, and no order.
- The same service routes wires through an enclosure: `POST /route` (`planner/routing.py`). The method, its limits and its measured speed are in the wiring design page. The app does not call it yet.
- `npm test` starts the planner itself and fails loudly if `python3` or uvicorn is missing: `pip install -r planner/requirements-dev.txt`. The service's own tests: `cd planner && python3 -m pytest -q`.

## Migrations

Schema changes are SQL files in `migrations/`, applied in order at start-up and recorded in `schema_migrations`. Add a new numbered file; never edit a released one. A migration that tightens a rule first repairs the rows that would break it and logs what it changed. The design and its reasons are in `docs/design/database.md`.

## Common changes

**Add a section.** Add it to `STAGES` in `src/lib/menu.ts` with `view: "items"`. It gets a list, a board, validation and a place in the report with no other change.

**Add a field to parts, wires or decisions.** Add it to the schema in `src/lib/domain/schemas.ts`, then to the reader beside it. Add a test in `tests/domain/`.

**Add a kind of view.** Write the component in `src/components/views/`, add its name to the `view` union in `menu.ts`, and register it in `VIEWS` in `SectionPage.tsx`.

**Add an API route.** Wrap it in `route()`, validate with a zod schema, and add a test in `tests/api/`.

## Rules the plan sets

- Use a maintained library where one exists; the exceptions are named in the plan.
- One item of the plan at a time, with its test, before the next.
- Documentation pages are updated in the same change as the behaviour they describe.
