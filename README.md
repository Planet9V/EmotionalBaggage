# Concept to realization

A workbench that takes any product concept through the same seven stages, with the same wiring for every concept:

1. **Concept**: brief, AI challenge, names and taglines, decision tree, open questions
2. **Research**: Perplexity research with citations, claims to verify
3. **Design**: requirements, 3D model with exploded view and drill-down, schematic, physical layout, bill of materials
4. **Prototype**: sourcing, 3D printing, wiring and soldering build sheet, assembly, acceptance tests
5. **Production**: unit economics, batch plan
6. **Marketing**: positioning, landing pages, ads, campaigns, social
7. **Sales**: Amazon listing, sales monitor, channels and pricing

Plus: order of operations (dependency graph and critical path), a printable report of everything recorded, and an integrations page that says what is and is not connected.

"Baggage Claims MK1" is the seeded example. Its rows come from the Rev A documents in the Google Drive folder "Emotional baggage"; outside facts are carried as unverified claims.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind 3.4
- Design tokens and UI kit from `Planet9V/eigenia` (`web/tailwind.config.ts`, `globals.css` tokens, `components/ui`)
- three.js through @react-three/fiber for the model, exploded view and STL generation
- @xyflow/react for the order-of-operations graph
- PostgreSQL with pgvector; files are stored in PostgreSQL (`files.bytes`), no object store
- A small Python service using NetworkX computes build order, parallel waves and the critical path

## Run

```
cp .env.example .env      # add the keys you have
docker compose up --build
```

Open http://localhost:3000. The schema is created and the example concept seeded on first request.

Without Docker: start PostgreSQL, then

```
pip install -r planner/requirements.txt && (cd planner && uvicorn main:app --port 8000) &
DATABASE_URL=postgresql://user:pass@localhost:5432/c2r PLANNER_URL=http://localhost:8000 npm run dev
```

## How every concept is wired

One table, `items`, holds every row of every section. `section` is `stage/section` from `src/lib/menu.ts`; `data` (jsonb) carries that section's columns.

- A **part** is an item in `design/bom`. `data.geometry` (mm) drives the 3D view, the exploded view and STL generation.
- A **wire** is an item in `design/wiring` (`from`, `fromPin`, `to`, `toPin`, `net`, `netClass`, `via`, `order`). The schematic, the 3D wire overlay and the build sheet all read it through `src/lib/design.ts`.
- A **decision** is an item in `concept/decisions` (`key`, `parent`, `options`, `chosen`, `dependsOn`, `unlocks`).
- A **step** is any item with `data.key`. `data.after` lists the keys it waits on and `data.minutes` its duration; the planner turns these into the order of operations.
- Every write is recorded in `events`; the report reads from it.

Adding a stage or section is an edit to `src/lib/menu.ts` only.

## What is and is not built

See the Integrations page in the app; it reads the live state. In short: the AI reviewer and Perplexity calls are written but have not been run against live keys; printer status reads exist for OctoPrint and Moonraker only; Amazon purchasing is search links plus an add-to-cart link; Amazon Seller Central, X and Instagram calls are not built; semantic search is not built (the pgvector column exists, nothing fills it).
