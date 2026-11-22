// The worked example's rows for the live views on the welcome page, read on the server from the seed modules
// (src/lib/seed.ts and src/lib/story/seed.ts): the rows a fresh install loads for Baggage Claims MK1, with the
// same default status the app's seeding gives a row ("open"). The welcome page is public, so it calls no API and
// reads no database for this (the public demo's database can be changed by any visitor); the rows are handed to
// the client as plain props.
//
// Nothing here is a stored picture or a typed figure:
//  - the enclosure is built by the app's own generator (CaseMaker on Manifold, the one the Enclosure page runs)
//    from the seeded parts, and measured by the app's own checks;
//  - each stage's gate is worked out by the app's own gate rules (evaluateGate) on these rows, so the journey
//    shows every check as it truly stands for the example;
//  - the unit cost is the app's own build-up (referenceUnitCost).
// The enclosure takes about a tenth of a second and is built once per server process.
import { SEED_ADDITIONS, SEED_ITEMS, SEED_PROJECT } from "@/lib/seed";
import { applySeedContent } from "@/lib/seedContent";
import { SEED_SOURCES, SEED_STORY } from "@/lib/story/seed";
import { SOURCES_STORE, STORY_STORE, storyPart } from "@/lib/story/parts";
import { readManifest } from "@/lib/story/seedFiles";
import { STORE } from "@/lib/domain";
import { buildSpec, validateSpec } from "@/lib/enclosure/spec";
import { generateCaseMaker } from "@/lib/enclosure/casemaker";
import { computeChecks } from "@/lib/enclosure/checks";
import { processFor } from "@/lib/process/definitions";
import { evaluateGate } from "@/lib/process/evaluate";
import { buildCircuit } from "@/lib/parts/circuit";
import { checkCircuit } from "@/lib/parts/erc";
import { readEconomics } from "@/lib/economics/read";
import { referenceUnitCost, type UnitCost } from "@/lib/economics/compute";
import type { Item } from "@/lib/types";

const CURRENCY = "USD"; // a new concept's currency
const PRODUCT_TYPE = "electronics"; // the example is electronics in an enclosure

/** Every row of the example as a fresh install holds it, each with its own id. */
function seedRows(storedFiles: ReadonlySet<string>): Item[] {
  const out: Item[] = [];
  const add = (section: string, title: string, body: string, data: Record<string, unknown>, status: string) =>
    out.push({ id: out.length + 1, projectId: SEED_PROJECT.id, section, title, body, data, status, sort: out.length });
  // the story and the list of source documents come first, as seedStory puts them
  // A fresh install stores the owner's documents in Files (seedFiles, from the seed manifest): those rows hold a
  // file. A document the manifest does not have is only listed, and the gate does not count it as a file.
  SEED_SOURCES.forEach((s, i) =>
    storedFiles.has(s.title) ? add(SOURCES_STORE, s.title, s.what, { kind: s.kind, fileName: s.title, fileId: i + 1 }, "stored") : add(SOURCES_STORE, s.title, s.what, { kind: s.kind, fileName: s.title }, "not uploaded"),
  );
  for (const p of SEED_STORY) add(STORY_STORE, storyPart(p.part)?.heading ?? p.part, p.body, { part: p.part }, p.status);
  for (const s of SEED_ITEMS) add(s.section, s.title, s.body ?? "", s.data ?? {}, s.status ?? "open");
  for (const [section, items] of Object.entries(SEED_ADDITIONS)) for (const s of items) add(section, s.title, s.body ?? "", s.data ?? {}, s.status ?? "open");
  // then the content batches entered since (src/lib/seedContent.ts), as seedContent applies them to a database
  return applySeedContent(out);
}

/** A mesh as plain numbers (positions in mm to 0.001, triangle indices), so it can cross to the browser as a prop. */
export type PlainMesh = { positions: number[]; indices: number[] };
export type ExampleEnclosure = {
  base: PlainMesh;
  lid: PlainMesh;
  /** outer size in mm: width (x), height (y), depth (z) */
  outer: [number, number, number];
  version: string;
  checks: { key: string; label: string; ok: boolean; detail: string }[];
};

const plain = (m: { positions: Float32Array; indices: Uint32Array }): PlainMesh => ({ positions: Array.from(m.positions, (v) => Math.round(v * 1000) / 1000), indices: Array.from(m.indices) });

async function generateEnclosure(parts: Item[]): Promise<ExampleEnclosure | null> {
  try {
    const spec = buildSpec({ items: parts });
    if (validateSpec(spec).some((i) => i.severity === "error")) return null;
    const out = await generateCaseMaker(spec, SEED_PROJECT.name);
    const checks = await computeChecks(spec, out);
    const { min, max } = spec.outer;
    return {
      base: plain(out.base),
      lid: plain(out.lid),
      outer: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
      version: out.version,
      checks: checks.map((c) => ({ key: c.key, label: c.label, ok: c.ok, detail: c.detail })),
    };
  } catch {
    // the page still reads in full; the Enclosure tab says the generator did not run
    return null;
  }
}

let enclosure: Promise<ExampleEnclosure | null> | null = null;

/** A stage's gate as the app's own rules find it on the seeded rows. */
export type ExampleGate = { met: number; total: number; checks: { id: string; label: string; met: boolean; /** what was found, for a check that is not met */ detail: string }[] };

function gates(all: Item[]): Record<string, ExampleGate> {
  const parts = all.filter((r) => r.section === STORE.parts);
  const wires = all.filter((r) => r.section === STORE.wiring);
  // what the gates need beyond the rows, as a fresh install has it: the electrical checks' counts, and nothing
  // yet in the tables a campaign or "Send to printing" fills
  const findings = checkCircuit(buildCircuit(parts, wires, []), { projectId: SEED_PROJECT.id });
  const errors = findings.filter((f) => f.severity === "error").length;
  const facts = { currency: CURRENCY, erc: { ok: errors === 0, errors, warnings: findings.filter((f) => f.severity === "warning").length }, links: 0, results: 0, enclosureFiles: 0 };
  const concept = { name: SEED_PROJECT.name, oneLiner: SEED_PROJECT.oneLiner };
  return Object.fromEntries(
    processFor(PRODUCT_TYPE).stages.map((g) => {
      const checks = evaluateGate(g, all, concept, facts).checks.map((c) => ({ id: c.id, label: c.label, met: c.met, detail: c.met ? "" : c.detail }));
      return [g.stage, { met: checks.filter((c) => c.met).length, total: checks.length, checks }];
    }),
  );
}

export type ExampleData = {
  parts: Item[];
  wires: Item[];
  enclosure: ExampleEnclosure | null;
  /** the seeded rows the journey shows */
  decisions: Item[];
  claims: Item[];
  positioning: Item[];
  ads: Item[];
  listing: Item[];
  channels: Item[];
  /** more seeded rows, for the hero's artefacts, the drafting chain and the market stage (storyData.ts) */
  brief: Item[];
  requirements: Item[];
  printing: Item[];
  assembly: Item[];
  tests: Item[];
  economics: Item[];
  brand: Item[];
  landing: Item[];
  campaigns: Item[];
  social: Item[];
  launch: Item[];
  /** every stage's gate, by stage key, in its true state for the example */
  gates: Record<string, ExampleGate>;
  /** the unit cost, built up by the app's own calculation at the example's first planned batch size */
  unit: UnitCost;
};

/** The example's rows, as the app's own Item rows, and what the app's own rules work out from them. */
export async function exampleData(): Promise<ExampleData> {
  const all = seedRows(new Set(((await readManifest()) ?? []).map((e) => e.title)));
  const of = (section: string) => all.filter((r) => r.section === section);
  const parts = of(STORE.parts);
  enclosure ??= generateEnclosure(parts);
  return {
    parts,
    wires: of(STORE.wiring),
    enclosure: await enclosure,
    decisions: of("concept/decisions"),
    claims: of("research/claims"),
    positioning: of("marketing/positioning"),
    ads: of("marketing/ads"),
    listing: of("sales/listing"),
    channels: of("sales/channels"),
    brief: of("concept/brief"),
    requirements: of("design/requirements"),
    printing: of("prototype/printing"),
    assembly: of("prototype/assembly"),
    tests: of("prototype/tests"),
    economics: of("production/economics"),
    brand: of("marketing/brand"),
    landing: of("marketing/landing"),
    campaigns: of("marketing/campaigns"),
    social: of("marketing/social"),
    launch: of("marketing/launch"),
    gates: gates(all),
    unit: referenceUnitCost(readEconomics({ parts, economics: of("production/economics"), channels: of("sales/channels"), methods: of("production/methods"), batches: of("production/batches"), printJobs: of("prototype/printing") }, CURRENCY)),
  };
}
