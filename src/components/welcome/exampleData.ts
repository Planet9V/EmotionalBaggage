// The worked example's rows for the live views on the welcome page, read on the server from the seed module
// (src/lib/seed.ts): the same rows a fresh install loads for Baggage Claims MK1. The welcome page is public, so
// it calls no API and reads no database for this; the rows are handed to the client as plain props.
//
// The enclosure is not a stored picture either: the app's own generator (CaseMaker on Manifold, the one the
// Enclosure page runs) builds the base and the lid from the seeded parts here, on the server, and the app's own
// checks measure the result. It takes about a tenth of a second and is done once per server process.
import { SEED_ADDITIONS, SEED_ITEMS, SEED_PROJECT } from "@/lib/seed";
import { STORE } from "@/lib/domain";
import { buildSpec, validateSpec } from "@/lib/enclosure/spec";
import { generateCaseMaker } from "@/lib/enclosure/casemaker";
import { computeChecks } from "@/lib/enclosure/checks";
import type { Item } from "@/lib/types";

function rows(section: string, firstId: number): Item[] {
  const seeded = SEED_ADDITIONS[section] ?? SEED_ITEMS.filter((i) => i.section === section);
  return seeded.map((s, i) => ({ id: firstId + i, projectId: SEED_PROJECT.id, section, title: s.title, body: s.body ?? "", data: s.data ?? {}, status: s.status ?? "", sort: i }));
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

export type ExampleData = {
  parts: Item[];
  wires: Item[];
  enclosure: ExampleEnclosure | null;
  /** the seeded rows the journey shows for Research, Marketing and Sales */
  claims: Item[];
  positioning: Item[];
  ads: Item[];
  listing: Item[];
  channels: Item[];
};

/** The example's rows, as the app's own Item rows, and its enclosure as the app's generator builds it. */
export async function exampleData(): Promise<ExampleData> {
  const parts = rows(STORE.parts, 1);
  enclosure ??= generateEnclosure(parts);
  return {
    parts,
    wires: rows(STORE.wiring, 1001),
    enclosure: await enclosure,
    claims: rows("research/claims", 2001),
    positioning: rows("marketing/positioning", 3001),
    ads: rows("marketing/ads", 3101),
    listing: rows("sales/listing", 4001),
    channels: rows("sales/channels", 4101),
  };
}
