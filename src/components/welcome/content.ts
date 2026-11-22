/**
 * The words of the public welcome page (/welcome) and its one-page overview (/welcome/overview), in one place
 * so the two never disagree. Every claim here is something the app does today, checked against
 * docs/guide/user.md and docs/guide/admin.md; where something needs a model, a key or a service, it says so.
 * No figures appear that are not measured in this repository: no user counts, no benchmarks, no time savings.
 * The one exception is LEVELS: the service levels are approved, their prices are proposals the owner has not
 * confirmed, and SHOW_PRICES keeps them off the page until he does.
 */

export const PRODUCT = "Concept to Realization";
export const REPO_URL = "https://github.com/Planet9V/EmotionalBaggage";

export const HERO = {
  eyebrow: "For makers, first-time founders and small product firms",
  title: "Your product idea, built and on sale.",
  sub: "One workbench carries a physical product from a one-line idea to a costed prototype, a launch plan and a marketplace listing. AI drafts each stage from the last. You decide what stands.",
  primary: "Request access",
  secondary: "Try the live demo",
  status: "Sign-up with your own workspace is being built. Today you can try the shared demo or request access.",
};

export const META = {
  title: "Concept to Realization: take a product idea to a prototype, a launch and a listing",
  description:
    "One workbench for makers, first-time founders and small product firms: AI drafts each stage from the last, from brief to parts list, print files, unit cost, ads and a marketplace listing, and you decide. Try the live demo or request access.",
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
  { title: "Claims are tied to proof", text: "A marketing line with a number or a superlative needs a linked proof row, or it cannot be approved." },
  { title: "Every change is recorded", text: "Each concept keeps its activity, and the install keeps an audit log that cannot be edited or deleted." },
];

export const AUDIENCE = {
  title: "Is it for someone like me?",
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
  { title: "Free when self-hosted", text: "Apache 2.0. No account with us and no subscription when you run it yourself. You pay only the services you choose to connect, at their own rates." },
  { title: "Your machine", text: "Three containers with Docker Compose: the app, PostgreSQL with pgvector, and the planner. Every concept and file is stored in your database." },
  { title: "Your models", text: "Ollama, LM Studio or OpenRouter, chosen in Admin. Without a model the AI buttons say what is missing and everything else works." },
  { title: "Your keys", text: "Perplexity for research; X, Instagram and Amazon if you want them. Keys are kept in your own database and never shown again." },
  { title: "Your printers", text: "Connections for OctoPrint and Klipper (Moonraker) are built in, so far tested against stand-ins. Any printer can take the sliced file by hand." },
];

export const RUN_COMMANDS = ["git clone https://github.com/Planet9V/EmotionalBaggage", "cd EmotionalBaggage", "docker compose up -d --build --wait"];

/** The objections, answered. Used for the FAQ on the page, its FAQPage data, and the overview's quick table. */
export const FAQ: { q: string; a: string; /** the one-line answer on the printed overview */ short: string; where: string }[] = [
  {
    q: "What does it cost?",
    short: "Self-hosted is free under Apache 2.0. The hosted levels are set; their prices are not announced yet.",
    a: "Running it yourself is free: the code is Apache 2.0 licensed, and you pay only the outside services you choose to connect, such as OpenRouter or Perplexity, at their rates. The hosted service will have a Free level and two paid levels, Maker and Studio. Their prices are not announced yet, and nothing can be bought today.",
    where: "Your turn, on this page",
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
  title: "Ready to get your idea out?",
  text: "An idea that is not pursued is never realised. Put yours through the same stages as the example: AI drafts, you decide, and the next step is always named.",
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
  what: "a gadget that straps to a suitcase and heckles the trip",
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
  /** one step per wire on the build sheet: the app numbers them 1 to 20 (two pairs share an order number in the seed, 18 distinct) */
  solderSteps: 20,
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

/**
 * The departures board: where the worked example stands today. Each row is a stage and its gate. The status and
 * the remark are worked out from the gate's true checks (exampleData.ts runs the app's own gate rules on the
 * seeded rows), never typed: a stage reads Departed only when every check of its gate is met, Boarding while at
 * least half are, Delayed while fewer are, and Scheduled when none is. The board runs through its states in a
 * loop: nothing called yet, then each gate called in turn.
 */
export const BOARD = {
  title: "Where is the example today?",
  lead: "Seven gates, one bag. Each row is a stage of the example, with its status worked out from the gate's own checks. Nothing has departed yet, and the board says so.",
  rule: "Departed means every check of the gate is met. Boarding: at least half are. Delayed: fewer than half. Scheduled: none yet.",
  flight: EXAMPLE.name,
  columns: { time: "Time", destination: "Destination", gate: "Gate", status: "Status", remarks: "Remarks" },
  /** how wide each column is, in flap cells */
  cells: { time: 5, destination: 10, gate: 2, status: 9, remarks: 18 },
  rows: [
    { key: "concept", n: "01", name: "Concept", about: "The idea" },
    { key: "research", n: "02", name: "Research", about: "The sources" },
    { key: "design", n: "03", name: "Design", about: "The parts" },
    { key: "prototype", n: "04", name: "Prototype", about: "The build" },
    { key: "production", n: "05", name: "Production", about: "The cost" },
    { key: "marketing", n: "06", name: "Marketing", about: "The launch" },
    { key: "sales", n: "07", name: "Sales", about: "The listing" },
  ] as { key: string; n: string; name: string; about: string }[],
};

type BoardTone = "plain" | "good" | "late";
export type BoardRow = { time: string; destination: string; gate: string; status: string; remarks: string; tone: BoardTone };
export type GateCount = { met: number; total: number };

/** A gate's status word, from its checks alone. */
function gateStatus(g: GateCount): { status: string; tone: BoardTone } {
  if (g.total > 0 && g.met === g.total) return { status: "Departed", tone: "good" };
  if (g.met === 0) return { status: "Scheduled", tone: "plain" };
  return g.met * 2 >= g.total ? { status: "Boarding", tone: "good" } : { status: "Delayed", tone: "late" };
}

/**
 * Every state of the board for these gates: state 0 is the board before any call, state k has gates 1 to k called.
 * A called row shows its true status and "4 of 6 checks met"; a row not yet called is Scheduled with what it is about.
 */
export function boardStates(gates: Record<string, GateCount>): BoardRow[][] {
  const state = (called: number): BoardRow[] =>
    BOARD.rows.map((r, i) => {
      const at = i + 1;
      const base = { destination: r.name, gate: r.n };
      if (at > called) return { ...base, time: at === called + 1 ? "Next" : "Later", status: "Scheduled", remarks: r.about, tone: "plain" };
      const g = gates[r.key] ?? { met: 0, total: 0 };
      return { ...base, time: at === called ? "Now" : "Open", ...gateStatus(g), remarks: `${g.met} of ${g.total} checks met` };
    });
  return Array.from({ length: BOARD.rows.length + 1 }, (_, k) => state(k));
}

export type JourneyStage = {
  key: string;
  /** index into STAGES */
  n: string;
  name: string;
  /** what the person does here: the desired state in docs/ux-discovery/journey-idea-to-product.md */
  does: string;
  /** where in the app */
  inApp: string;
  /** this stage's views run live in the engineering stage above, so it shows no screenshot and links there */
  live?: boolean;
  /** index into PROBLEM.pairs, shown as "elsewhere" and "here" */
  pair?: number;
  /** figures from this repository: the seed concept, its source documents and the journey document */
  facts: { figure: string; label: string }[];
  line: BagLineKey;
  extras?: ("exploded" | "layers" | "cost" | "ads" | "listing" | "schematic")[];
};

/**
 * The engineering stage: the app's own views, live on the page, on the example's own rows. Counts that the views
 * work out (parts placed, wires drawn, checks met) are computed where they are shown, never typed here.
 */
export const ENGINEERING = {
  eyebrow: "The engineering, live",
  title: "Is the engineering real?",
  tagNote: "A handle-tag enclosure is being designed; this is the first enclosure, generated from the same parts.",
  lead: `Six of the workbench's own views, running here on ${EXAMPLE.name}'s rows. Turn the model, pan the schematic, watch the case print. Nothing on this page can be saved; in the workbench every one of them is yours to edit.`,
  tabs: { model: "3D", schematic: "Schematic", layout: "Physical layout", enclosure: "Enclosure and print", bom: "Parts list", build: "Build sheet" },
  loading: "Loading the view",
  badge: "Live views, in the workbench's dark theme",
  still: "A still of the 3D view; the live one loads as you reach it.",
  noscript: "Script is off, so the views cannot run. Here are stills of the schematic and the enclosure, the whole parts list and the first soldering steps.",
  hintMouse: "Drag to turn. Ctrl or Cmd + wheel to zoom.",
  hintTouch: "Tap, then drag to turn. Pinch to zoom.",
  tap: "Tap to explore",
  panTouch: "Tap, then drag to pan. Pinch or the buttons zoom.",
  note: "The stage is dark whichever theme the page is in: these are the workbench's own views in its dark theme. As the app says of this example, the internal layout is illustrative, and sizes marked typical are common sizes for that kind of part, not measured.",
  model: {
    modes: { translucent: "Translucent", solid: "Solid", wireframe: "Wireframe", exploded: "Exploded" },
    wiresHidden: "The solid lid is closed, so the wires and the labels of the parts inside are not drawn.",
    /** `drawn` is null before the live view has worked the wires out */
    counts: (placed: number, parts: number, drawn: number | null, wires: number) =>
      `${placed} of ${parts} parts have a size and are placed${drawn === null ? `; ${wires} wires` : `; ${drawn} of ${wires} wires run between placed parts and are drawn`}`,
  },
  schematic: {
    views: { symbols: "Symbols", pins: "Pins and wires" },
    waiting: "Laying out the schematic",
    hint: "Drag to pan. Ctrl or Cmd + wheel, or the buttons, to zoom. Press a pin or a wire to light it up.",
  },
  layout: {
    scale: "Top, front and side, to scale in mm.",
    straps: "STR1, outside the case outline, is the pair of mounting straps under it.",
    hint: "Drag to pan. Press a part to name it. Ctrl or Cmd + wheel, or the buttons, to zoom.",
  },
  enclosure: {
    modes: { printing: "As it prints", assembled: "Assembled" },
    label: "The generated enclosure of the example: a base and a lid.",
    /** the plane climbs to the taller of the two pieces as they lie on the bed; the assembled height is the base plus the lid's thickness */
    layer: "Layer height",
    of: (top: string) => `of ${top} mm`,
    sizes: (base: string, lid: string, assembled: string) => `On the bed the base is ${base} mm tall and the lid, turned over, ${lid} mm. Closed, the case is ${assembled} mm.`,
    checksTitle: "The app's checks, measured on these meshes",
    missing: "The enclosure generator did not run on this server, so there is nothing to show here.",
  },
  bom: {
    caption: "The example's parts list",
    sort: "Select a column heading to sort",
    hint: "Priced by the app's own rule: a part with no price is named, never counted as zero.",
    columns: { ref: "Ref", title: "Part", spec: "Specification", qty: "Qty", source: "Source", line: "Line cost" },
    total: "Total",
  },
  build: {
    heading: "The first soldering steps",
    hint: "The order to solder in, from the schematic's wires.",
    more: (n: number) => `And ${n} more, in the same order, on the build sheet in the workbench.`,
  },
};

/** The journey's panels of seeded rows (StageRows.tsx): their counts are worked out from the rows, never typed. */
export const ROWS = {
  claims: {
    caption: "The example's claims to verify, each with its source and status",
    count: (n: number, open: number) => `${n} claims, ${open} still to verify`,
  },
  positioning: { count: (n: number) => `${n} rows` },
  decisions: {
    count: (n: number, decided: number) => `${n} decisions, ${decided} decided`,
    hint: "The example's decision tree, every branch open. Press a decision to frame it and see where it stands.",
    still: "The example's decisions, as a list until the tree loads.",
  },
  unit: {
    count: (lines: number, batch: number) => `${lines} lines, at a batch of ${batch}`,
    honest: "Added up by the app's own calculation from the seeded parts list. Prices are the example's own, from its source documents.",
  },
  ads: { count: (n: number) => `${n} drafts, none approved` },
  listing: {
    count: (n: number) => `${n} row`,
    honest: "That is all the example holds here: one row saying the listing is not started. Nothing is drawn in to fill the gap.",
  },
  channels: {
    caption: "The example's planned sales channels, with price, the channel's take and the net",
    count: (n: number) => `${n} channels, none live`,
    honest: "Planned figures from the example's own source documents, not results: no channel has been run.",
  },
};
export const GATE = {
  count: (met: number, total: number) => `Gate: ${met} of ${total} checks met`,
  met: "met",
  open: "not met",
};
export const LIVE_LINK = "These views run live in the engineering stage above";

export const JOURNEY_INTRO = {
  title: "What does each gate still need?",
  lead: `One week of chats about a talking suitcase produced ${EXAMPLE.documents} documents that disagreed with each other. Here is the same idea carried through the workbench, with the example's own rows at each stage. Each gate shows its checks as they truly stand for the example today, worked out by the app's own gate rules: most are still open, and each open one says what is missing.`,
};

export const JOURNEY: JourneyStage[] = [
  {
    key: "concept",
    n: "01",
    name: "Concept",
    does: "Tell the idea once and keep every source with it. Then lay out the choices the idea depends on, and let the gate list what is still missing.",
    inApp: "Wizard, Concept story, Files, Decision tree",
    facts: [
      { figure: String(EXAMPLE.documents), label: "source documents kept with the concept" },
      { figure: String(EXAMPLE.decisions), label: "decisions laid out, each with its options" },
    ],
    line: "scale",
  },
  {
    key: "research",
    n: "02",
    name: "Research",
    does: "Ask the questions that worry you and keep each answer with its sources. A claim becomes verified or wrong from the sources you judged, not from repetition.",
    inApp: "Research, Claims, Chat",
    facts: [{ figure: "2", label: "Kickstarter goals, and two build times, in the source documents. This is where they get settled." }],
    line: "hold",
  },
  {
    key: "design",
    n: "03",
    name: "Design",
    does: "Enter the parts once. The schematic, the physical layout, the 3D model and the enclosure are all drawn from that one list.",
    inApp: "Parts list, Schematic, Layout, 3D model, Enclosure",
    live: true,
    pair: 0,
    facts: [
      { figure: String(EXAMPLE.parts), label: "parts on the parts list" },
      { figure: String(EXAMPLE.wires), label: "wires on the schematic" },
    ],
    line: "lifted",
    extras: ["exploded", "schematic"],
  },
  {
    key: "prototype",
    n: "04",
    name: "Prototype",
    does: "Source the parts, slice and print the case, wire it from a build sheet in order, and record each test.",
    inApp: "Sourcing, Print jobs, Build sheet, Tests",
    live: true,
    facts: [
      { figure: String(EXAMPLE.solderSteps), label: "soldering steps on the build sheet" },
      { figure: EXAMPLE.build, label: "to build, along the critical path" },
    ],
    line: "impact",
    extras: ["layers"],
  },
  {
    key: "production",
    n: "05",
    name: "Production",
    does: "Read the unit cost, added up from what you entered. See which parts have no price yet, then plan a batch and the cash it needs.",
    inApp: "Unit economics, Batch plans, Order of operations",
    pair: 1,
    facts: [{ figure: String(EXAMPLE.parts), label: "parts, every one with a price before the total is trusted" }],
    line: "souvenirs",
    extras: ["cost"],
  },
  {
    key: "marketing",
    n: "06",
    name: "Marketing",
    does: "Approve drafts built from the brief and the proof: positioning, a brand kit, ads, a landing page and a launch plan whose dates count back from launch day.",
    inApp: "Positioning, Brand kit, Ads, Launch plan",
    pair: 3,
    facts: [{ figure: String(EXAMPLE.voicePacks.length), label: `voice packs to sell: ${EXAMPLE.voicePacks[0]}, ${EXAMPLE.voicePacks[1]} and ${EXAMPLE.voicePacks[2]}` }],
    line: "carousel",
    extras: ["ads"],
  },
  {
    key: "sales",
    n: "07",
    name: "Sales",
    does: "List it, post about it, and watch orders and campaign results beside the targets you set. Nothing is posted until you confirm the exact text and the account.",
    inApp: "Listing, Channels, Social, Sales monitor",
    facts: [{ figure: "0", label: "real marketplace accounts run so far. These screens are built and tested against stand-ins, and say so." }],
    line: "conveyor",
    extras: ["listing"],
  },
];

/** Labels of the exploded drawing of the gadget, top to bottom. The parts are on the parts list. */
export const CASE_LAYERS = ["Lid", "Speaker", "Carrier board", "Battery holder", "Base"];
export const EXPLODED_TITLE = "The gadget, taken apart";

/** The theme switch on the public pages. Their header and hero stay dark in both themes, so the label names the page. */
export const TOGGLE = { toDark: "Switch page to dark", toLight: "Switch page to light" };

export const PRINT_NOTE = "The base in PETG, 4 perimeters, 25% infill, as the parts list specifies.";
export const COST = { value: EXAMPLE.partsCost, label: `prototype parts cost: the ${EXAMPLE.parts} lines of the parts list, stacked` };
export const ADS_NOTE = "The example holds three ad drafts, all for retargeting. Each waits for approval.";
export const LISTING_NOTE = "What a listing draft holds. The example's own listing is not started yet; it goes live only when you say so.";
export const SCHEMATIC_NOTE = "A corner of the schematic: the audio module, its series resistor and the speaker, with the app's net colours.";

/**
 * The whole trip on one map: each stage, what it produces, and what feeds what. The sections are the app's
 * own; the feeds are the ones the guides describe (the parts list drives the schematic, the enclosure and the
 * unit cost; drafts are built from approved positioning; a claim needs proof). Drawn with React Flow.
 */
export const MAP = {
  title: "What changes when I change one thing?",
  lead: "One map of the seven stages: what each one produces, and what feeds what. Pick anything on it to see what depends on it.",
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
  title: "Try the bag",
  lead: "The gadget reads motion and answers back. This one is a drawing, so it is quiet.",
  idle: "Pick something to do to the bag.",
  actions: [
    { key: "weigh", label: "Weigh it", line: "scale" },
    { key: "toss", label: "Toss it on the belt", line: "impact" },
    { key: "spin", label: "Send it round the carousel", line: "carousel" },
    { key: "dark", label: "Leave it in the dark", line: "hold" },
  ] as { key: "weigh" | "toss" | "spin" | "dark"; label: string; line: BagLineKey }[],
};

/** The header's links, in the page's order. */
export const NAV: { href: string; label: string }[] = [
  { href: "#get", label: "What you get" },
  { href: "#fast", label: "How it works" },
  { href: "#engineering", label: "Engineering" },
  { href: "#market", label: "To market" },
  { href: "#levels", label: "Levels" },
  { href: "#faq", label: "Questions" },
];

/**
 * The hero's visual: one line of an idea goes in, the stage outputs come out. The idea is the owner's own first
 * note, taken from the story's origin part (storyData.ts reads it from src/lib/story/seed.ts); the outputs are
 * the example's seeded rows (Artefacts.tsx).
 */
export const HERO_FLOW = {
  label: "An idea typed as one line goes in. Nine outputs come out, one per step, from a brief to a sales channel.",
  field: "Your idea, in one line",
  from: "Idea",
  to: "On sale",
  caption: `The worked example: ${EXAMPLE.name}, shown in its own rows as they stand today. It is planned, not yet built or sold.`,
};

/** "What you get": the thing you walk away with at each stage. Every line is a section of the app today (src/lib/menu.ts). */
export const GET = {
  eyebrow: "What you get",
  title: "What do I end up with?",
  lead: "Something you can use at the end of each of seven stages: a working document, a file or a figure. The next stage is built on it. Pick a stage to see what it leaves you with.",
  note: `Each output shown is one of ${EXAMPLE.name}'s own rows, the example this page follows.`,
  label: "The seven stages, in two lanes",
  holds: "In the workbench this stage holds",
  see: { engineering: "See it running below", market: "See it open below" },
  groups: [
    {
      key: "make",
      title: "Make it",
      sub: "From the idea to a prototype on the bench",
      items: [
        { n: "01", stage: "Concept", art: "brief", get: "A brief that has been argued with", also: "A press release and FAQ written first, an AI reviewer's challenge, and every decision laid out as a tree." },
        { n: "02", stage: "Research", art: "claim", get: "Answers that keep their sources", also: "Each claim your plan leans on, marked verified or wrong from the sources you judged." },
        { n: "03", stage: "Design", art: "parts", get: "A parts list with a cost you can believe", also: "A schematic with electrical checks, a physical layout, a 3D model and a printable enclosure." },
        { n: "04", stage: "Prototype", art: "print", get: "Print files that fit, and a build sheet", also: "Sourcing links per part, sliced print jobs, assembly steps and acceptance tests." },
      ],
    },
    {
      key: "sell",
      title: "Sell it",
      sub: "From a unit cost to a listing",
      items: [
        { n: "05", stage: "Production", art: "cost", get: "A unit cost and a margin per channel", also: "Batch plans with the cash each needs, suppliers, and a compliance checklist for your own checking." },
        { n: "06", stage: "Marketing", art: "ad", get: "Ads written to each channel's limits", also: "Positioning with its proof, a brand kit, a landing page, social posts and a dated launch plan." },
        { n: "07", stage: "Sales", art: "channel", get: "A listing ready for the marketplace", also: "Channels with their fees, reviews turned into requirements, and a sales monitor." },
      ],
    },
  ] as { key: string; title: string; sub: string; items: { n: string; stage: string; art: "brief" | "claim" | "parts" | "print" | "cost" | "ad" | "channel"; get: string; also: string }[] }[],
};

/**
 * "How it goes fast": AI drafts each stage from the last and you decide. No time saving or percentage is claimed,
 * because none has been measured; the copy says what the workbench is built to do.
 */
export const FAST = {
  eyebrow: "How it goes fast",
  title: "How does it get me there faster?",
  lead: "AI drafts the next stage from the one you approved, so no stage starts from a blank page. Here an approved brief line becomes a drafted requirement, which becomes a drafted part, a wire, an assembly step, a test and an ad. Each draft waits for you, and nothing you have not approved is built on.",
  label: "A chain of seven rows from the example. Each is drafted from the one before and approved before it feeds the next.",
  draft: "Draft",
  approve: "Approve",
  approved: "Approved",
  waits: "Waits for you",
  from: "Drafted from the row before",
  first: "Written by you",
  note: `Shown on ${EXAMPLE.name}'s own rows. In the workbench the drafting is done by the model you choose, from the rows you approved, and every draft lists the rows it came from. No time saving is claimed here, because none has been measured.`,
  guaranteesTitle: "What stays my decision?",
  guarantees: [
    { title: "Publishing and spending wait for you", text: "A post, a message or a purchase goes out only when you confirm it in the app. The app places no orders." },
    { title: "Numbers come from your rows", text: "A missing price is named and left out of the total. Print time and material come from the slicer's own output." },
    { title: "Claims need proof", text: "A marketing line with a number or a superlative needs a linked proof row before it can be approved." },
    { title: "Changes are recorded", text: "Each concept keeps its activity, and the install keeps an audit log that is read only." },
  ],
};

/**
 * The market stage: seven tabs at the weight of the engineering stage. Each shows the example's own rows where it
 * has them, and where it has few or none, the structure the stage produces and the limits the app enforces, with
 * a line saying which is which. Counts are worked out from the rows (storyData.ts).
 */
export const MARKET = {
  eyebrow: "Then it went to market",
  title: "Does it get me to market?",
  lead: `Marketing and sales are stages of the same workbench, built on the same rows as the engineering. Seven of them are open here on ${EXAMPLE.name}. Where the example has rows you see them; where it has none yet you see what the stage produces and the limits it holds you to.`,
  tabs: { positioning: "Positioning", brand: "Brand kit", ads: "Ads", landing: "Landing page", launch: "Launch plan", listing: "Listing", results: "Channels and results" },
  badge: "The example's rows, read only",
  note: "Connections to Amazon, X and Instagram are built to each service's published documentation and tested against stand-ins. They have not yet been run on live accounts.",
  noscript: "Script is off, so the tabs cannot change. Every tab is set out below.",
  positioning: {
    path: "/s/marketing/positioning",
    lineTitle: "The line",
    lineHint: "The workbench composes one sentence from six parts. The brackets are the parts the example has not filled.",
    notesTitle: "What the example holds",
    messagesTitle: "Three messages, each tied to proof",
    messagesHint: "A message can be approved only when it links to something the concept holds. This is what a link to the example's rows would count as today, by the app's own check.",
    proven: (proven: number, count: number, label: string) => (label === "Requirements" ? `${count} written` : `${proven} of ${count} ${label === "Claims" ? "verified" : "passing"}`),
    honest: (notes: number, statements: number) => `${EXAMPLE.name} has ${notes} positioning notes and ${statements === 0 ? "no positioning statement" : `${statements} positioning statement${statements === 1 ? "" : "s"}`} yet.`,
    reviewer: "Before approval the AI reviewer attacks the positioning once, and the critique stays beside it.",
  },
  brand: {
    path: "/s/marketing/brand",
    voiceTitle: "Voice",
    kitTitle: "What a brand kit holds",
    kit: ["A voice summary", "Voice rules, each with a do and a do not", "Colours, primary and secondary", "A heading font and a body font", "Logos", "A tagline and boilerplate"],
    kitHint: "Every ad, post, page and reply is drafted in the kit, and the landing page takes its colours and type.",
    contrastTitle: "Every colour is checked for contrast",
    contrastHint: "The example has chosen no colours, so the check is shown on this site's own orange.",
    onWhite: "On white",
    onBlack: "On black",
    honest: (kit: boolean) => (kit ? `${EXAMPLE.name} has a brand kit.` : `${EXAMPLE.name} has voice rules from its playbook and no brand kit yet: no colours, no type.`),
  },
  ads: {
    path: "/s/marketing/ads",
    draftsTitle: "The example's ad variants",
    limitsTitle: "Written to the channel's limits",
    limitsHint: "Pick a channel. A limit from the platform's own page is enforced; a recommendation is shown as a guide.",
    enforced: "platform limit",
    guide: "guide",
    required: "required",
    fits: (label: string, field: string) => `The first variant, counted against ${label}: ${field}`,
    honest: (ads: number, posts: number) => `${EXAMPLE.name} has ${ads} ad drafts and ${posts} social post drafts, none approved. An ad needs a stop and scale rule before it can be approved.`,
  },
  landing: {
    path: "/s/marketing/landing",
    pagesTitle: "The example's planned pages",
    kindsTitle: "What the generator draws",
    kindsHint: "One page for one approved message, as sections you edit and reorder, in the brand kit. Preview it, then export a static page with no script in it.",
    cta: "Action",
    honest: (pages: number, sections: number) => `${EXAMPLE.name} has ${pages} planned pages from its website plan and ${sections === 0 ? "no drafted sections" : `${sections} drafted sections`}, so there is no preview to show yet.`,
  },
  launch: {
    path: "/s/marketing/launch",
    pick: "Launch template",
    day: "Launch day",
    before: (n: number) => `${n} ${n === 1 ? "day" : "days"} before`,
    after: (n: number) => `${n} ${n === 1 ? "day" : "days"} after`,
    foot: "Each step is due a set number of days before or after launch day.",
    needs: (gate: string) => `needs the ${gate} gate`,
    steps: (n: number) => `${n} steps`,
    honest: (launches: number) => (launches === 0 ? `${EXAMPLE.name} has no launch date yet, so no step has a due date. Set one in the workbench and every step is dated, counted back from it. Move the date and every step moves.` : `${EXAMPLE.name} has ${launches} launch planned.`),
  },
  listing: {
    path: "/s/sales/listing",
    fieldsTitle: "The listing, field by field",
    fieldsHint: (category: string) => `Amazon's limits for ${category.toLowerCase()}. Claims Amazon does not allow are flagged as you write.`,
    empty: "not written",
    rowsTitle: "What the example holds",
    honest: (rows: number) => `${EXAMPLE.name} has ${rows} listing row, and it says the listing is not started. Nothing is drawn in to fill the gap.`,
  },
  results: {
    path: "/s/sales/channels",
    channelsTitle: "Sales channels",
    campaignsTitle: "Campaigns and their targets",
    connectionsTitle: "Connections",
    columns: { channel: "Channel", price: "Price", take: "Their take", net: "Net", status: "Status", campaign: "Campaign", budget: "Budget", target: "Target", result: "Result" },
    none: "none yet",
    foot: "Spend, clicks and orders are entered or imported by day and set against each campaign's target.",
    honest: (channels: number, campaigns: number, days: number) => `${EXAMPLE.name} has ${channels} planned channels and ${campaigns} planned campaigns, each with the number it must reach, and ${days} days of results. Prices and takes are planned figures from its source documents.`,
  },
};

/**
 * Service levels. The four levels and what each includes are approved (docs/research/saas-pricing-and-platform-design.md,
 * decision S3). Accounts and payment are not built: every paid level's button asks for access.
 *
 * PRICES ARE PROPOSALS AWAITING THE OWNER. He has not confirmed any price point, so SHOW_PRICES is false and the
 * page shows "Price to be announced" on the paid levels. Set SHOW_PRICES to true only when he has confirmed the
 * `price` fields below; nothing else needs to change.
 */
export const SHOW_PRICES = false;

export type Level = {
  key: "free" | "maker" | "studio" | "self";
  name: string;
  /** PROPOSAL, not confirmed by the owner. Shown only when SHOW_PRICES is true. */
  price: string;
  /** what follows the price, such as "a month" */
  per: string;
  paid: boolean;
  who: string;
  what: string;
  includes: string[];
  action: "request" | "run";
};

export const LEVELS: Level[] = [
  {
    key: "free",
    name: "Free",
    price: "$0", // proposal awaiting the owner
    per: "",
    paid: false,
    who: "Anyone with one idea",
    what: "Try the whole workbench on one concept, with your own AI key.",
    includes: ["1 concept", "1 person", "Your own AI key", "The Baggage Claims example to explore"],
    action: "request",
  },
  {
    key: "maker",
    name: "Maker",
    price: "$29", // proposal awaiting the owner
    per: "a month",
    paid: true,
    who: "Makers and first-time founders",
    what: "One person taking an idea to a prototype and a launch.",
    includes: ["Several concepts", "Monthly AI credits, with top-ups", "Slicing for your printer", "Exports", "Channels: Amazon, X, Instagram"],
    action: "request",
  },
  {
    key: "studio",
    name: "Studio",
    price: "$99", // proposal awaiting the owner
    per: "a month",
    paid: true,
    who: "Small product firms",
    what: "A team with several products in one shared workspace.",
    includes: ["Team seats", "A shared workspace", "Roles", "Pooled AI credits", "More concepts and storage"],
    action: "request",
  },
  {
    key: "self",
    name: "Self-hosted",
    price: "Free", // proposal awaiting the owner
    per: "",
    paid: false,
    who: "People who run it themselves",
    what: "The same workbench on your own machine, with your own models.",
    includes: ["Run it yourself with Docker", "Your own models and keys", "No limits set by us", "Apache-2.0 source"],
    action: "run",
  },
];

export const YOUR_TURN = {
  eyebrow: "Your turn",
  title: "What does it cost, and how do I start?",
  lead: "Four levels, from one idea to a team. A subscription sets concepts, seats and storage and includes monthly AI credits.",
  honest: "Sign-up with your own workspace is being built, and nothing can be bought yet. Today you can try the shared demo or request access.",
  tba: "Price to be announced",
  request: "Request access",
  run: "Run it yourself",
  includes: "Includes",
  formTitle: (level: string | null) => (level ? `Request access: ${level}` : "Request access"),
  formLead: (level: string | null) =>
    `Tell us who you are and what you want to build${level ? `, and mention that ${level} is the level you want: the form has no field for it yet` : ""}. The request is stored here and the owner reads it in Admin. No email is sent yet, so the reply comes by hand.`,
  demoTitle: "Or try the live demo now",
};
