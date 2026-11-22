/**
 * The words of the public welcome page (/welcome) and its one-page overview (/welcome/overview), in one place
 * so the two never disagree. Every claim here is something the app does today, checked against
 * docs/guide/user.md and docs/guide/admin.md; where something needs a model, a key or a service, it says so.
 * No figures appear that are not measured in this repository: no user counts, no prices, no benchmarks.
 */

export const PRODUCT = "Concept to Realization";
export const REPO_URL = "https://github.com/Planet9V/EmotionalBaggage";

export const HERO = {
  title: "Take one idea from a joke to a product you can hold, cost and sell.",
  sub: "An idea nobody pursues never gets made. This workbench is built to get yours to market fast: AI drafts, you decide, and seven stages carry it from first brief to sales channel. For makers, first-time founders and small product firms. Below is the first idea put through it: Baggage Claims MK1, a puck that straps to a suitcase and heckles the trip.",
  journeyLink: "See where the bag went",
  status: "Public demo: sign in as demo / demo. That account is shared with everyone who visits.",
};

export const META = {
  title: "Concept to Realization: from product idea to tested prototype and launch plan",
  description:
    "A free, self-hosted workbench for makers, first-time founders and small product firms: take a product idea through research, design, a prototype, unit cost and a launch plan. Try the live demo.",
};

/** The problem, as before and after pairs. The "after" side is what the app does, word for word from the guides. */
export const PROBLEM = {
  title: "One product, ten tools that never talk to each other",
  lead: "A hardware idea usually lives in a notes app, a parts spreadsheet, a CAD file, a schematic tool, a slicer, a cost sheet, a task board and an ad manager. Change one part and the wiring, the enclosure, the cost and the launch copy go stale without telling you.",
  pairs: [
    {
      before: "The parts list is a spreadsheet nothing else reads.",
      after: "The parts list drives the schematic, the 3D model, the enclosure, the build sheet and the unit cost.",
    },
    {
      before: "A guessed price quietly becomes a fact.",
      after: "A part with no price is named and left out of the total. It is never counted as zero.",
    },
    {
      before: "You find out what a change broke when the build fails.",
      after: "Change a part, a requirement or a decision and a notice lists the rows it affects.",
    },
    {
      before: "An AI tool writes confident copy with numbers nobody checked.",
      after: "A marketing line with a number or a word like \"best\" needs a linked proof row before it can be approved.",
    },
    {
      before: "Nobody can say what to do next.",
      after: "Each stage has a gate of checks, and the next step names the row that is in the way.",
    },
  ],
};

export const STAGES: { n: string; name: string; text: string; /** one line, for the printed overview */ short: string }[] = [
  { n: "01", short: "Brief, press release, FAQ, the AI reviewer's challenge, decisions.", name: "Concept", text: "Write the brief, the launch-day press release and the FAQ before anything is built. Have the AI reviewer argue against them. Lay out the decisions the idea depends on." },
  { n: "02", short: "Questions with sourced answers; claims verified from the sources.", name: "Research", text: "Ask questions through Perplexity and keep each answer with its sources. A claim becomes verified or wrong from the sources you judged, not from a guess." },
  { n: "03", short: "Requirements, parts list, layout, 3D model, schematic, enclosure.", name: "Design", text: "Requirements, the parts list, the physical layout, the 3D model, the schematic with its electrical checks, and a printable enclosure." },
  { n: "04", short: "Sourcing, sliced print jobs, build sheet, assembly, tests, builds.", name: "Prototype", text: "Sourcing links and offers per part, print jobs sliced by OrcaSlicer, a soldering build sheet, assembly steps, acceptance tests and named builds." },
  { n: "05", short: "Unit cost, batch plans, suppliers, methods, compliance checklist.", name: "Production", text: "The unit cost from parts and cost lines, batch plans with the cash each needs, suppliers, manufacturing methods and a compliance checklist for your own checking." },
  { n: "06", short: "Personas, positioning, pricing, brand kit, ads, posts, launch plan.", name: "Marketing", text: "Personas, competitors, positioning, pricing, a brand kit, ads per channel, a landing page, social posts, campaigns and a dated launch plan." },
  { n: "07", short: "Amazon listing, channels and fees, reviews, the sales monitor.", name: "Sales", text: "The Amazon listing, sales channels with their fees, reviews and questions turned into requirements, and the sales monitor." },
];

export const GATES_NOTE =
  "Each stage ends in a gate: the checks that show it is done. Gates warn; they never lock you out. Going past one needs a written reason, and the Process page keeps it.";

export type Feature = { shot: string; stage: string; title: string; text: string; alt: string; note?: string };

/** The screenshots, in the order a product moves. `alt` says what the picture shows. */
export const FEATURES: Feature[] = [
  {
    shot: "schematic",
    stage: "03 Design",
    title: "A schematic that checks itself",
    text: "Drag from pin to pin to add a wire. Switch between symbols and a pins-and-wires view; select a wire and it lights up in both. Electrical checks list what they find, worst first. Export a KiCad 10 schematic, a netlist and a wiring table.",
    alt: "The Schematic page of the example concept: symbols for the MCU board, IMU sensor, audio module, speaker, switch and battery, joined by colour-coded wires, with the list of 14 nets on 20 wires beside it.",
  },
  {
    shot: "model",
    stage: "03 Design",
    title: "Your parts, placed in 3D",
    text: "Parts are drawn as boxes and cylinders from the sizes you enter, or from an STL or STEP file you attach. Move and rotate them, cut a section, measure, explode the assembly, and route the wires around the parts.",
    alt: "The 3D model page: a see-through enclosure holding the board, sensor, speaker and three batteries, with the parts list and their sizes on the left.",
  },
  {
    shot: "enclosure",
    stage: "03 Design",
    title: "A printable enclosure, with its checks measured",
    text: "Generate a base and a lid around your parts with CaseMaker in a few seconds, or with YAPP_Box in OpenSCAD. Five checks are worked out on the result: both pieces watertight, the lid closes, every part fits with your clearance, every opening lines up. Download STL and 3MF files.",
    alt: "The Enclosure page after generating with CaseMaker: a 3D preview of the box with an orange lid, and five checks below it, each marked met with its measurements.",
  },
  {
    shot: "wiring",
    stage: "04 Prototype",
    title: "A build sheet made from the schematic",
    text: "The order to solder in, which pins each wire joins, a cut list with lengths and gauge, and a tick box for every joint. Print it, or keep it open on the bench.",
    alt: "The Wiring and soldering page: a numbered soldering sequence, each step naming the two pins a wire joins and the check to make after it.",
  },
  {
    shot: "process",
    stage: "Whole concept",
    title: "Always know the next step",
    text: "Each stage has a gate of real checks: decisions made, electrical checks passed, enclosure checks met, parts priced. The next step names the row in the way and opens the control that fixes it.",
    alt: "The Process page: the next step as an orange button, and the Concept gate with two checks met and two still open, each with a link to the row that settles it.",
  },
  {
    shot: "plan",
    stage: "Whole concept",
    title: "The build order, worked out",
    text: "Give a step a key, what it waits on and how long it takes. The planner orders the steps into waves with NetworkX and marks the critical path in orange. Steps that wait on each other in a loop are marked blocked, never guessed around.",
    alt: "The Order of operations page: a graph of steps and decisions in waves, with the critical path from bench setup to pack-out drawn in orange.",
  },
  {
    shot: "social",
    stage: "06 Marketing",
    title: "Marketing drafted from what you approved",
    text: "Posts per channel within each channel's limits, on a board or a calendar. Ads, the landing page, the launch email and the listing are drafted from your approved positioning and wait for your approval. Nothing is posted until you confirm the exact text and the account.",
    alt: "The Social page: a board with draft, approved, scheduled and posted columns, and draft short-video posts in the first column.",
  },
  {
    shot: "launch",
    stage: "06 Marketing",
    title: "A launch plan whose dates move with you",
    text: "Pick a template (Kickstarter, Amazon, your own site, retail outreach or a soft launch) and a launch date. Every step gets a due date counted back from it. Move the date and every step moves.",
    alt: "The Launch plan page: five launch templates, Kickstarter chosen, with a launch date field and a button to start the launch.",
  },
  {
    shot: "chat",
    stage: "Whole concept",
    title: "Ask the concept, and see the sources",
    text: "Chat answers from the concept's own rows and saved research, with numbered sources that open the section holding each one. If nothing recorded covers the question, it says so.",
    note: "Chat needs a model you choose. This screenshot is what a fresh install shows before one is chosen: it says what is missing instead of making an answer up.",
    alt: "The Chat page on a fresh install: notices that no reasoning model and no embedding model are chosen yet, with buttons to Admin, and three suggested questions about the concept.",
  },
];

export const PRINCIPLES: { title: string; text: string }[] = [
  { title: "Nothing goes out without you", text: "Nothing is published, sent or bought until you confirm it in the app. The app never places an order." },
  { title: "AI drafts wait for you", text: "Every draft is kept with the rows it came from and counts for nothing until you approve it." },
  { title: "No invented numbers", text: "A missing price is named, not counted as zero. Print time and material come from OrcaSlicer's own output." },
  { title: "Claims need proof", text: "A marketing line with a number or a superlative needs a linked proof row, or it cannot be approved." },
  { title: "Every change is recorded", text: "Each concept keeps its activity, and the install keeps an audit log that cannot be edited or deleted." },
];

export const AUDIENCE = {
  title: "For makers, first-time founders and small product firms",
  lead: "You have an idea for a physical product, often with electronics inside. You want to get from the idea to a working prototype, a parts list with real prices and a plan to sell it, without stitching ten tools together.",
  fit: [
    "Makers taking a first hardware product past the bench.",
    "First-time founders preparing a Kickstarter, Amazon or own-site launch.",
    "Small product firms that want the cost and the build order worked out, not estimated in someone's head.",
  ],
  types: "Three kinds of product are supported: electronics in an enclosure, a printed part, and a physical product with no electronics. Sections that do not apply to yours are hidden, never deleted.",
  notYet: [
    "You need precise mechanical CAD. Parts here are boxes, cylinders or the STL and STEP files you attach.",
    "Several people need their own logins. An install has one account today.",
    "You want parts ordered for you. The app gives search links and a shopping list; you buy.",
  ],
};

export const RUNS_ON: { title: string; text: string }[] = [
  { title: "Free, Apache 2.0", text: "No account with us and no subscription. You pay only the services you choose to connect, at their own rates." },
  { title: "Your machine", text: "Three containers with Docker Compose: the app, PostgreSQL with pgvector, and the planner. Every concept and file is stored in your database." },
  { title: "Your models", text: "Ollama, LM Studio or OpenRouter, chosen in Admin. Without a model the AI buttons say what is missing and everything else works." },
  { title: "Your keys", text: "Perplexity for research; X, Instagram and Amazon if you want them. Keys are kept in your own database and never shown again." },
  { title: "Your printers", text: "Connections for OctoPrint and Klipper (Moonraker) are built in, so far tested against stand-ins. Any printer can take the sliced file by hand." },
];

export const RUN_COMMANDS = ["git clone https://github.com/Planet9V/EmotionalBaggage", "cd EmotionalBaggage", "docker compose up -d --build --wait"];

/** The objections, answered. Used for the FAQ on the page, its FAQPage data, and the overview's quick table. */
export const FAQ: { q: string; a: string; /** the one-line answer on the printed overview */ short: string; where: string }[] = [
  {
    q: "Is it really free?",
    short: "Yes. Apache 2.0 and self-hosted; you pay only the services you connect.",
    a: "Yes. The code is Apache 2.0 licensed and you run it yourself. The only costs are the outside services you choose to connect, such as OpenRouter or Perplexity, billed by them at their rates.",
    where: "LICENSE in the repository",
  },
  {
    q: "Do I need an AI model to use it?",
    short: "No. Every section works by hand; the AI buttons say what is missing until you choose a model.",
    a: "No. Every section works by hand. Drafting, the reviewer, chat and search by meaning need a model you choose in Admin. Until you choose one, those buttons say what is missing and link to the place to set it.",
    where: "Admin, Models",
  },
  {
    q: "Does my idea leave my machine?",
    short: "Only to services you connect. With Ollama or LM Studio, drafting stays on your machine.",
    a: "Only when you use a service you connected: a question sent to Perplexity, a prompt sent to OpenRouter, a post you confirm to X. With a local model through Ollama or LM Studio, drafting stays on your machine.",
    where: "Integrations page",
  },
  {
    q: "Can I put my real idea in the public demo?",
    short: "No. The demo account is shared with everyone who visits.",
    a: "Please do not. The demo account is shared with everyone who visits, so anyone can read or change what you type there. Use it to look around, then run your own copy or request a workspace.",
    where: "This page",
  },
  {
    q: "Is it only for electronics?",
    short: "No. Electronics in an enclosure, a printed part, or a product with no electronics.",
    a: "No. A concept is one of three kinds: electronics in an enclosure, a printed part, or a physical product with no electronics. The sections that do not apply, such as the schematic for a printed part, are hidden.",
    where: "New concept wizard",
  },
  {
    q: "Can it replace my CAD tool?",
    short: "No. It places and checks parts and makes a simple enclosure; attach detailed shapes as STL or STEP.",
    a: "No. It places parts, checks fits and openings, generates a simple printable enclosure and exports STL, 3MF and KiCad files. It does not model curved or detailed shapes; attach those as STL or STEP files.",
    where: "Design, 3D model and Enclosure",
  },
  {
    q: "What has been run against the real services?",
    short: "Outside services are built to their documentation and tested against stand-ins; each screen says what is unverified.",
    a: "Chat, research, posting, Amazon sync and printer control are built to each service's published documentation and tested against stand-ins in the test suite. Each screen says plainly what has not yet been run against the real service.",
    where: "The user guide, under Documentation",
  },
  {
    q: "Can a team use it?",
    short: "One account per install today; every change is recorded under that name.",
    a: "An install has one account today. Several people can share it, but every change is recorded under that one name.",
    where: "Account page",
  },
  {
    q: "How are my keys stored?",
    short: "In your own database, not encrypted, and never shown again after saving.",
    a: "In the install's own PostgreSQL database, not encrypted, and never shown again after you save them. Run it on a machine you control and change the default password first.",
    where: "Admin, Credentials",
  },
];

export const CLOSING = {
  title: "Most ideas are never made. Get yours out.",
  text: "For makers, first-time founders and small product firms. AI drafts, you decide, and the next step is always named. Start with the example, then bring your own idea.",
};

/** What the live demo opens on. Beside the demo button in Get started. */
export const DEMO_NOTE =
  "The live workbench opens on Baggage Claims MK1, a full example concept with its parts, wiring, decisions, costs and campaigns already entered. Walk through it, then start a concept of your own with the six-step wizard.";

/**
 * The worked example's figures, in one place so every section of the page shows the same ones. Each is from this
 * repository: the 21 files under seed/concepts/baggage-claims/files, the seeded decisions, parts and wiring in
 * src/lib/seed.ts, the concept story, and the order of operations as the planner totals it.
 */
export const EXAMPLE = {
  name: "Baggage Claims MK1",
  what: "a puck that straps to a suitcase and heckles the trip",
  documents: 21,
  decisions: 8,
  parts: 16,
  partsCost: 64.8,
  /** every line of the parts list (BOM_shopping_list.csv), in its order; they add up to partsCost */
  partLines: [
    ["MCU dev board", 8.99], ["IMU sensor", 6.99], ["Audio module", 5.5], ["Speaker", 1.75], ["Battery holder", 2.0], ["Batteries", 2.5],
    ["Power switch", 1.0], ["Mode button", 0.5], ["Resistor", 0.05], ["Resistor", 0.05], ["Storage", 5.99], ["Wire and headers", 8.99],
    ["Carrier", 4.5], ["Mounting", 6.99], ["Enclosure", 5.0], ["Mount strap", 4.0],
  ] as [string, number][],
  pitch: "A gadget that gives a suitcase a voice.",
  wires: 20,
  solderSteps: 18,
  build: "7 h 10 min",
  voicePacks: ["Family", "Salty", "New Yorker"],
} as const;

/**
 * The bag's own lines, word for word from the owner's gag catalogue for Baggage Claims MK1. They are the only
 * jokes on the page: product copy stays plain. `where` says what is happening to the suitcase when it speaks.
 */
export const BAG_LINES = {
  scale: { line: "Are you calling me FAT?", where: "on the check-in scale" },
  impact: { line: "OW! ...I felt that in my flip-flops.", where: "after a hard landing on the belt" },
  lifted: { line: "Whoa whoa whoa — are you gonna buy me dinner first?", where: "lifted by the handle" },
  carousel: { line: "Wheeee! Again! Again!", where: "on the carousel" },
  conveyor: { line: "Oh sure, I'll take the scenic route.", where: "on the conveyor" },
  hold: { line: "Hello? ...Anyone? ...Cool, cool. I'll just be here.", where: "two hours into the dark hold" },
  souvenirs: { line: "Sixty-two pounds? That's mostly SOUVENIRS.", where: "back at the scale" },
} as const;

export type BagLineKey = keyof typeof BAG_LINES;

/** The order the hero's speech bubble cycles through. */
export const HERO_LINES: BagLineKey[] = ["scale", "lifted", "impact", "conveyor", "carousel", "hold", "souvenirs"];

export const BOARD = {
  title: "Seven gates, one bag",
  lead: `Today's departure is ${EXAMPLE.name}.`,
  flight: EXAMPLE.name,
};

export type JourneyStage = {
  key: string;
  /** index into STAGES */
  n: string;
  name: string;
  /** what the person does here: the desired state in docs/ux-discovery/journey-idea-to-product.md */
  does: string;
  /** where in the app */
  inApp: string;
  shots: string[];
  /** index into PROBLEM.pairs, shown as "elsewhere" and "here" */
  pair?: number;
  /** figures from this repository: the seed concept, its source documents and the journey document */
  facts: { figure: string; label: string }[];
  line: BagLineKey;
  /** up to three of this stage's gate checks, worded as src/lib/process/definitions.ts words them */
  gate: string[];
  extras?: ("exploded" | "layers" | "cost" | "ads" | "listing" | "schematic")[];
};

export const JOURNEY_INTRO = {
  title: "The journey, gate by gate",
  lead: `One week of chats about a talking suitcase produced ${EXAMPLE.documents} documents that disagreed with each other. Here is the same idea carried through the workbench, in screenshots of the running app. The ticked lines are checks each gate runs, shown met for illustration.`,
};

export const JOURNEY: JourneyStage[] = [
  {
    key: "concept",
    n: "01",
    name: "Concept",
    does: "Tell the idea once and keep every source with it. Then lay out the choices the idea depends on, and let the gate list what is still missing.",
    inApp: "Wizard, Concept story, Files, Decision tree",
    shots: ["process"],
    facts: [
      { figure: String(EXAMPLE.documents), label: "source documents kept with the concept" },
      { figure: String(EXAMPLE.decisions), label: "decisions laid out, each with its options" },
    ],
    gate: ["The concept story has its pitch", "At least one file is in Files", "The go/no-go decision is decided"],
    line: "scale",
  },
  {
    key: "research",
    n: "02",
    name: "Research",
    does: "Ask the questions that worry you and keep each answer with its sources. A claim becomes verified or wrong from the sources you judged, not from repetition.",
    inApp: "Research, Claims, Chat",
    shots: ["chat"],
    facts: [{ figure: "2", label: "Kickstarter goals, and two build times, in the source documents. This is where they get settled." }],
    gate: ["At least one claim is recorded", "At least 80% of claims are verified"],
    line: "hold",
  },
  {
    key: "design",
    n: "03",
    name: "Design",
    does: "Enter the parts once. The schematic, the physical layout, the 3D model and the enclosure are all drawn from that one list.",
    inApp: "Parts list, Schematic, Layout, 3D model, Enclosure",
    shots: ["model", "schematic"],
    pair: 0,
    facts: [
      { figure: String(EXAMPLE.parts), label: "parts on the parts list" },
      { figure: String(EXAMPLE.wires), label: "wires on the schematic" },
    ],
    gate: ["The schematic has at least one wire", "The electrical checks find no error", "The chosen enclosure passes its checks"],
    line: "lifted",
    extras: ["exploded", "schematic"],
  },
  {
    key: "prototype",
    n: "04",
    name: "Prototype",
    does: "Source the parts, slice and print the case, wire it from a build sheet in order, and record each test.",
    inApp: "Sourcing, Print jobs, Build sheet, Tests",
    shots: ["wiring", "enclosure"],
    facts: [
      { figure: String(EXAMPLE.solderSteps), label: "soldering steps on the build sheet" },
      { figure: EXAMPLE.build, label: "to build, along the critical path" },
    ],
    gate: ["Every bought part is in hand", "Every joint is soldered and tested", "Every acceptance test passes"],
    line: "impact",
    extras: ["layers"],
  },
  {
    key: "production",
    n: "05",
    name: "Production",
    does: "Read the unit cost, added up from what you entered. See which parts have no price yet, then plan a batch and the cash it needs.",
    inApp: "Unit economics, Batch plans, Order of operations",
    shots: ["plan"],
    pair: 1,
    facts: [{ figure: String(EXAMPLE.parts), label: "parts, every one with a price before the total is trusted" }],
    gate: ["Unit economics have at least one line", "At least one batch is planned", "Production readiness: tests, compliance, parts and economics"],
    line: "souvenirs",
    extras: ["cost"],
  },
  {
    key: "marketing",
    n: "06",
    name: "Marketing",
    does: "Approve drafts built from the brief and the proof: positioning, a brand kit, ads, a landing page and a launch plan whose dates count back from launch day.",
    inApp: "Positioning, Brand kit, Ads, Launch plan",
    shots: ["launch"],
    pair: 3,
    facts: [{ figure: String(EXAMPLE.voicePacks.length), label: `voice packs to sell: ${EXAMPLE.voicePacks[0]}, ${EXAMPLE.voicePacks[1]} and ${EXAMPLE.voicePacks[2]}` }],
    gate: ["The positioning is attacked by the reviewer and approved", "A name is chosen", "A launch plan has dated steps"],
    line: "carousel",
    extras: ["ads"],
  },
  {
    key: "sales",
    n: "07",
    name: "Sales",
    does: "List it, post about it, and watch orders and campaign results beside the targets you set. Nothing is posted until you confirm the exact text and the account.",
    inApp: "Listing, Channels, Social, Sales monitor",
    shots: ["social"],
    facts: [{ figure: "0", label: "real marketplace accounts run so far. These screens are built and tested against stand-ins, and say so." }],
    gate: ["At least one sales channel is set", "Every listing element is ready or live", "Every ready or live listing has proof for its claims"],
    line: "conveyor",
    extras: ["listing"],
  },
];

/** Labels of the exploded view of the puck, top to bottom. The parts are on the parts list. */
export const PUCK_LAYERS = ["Shell top", "Speaker", "Board", "Battery holder", "Shell base"];

export const PRINT_NOTE = "Shell base in PETG, 4 perimeters, 25% infill, as the parts list specifies.";
export const COST = { value: EXAMPLE.partsCost, label: `prototype parts cost: the ${EXAMPLE.parts} lines of the parts list, stacked` };
export const ADS_NOTE = `One ad draft per voice pack (${EXAMPLE.voicePacks.join(", ")}), each waiting for approval.`;
export const LISTING_NOTE = "The listing, drafted from the approved positioning. It goes live only when you say so.";
export const SCHEMATIC_NOTE = "A corner of the schematic: the audio module, its series resistor and the speaker, with the app's net colours.";

/** "In 60 seconds": the trip as six slides, one line each. The pictures are drawn in Illustrations.tsx. */
export const SIXTY = {
  title: "The trip in 60 seconds",
  lead: "Six slides, one line each.",
  slides: [
    { key: "joke", tab: "The joke", line: "It starts as a joke: a suitcase that complains about its trip.", note: "The bag's own line, from the gag catalogue in the source documents." },
    { key: "idea", tab: "On screen", line: "In the first hour the idea is on screen, with its pitch and every source.", note: `${EXAMPLE.documents} source documents and ${EXAMPLE.decisions} decisions, kept with the concept.` },
    { key: "part", tab: "In hand", line: "Then there is a part in your hand, printed from the enclosure the app drew.", note: "Sliced by OrcaSlicer; each print job is tracked to a result." },
    { key: "cost", tab: "The cost", line: "The cost adds up, because it is added from what you entered.", note: `${EXAMPLE.parts} parts, $${EXAMPLE.partsCost.toFixed(2)} for the prototype. A missing price is named, never counted as zero.` },
    { key: "launch", tab: "The launch", line: "The launch is drafted from what you approved, and waits for your yes.", note: `Ads per channel and ${EXAMPLE.voicePacks.length} voice packs to sell: ${EXAMPLE.voicePacks.join(", ")}.` },
    { key: "turn", tab: "Your turn", line: "Your turn. The idea you keep not starting can go the same way.", note: "The live workbench opens on this example." },
  ],
};

/**
 * The whole trip on one map: each stage, what it produces, and what feeds what. The sections are the app's
 * own; the feeds are the ones the guides describe (the parts list drives the schematic, the enclosure and the
 * unit cost; drafts are built from approved positioning; a claim needs proof). Drawn with React Flow.
 */
export const MAP = {
  title: "The whole trip on one map",
  lead: "Seven stages, what each one produces, and what feeds what. Pick anything on the map to see what depends on it.",
  idle: "Nothing picked yet. Try the parts list.",
  note: "A map of what feeds what. Today the app's change notice lists design and cost rows; marketing and assembly rows are being added.",
  stages: [
    { key: "concept", n: "01", name: "Concept", makes: [["story", "Concept story"], ["decisions", "Decision tree"]] },
    { key: "research", n: "02", name: "Research", makes: [["answers", "Sourced answers"], ["claims", "Verified claims"]] },
    { key: "design", n: "03", name: "Design", makes: [["parts", "Parts list"], ["schematic", "Schematic"], ["enclosure", "Enclosure"]] },
    { key: "prototype", n: "04", name: "Prototype", makes: [["buildsheet", "Build sheet"], ["prints", "Print jobs"], ["tests", "Acceptance tests"]] },
    { key: "production", n: "05", name: "Production", makes: [["unitcost", "Unit cost"], ["batch", "Batch plan"]] },
    { key: "marketing", n: "06", name: "Marketing", makes: [["positioning", "Positioning"], ["pricing", "Pricing"], ["ads", "Ad copy"]] },
    { key: "sales", n: "07", name: "Sales", makes: [["listing", "Listing"], ["monitor", "Sales monitor"]] },
  ] as { key: string; n: string; name: string; makes: [id: string, label: string][] }[],
  feeds: [
    ["story", "positioning"], ["decisions", "batch"], ["answers", "claims"], ["claims", "positioning"], ["claims", "ads"],
    ["parts", "schematic"], ["parts", "enclosure"], ["parts", "unitcost"], ["schematic", "buildsheet"], ["enclosure", "prints"],
    ["buildsheet", "tests"], ["unitcost", "batch"], ["unitcost", "pricing"], ["positioning", "ads"], ["pricing", "listing"],
    ["ads", "listing"], ["listing", "monitor"],
  ] as [from: string, to: string][],
};

/** Every node of the map by id: the stage names and what each stage makes. */
export const MAP_LABEL = new Map<string, string>(MAP.stages.flatMap((s) => [[s.key, s.name] as [string, string], ...s.makes]));

export const POKE = {
  title: "Go on, poke the bag",
  lead: "The puck reads motion and answers back. This one is a drawing, so it is quiet, but it has the same opinions.",
  idle: "Pick something to do to the bag.",
  actions: [
    { key: "weigh", label: "Weigh it", line: "scale" },
    { key: "toss", label: "Toss it on the belt", line: "impact" },
    { key: "spin", label: "Send it round the carousel", line: "carousel" },
    { key: "dark", label: "Leave it in the dark", line: "hold" },
  ] as { key: "weigh" | "toss" | "spin" | "dark"; label: string; line: BagLineKey }[],
};
