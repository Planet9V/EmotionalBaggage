// What a gate may count. A row with nothing in it is not evidence, whatever status it carries: every
// gate check reads its rows through hasSubstance, so no check is met by an empty row. Pure.
import { toWire } from "@/lib/domain/wire";
import { plural } from "@/lib/format";
import { SOURCES_STORE, STORY_STORE } from "@/lib/story/parts";
import type { Item } from "@/lib/types";

/** A value somebody entered: text with a character in it, a number, a flag, or a list or object holding one. */
function filled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.some(filled);
  if (typeof v === "object") return Object.values(v).some(filled);
  return true;
}

/**
 * Whether a row holds what its section is for:
 *  - a file in Files is a stored file, not a document that is only listed;
 *  - a part of the concept story is its text;
 *  - a wire names both its ends;
 *  - any other row has a title, a body or a filled field.
 */
export function hasSubstance(row: Item): boolean {
  if (row.section === SOURCES_STORE) return typeof row.data?.fileId === "number";
  if (row.section === STORY_STORE) return row.body.trim() !== "";
  if (row.section === "design/wiring") return toWire(row) !== null;
  return row.title.trim() !== "" || row.body.trim() !== "" || filled(row.data);
}

/** Why rows of a section were left out of a count, in a sentence, or "" when none were. `left` are the rows without substance. */
export function leftOut(section: string, left: Item[], noun: [string, string]): string {
  if (!left.length) return "";
  if (section === SOURCES_STORE) return `${plural(left.length, "file")} ${left.length === 1 ? "is" : "are"} listed, but none is uploaded yet.`;
  if (section === STORY_STORE) return "A part of the concept story with no text does not count.";
  if (section === "design/wiring") return `${plural(left.length, "wire")} ${left.length === 1 ? "names" : "name"} no two ends and ${left.length === 1 ? "does" : "do"} not count.`;
  return `${plural(left.length, `empty ${noun[0]}`, `empty ${noun[1]}`)} ${left.length === 1 ? "does" : "do"} not count.`;
}
