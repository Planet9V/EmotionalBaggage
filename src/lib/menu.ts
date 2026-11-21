// The menu is the product: one ordered path from concept to sales.
// Every section stores "items" in the backend under its `store` key.

export type Column = { key: string; label: string };

export type Section = {
  key: string;
  label: string;
  blurb: string;
  /** which specialised view renders this section; "items" is the generic list */
  view:
    | "items"
    | "challenge"
    | "research"
    | "model"
    | "bom"
    | "sourcing"
    | "printing"
    | "monitor"
    | "social"
    | "decisions"
    | "schematic"
    | "layout"
    | "buildsheet";
  /** backend section key the items live under (defaults to stage/key) */
  store?: string;
  columns?: Column[];
  statuses?: string[];
  addLabel?: string;
};

export type Stage = {
  key: string;
  n: number;
  label: string;
  goal: string;
  sections: Section[];
};

export const DEFAULT_STATUSES = ["open", "in progress", "done", "blocked"];

export const STAGES: Stage[] = [
  {
    key: "concept",
    n: 1,
    label: "Concept",
    goal: "State the proposition, then have it questioned until it holds.",
    sections: [
      {
        key: "brief",
        label: "Brief",
        blurb: "What it is, who it is for, why now, and what it costs to find out.",
        view: "items",
        addLabel: "Add to brief",
      },
      {
        key: "press",
        label: "Press release",
        blurb: "The announcement you would publish on launch day, written first and attacked by the reviewer.",
        view: "items",
        statuses: ["draft", "reviewed", "final"],
        addLabel: "Add press release",
      },
      {
        key: "faq",
        label: "FAQ",
        blurb: "The questions buyers and sceptics will ask, with straight answers.",
        view: "items",
        statuses: ["draft", "reviewed", "final"],
        addLabel: "Add question",
      },
      {
        key: "challenge",
        label: "Challenge",
        blurb: "An AI reviewer that pushes back on the proposition and asks what it rests on.",
        view: "challenge",
      },
      {
        key: "names",
        label: "Names and taglines",
        blurb: "Candidate names and lines, with what still has to be cleared.",
        view: "items",
        columns: [{ key: "kind", label: "Kind" }],
        statuses: ["candidate", "shortlist", "chosen", "rejected"],
        addLabel: "Add name or tagline",
      },
      {
        key: "decisions",
        label: "Decision tree",
        blurb: "Every decision, its options, what each leads to and what it depends on.",
        view: "decisions",
        statuses: ["open", "decided", "blocked"],
      },
      {
        key: "questions",
        label: "Open questions",
        blurb: "Decisions and conflicts that block later stages.",
        view: "items",
        statuses: ["open", "decided"],
        addLabel: "Add question",
      },
    ],
  },
  {
    key: "research",
    n: 2,
    label: "Research",
    goal: "Check the claims the proposition depends on against outside sources.",
    sections: [
      {
        key: "ask",
        label: "Ask",
        blurb: "Web research through the Perplexity API, saved with its citations.",
        view: "research",
      },
      {
        key: "claims",
        label: "Claims to verify",
        blurb: "Every outside fact the plan leans on, and whether it has been checked.",
        view: "items",
        columns: [{ key: "source", label: "Stated in" }],
        statuses: ["unverified", "verified", "wrong"],
        addLabel: "Add claim",
      },
    ],
  },
  {
    key: "design",
    n: 3,
    label: "Design",
    goal: "Turn the proposition into requirements, a model and a parts list.",
    sections: [
      {
        key: "requirements",
        label: "Requirements",
        blurb: "What the product must do, each with how it will be tested.",
        view: "items",
        columns: [
          { key: "trigger", label: "Detection" },
          { key: "response", label: "Response" },
        ],
        addLabel: "Add requirement",
      },
      {
        key: "model",
        label: "3D model",
        blurb: "View the enclosure, explode it, and load your own STL.",
        view: "model",
      },
      {
        key: "schematic",
        label: "Schematic",
        blurb: "Parts, pins and the wires between them. Drag to arrange, drag pin to pin to connect.",
        view: "schematic",
        store: "design/wiring",
        statuses: ["to solder", "soldered", "tested"],
      },
      {
        key: "layout",
        label: "Physical layout",
        blurb: "Where each part sits inside the envelope. Drag to move; the 3D model follows.",
        view: "layout",
        store: "design/bom",
      },
      {
        key: "bom",
        label: "Bill of materials",
        blurb: "Every part, its source and its cost.",
        view: "bom",
        statuses: ["to buy", "to print", "ordered", "in hand"],
      },
    ],
  },
  {
    key: "prototype",
    n: 4,
    label: "Prototype",
    goal: "Buy the parts, print the shell, assemble it and prove it works.",
    sections: [
      {
        key: "sourcing",
        label: "Sourcing",
        blurb: "Buy links for every part, and an Amazon cart once ASINs are filled in.",
        view: "sourcing",
        store: "design/bom",
        statuses: ["to buy", "to print", "ordered", "in hand"],
      },
      {
        key: "printing",
        label: "3D printing",
        blurb: "Printer status, print settings and the job queue.",
        view: "printing",
        columns: [
          { key: "material", label: "Material" },
          { key: "settings", label: "Settings" },
          { key: "estimate", label: "Estimate" },
        ],
        statuses: ["waiting on file", "ready", "printing", "printed", "failed"],
        addLabel: "Add print job",
      },
      {
        key: "wiring",
        label: "Wiring and soldering",
        blurb: "The build sheet generated from the schematic: every joint, in order, with its check.",
        view: "buildsheet",
        store: "design/wiring",
        statuses: ["to solder", "soldered", "tested"],
      },
      {
        key: "assembly",
        label: "Assembly",
        blurb: "The build, phase by phase.",
        view: "items",
        columns: [{ key: "time", label: "Time" }],
        addLabel: "Add step",
      },
      {
        key: "tests",
        label: "Acceptance tests",
        blurb: "What the unit must pass before it counts as done.",
        view: "items",
        columns: [{ key: "pass", label: "Pass condition" }],
        statuses: ["not run", "pass", "fail"],
        addLabel: "Add test",
      },
    ],
  },
  {
    key: "production",
    n: 5,
    label: "Production",
    goal: "Know the unit cost at each volume and what each batch needs.",
    sections: [
      {
        key: "economics",
        label: "Unit economics",
        blurb: "Landed cost by volume and margin by channel.",
        view: "items",
        columns: [
          { key: "volume", label: "Volume" },
          { key: "cogs", label: "Landed COGS" },
          { key: "price", label: "Price" },
          { key: "margin", label: "Gross margin" },
        ],
        statuses: ["estimate", "quoted", "actual"],
        addLabel: "Add line",
      },
      {
        key: "batches",
        label: "Batch plan",
        blurb: "Each build run, its size, its gate and its exit test.",
        view: "items",
        columns: [
          { key: "units", label: "Units" },
          { key: "gate", label: "Gate to start" },
        ],
        statuses: ["planned", "funded", "building", "shipped"],
        addLabel: "Add batch",
      },
    ],
  },
  {
    key: "marketing",
    n: 6,
    label: "Marketing",
    goal: "Positioning, pages, ads and posts, all tied to one action each.",
    sections: [
      {
        key: "positioning",
        label: "Positioning",
        blurb: "Who it is for and the voice it speaks in.",
        view: "items",
        addLabel: "Add positioning note",
      },
      {
        key: "landing",
        label: "Landing pages",
        blurb: "Each page, its job and its single call to action.",
        view: "items",
        columns: [
          { key: "path", label: "Path" },
          { key: "cta", label: "Call to action" },
        ],
        statuses: ["planned", "drafted", "live"],
        addLabel: "Add page",
      },
      {
        key: "ads",
        label: "Ads",
        blurb: "Ad copy and the rule for killing or scaling it.",
        view: "items",
        columns: [
          { key: "channel", label: "Channel" },
          { key: "rule", label: "Kill / scale rule" },
        ],
        statuses: ["draft", "approved", "running", "killed"],
        addLabel: "Add ad",
      },
      {
        key: "campaigns",
        label: "Campaigns",
        blurb: "The campaign plan by funnel stage.",
        view: "items",
        columns: [
          { key: "funnel", label: "Funnel stage" },
          { key: "budget", label: "Budget" },
          { key: "kpi", label: "KPI" },
        ],
        statuses: ["planned", "running", "done", "killed"],
        addLabel: "Add campaign",
      },
      {
        key: "social",
        label: "Social",
        blurb: "Draft, approve and post to X and Instagram; replies come back here.",
        view: "social",
        columns: [{ key: "channel", label: "Channel" }],
        statuses: ["draft", "approved", "posted"],
        addLabel: "Add draft post",
      },
    ],
  },
  {
    key: "sales",
    n: 7,
    label: "Sales",
    goal: "Amazon first; watch what sells and what it earns.",
    sections: [
      {
        key: "listing",
        label: "Amazon listing",
        blurb: "Title, bullets, images and keywords for the listing.",
        view: "items",
        columns: [{ key: "field", label: "Listing field" }],
        statuses: ["draft", "ready", "live"],
        addLabel: "Add listing element",
      },
      {
        key: "monitor",
        label: "Sales monitor",
        blurb: "Orders and revenue from Amazon Seller Central.",
        view: "monitor",
      },
      {
        key: "channels",
        label: "Channels and pricing",
        blurb: "Every channel, its price and what the platform takes.",
        view: "items",
        columns: [
          { key: "price", label: "Price" },
          { key: "take", label: "Platform take" },
          { key: "net", label: "Net" },
        ],
        statuses: ["planned", "live", "paused"],
        addLabel: "Add channel",
      },
    ],
  },
];

export function storeKey(stage: Stage, section: Section) {
  return section.store ?? `${stage.key}/${section.key}`;
}

export function findSection(stageKey: string, sectionKey: string) {
  const stage = STAGES.find((s) => s.key === stageKey);
  const section = stage?.sections.find((s) => s.key === sectionKey);
  return stage && section ? { stage, section } : null;
}

/** statuses that mean "nothing left to do here" */
export const CLOSED = new Set([
  "done",
  "decided",
  "verified",
  "chosen",
  "rejected",
  "pass",
  "printed",
  "live",
  "posted",
  "shipped",
  "actual",
  "killed",
  "in hand",
  "tested",
  "final",
]);
