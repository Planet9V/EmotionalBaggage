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

export type CheckKind = "min-rows" | "all-status" | "decision-made" | "no-open" | "claims-verified" | "field-set";

/** Concept fields a `field-set` check can ask for. */
export type ConceptField = "name" | "oneLiner";

export type Check =
  | { id: string; label: string; kind: "min-rows"; params: { section: string; min: number } }
  | { id: string; label: string; kind: "all-status"; params: { section: string; statuses: string[] } }
  | { id: string; label: string; kind: "decision-made"; params: { key: string } }
  | { id: string; label: string; kind: "no-open"; params: { section: string; statuses?: string[] } }
  | { id: string; label: string; kind: "claims-verified"; params: { share: number; section?: string } }
  | { id: string; label: string; kind: "field-set"; params: { field: ConceptField } };

export type Gate = { stage: string; checks: Check[] };

export type ProcessDefinition = { productType: ProductType; stages: Gate[] };

/** The section `no-open` treats as open when no statuses are given. */
export const OPEN_STATUSES = ["open", "blocked"];

/** The decision every concept settles before it leaves the Concept stage. */
export const GO_DECISION = "go";

// Checks shared by every type, stage by stage.
const conceptGate: Check[] = [
  { id: "concept.one-liner", label: "The concept has a one-line description", kind: "field-set", params: { field: "oneLiner" } },
  { id: "concept.brief", label: "The brief has at least three lines", kind: "min-rows", params: { section: "concept/brief", min: 3 } },
  { id: "concept.go", label: `The go/no-go decision (key "${GO_DECISION}") is decided`, kind: "decision-made", params: { key: GO_DECISION } },
  { id: "concept.questions", label: "No open question is left open or blocked", kind: "no-open", params: { section: "concept/questions" } },
];

const researchGate: Check[] = [
  { id: "research.claims", label: "At least one claim is recorded", kind: "min-rows", params: { section: "research/claims", min: 1 } },
  { id: "research.verified", label: "At least 80% of claims are verified", kind: "claims-verified", params: { share: 0.8 } },
];

const requirements: Check = { id: "design.requirements", label: "At least one requirement is written", kind: "min-rows", params: { section: "design/requirements", min: 1 } };
const parts: Check = { id: "design.bom", label: "The bill of materials has at least one part", kind: "min-rows", params: { section: "design/bom", min: 1 } };
const requirementsClosed: Check = { id: "design.requirements-open", label: "No requirement is open or blocked", kind: "no-open", params: { section: "design/requirements" } };

const inHand: Check = { id: "prototype.parts-in-hand", label: "Every part is in hand", kind: "all-status", params: { section: "prototype/sourcing", statuses: ["in hand"] } };
const testsWritten: Check = { id: "prototype.tests", label: "At least one acceptance test is written", kind: "min-rows", params: { section: "prototype/tests", min: 1 } };
const testsPass: Check = { id: "prototype.tests-pass", label: "Every acceptance test passes", kind: "all-status", params: { section: "prototype/tests", statuses: ["pass"] } };

const productionGate: Check[] = [
  { id: "production.economics", label: "Unit economics have at least one line", kind: "min-rows", params: { section: "production/economics", min: 1 } },
  { id: "production.batches", label: "At least one batch is planned", kind: "min-rows", params: { section: "production/batches", min: 1 } },
];

const marketingGate: Check[] = [
  { id: "marketing.positioning", label: "Positioning has at least one note", kind: "min-rows", params: { section: "marketing/positioning", min: 1 } },
  { id: "marketing.landing", label: "At least one landing page is planned", kind: "min-rows", params: { section: "marketing/landing", min: 1 } },
];

const salesGate: Check[] = [
  { id: "sales.channels", label: "At least one sales channel is set", kind: "min-rows", params: { section: "sales/channels", min: 1 } },
  { id: "sales.listing", label: "The listing has at least one element", kind: "min-rows", params: { section: "sales/listing", min: 1 } },
  { id: "sales.listing-ready", label: "Every listing element is ready or live", kind: "all-status", params: { section: "sales/listing", statuses: ["ready", "live"] } },
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
        requirementsClosed,
      ],
      [
        inHand,
        { id: "prototype.wiring-tested", label: "Every joint is soldered and tested", kind: "all-status", params: { section: "prototype/wiring", statuses: ["tested"] } },
        testsWritten,
        testsPass,
      ]
    ),
  },
  printed: {
    productType: "printed",
    stages: gates(
      [requirements, parts, requirementsClosed],
      [
        { id: "prototype.print-jobs", label: "At least one print job is set up", kind: "min-rows", params: { section: "prototype/printing", min: 1 } },
        { id: "prototype.printed", label: "Every print job is printed", kind: "all-status", params: { section: "prototype/printing", statuses: ["printed"] } },
        testsWritten,
        testsPass,
      ]
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
