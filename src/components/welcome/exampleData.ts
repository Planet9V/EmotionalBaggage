// The worked example's rows for the live views on the welcome page, read on the server from the seed module
// (src/lib/seed.ts): the same rows a fresh install loads for Baggage Claims MK1. The welcome page is public, so
// it calls no API and reads no database for this; the rows are handed to the client as plain props.
import { SEED_ADDITIONS, SEED_ITEMS, SEED_PROJECT } from "@/lib/seed";
import { STORE } from "@/lib/domain";
import type { Item } from "@/lib/types";

function rows(section: string, firstId: number): Item[] {
  const seeded = SEED_ADDITIONS[section] ?? SEED_ITEMS.filter((i) => i.section === section);
  return seeded.map((s, i) => ({ id: firstId + i, projectId: SEED_PROJECT.id, section, title: s.title, body: s.body ?? "", data: s.data ?? {}, status: s.status ?? "", sort: i }));
}

/** The parts list and the wires of the example, as the app's own Item rows. */
export function exampleEngineering(): { parts: Item[]; wires: Item[] } {
  return { parts: rows(STORE.parts, 1), wires: rows(STORE.wiring, 1001) };
}
