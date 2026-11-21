/**
 * The words of the public welcome page (/welcome) and its one-page overview (/welcome/overview), in one place
 * so the two never disagree. Every claim here is something the app does today, checked against
 * docs/guide/user.md and docs/guide/admin.md; where something needs a model, a key or a service, it says so.
 * No figures appear that are not measured in this repository: no user counts, no prices, no benchmarks.
 */

export const PRODUCT = "Concept to Realization";
export const REPO_URL = "https://github.com/Planet9V/EmotionalBaggage";

export const HERO = {
  eyebrow: "Product workbench · free · self-hosted",
  titleBefore: "Take your product idea to a ",
  titleAccent: "tested prototype",
  titleAfter: " and a launch plan, in one place.",
  sub: "Concept to Realization walks a product idea through seven stages, from the first brief to the sales channel. Your parts list draws the schematic, the 3D layout, the enclosure and the build sheet. Every cost on screen is added up from what you entered.",
  status: "Public demo: sign in as demo / demo. That account is shared with everyone who visits.",
};

export const META = {
  title: "Concept to Realization: from product idea to tested prototype and launch plan",
  description:
    "A free, self-hosted workbench for a product idea: research, schematic, 3D layout, enclosure, build sheet, unit cost and launch plan in one place. Try the live demo.",
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

export const STAGES: { n: string; name: string; text: string }[] = [
  { n: "01", name: "Concept", text: "Write the brief, the launch-day press release and the FAQ before anything is built. Have the AI reviewer argue against them. Lay out the decisions the idea depends on." },
  { n: "02", name: "Research", text: "Ask questions through Perplexity and keep each answer with its sources. A claim becomes verified or wrong from the sources you judged, not from a guess." },
  { n: "03", name: "Design", text: "Requirements, the parts list, the physical layout, the 3D model, the schematic with its electrical checks, and a printable enclosure." },
  { n: "04", name: "Prototype", text: "Sourcing links and offers per part, print jobs sliced by OrcaSlicer, a soldering build sheet, assembly steps, acceptance tests and named builds." },
  { n: "05", name: "Production", text: "The unit cost from parts and cost lines, batch plans with the cash each needs, suppliers, manufacturing methods and a compliance checklist for your own checking." },
  { n: "06", name: "Marketing", text: "Personas, competitors, positioning, pricing, a brand kit, ads per channel, a landing page, social posts, campaigns and a dated launch plan." },
  { n: "07", name: "Sales", text: "The Amazon listing, sales channels with their fees, reviews and questions turned into requirements, and the sales monitor." },
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
  title: "Built for one person with one product idea",
  lead: "You have an idea for a physical product, often with electronics inside. You want to get from the idea to a working prototype, a parts list with real prices and a plan to sell it, without stitching ten tools together.",
  fit: [
    "Inventors and makers taking a first hardware product past the bench.",
    "Small teams preparing a Kickstarter, Amazon or own-site launch.",
    "Engineers who want the cost and the build order worked out, not estimated in their head.",
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
  title: "Start with the example. Then bring your own idea.",
  text: "The live workbench opens on Baggage Claims MK1, a full example concept with its parts, wiring, decisions, costs and campaigns already entered. Walk through it, then start a concept of your own with the six-step wizard.",
};
