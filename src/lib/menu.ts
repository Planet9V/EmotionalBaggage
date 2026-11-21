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
    | "enclosure"
    | "buildsheet"
    | "builds"
    | "economics"
    | "batches"
    | "partprices"
    | "compliance"
    // marketing (plan 8.1 to 8.7)
    | "personas"
    | "competitors"
    | "positioning"
    | "pricing"
    | "names"
    | "brand"
    | "imagery"
    // content (plan 8.8 to 8.12)
    | "ads"
    | "landing"
    | "listing"
    | "announce"

    // campaigns (plan 8.13 to 8.16)
    | "campaigns"
    | "launch"
    | "results"
    | "links"
    // sales and channels (plan 8.17 to 8.20)
    | "posting"
    | "inbox"
    | "replies"
    | "reviews";
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
        columns: [{ key: "kind", label: "Kind" }],
        view: "names",
        statuses: ["draft", "candidate", "shortlist", "chosen", "rejected"],
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
        key: "enclosure",
        label: "Enclosure",
        blurb: "Generate a printable base and lid around the parts, with the openings they need, and check the result.",
        view: "enclosure",
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
        blurb: "Suppliers, prices and order status for every part, search links, and a shopping list by supplier.",
        view: "sourcing",
        store: "design/bom",
        statuses: ["to buy", "to print", "ordered", "in hand"],
      },
      {
        key: "printing",
        label: "3D printing",
        blurb: "Slice a file for one of your printers, send it, follow the print and record how it came out.",
        view: "printing",
        columns: [
          { key: "material", label: "Material" },
          { key: "settings", label: "Settings" },
          { key: "estimate", label: "Estimate" },
        ],
        statuses: ["queued", "slicing", "sliced", "sent", "printing", "done", "failed", "cancelled"],
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
      {
        key: "builds",
        label: "Builds",
        blurb: "Named builds (works-like, looks-like, EVT, DVT, PVT), each with its exit criteria and the tests it must pass.",
        view: "builds",
        statuses: ["planned", "building", "testing", "passed", "failed"],
        addLabel: "Add build",
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
        blurb: "Unit cost built from the parts and the lines you add, and the margin on each channel. Each figure says where it comes from.",
        view: "economics",
        statuses: ["estimate", "quoted", "actual"],
        addLabel: "Add cost line",
      },
      {
        key: "batches",
        label: "Batch plan",
        blurb: "Each build run, its size, its date, what it costs per unit and whether production is ready.",
        view: "batches",
        statuses: ["planned", "funded", "building", "shipped"],
        addLabel: "Add batch",
      },
      {
        key: "suppliers",
        label: "Suppliers",
        blurb: "Who supplies what, how long it takes and the smallest order. A public web address only; no personal contact details.",
        view: "items",
        columns: [
          { key: "code", label: "Code (parts link to it)" },
          { key: "supplies", label: "Supplies" },
          { key: "leadTimeDays", label: "Lead time (days)" },
          { key: "minOrder", label: "Minimum order" },
          { key: "location", label: "Location" },
          { key: "url", label: "Website" },
        ],
        statuses: ["candidate", "quoted", "approved", "in use", "dropped"],
        addLabel: "Add supplier",
      },
      {
        key: "pricing",
        label: "Part prices",
        blurb: "A unit price, a quantity price break and a supplier for each part. These feed the unit cost.",
        view: "partprices",
        store: "design/bom",
      },
      {
        key: "methods",
        label: "Manufacturing methods",
        blurb: "How each custom part or assembly step is made, with its tooling cost and its extra cost per unit.",
        view: "items",
        columns: [
          { key: "method", label: "Method" },
          { key: "appliesTo", label: "Applies to (part reference or step key)" },
          { key: "toolingCost", label: "Tooling cost" },
          { key: "unitCost", label: "Extra cost per unit" },
        ],
        statuses: ["estimate", "quoted", "actual"],
        addLabel: "Add method",
      },
      {
        key: "compliance",
        label: "Compliance",
        blurb: "A checklist of rules that may apply to this product, for your own checking. Not advice.",
        view: "compliance",
        statuses: ["to check", "applies", "does not apply", "done", "draft"],
        addLabel: "Add compliance row",
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
        key: "personas",
        label: "Personas",
        blurb: "Who buys it, the job they are trying to get done, what makes them buy and what stops them.",
        view: "personas",
        statuses: ["draft", "approved"],
        addLabel: "Add persona",
      },
      {
        key: "competitors",
        label: "Competitors",
        blurb: "What else a buyer could choose, including doing nothing, with price, claim and weakness, each with its source.",
        view: "competitors",
        statuses: ["draft", "approved"],
        addLabel: "Add competitor",
      },
      {
        key: "positioning",
        label: "Positioning",
        blurb: "One line, three messages, the proof for each, and the reviewer's attack on it.",
        view: "positioning",
        statuses: ["draft", "approved", "done"],
        addLabel: "Add positioning",
      },
      {
        key: "pricing",
        label: "Pricing",
        blurb: "Price options against unit cost, channel fees and competitor prices, with the margin worked out.",
        view: "pricing",
        statuses: ["draft", "approved"],
        addLabel: "Add price",
      },
      {
        key: "names",
        label: "Names and taglines",
        blurb: "The same list as under Concept: candidates with the checks you still have to run yourself.",
        view: "names",
        store: "concept/names",
      },
      {
        key: "brand",
        label: "Brand kit",
        blurb: "Voice, colours, type, logos, tagline and boilerplate, applied to everything generated.",
        view: "brand",
        statuses: ["draft", "approved"],
        addLabel: "Add brand note",
      },
      {
        key: "imagery",
        label: "Imagery",
        blurb: "The shots a listing and ads need, and the file for each.",
        view: "imagery",
        statuses: ["draft", "approved"],
        addLabel: "Add shot",
      },
      {
        key: "landing",
        label: "Landing page",
        blurb: "The page for one approved message, as sections you can edit and reorder, in the brand kit. Preview it, then export it as a static page.",
        view: "landing",
        statuses: ["draft", "planned", "approved"],
        addLabel: "Add section",
      },
      {
        key: "ads",
        label: "Ads",
        blurb: "Ad variants per channel within the platform's limits, each tied to one message, with the rule for stopping or scaling it.",
        view: "ads",
        statuses: ["draft", "approved", "running", "paused", "killed"],
        addLabel: "Add ad",
      },
      {
        key: "campaigns",
        label: "Campaigns",
        blurb: "Each campaign's objective, audience, budget, dates, creative, the number it must reach and the rule for stopping or scaling it.",
        view: "campaigns",
        statuses: ["planned", "ready", "running", "paused", "done", "killed"],
        addLabel: "Add campaign",
      },
      {
        key: "launch",
        label: "Launch plan",
        blurb: "A dated checklist for each launch, built from a template. Moving the launch date moves every step.",
        view: "launch",
        store: "marketing/launch",
        statuses: ["open", "in progress", "done", "blocked"],
        addLabel: "Add step",
      },
      {
        key: "results",
        label: "Campaign results",
        blurb: "Spend, clicks and orders by day for each campaign and creative, set against its target and its rule.",
        view: "results",
        store: "marketing/results",
      },
      {
        key: "links",
        label: "Tracked links",
        blurb: "A link for each campaign and creative, with UTM parameters, an optional short address and a QR code for print.",
        view: "links",
        store: "marketing/links",
      },
      {
        key: "social",
        label: "Social",
        blurb: "Posts per channel within each channel's limits, scheduled on a calendar. Posting is done by the channel connection, not here.",
        view: "social",
        columns: [{ key: "channel", label: "Channel" }],
        statuses: ["draft", "approved", "scheduled", "posted"],
        addLabel: "Add draft post",
      },
      {
        key: "announce",
        label: "Launch email and press note",
        blurb: "The launch email, a short press note and a three-email sequence, written from the approved press release. Nothing is sent from here.",
        view: "announce",
        statuses: ["draft", "approved"],
        addLabel: "Add launch piece",
      },
      {
        key: "posting",
        label: "Posting",
        blurb: "Send an approved post to X or Instagram, one at a time, after you confirm what goes where and what X charges.",
        view: "posting",
        store: "marketing/social",
      },
      {
        key: "inbox",
        label: "Replies and comments",
        blurb: "Mentions on X and comments on Instagram, read when you ask, each waiting for a drafted reply.",
        view: "inbox",
        statuses: ["new", "answered", "ignored"],
        addLabel: "Add message",
      },
      {
        key: "replies",
        label: "Replies to send",
        blurb: "Approved replies. Each is sent only when you press Send for that one reply; review replies you post yourself.",
        view: "replies",
        statuses: ["approved", "sent", "withdrawn"],
        addLabel: "Add reply",
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
        blurb: "Title, five bullets, description and search terms within Amazon's limits for the category, with the claims Amazon does not allow flagged and an image checklist.",
        view: "listing",
        statuses: ["draft", "ready", "live"],
        addLabel: "Add listing",
      },
      {
        key: "monitor",
        label: "Sales monitor",
        blurb: "Orders and revenue from Amazon Seller Central.",
        view: "monitor",
      },
      {
        key: "reviews",
        label: "Reviews and questions",
        blurb: "What customers say and ask, with drafted replies, and the requests that keep coming back turned into requirements.",
        view: "reviews",
        statuses: ["new", "answered", "no reply needed"],
        addLabel: "Add review or question",
      },
      {
        key: "channels",
        label: "Channels and pricing",
        blurb: "Every channel, its price and what it costs to sell there. The margin is worked out on Production, Unit economics.",
        view: "items",
        columns: [
          { key: "price", label: "Price" },
          { key: "platformPercent", label: "Platform fee (%)" },
          { key: "platformFixed", label: "Platform fee (fixed)" },
          { key: "paymentPercent", label: "Payment fee (%)" },
          { key: "paymentFixed", label: "Payment fee (fixed)" },
          { key: "fulfilment", label: "Fulfilment per order" },
          { key: "returnsPercent", label: "Returns allowance (%)" },
          { key: "adCost", label: "Advertising per order" },
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
  "passed",
]);
