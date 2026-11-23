/**
 * The words of the public welcome page (/welcome), in one place. Every claim here is something the app does today,
 * checked against docs/guide/user.md and docs/guide/admin.md. No figures appear that are not measured in this
 * repository: no user counts, no benchmarks, no time savings.
 *
 * The welcome page is the early-access page (owner, 22 Nov): one action, "Claim an early-access place", nine
 * blocks, and nothing about running the software yourself. The words were rewritten on 23 Nov (owner: sell the full
 * process, the example is only the proof; docs/research/landing/copy-v2-2026-11-23.md): each block opens with the
 * visitor's question and answers it in its first sentence. Its words are HERO, PROBLEM, GET, MECHANISM, PROOF,
 * PRICING, BUILDER, questions(), CLOSING and FOOTER. The plans and their prices are the plan catalogue's
 * (src/lib/admin/planSchema.ts), never typed here.
 */

import { BRAND } from "@/components/brand/name";

export const PRODUCT = BRAND;

/** The one action of the page, worded the same everywhere. `short` is the header's label on a phone. */
export const ACTION = { label: "Claim an early-access place", short: "Early access" };

export const HERO = {
  eyebrow: "For makers, first-time founders and small product firms",
  title: "Finally take that product idea to market.",
  sub: "Type the idea in one line. Get a costed parts list, a checked schematic, your margin on each sales channel and a launch plan. AI drafts every stage and you approve it, so you know the numbers before you spend a dollar. Our first idea got that far in one weekend.",
  secondary: "See the worked example",
};

export const META = {
  title: "Shipwright: take your product idea to market",
  description:
    "Type a product idea in one line. Get a costed parts list, a checked schematic, your margin by sales channel and a launch plan. 50 early-access places, no payment.",
};

/** The problem, as before and after pairs. The "after" side is what the app does, word for word from the guides. */
export const PROBLEM = {
  title: "Why is the idea still in the drawer?",
  before: "Elsewhere",
  after: "Here",
  /** the pairs the welcome page shows, by index */
  shown: [0, 2, 3],
  /** the tools the lead names, as the block's picture shows them */
  tools: ["Notes app", "Parts spreadsheet", "CAD file", "Schematic tool", "Slicer", "Cost sheet", "Task board", "Ad manager"],
  art: "Elsewhere: a notes app, a parts spreadsheet, a CAD file, a schematic tool, a slicer, a cost sheet, a task board and an ad manager, each on its own. Here: one line from the idea to the sale, with the seven stages on it.",
  lead: "Because nothing shows you the way from here to a product. The idea lives in a notes app, a parts spreadsheet, a drawing tool and a dozen browser tabs. None of them says what it would cost to make, or whether it would earn money. So you spend first and find out later, or you wait.",
  pairs: [
    {
      before: "You find out what it costs after you have paid for it.",
      after: "You see the unit cost at each batch size, and what each sales channel leaves you, before you order a part.",
    },
    {
      before: "A guessed price quietly becomes a fact.",
      after: "A part with no price is named and left out of the total. It is never counted as zero.",
    },
    {
      before: "You learn what a change broke when the build fails.",
      after: "Change a part, a requirement or a decision and a notice lists everything that depends on it.",
    },
    {
      before: "An AI tool writes confident copy with numbers nobody checked.",
      after: "Every claim is listed with its source and marked verified or unverified. An ad line with a number needs proof before you can approve it.",
    },
    {
      before: "The parts list is a spreadsheet nothing else reads.",
      after: "The parts list drives the schematic, the 3D model, the enclosure, the build sheet and the unit cost.",
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

export const CLOSING = {
  title: "What would your idea cost to make?",
  text: "Find out before you spend on it. Claim one of the 50 early-access places with an email address and one line about what you want to make. You get the same seven stages our own idea went through, and the numbers for yours.",
};

export const FOOTER = {
  privacy: "Visits to this page are counted on our own server. Nothing is sent to anyone else.",
};

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
  /**
   * What the example's economics said, as the cost view of "What you get" works it out from the Rev D rows
   * (seed/concepts/baggage-claims/content/2026-11-22-revD-2.json: $30.01 for one unit, $17.67 a unit at 100, parts
   * and filament only) against the channels' nets (src/lib/seed.ts: own site $21.95, wholesale $14.50; the dearest
   * net of the five, $21.95, is under $30.01). $21.95 - $17.67 = $4.28; $17.67 - $14.50 = $3.17. Estimates, as the rows say.
   */
  badNews: { costAtOne: "$30.01", ownSiteLeaves: "$4" },
} as const;

/**
 * The engineering stage: the app's own views, live on the page, on the example's own rows. Counts that the views
 * work out (parts placed, wires drawn, checks met) are computed where they are shown, never typed here.
 */
export const ENGINEERING = {
  /** names the tab list */
  title: "Make it: the engineering views",
  tabs: { model: "3D", schematic: "Schematic", layout: "Physical layout", enclosure: "Enclosure and print", bom: "Parts list", build: "Build sheet" },
  loading: "Loading the view",
  badge: "Live views, in the app's dark theme",
  still: "A still of the 3D view; the live one loads as you reach it.",
  noscript: "Script is off, so the views cannot run. Here are stills of the schematic and the enclosure, the whole parts list and the first soldering steps.",
  hintMouse: "Drag to turn. Ctrl or Cmd + wheel to zoom.",
  hintTouch: "Tap, then drag to turn. Pinch to zoom.",
  tap: "Tap to explore",
  panTouch: "Tap, then drag to pan. Pinch or the buttons zoom.",
  note: "As the app says of this example, the internal layout is illustrative, and sizes marked typical are common sizes for that kind of part, not measured.",
  model: {
    modes: { translucent: "Translucent", solid: "Solid", wireframe: "Wireframe", exploded: "Exploded" },
    wiresHidden: "The finished tag is closed, so the wires and the names of the parts inside are not drawn.",
    label: (name: string) => `${name} in 3D. Drag to turn it, or use the arrow keys or the buttons.`,
    still: (name: string) => `${name}: the front of the tag, drawn.`,
    hint: "Drag to turn. The buttons turn, tilt and zoom.",
    counts: (placed: number, parts: number, joins: number, wires: number) => `${placed} of ${parts} parts have a place and are drawn; the ${wires} wires join ${joins} pairs of them`,
  },
  schematic: {
    views: { symbols: "Symbols", pins: "Pins and wires" },
    waiting: "Laying out the schematic",
    hint: "Drag to pan. Ctrl or Cmd + wheel, or the buttons, to zoom. Press a pin or a wire to light it up.",
  },
  layout: {
    scale: "Top, front and side, to scale in mm.",
    straps: "STR1, outside the case outline, is the printed strap above the slot, drawn straight.",
    hint: "Drag to pan. Press a part to name it. Ctrl or Cmd + wheel, or the buttons, to zoom.",
  },
  enclosure: {
    modes: { printing: "As it prints", assembled: "Assembled" },
    label: "The app's generated enclosure around the example's parts: a base and a lid.",
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
    more: (n: number) => `And ${n} more, in the same order, on the build sheet in the app.`,
  },
};

/** The theme switch on the public pages. Their header and hero stay dark in both themes, so the label names the page. */
export const TOGGLE = { toDark: "Switch page to dark", toLight: "Switch page to light" };

/** The header's links, shown from 1024 px. */
export const NAV: { href: string; label: string }[] = [
  { href: "#get", label: "What you get" },
  { href: "#proof", label: "The example" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "Questions" },
];

/**
 * The hero's visual: one line of an idea goes in, the stage outputs come out. The idea is the owner's own first
 * note, taken from the story's origin part (storyData.ts reads it from src/lib/story/seed.ts); the outputs are
 * the example's seeded rows (Artefacts.tsx).
 */
/** Sent on the window to open a stage of "What do I end up with?" (the hero's "Look inside" opens the product). */
export const GET_STAGE_EVENT = "c2r:get-stage";

/** The hero's picture: the example's product on the line from an idea to a sale, with four of its outputs. */
export const HERO_STAGE = {
  label: (name: string) => `${name}, the worked example: a slim leather-look luggage tag on its strap, hanging on a line that runs from an idea typed as one line to a product ready to sell. Beside it, four of its outputs: the schematic, the unit cost, an ad and the marketplace listing.`,
  tag: (name: string, w: number, h: number, t: number) => `${name}: a saddle-tan luggage tag, ${w} by ${h} by ${t} mm, with cream stitching, a perforated speaker panel and its name stamped in an oval.`,
  turn: "The tag in 3D, turning. Drag it, or use the arrow keys, to turn it yourself.",
  modesLabel: "How the tag is drawn",
  modes: { solid: "Finished", translucent: "See-through", wireframe: "Wireframe" },
  inside: "Look inside",
  field: "Your idea, in one line",
  from: "Idea",
  to: "Ready to sell",
  cards: {
    schematic: "Schematic",
    cost: "Unit cost",
    ad: "Ad",
    listing: "Listing",
    wires: (n: number) => `${n} wires, checked`,
    from: (volume: string) => `At ${volume}:`,
    at: (volume: string) => `at ${volume}`,
    each: (volume: string) => `a unit, at ${volume}`,
    variants: (n: number) => `1 of ${n} variants`,
    net: (net: string) => `${net} net of fees`,
  },
  caption: `The worked example: ${EXAMPLE.name}, shown in its own rows as they stand today. It is designed and costed, not yet built or sold.`,
};

/** "What you get": the thing you walk away with at each stage. Every line is a section of the app today (src/lib/menu.ts). */
export const GET = {
  eyebrow: "What you get",
  title: "What do I end up with?",
  lead: "Something you can use at the end of every stage. Seven stages leave you a brief, sourced answers, a costed parts list, print files, your margin on each channel, ads and a marketplace listing. Each is built from the one before. Pick a stage to see it.",
  note: `Each output shown is one of ${EXAMPLE.name}'s own rows, the example this page follows.`,
  label: "The seven stages, in two lanes",
  holds: "In the app this stage holds",
  more: (n: number) => `and ${n} more`,
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
        { n: "05", stage: "Production", art: "cost", get: "Your unit cost, and your margin on each channel", also: "Batch plans with the cash each needs, suppliers, and a compliance checklist for your own checking." },
        { n: "06", stage: "Marketing", art: "ad", get: "Ads written to each channel's limits", also: "Positioning with its proof, a brand kit, a landing page, social posts and a dated launch plan." },
        { n: "07", stage: "Sales", art: "channel", get: "A listing ready for the marketplace", also: "Channels with their fees, reviews turned into requirements, and a sales monitor." },
      ],
    },
  ] as { key: string; title: string; sub: string; items: { n: string; stage: string; art: "brief" | "claim" | "parts" | "print" | "cost" | "ad" | "channel"; get: string; also: string }[] }[],
};

/** The live views of "What you get": one per stage output, each on the example's own rows (get/*.tsx). */
export const GET_VIEWS = {
  badge: "The example's rows, live",
  loading: "Loading the view",
  exploded: (parts: string[]) => `An exploded drawing of the example, from the sizes and places in its parts list: the tag pulled apart, each part numbered. ${parts.join("; ")}. The live 3D view loads as you reach it.`,
  looks: { wireframe: "Wireframe", translucent: "See-through", solid: "Solid" },
  model: {
    path: "/s/design/model",
    label: "The 3D model of the example, from its own parts list. Drag to turn it, or use the buttons.",
    lookLabel: "Drawn as",
    looks: { wireframe: "Wireframe", translucent: "See-through", solid: "Solid" },
    tags: "Tags",
    layersLabel: "Layers",
    layers: { enclosure: "Enclosure", electronics: "Electronics", power: "Power", wiring: "Wiring", fasteners: "Fasteners" },
    assembly: "Assembly",
    explode: "Exploded",
    exploded: "Exploded",
    reset: "Start the assembly and the turn again",
    stepOf: (n: number, total: number) => (n === 0 ? `Step 0 of ${total}` : `Step ${n} of ${total}`),
    nothingYet: "Nothing in place yet",
    counts: (shaped: number, parts: number, wires: number, steps: number) => `${shaped} of ${parts} parts with a shape, ${wires} wires, ${steps} assembly steps`,
    hint: "Build-sheet order: base, board, each soldering step, integration.",
  },
  views: { product: "The product", model: "3D model", schematic: "Schematic" },
  /** the example as a product: every angle, every part, drawn live from its parts list and its schematic */
  product: {
    path: "/s/design/model",
    label: (name: string) => `${name} in 3D. Drag to turn it, or use the arrow keys; press a part to choose it.`,
    viewsLabel: "Views of the product",
    views: {
      front: "Front",
      back: "Back",
      left: "Three-quarter",
      right: "Other side",
      edge: "Edge",
      top: "Top",
      handle: "On a handle",
      coin: "Cell door open",
      tracker: "Tracker pocket",
      exploded: "Exploded",
      inside: "See-through",
      lines: "Wireframe",
    },
    lookLabel: "Drawn as",
    looks: { solid: "Finished", translucent: "See-through", wireframe: "Wireframe" },
    apart: "Pulled apart",
    turn: "Turn",
    partsTitle: "Parts",
    search: "Find a part",
    none: "No part of that name.",
    groups: { enclosure: "Enclosure", board: "Board and chips", power: "Power", audio: "Audio", controls: "Controls" },
    all: "All parts",
    close: "Close",
    does: "What it does",
    size: "Size",
    qty: "Quantity",
    cost: "Cost",
    costNote: "estimate",
    source: "From",
    joins: "Joined to",
    noJoins: "No net in the schematic joins this part.",
    netClass: { power: "power", ground: "ground", signal: "signal", audio: "audio" },
    illustrative: "Its place on the board is illustrative: the board's components have no layout rows yet.",
    listOnly: "Not drawn: this row has no body of its own in the tag.",
    render: "A render from the example's own CAD (Rev D, colourway A1), on a suitcase handle. Not a photograph: no tag has been built.",
    renderAlt: "The tag hanging by its black strap from the handle of a dark suitcase, front toward the viewer.",
    caption: {
      size: (w: number, h: number, t: number) => `${w} x ${h} x ${t} mm`,
      parts: (n: number, illustrative: number) => `${n} parts drawn from the parts list${illustrative ? `; ${illustrative} on the board placed for illustration` : ""}`,
    },
    alt: (parts: number, joined: number) => `The product has ${parts} parts in its parts list, ${joined} of them joined by nets of the schematic. The list beside the picture names each part; choosing one shows what it does, its size, its cost and the parts it is joined to.`,
    hint: "Drag to turn. Press a part, or pick it in the list, to see what it does and what it joins.",
    counts: (parts: number, wires: number) => `${parts} parts, ${wires} wires, from the example's rows`,
  },
  print: {
    path: "/s/prototype/printing",
    label: "The enclosure's base and lid on the print bed, cut at the layer being printed.",
    lookLabel: "Drawn as",
    looks: { wireframe: "Wireframe", translucent: "See-through", solid: "Solid" },
    layer: "Layer",
    reset: "Start the print and the turn again",
    jobsTitle: "The example's print jobs",
    material: "Material",
    settings: "Settings",
    estimate: "Estimate",
    none: "not given",
    valueText: (n: number, total: number, mm: string) => `layer ${n} of ${total}, ${mm} millimetres`,
    honest: (job: string, mm: number, fromRow: boolean) =>
      fromRow ? `Layers of ${mm} mm, as the job "${job}" sets them. The pieces are the app's own generator's, from the parts list; nothing has been printed yet.` : `No layer height is set on a print job, so the slicer's default of ${mm} mm is shown.`,
    hint: "Drag the layer slider to stop the print at any layer.",
    counts: (checks: number, of: number, version: string) => `${checks} of ${of} enclosure checks met, ${version}`,
  },
  brief: {
    path: "/s/concept/brief",
    lead: "The one line",
    lines: "Every line of the brief",
    statusTitle: "Where the brief stands",
    decisions: (n: number) => `${n} decisions laid out as a tree`,
    hint: "Each line is a row of the brief; done lines have been argued with and kept.",
    counts: (n: number, done: number) => `${n} lines, ${done} done`,
  },
  claim: {
    path: "/s/research/claims",
    listTitle: "Claims and where each is stated",
    flowTitle: "Nothing is claimed in an ad without proof",
    flowHint: "The app's own proof check, run on the example's rows: what a link to each kind of row would count as today.",
    check: "Proof check",
    checkBody: "An ad line with a number or a superlative needs a linked proof row before it can be approved.",
    ads: "Ad drafts",
    adsBody: (n: number) => `${n} draft${n === 1 ? "" : "s"}, each waiting for proof and for you`,
    honest: (n: number, verified: number) => `${n} claims from the example's own documents, ${verified === 0 ? "none verified yet" : `${verified} verified`}. Each keeps the file and the place it came from.`,
    hint: "Each claim keeps its source; the status is the research stage's verdict.",
    counts: (n: number) => `${n} claims`,
    stated: "Stated in",
  },
  cost: {
    path: "/s/production/economics",
    buildTitle: (batch: number) => `Unit cost at a batch of ${batch}, built up line by line`,
    total: "Unit cost",
    groups: { part: "Parts", line: "Per-unit lines", scrap: "Scrap allowance", setup: "Setup spread over the batch" },
    curveTitle: "The cost per unit as the batch grows",
    curveHint: "The example's own estimates at each volume.",
    marginTitle: "What each channel leaves, against the cost at a volume",
    volume: "Volume",
    net: "net",
    leaves: (v: string) => `leaves ${v}`,
    short: (v: string) => `short by ${v}`,
    hint: "Every figure is the app's own build-up of the example's rows; a missing price is named, never guessed.",
    counts: (lines: number, missing: number) => `${lines} lines${missing ? `, ${missing} not priced` : ""}`,
    honest: "The build-up is worked out by the app from the parts list and the cost rows. The volume estimates and the channel prices are the example's own rows; none has been tested in a sale.",
  },
  ad: {
    path: "/s/marketing/ads",
    stackTitle: "Ad drafts",
    fitTitle: "The front draft against each channel's text limit",
    fitHint: "Each channel's limit as the app holds it; enforced limits refuse a longer line.",
    of: (i: number, n: number) => `Draft ${i} of ${n}`,
    hint: "Drafts change every few seconds; choose one to hold it.",
    counts: (n: number, channels: number) => `${n} drafts, ${channels} channels`,
    choose: "Choose a draft",
  },
  channel: {
    path: "/s/sales/listing",
    listingTitle: "The listing, as the marketplace takes it",
    listingHint: (category: string) => `Amazon's limits for ${category}, held by the app. The example has no listing text yet, so every field stands at zero.`,
    channelsTitle: "Channels, with what each takes and leaves",
    price: "Price",
    take: "Takes",
    net: "Leaves",
    hint: "The listing's fields fill from the brief, the positioning and the ads, each within its limit.",
    counts: (rows: number, channels: number) => `${rows} listing row, ${channels} channels`,
  },
};

/**
 * How it works, as a short strip inside "What you get": AI drafts each stage from the last and you decide. No time
 * saving, percentage or "faster" is claimed, because none has been measured.
 */
export const MECHANISM = {
  title: "How does it work? Three steps, seven times: AI drafts a stage, you approve it, the next stage starts from there.",
  guarantees: [
    { title: "Nothing is posted or bought without you", text: "A post, a message or a purchase goes out only when you confirm it in the app. The app places no orders." },
    { title: "No number is made up", text: "A missing price is named and left out of the total. Print time and material come from the slicer's own output." },
    { title: "Every claim shows its source", text: "Each claim is listed with where it came from and marked verified or unverified. An ad line with a number or a superlative needs linked proof before you can approve it." },
    { title: "You see what a change touches", text: "Change a part, a requirement or a decision and a notice lists everything that depends on it. Every change is kept in a read-only log." },
  ],
};

/**
 * The proof: one showcase of the worked example in two groups, Make it (the engineering stage, Engineering.tsx) and
 * Sell it (the market stage, Market.tsx), then one row of the seven stages with their gate counts, worked out by
 * the app's own gate rules (exampleData.ts), and what is still open behind a disclosure.
 */
export const PROOF = {
  eyebrow: `The worked example: ${EXAMPLE.name}`,
  title: "Has it worked on a real idea?",
  /** the counts are the example's own rows, handed in by the page, so the sentence cannot drift from the views under it */
  lead: (parts: number, wires: number) =>
    `Yes, on ours. We had a joke idea on the way to an airport: a luggage tag that heckles its trip. Over one weekend, one of us took that line to a costed list of ${parts} parts and a checked ${wires}-wire schematic. Then a 3D model, margins for five sales channels and a launch plan. This app was built to do it. Its own data is below.`,
  switch: "Which half of the example to show",
  groups: {
    make: { label: "Make it", sub: "Six engineering views, live: turn the model, pan the schematic, watch the case print." },
    sell: { label: "Sell it", sub: "Seven marketing and sales views, built on the same rows as the engineering." },
  },
  noscript: "Script is off, so the switch cannot change. The Sell it views are set out below.",
  enclosureNote: "3D is the app's view of the example: its own case design, and each part at the size and place its row gives; the board's chips have no layout rows yet and are set out for illustration. Enclosure and print shows the box the app generates around the same parts.",
  status: {
    title: "What did it tell us?",
    lead: `What we did not want to hear, before we spent a dollar. At prototype cost, ${EXAMPLE.badNews.costAtOne} a unit, all five channels lose money. At 100 units our own site leaves about ${EXAMPLE.badNews.ownSiteLeaves} a unit and wholesale still loses. So the tag is designed and costed, not yet built or sold. Here are its checks, stage by stage.`,
    label: "The seven stages of the example, each with its checks met",
    count: (met: number, total: number) => `${met} of ${total} checks met`,
    open: (n: number) => `What is still open (${n} ${n === 1 ? "check" : "checks"})`,
    none: "Every check is met.",
  },
};

/**
 * The market stage: seven tabs at the weight of the engineering stage. Each shows the example's own rows where it
 * has them, and where it has few or none, the structure the stage produces and the limits the app enforces, with
 * a line saying which is which. Counts are worked out from the rows (storyData.ts).
 */
export const MARKET = {
  /** names the tab list */
  title: "Sell it: the marketing and sales views",
  tabs: { positioning: "Positioning", brand: "Brand kit", ads: "Ads", landing: "Landing page", launch: "Launch plan", listing: "Listing", results: "Channels and results" },
  badge: "The example's rows, read only",
  note: "Connections to Amazon, X and Instagram are built to each service's published documentation and tested against stand-ins. They have not yet been run on live accounts.",
  noscript: "Script is off, so the tabs cannot change. Every tab is set out below.",
  positioning: {
    path: "/s/marketing/positioning",
    lineTitle: "The line",
    lineHint: "The app composes one sentence from six parts. The brackets are the parts the example has not filled.",
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
    honest: (launches: number) => (launches === 0 ? `${EXAMPLE.name} has no launch date yet, so no step has a due date. Set one in the app and every step is dated, counted back from it. Move the date and every step moves.` : `${EXAMPLE.name} has ${launches} launch planned.`),
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
 * Pricing on the welcome page (owner, 22 Nov): early access is limited to 50 places, then two paid plans. The
 * cards are the paid plans of the catalogue in force, at its prices (Pricing.tsx, paidPlans); with its prices off
 * the page there are no cards and `plansLead` is not said. Early access takes no payment. No discount is promised:
 * none was ruled.
 */
export const PRICING = {
  eyebrow: "Pricing",
  title: "What does it cost?",
  lead: "Nothing is charged during early access, and no card is asked for. There are 50 places.",
  plansLead: "After those are gone it is a monthly subscription, on one of the two plans below.",
  offerTitle: "Early access: 50 places",
  offerText: "Give an email address and one line about what you want to make. Workspaces open in the order places were claimed. The count beside the form is the real number of places left.",
  plansTitle: "After early access",
  includes: "Includes",
  per: "a month",
  first: "Early-access members are asked first when paid plans open.",
  questionsTitle: "What might stop you?",
};

/** "Who built it": shown only when the setting BUILDER.setting holds a name and a text (builder.ts). */
export const BUILDER = {
  setting: "welcome.builder",
  title: "Who built it?",
};

type Question = { q: string; a: string };

/**
 * The buying questions of the welcome page and its FAQPage data. The prices are the ones the pricing cards show,
 * so the two cannot disagree. "Who can see my idea?" is answered in the owner's words of 22 Nov ("The ideas are
 * kept in your own space and not shared with others"); nothing is said about ownership, which is not ruled.
 */
export function questions(plans: { name: string; price: string; per: string }[]): Question[] {
  const prices = plans.map((p) => `${p.name} at ${p.price} ${p.per}`).join(" and ");
  const then = prices ? ` After the 50 early-access places it is a subscription: ${prices}.` : "";
  return [
    { q: "What does it cost?", a: `Nothing during early access, and no card is asked for.${then} ${PRICING.first}` },
    {
      q: "Is the limit of 50 real?",
      a: `Yes. Fifty is a fixed limit, and the count on this page is read from our database each time the page loads. A place puts you among the first 50 people to take an idea of their own through the seven stages. When the places are gone the form becomes a waiting list${prices ? ", and the way in is a paid plan" : ""}.`,
    },
    { q: "Who can see my idea?", a: "Your ideas are kept in your own workspace and are not shared with others." },
    {
      q: "I am not an engineer. Can I still use it?",
      a: "For the drawing, yes. Parts are drawn from the sizes you enter, or from an STL or STEP file, and the enclosure is generated around them, so you need no CAD skills. For electronics, some knowledge helps: you approve every draft and you build the prototype yourself. The electrical checks list what they find, worst first, and the build sheet gives the order to solder in.",
    },
    {
      q: "My product has no electronics. Is this for me?",
      a: "Yes. A concept is one of three kinds: electronics in an enclosure, a printed part, or a physical product with no electronics. The sections that do not apply, such as the schematic for a printed part, are hidden.",
    },
    {
      q: "Can I trust what the AI writes?",
      a: "Trust it as a draft, never as a fact. A draft counts for nothing until you approve it. Every claim is listed with its source and marked verified or unverified. A part with no price is named and left out of the total, never counted as zero. On our own idea it showed that every channel lost money at prototype cost.",
    },
    {
      q: "What is not finished yet?",
      a: `Connections to outside services (Amazon, X, Instagram and printers) are built to each service's published documentation and tested against stand-ins; they have not yet been run on live accounts. Team workspaces open after early access. Our own example, ${EXAMPLE.name}, is designed and costed, not yet built or sold. And nobody can promise a product will sell. This shows you the numbers so you can decide.`,
    },
  ];
}
