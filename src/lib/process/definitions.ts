import { STAGES } from "@/lib/menu";
import { PRODUCT_TYPES, sectionVisible, type ProductType } from "@/lib/productTypes";

// The process per product type (plan 3.2): for each of the seven stages, the gate that has to
// be passed before the concept moves on. A gate is a list of checks, and a check is data: a
// kind from the list below and its parameters. One pure function (evaluate.ts) reads every kind,
// so a new gate needs no new code, only a new line here.
//
// `section` parameters are menu paths ("<stage key>/<section key>"), so a check points at the
// page that fixes it. A check may only name a section its product type shows: a printed part or
// a wooden toy has no schematic, so its gates cannot ask for one. That is enforced at load.

export type CheckKind =
  | "min-rows"
  | "all-status"
  | "decision-made"
  | "no-open"
  | "claims-verified"
  | "field-set"
  | "electrical"
  | "enclosure"
  | "production-ready"
  | "content-proof"
  | "positioning"
  | "campaign-budget"
  | "tracked-links"
  | "campaign-results";

/** Concept fields a `field-set` check can ask for. */
export type ConceptField = "name" | "oneLiner";

/**
 * Every check may name `anchor`: the id of the control on its page that fixes it (the next step links to
 * `/s/<section>#<anchor>`, and the page scrolls to and focuses it). A check about rows that are not yet in the
 * right state links to the first such row with `?item=<id>` where the section's page opens a row from the address.
 */
/** `todo`: what to do when the section has no row yet, in words, when the generic "Add a row" would not say it. */
type Base = { id: string; label: string; anchor?: string; todo?: string };

export type Check =
  /**
   * `statuses`: count only rows at one of these statuses ("approved"). `except`: leave out rows whose
   * data field has this value (the campaigns section's one budget row, kind "plan").
   */
  | (Base & { kind: "min-rows"; params: { section: string; min: number; statuses?: string[]; except?: { field: string; value: string } } })
  | (Base & { kind: "all-status"; params: { section: string; statuses: string[] } })
  /**
   * `fallback: "root"`: when no decision has the key, the first top-level decision of the tree is
   * read instead. The decision tree screen makes keys from the question, so a user cannot always
   * type the key; the first decision of a tree is where the go/no-go question sits.
   */
  | (Base & { kind: "decision-made"; params: { key: string; fallback?: "root" } })
  | (Base & { kind: "no-open"; params: { section: string; statuses?: string[] } })
  | (Base & { kind: "claims-verified"; params: { share: number; section?: string } })
  | (Base & { kind: "field-set"; params: { field: ConceptField } })
  // Worked out by another feature's own code (src/lib/process/computed.ts):
  /** the electrical checks (src/lib/parts/erc.ts) find no error */
  | (Base & { kind: "electrical"; params: Record<string, never> })
  /** the enclosure's checks pass on the saved choice, measured on today's parts and settings */
  | (Base & { kind: "enclosure"; params: Record<string, never> })
  /** the four production readiness checks (src/lib/economics/readiness.ts) for the first planned batch */
  | (Base & { kind: "production-ready"; params: Record<string, never> })
  /** every released content row in these stores has proof for its numbers and superlatives (src/lib/content/claims.ts) */
  | (Base & { kind: "content-proof"; params: { sections: string[] } })
  /** a positioning row the reviewer attacked (on its current words) and that is approved (src/lib/market/rules.ts) */
  | (Base & { kind: "positioning"; params: Record<string, never> })
  /** the campaigns section's budget row (kind "plan") has a total budget and the share of margin a campaign may spend */
  | (Base & { kind: "campaign-budget"; params: Record<string, never> })
  /** tracked links (their own table, counted on the server: GateFacts.links) */
  | (Base & { kind: "tracked-links"; params: { min: number } })
  /** campaign results (their own table, counted on the server: GateFacts.results) */
  | (Base & { kind: "campaign-results"; params: { min: number } });

export type Gate = { stage: string; checks: Check[] };

export type ProcessDefinition = { productType: ProductType; stages: Gate[] };

/** The section `no-open` treats as open when no statuses are given. */
export const OPEN_STATUSES = ["open", "blocked"];

/** The decision every concept settles before it leaves the Concept stage. */
export const GO_DECISION = "go";

// Checks shared by every type, stage by stage.
const conceptGate: Check[] = [
  { id: "concept.one-liner", label: "The concept has a one-line description", kind: "field-set", params: { field: "oneLiner" } },
  { id: "concept.brief", label: "The brief has at least three lines", kind: "min-rows", anchor: "add-row", params: { section: "concept/brief", min: 3 } },
  { id: "concept.go", label: "The go/no-go decision is decided", kind: "decision-made", params: { key: GO_DECISION, fallback: "root" } },
  { id: "concept.questions", label: "No open question is left open or blocked", kind: "no-open", params: { section: "concept/questions" } },
];

const researchGate: Check[] = [
  { id: "research.claims", label: "At least one claim is recorded", kind: "min-rows", anchor: "add-row", params: { section: "research/claims", min: 1 } },
  { id: "research.verified", label: "At least 80% of claims are verified", kind: "claims-verified", params: { share: 0.8 } },
];

const requirements: Check = { id: "design.requirements", label: "At least one requirement is written", kind: "min-rows", anchor: "draft-with-ai", params: { section: "design/requirements", min: 1 } };
const parts: Check = { id: "design.bom", label: "The bill of materials has at least one part", kind: "min-rows", anchor: "draft-with-ai", params: { section: "design/bom", min: 1 } };
const requirementsClosed: Check = { id: "design.requirements-open", label: "No requirement is open or blocked", kind: "no-open", params: { section: "design/requirements" } };

// A part made by printing is not bought: "to print" counts until its print job is done.
const inHand: Check = { id: "prototype.parts-in-hand", label: "Every bought part is in hand", kind: "all-status", params: { section: "prototype/sourcing", statuses: ["in hand", "to print"] } };
const testsWritten: Check = { id: "prototype.tests", label: "At least one acceptance test is written", kind: "min-rows", anchor: "draft-with-ai", params: { section: "prototype/tests", min: 1 } };
const testsPass: Check = { id: "prototype.tests-pass", label: "Every acceptance test passes", kind: "all-status", params: { section: "prototype/tests", statuses: ["pass"] } };
const buildPassed: Check = { id: "prototype.build-passed", label: "A build has passed its exit criteria and tests", kind: "min-rows", anchor: "add-build", todo: "Add a build with its exit criteria and tests", params: { section: "prototype/builds", min: 1, statuses: ["passed"] } };
const printJob: Check = { id: "prototype.print-jobs", label: "At least one print job is set up", kind: "min-rows", anchor: "new-print-job", todo: "Set up a print job: a file, a printer and the settings", params: { section: "prototype/printing", min: 1 } };
// The print job statuses since migration 0018: a finished print is "done" (the gate asked for "printed", which no job can reach).
const printed: Check = { id: "prototype.printed", label: "Every print job is printed", kind: "all-status", params: { section: "prototype/printing", statuses: ["done"] } };

const productionGate: Check[] = [
  { id: "production.economics", label: "Unit economics have at least one line", kind: "min-rows", anchor: "add-row", todo: "Add a cost line in Unit economics", params: { section: "production/economics", min: 1 } },
  { id: "production.batches", label: "At least one batch is planned", kind: "min-rows", anchor: "add-row", todo: "Plan a batch: its size and date", params: { section: "production/batches", min: 1 } },
  { id: "production.ready", label: "Production readiness: tests, compliance, parts and economics", kind: "production-ready", params: {} },
];

// Marketing leads in order (F1): who buys, what else they could buy, the message (attacked, approved), the price,
// the name and the brand; then the pieces that carry the message; then the campaigns, the launch, the links and
// the results. The first unmet check is the next step, so this order is the order the work is done in.
const approved = (id: string, section: string, label: string, anchor = "draft-with-ai"): Check => ({ id, label, kind: "min-rows", anchor, params: { section, min: 1, statuses: ["approved"] } });

const marketingGate: Check[] = [
  approved("marketing.personas", "marketing/personas", "At least one persona is approved"),
  { ...approved("marketing.competitors", "marketing/competitors", "At least one competitor or alternative is approved", "research-competitors"), todo: "Research competitors and alternatives, then review the rows" },
  { id: "marketing.positioning", label: "The positioning is attacked by the reviewer and approved", kind: "positioning", params: {} },
  { ...approved("marketing.pricing", "marketing/pricing", "A price is approved", "add-price"), todo: "Add a price to consider and read its margin" },
  { id: "marketing.name", label: "A name is chosen", kind: "min-rows", anchor: "draft-with-ai", params: { section: "marketing/names", min: 1, statuses: ["chosen"] } },
  { ...approved("marketing.brand", "marketing/brand", "The brand kit is approved", "brand-kit"), todo: "Set up the brand kit: voice, colours and type" },
  approved("marketing.ads", "marketing/ads", "At least one ad is approved"),
  approved("marketing.landing", "marketing/landing", "The landing page has an approved section"),
  { id: "marketing.listing", label: "The marketplace listing is drafted", kind: "min-rows", anchor: "draft-with-ai", params: { section: "sales/listing", min: 1 } },
  approved("marketing.social", "marketing/social", "At least one social post is approved"),
  approved("marketing.announce", "marketing/announce", "The launch email or press note is approved"),
  { id: "marketing.proof", label: "Every approved ad, page, post and announcement has proof for its claims", kind: "content-proof", params: { sections: ["marketing/ads", "marketing/landing", "marketing/social", "marketing/announce"] } },
  { id: "marketing.budget", label: "The campaign budget and the rule numbers are set", kind: "campaign-budget", anchor: "campaign-budget", params: {} },
  { id: "marketing.campaigns", label: "At least one campaign is planned", kind: "min-rows", anchor: "draft-with-ai", todo: "Draft a campaign plan with AI from the budget and the approved messages", params: { section: "marketing/campaigns", min: 1, except: { field: "kind", value: "plan" } } },
  { id: "marketing.launch", label: "A launch plan has dated steps", kind: "min-rows", anchor: "launch-template", todo: "Start a launch plan from a template, with a launch date", params: { section: "marketing/launch", min: 1 } },
  { id: "marketing.links", label: "A tracked link exists for a campaign", kind: "tracked-links", anchor: "new-link", params: { min: 1 } },
  { id: "marketing.results", label: "A campaign has results recorded", kind: "campaign-results", anchor: "enter-results", params: { min: 1 } },
];

const salesGate: Check[] = [
  { id: "sales.channels", label: "At least one sales channel is set", kind: "min-rows", anchor: "add-row", todo: "Add a sales channel with its price and fees", params: { section: "sales/channels", min: 1 } },
  { id: "sales.listing", label: "The listing has at least one element", kind: "min-rows", anchor: "draft-with-ai", params: { section: "sales/listing", min: 1 } },
  { id: "sales.listing-ready", label: "Every listing element is ready or live", kind: "all-status", params: { section: "sales/listing", statuses: ["ready", "live"] } },
  { id: "sales.listing-proof", label: "Every ready or live listing has proof for its claims", kind: "content-proof", params: { sections: ["sales/listing"] } },
];

const gates = (design: Check[], prototype: Check[]): Gate[] => [
  { stage: "concept", checks: conceptGate },
  { stage: "research", checks: researchGate },
  { stage: "design", checks: design },
  { stage: "prototype", checks: prototype },
  { stage: "production", checks: productionGate },
  { stage: "marketing", checks: marketingGate },
  { stage: "sales", checks: salesGate },
];

export const PROCESS_DEFINITIONS: Record<ProductType, ProcessDefinition> = {
  electronics: {
    productType: "electronics",
    stages: gates(
      [
        requirements,
        parts,
        { id: "design.schematic", label: "The schematic has at least one wire", kind: "min-rows", params: { section: "design/schematic", min: 1 } },
        { id: "design.electrical", label: "The electrical checks find no error", kind: "electrical", params: {} },
        { id: "design.enclosure", label: "The chosen enclosure passes its checks", kind: "enclosure", params: {} },
        requirementsClosed,
      ],
      // Prototype leads in order (F1): parts in hand, the enclosure printed, the build sheet worked through, the tests, the build.
      [
        inHand,
        printJob,
        printed,
        { id: "prototype.wiring-tested", label: "Every joint is soldered and tested", kind: "all-status", params: { section: "prototype/wiring", statuses: ["tested"] } },
        testsWritten,
        testsPass,
        buildPassed,
      ]
    ),
  },
  printed: {
    productType: "printed",
    stages: gates(
      [requirements, parts, requirementsClosed],
      [inHand, printJob, printed, testsWritten, testsPass, buildPassed]
    ),
  },
  physical: {
    productType: "physical",
    stages: gates(
      [requirements, parts, requirementsClosed],
      [
        inHand,
        { id: "prototype.assembly", label: "No assembly step is open or blocked", kind: "no-open", params: { section: "prototype/assembly" } },
        testsWritten,
        testsPass,
        buildPassed,
      ]
    ),
  },
};

/** The process for a product type. An unknown stored type gets the electronics process, as the menu does. */
export function processFor(type: string): ProcessDefinition {
  return PROCESS_DEFINITIONS[type as ProductType] ?? PROCESS_DEFINITIONS.electronics;
}

/** The menu section a check points at, or null for checks that are not about one section. */
export function checkSection(check: Check): string | null {
  switch (check.kind) {
    case "min-rows":
    case "all-status":
    case "no-open":
      return check.params.section;
    case "claims-verified":
      return check.params.section ?? "research/claims";
    case "decision-made":
      return "concept/decisions";
    case "electrical":
      return "design/schematic";
    case "enclosure":
      return "design/enclosure";
    case "production-ready":
      return "production/batches";
    case "content-proof":
      return check.params.sections[0] ?? null;
    case "positioning":
      return "marketing/positioning";
    case "campaign-budget":
      return "marketing/campaigns";
    case "tracked-links":
      return "marketing/links";
    case "campaign-results":
      return "marketing/results";
    case "field-set":
      return null;
  }
}

// A definition that names a missing stage or a hidden section, or repeats a check id, would
// quietly ask for something the concept cannot show; fail at load instead.
for (const t of PRODUCT_TYPES) {
  const def = PROCESS_DEFINITIONS[t.key];
  if (def.stages.map((g) => g.stage).join() !== STAGES.map((s) => s.key).join()) {
    throw new Error(`The process for "${t.key}" must list the menu's stages in order.`);
  }
  const ids = new Set<string>();
  for (const gate of def.stages) {
    for (const c of gate.checks) {
      if (ids.has(c.id)) throw new Error(`The process for "${t.key}" repeats the check "${c.id}".`);
      ids.add(c.id);
      const path = checkSection(c);
      if (path) {
        const [stage, section] = path.split("/");
        if (!sectionVisible(t.key, stage, section)) {
          throw new Error(`The process for "${t.key}" checks "${path}", which that product type does not show.`);
        }
      }
    }
  }
}
