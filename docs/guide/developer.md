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

Use PostgreSQL 19 with pgvector 0.8.7, the versions the stack runs (`apt install postgresql-19 postgresql-19-pgvector` from the PostgreSQL project's repository, or the `pgvector/pgvector:0.8.7-pg19-trixie` image). Without pgvector the app runs, but search by meaning is off and its tests are skipped.

The planner works out the order of operations: `cd planner && pip install -r requirements-dev.txt && uvicorn main:app --port 8811`, then set `PLANNER_URL=http://localhost:8811`. Without it the plan page shows the steps with no order.

## Tests

```
createdb c2r_test
DATABASE_URL=postgresql://localhost/c2r_test npm test
```

The API tests call the route handlers directly against a real PostgreSQL, so point `DATABASE_URL` at a database you can throw away. Component tests are `*.test.tsx` under `tests/` and run in jsdom. `npm run typecheck` and `npm run lint` must also pass.

**Browser smoke test (Playwright).** `tests/e2e/` opens the production build in Chromium and checks every screen. Build first, then run it:

```
npm run build
npx playwright install chromium        # once per machine
E2E_DATABASE_URL=postgresql://c2r:c2r@localhost:5432/c2r_e2e npm run test:e2e
```

`tests/e2e/server.mjs` drops and recreates the database named in `E2E_DATABASE_URL` (the name must contain `e2e`), starts the planner, and serves `.next/standalone` on `127.0.0.1:$E2E_PORT` (default 3210). If Playwright's browser cannot be downloaded, set `E2E_CHROME=system` to use the installed Google Chrome. It checks: signed out (the redirect, a wrong password, `demo`/`demo`, the form by keyboard); signed in, every page once in the light theme and once in the dark (status 200, its own address, an `h1`, no uncaught error, no console error, no failed same-origin request); one status change that must survive a reload; sign out; and an axe-core check on three pages, where critical violations fail the run and serious ones are listed.

Pages come from the rendered sidebar and the `/docs` index, so a new section is covered without editing the test. Pages not in the sidebar go in `FIXED_ROUTES` in `tests/e2e/helpers.ts`. A request a page is meant to make and that answers 4xx or 5xx goes in `ALLOWED_FAILED_REQUESTS`, with a reason.

CI runs three jobs on every change: `web` (planner tests, typecheck, lint, Vitest, build), `e2e` (the browser smoke test) and `stack` (the Docker stack, with its checks).

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

## Sign-in

Every API route needs a session by default. Wrap handlers in `route()` from `src/lib/api/route.ts`: it answers 401 `{ "error": "Sign in to continue." }` without a session, and 403 to a state-changing request whose `Origin` is another site. Inside a handler, `sessionOf(req)` gives `{ sessionId, userId, username, usingDefaultPassword }`.

A route that must work signed out is written `route.open(...)`. Four are open: sign-in, sign-out, `me`, and `/api/health` (the container health check; it says only whether the database answers). `tests/auth/routes.test.ts` finds every `route.ts` on disk and fails if a new one answers without a session; adding an open route means adding it to `OPEN` in that test on purpose. Do not export a bare `async function GET()`: it bypasses the check, and that test catches it.

Pages: `src/proxy.ts` sends a browser with no session cookie to `/sign-in?next=...`. It only checks that the cookie exists (Next.js advises against database work there), so the real check is always `route()`. In the browser, `api()` in `src/lib/http.ts` sends the user to sign in on any 401. One download in `src/components/three/PrintPanel.tsx` calls `fetch` directly and does not.

Passwords are hashed with scrypt from `node:crypto` (N = 2^17, r = 8, p = 1; the parameters are stored with the hash). Session tokens are 32 random bytes; only their SHA-256 is stored. The code is `src/lib/auth.ts`, the tables are in `migrations/0004_sign_in.sql`.

Tests: `tests/auth/session.setup.ts` creates a real session for `demo` before each test file. `json(method, payload?, url?)` in `tests/api/helpers.ts` sends it; `anonymous(...)` sends none; `form(...)` is for uploads. Never call a handler with no argument. Tests must not change the `demo` password; create a `zz-...` user.

## The audit log

`audit_log` (migration `0005`) is the install-wide record of all work. It has no link to the concepts table on purpose, so deleting a concept does not delete its lines; the concept's id and name are kept as text. Nothing in the app updates or deletes a line.

- `logEvent` and `logEventIn` in `src/lib/db.ts` write a change to a concept both to that concept's activity list and to the audit log, in one transaction.
- `audit` and `auditIn` write work that belongs to no concept: keys, settings, printers, sign-in, a password change, and the deletion of a concept.
- The name recorded is the signed-in user's. `route()` sets it for the whole request (`src/lib/actor.ts`, Node's AsyncLocalStorage), so nothing passes a user name around.
- Never put a key, password or token in `detail`. A refused sign-in records no user name, because people type passwords into that box by mistake.
- Reading: `GET /api/admin/audit` (newest first; `project`, `action`, `q`, `before`, `limit`) and `GET /api/admin/audit/export` (a file, one JSON object per line, oldest first).

## Styling

Tailwind 4. There is no `tailwind.config`; the theme is in `src/app/globals.css`. The Eigenia tokens are set per theme in the `:root` and `.dark` blocks and given Tailwind names in `@theme`.

`text-primary`, `text-secondary` and `text-muted` are ink colours here. shadcn/ui uses those three names as fills, so as backgrounds they take shadcn's meaning (`bg-primary` is the orange action colour, `bg-secondary` and `bg-muted` the subtle fill); Tailwind 4 allows a name to differ by utility (`--background-color-*`). The other shadcn names (`background`, `foreground`, `card`, `popover`, `accent`, `border`, `input`, `ring`, `destructive`, `muted-foreground`) map onto the same tokens, so a component added with `npx shadcn@latest add <name>` arrives themed.

`src/components/ui` holds the UI kit (the six Eigenia components plus shadcn/ui ones). `src/components/ai-elements` holds Vercel's AI Elements chat components, added with `npx shadcn@latest add https://elements.ai-sdk.dev/api/registry/<name>.json`. When the CLI asks to overwrite `button.tsx`, `dialog.tsx` or `input.tsx`, answer no: those are Eigenia's. Copied library code is not linted and is listed on the Code use page.

## Concepts and product types

`/api/projects` lists concepts: active ones by default, `?archived=1` for archived only, `?archived=all` for both. Each comes with its product type, stage, timestamps, the time of its latest event and row counts by stage, from one query (`CONCEPT_SELECT` in `src/lib/api/concepts.ts`).

`/api/projects/[id]` answers GET, PATCH (name, one-liner, product type, stage; recorded with before and after) and DELETE (body `{ "confirm": "<exact name>" }`; the database removes everything the concept owns). `POST …/archive` and `…/restore` can be repeated safely. `GET …/export` is a JSON download of every owned row, with file bytes as base64. `POST …/duplicate` `{ name }` copies rows and files in one transaction, not history, chat, research or gates.

Product types are defined in `src/lib/productTypes.ts`. Each lists the menu sections it hides. Use `sectionsFor(type)` to build a concept's menu and `sectionVisible(type, stage, section)` to guard a page. Hiding never deletes rows. Never edit `menu.ts` to hide a section for one type.

Concept changes in the browser go through the mutations in `src/lib/conceptsClient.ts`; the page is `src/app/concepts/page.tsx`. `?concept=<id>` on any address is resolved by `src/components/concepts/ConceptFromUrl.tsx`. Deleting the default concept clears `concepts.default` in the same transaction.

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

## Models

Every AI feature talks to models through `src/lib/ai/models.ts`; no other file builds a model client or reads a model name. `getReasoning()` and `getEmbedding()` return the model chosen in Admin, or `{ ok: false, reason }` with a sentence to show the user. Build features on `complete`, `completeStream`, `completeJson` (a zod schema; structured output with a prompted fallback, and `path` says which ran) and `embed` (checks every vector's width). Failures are `ModelError`, an `HttpError`, so a route wrapped in `route()` answers 503 (not configured), 502 (provider or unreachable) or 504 (time limit) with a sentence that never contains a key. Limits: 60 s for completions, 30 s for embeddings, adjustable per call; one retry on network errors, 429 and 5xx.

Embeddings for search are in `src/lib/ai/embeddings.ts`: `indexProject` and `indexItem` embed rows whose text changed (hash in `content_sha256`, per model), and `searchByMeaning` returns rows with cosine similarity; both return `{ ok: false, missing: "pgvector" }` when the database has no pgvector. Each vector width gets its own partial HNSW index the first time it is used; widths above 2,000 are searched exactly. Tests use `tests/standins/openai.ts`; `tests/ai/vector.test.ts` runs only where pgvector is installed, which means in GitHub Actions and not on a machine without it.

## Chat and search by meaning

Each vector width gets one index: `embeddings_hnsw_<d>` (cosine) up to 2,000 numbers, and `embeddings_bq_<d>`, an HNSW index over `binary_quantize(embedding::vector(d))::bit(d)` with `bit_hamming_ops`, from 2,001 to 64,000. `ensureWidthIndex` builds it and raises `maintenance_work_mem` to 1GB for the build when it is lower.

A search first counts the concept's vectors for the model. At or below `EXACT_SEARCH_MAX_ROWS` (5,000) it is exact. Above it, the index runs with `hnsw.ef_search` equal to the candidate count (ten times the rows wanted, between 100 and 1,000) and `hnsw.iterative_scan = relaxed_order`; the one-bit path then orders the candidates by cosine distance on the full vectors. Results say which ran: `exact`, `hnsw` or `binary`. The measurements behind these rules are in `docs/design/vector-search.md`. Research answers are embedded too, as question plus answer.

Chat routes: `GET` and `POST /api/projects/[id]/chats`; `GET` and `DELETE /api/chats/[id]`; `POST /api/chats/[id]/messages { message }`, which returns an AI SDK UI message stream whose metadata carries the numbered sources, how they were found, and the model. It falls back to text search when search by meaning is not ready, and answers 503 with no reasoning model. Tables: `chats` and `chat_messages` (`migrations/0007_chat.sql`). Helpers safe for the browser are in `src/lib/chat/shared.ts`; the prompt and retrieval are in `src/lib/chat/server.ts`; the screen is `src/app/chat/page.tsx` with `src/components/chat/`, built from the AI Elements components.

## Research

Research talks to Perplexity only through `src/lib/research/perplexity.ts` (`POST {PERPLEXITY_BASE_URL}/v1/agent`; key from `getCredential("perplexity","apiKey")`; effort from the setting `research.model`, default `fast`; 60 second limit). What the interface looks like, page by page, is in `docs/research/perplexity-api.md`, and `tests/standins/perplexity.ts` is written to it.

Each research row keeps `citations` (the URLs) and `sources` (`[{ url, title, snippet?, date? }]`, `title` empty when Perplexity gave none; `migrations/0006_research_sources.sql`). Read them with `readSources()` in `src/lib/research/schemas.ts`. Claim evidence lives in a claim's `data.evidence` and changes only through `POST` and `DELETE /api/research/evidence`, which set the status from `claimStatus()` in the same transaction and record before and after. `src/lib/research/rules.ts` enforces this on the generic routes: `PATCH /api/items/[id]` answers 400 to any change of a claim's `data.evidence`, and to a status change the evidence contradicts; both create routes refuse a claim that starts verified or carries evidence. `statusReason()` in `status.ts` words a status for the screen.

## Admin

Everything under `/api/admin/` is the Admin area's back end: credentials (`src/lib/admin/credentials.ts`; no response ever contains a full secret, and a test scans for it), settings, printers, and `POST /api/admin/test`, which makes one cheap read-only call per kind and always answers with `{ ok, message }`. The provider and printer-family registries (`src/lib/admin/providers.ts`, `printerFamilies.ts`) are what the screens build their forms from. Anything that talks to an outside service reads its key with `getCredential` and its address or model from `src/lib/settings.ts`, never from `process.env` directly.

The screens are `src/app/admin/page.tsx` and `src/components/admin/`. Hooks and keys are in `src/lib/admin/client.ts`. Forms are built from `/api/admin/credentials` and `/api/admin/printer-families`, so adding a provider or a family needs no screen change. A secret typed in a form goes only in a request body; it never goes in a query key, the cache, a URL or a log, and optimistic updates leave the last four characters empty until the server answers. Component tests are `tests/admin-ui/*.test.tsx`. The toaster (`components/ui/sonner.tsx`) follows the `dark` class on `<html>`.

The Perplexity connection test is the exception to "read-only": Perplexity documents no free call, so it sends the smallest documented `POST /v1/agent`, says in its message that the call is billed, and has a 30-second limit.

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
