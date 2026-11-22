# User journey: a person bringing a product idea to life

21 November 2026. Written for the public welcome page, which tells this journey as its narrative.

**How this was made.** No interviews or usage data exist yet. The journey is drawn from three things: the owner's own path with Baggage Claims MK1 as recorded in his 21 source documents, the app's seven stages, and the independent user-experience review of 21 November. Every statement about what a person thinks or feels is an **assumption to test**, not a finding. The measures in the desired state are how to test them.

## Scenario

- **Who:** one person, or a team of two or three, with an idea for a physical product and no product-development department. They can use a web application; they are not necessarily an engineer or a marketer.
- **The job:** get from "this would be funny, or useful" to something that can be held, costed, shown to buyers and sold, without losing the thread along the way.
- **The trigger:** the idea will not go away. For Baggage Claims it was a joke with a business attached: a gadget that gives a suitcase a voice.
- **Kind of software:** a web application with a 3D view, diagrams and generated documents, plus outside touchpoints: chat assistants, spreadsheets, a 3D printer, parts suppliers, ad platforms, a marketplace.

## Current state: how it goes today without the workbench

| Phase | What they do | Where | Thinking | Feeling | Pain | How long |
|---|---|---|---|---|---|---|
| Spark | Describe the idea to a chat assistant; get a wave of ideas, names and gags | Chat assistant, notes app | "This could actually work." | Delighted | Everything lands in separate chats and files; nothing connects | An evening |
| Is it real? | Search for competitors, market size, rules | Search, more chats | "Is that number true?" | Anxious | Figures with no source become facts by repetition | Days |
| Design | Ask for a parts list, a wiring table, a case | Spreadsheet, a schematic tool, CAD | "Does this part fit that one?" | Confused | Change one part and the wiring, case and cost go stale silently | Weeks |
| First build | Order parts, print a case, solder | Suppliers, slicer, printer, bench | "Which wire goes where?" | Frustrated | Instructions scattered; print fails; no record of what was tried | Weeks |
| What does it cost? | Add up parts, guess the rest | Spreadsheet | "Can I sell this at a profit?" | Anxious | A missing price counts as zero; margin is a guess | Hours, repeated |
| Telling people | Write a page, ads, posts | Site builder, ad managers | "What do I even say?" | Confident, then stuck | Copy drifts from what the product does; claims unchecked | Weeks |
| Selling | List it, watch orders | Marketplace, social | "Is this working?" | Neutral | No line back from results to decisions | Ongoing |
| Change | Swap a part, change the price, rethink the audience | Everything again | "What did I just break?" | Frustrated | Nothing says what a change affects | Every time |

Baggage Claims shows the pattern: one week of chats produced 21 documents with three different web stacks, two Kickstarter goals, two build times and a parts total that did not match its own table. The idea was strong; the thread was lost between documents.

## Moments of truth

**Make or break**
- The first hour: does the idea become something on screen, or another empty tool?
- The first physical thing: a printed part in the hand.
- The first cost that adds up: unit cost and margin that can be believed.
- The first change: does the tool say what it touched?

**Peak pain**
- A number nobody checked ends up in an ad.
- A part change silently breaks the case or the wiring.
- "What do I do next?" has no answer.

**Delight worth keeping**
- The spark itself: the gags, the names, the voice. The current tools are good at this and bad at keeping it.
- Seeing the product in 3D before it exists.

## Desired state: the same journey in the workbench

| Phase | What they do | In the app | Feeling | What we build to enable it | Measure |
|---|---|---|---|---|---|
| Spark | Tell the idea once; keep every source | Wizard, Concept story, Files | Delighted | The story page holds the pitch, origin, voice and gags with their sources | Share of new concepts with a written pitch within the first session |
| Is it real? | Ask questions; keep answers with sources; mark claims | Research, Claims | Confident | A claim is verified only from a named source | Share of claims with a source before they are used in marketing |
| Decide | Lay out the choices the idea depends on | Decision tree, gates | Confident | Gates that list what is missing and can be overridden with a reason | Share of stage moves made with all checks met |
| Design | Enter parts once | Parts list, schematic, layout, 3D, enclosure | Satisfied | One parts list drives every design view | Design changes that needed no manual correction elsewhere |
| First build | Source, slice, print, wire, test | Sourcing, print jobs, build sheet, tests | Satisfied | A printable build sheet in order; print jobs tracked to a result | Time from parts list to first recorded print result |
| What does it cost? | Read the cost; see what is unpriced | Unit economics, batch plan | Confident | Costs added from entries; a missing price is named | Concepts with every part priced before a batch is planned |
| Telling people | Approve drafts built from the brief and the proof | Positioning, brand kit, ads, landing page, launch plan | Delighted | Drafts that cite what they came from; claims need proof | Drafts approved without rewriting the claim |
| Selling | See orders and campaign results beside targets | Sales monitor, campaigns | Neutral to satisfied | Results compared with the stop-or-scale rule | Campaigns with a recorded stop, hold or scale decision |
| Change | Change something and read what it affects | Impact notice, history | Confident | Downstream rows listed with why | Changes followed by a reviewed impact list |

## Gap analysis

| Phase | Today in the app (21 Nov) | Gap | Priority |
|---|---|---|---|
| Spark | Story and Files exist; the first next step after the wizard is "Add a file" | A new person often has no file; lead with the pitch | High |
| Is it real? | A claim can be marked verified with any web address | Require a saved answer and a quote | High |
| Design | Built; a false electrical error appears when wires have no net name | Fix the net list to match the drawing | High |
| First build | Built against stand-ins; no real printer run | Run on one real printer | Medium |
| Cost | Pricing and Unit economics disagree on margin | One calculation | High |
| Telling people | Built; a positioning with no proof can be approved | Block approval without proof | High |
| Selling | Built against stand-ins only | Run on one real account | Medium |
| Change | Impact misses marketing and assembly rows | Extend the impact graph | High |
| Signing up | One shared account; no sign-up or payment | Accounts, workspaces, plans | High, before the page can ask for payment |

## What the welcome page takes from this

- **The narrative is the journey.** One idea, followed from a joke to a product, stage by stage. The visitor sees their own path in it.
- **The four make-or-break moments are the four set pieces:** the idea on screen, the part in the hand, the cost that adds up, the change that explains itself.
- **The emotional line of the page** runs delighted, anxious, confident, satisfied: name the worry before answering it.
- **The spark is not sanded off.** The bag's own lines carry the humour; the product copy stays plain.
