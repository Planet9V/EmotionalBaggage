# Build brief for view agents

App: /home/claude/concept-to-realization. Next.js 16 App Router, React 19, TypeScript, Tailwind 3.4,
three.js via @react-three/fiber + drei, @xyflow/react, framer-motion, lucide-react, PostgreSQL via pg.
It is a "concept to realization" workbench: any product concept goes through the same seven stages
(src/lib/menu.ts) with the same wiring. "Baggage Claims MK1" is only the seeded example; nothing you
write may be specific to it. Every view must work for a brand-new empty concept (good empty states).

## Hard rules
- Touch ONLY the files listed as yours. Read anything. Never edit src/lib/*, src/components/ui/*,
  src/components/Shell.tsx, src/app/**, package.json. If you need a change there, say so in your report.
- Do NOT run `next build`, `next dev` or `npm install` (five agents share this directory).
  Verify with: `npx tsc --noEmit` and `npx eslint <your files>`. Both must be clean for your files.
- A foundation server is running at http://localhost:3311 (API is live; use curl to see real data
  shapes). It will not show your UI changes.
- No new dependencies.
- Never invent data. No placeholder numbers, names, reviews or "sample" rows. If an integration is not
  connected, say exactly that and what it needs. Never fake a success state.
- No row of headline stat tiles / KPI tiles at the top of a page. Ever.
- Copy: plain, short, sentence case. No em dashes. No words: leverage, utilize, robust, streamline, seamless.
- Every component file starts with "use client".

## Design system (Eigenia tokens, already in tailwind.config.ts and globals.css)
- Colours as Tailwind classes: bg-canvas, bg-surface, bg-subtle, bg-bezel, text-primary, text-secondary,
  text-muted, border-hairline, text-link, bg-action / hover:bg-action-hover (filled buttons),
  dutchOrange (#E05A10, the ONLY accent; `bg-dutchOrange/10`, `border-dutchOrange/40` are fine),
  status tokens: text-danger bg-danger-soft, text-success bg-success-soft, text-warning bg-warning-soft,
  text-info bg-info-soft. Do NOT put opacity modifiers on var()-backed tokens (canvas, surface, subtle,
  primary, secondary, muted, hairline, action, link, danger, success, warning, info).
- Type: Inter (font-sans) for everything; JetBrains Mono (font-mono) for eyebrows, IDs, numbers, units.
  Eyebrow: `font-mono text-[10px] uppercase tracking-[0.2em] text-link`. Headings tracking-tight, never all caps.
- Radii: rounded-md controls, rounded-xl cards (default), rounded-2xl feature tiles. Nothing larger
  except the Card component's own shell.
- Motion: framer-motion entrances opacity 0→1, y 12→0, 0.3-0.5s easeOut; hover 150ms; respect
  prefers-reduced-motion. One orange glow per viewport at most (`animate-glow` or
  `hover:shadow-[0_0_20px_rgba(224,90,16,0.15)]`).
- Both themes must look right: light is default, `html.dark` is dark. Use tokens, not hex.
- UI kit to reuse (read them first): src/components/ui/{Card,button,input,table,dialog,StatusBadge}.tsx,
  src/lib/statusTones.ts (`statusTone(status)` → tone for StatusBadge), src/components/PageHeader.tsx.
- Reference for polish level and kanban interaction (read-only, do not copy sales-specific logic):
  /home/claude/eigenia/web/src/components/partners/defenderware/Kanban.tsx

## Data contract
Types: src/lib/types.ts (Project, Item, Geometry, FileMeta, EventRow, Plan, PlanNode).
Menu: src/lib/menu.ts (STAGES, Section with columns/statuses/addLabel, CLOSED set, storeKey).
Client: src/lib/client.ts
- `useProject()` → { projects, project, loading, error, select(id), reload() }
- `useItems(projectId, store)` → { items, loading, error, reload, add({section,title,body?,data?,status?}),
  patch(id, {title?,body?,status?,sort?,data?}) (data is MERGED server-side), remove(id) }.
  Pass store = null to load every item of the concept.
- `api<T>(path, init?)` throws Error(message) on non-2xx.
Section views receive `ViewProps` (src/components/views/types.ts): { project, stage, section, store }.

Endpoints
- GET/POST /api/projects                       POST {name, oneLiner, items?:[{section,title,body?,data?,status?}]}
- GET/POST /api/projects/:id/items?section=    
- PATCH/DELETE /api/items/:id
- GET/POST /api/projects/:id/files             POST multipart: file, kind, meta(JSON string). Stored in Postgres, 25 MB cap.
- GET/DELETE /api/files/:id                    GET returns the bytes as a download
- GET /api/projects/:id/events                 activity log, newest first
- GET /api/projects/:id/plan                   Plan (NetworkX service; `engine` says which engine answered, `note` why)
- GET /api/challenge?projectId=  POST {projectId,message}  → 503 {error} when no API key
- GET /api/research?projectId=   POST {projectId,query}    → 503 {error} when no API key
- GET /api/integrations                        {integrations[], database{connected,vector,version}, planner{connected,networkx}}
- GET /api/printer                             {configured, kind?, state?, file?, progress?, secondsLeft?, error?, note?}
- GET /api/search?projectId=&q=                {mode:"text", items}

Conventions inside Item.data
- Any section: the section's `columns` keys (menu.ts) hold display fields.
- Parts (store "design/bom"): ref, qty, source ("Amazon" | "Micro Center" | "Own printer" | free text),
  search (search term), line (line cost, number), asin (string, may be ""), geometry?: Geometry.
  Geometry is in mm, x width / y up / z depth, origin at the centre of the enclosure floor;
  shape box|cylinder|shell; size [x,y,z] or [diameter,length]; pos = assembled centre; explode = offset
  added at full explosion; basis "doc" (stated in source documents) or "typical" (not measured);
  count? = how many identical bodies; print? = this part is 3D printed.
- Steps (any store): key (unique id), after (comma-separated keys it waits on), minutes (number).

## Report back
List files changed, what works, what you verified and how, and anything not done or not verified.

## Round 2 additions (decision tree, schematic, layout, build sheet, 3D drill-down)

New shared readers in src/lib/design.ts (read it first; do not edit it):
- `toDecision(item)` → Decision {key, parent, question, context, options[{id,label,outcome}], chosen, dependsOn[], unlocks[], source, status}; `decisionReady(d, all)`; store `DECISION_STORE` = "concept/decisions". Statuses: open, decided, blocked. To decide: patch(id, {status:"decided", data:{chosen: optionId}}); to reopen: {status:"open", data:{chosen:""}}.
- `toWire(item)` → Wire {order, name, note, net, netClass (power|ground|signal|audio), from, fromPin, to, toPin, via, status}; `pinsOf(ref, wires)`; `NET_COLOR`; store `WIRING_STORE` = "design/wiring". Statuses: to solder, soldered, tested. `from`/`to`/`via` are part refs = Item.data.ref of parts in `PARTS_STORE` ("design/bom").
- A part's schematic position is saved on the part item as data.schematic = {x, y} (patch merges data).
- A part's physical position is data.geometry.pos (mm; x width, y up, z depth; origin = centre of the enclosure floor). When patching geometry send the WHOLE geometry object (the merge is shallow).

The interaction and finish reference for the split-view tree is Eigenia's organization explorer (read-only; study, do not import):
/home/claude/eigenia/web/src/components/lp/OrgTwin.tsx (shell: view toggle, play/pause walkthrough, caption bar with progress dashes, split view) and
/home/claude/eigenia/web/src/components/lp/OrgFlow.tsx (React Flow tree that expands as you click, dashed path to the selected node, status bars on node cards).
Match that level: dark-capable, hairline cards, one orange accent, mono eyebrows, smooth pan to the selected node.

Everything must work for an empty concept (no decisions, no wires, no parts): show how to start, and let the user create the first row from the view itself.
The local API at http://localhost:3311 may be down at times; if curl fails, read the seed in src/lib/seed.ts (SEED_DECISIONS, SEED_WIRING, GEOMETRY) for the real shapes.
