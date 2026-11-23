// The part library: generic parts a first prototype uses. Data only; checked against
// `libraryEntry` in tests/parts/library.test.ts. Every electrical figure names its source in
// the entry, or is left out.
import { libraryEntry, type LibraryEntry } from "../schema";
import { BOARDS } from "./boards";
import { CHIPS } from "./chips";
import { DISPLAYS, MODULES, SENSORS } from "./devices";
import { DISCRETE } from "./discrete";
import { POWER } from "./power";

/** The raw entries, before parsing. Tests validate these. */
export const RAW_LIBRARY = [...BOARDS, ...SENSORS, ...DISPLAYS, ...MODULES, ...POWER, ...DISCRETE, ...CHIPS];

export const LIBRARY: readonly LibraryEntry[] = RAW_LIBRARY.map((e) => libraryEntry.parse(e));

const BY_ID = new Map(LIBRARY.map((e) => [e.id, e]));

export function libraryEntryById(id: string | null | undefined): LibraryEntry | null {
  return id ? BY_ID.get(id) ?? null : null;
}
