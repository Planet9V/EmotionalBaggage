// Pure helpers for the Concepts page: search, sort, grouping, and the words for product types.
import { STAGES } from "@/lib/menu";
import { PRODUCT_TYPES, productType } from "@/lib/productTypes";
import { lastChanged, type Concept } from "@/lib/conceptsClient";

export type SortKey = "changed" | "name";

/** Case-insensitive match on name and one-line description. Blank search matches everything. */
export function matches(c: Pick<Concept, "name" | "oneLiner">, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return c.name.toLowerCase().includes(term) || c.oneLiner.toLowerCase().includes(term);
}

/** Last changed: newest first. Name: A to Z, ignoring case, then by id so the order is stable. */
export function sortConcepts(list: Concept[], key: SortKey): Concept[] {
  const out = [...list];
  if (key === "name") {
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id));
  } else {
    out.sort((a, b) => Date.parse(lastChanged(b)) - Date.parse(lastChanged(a)) || a.id.localeCompare(b.id));
  }
  return out;
}

/** Active and archived concepts that match the search, each sorted. */
export function groupConcepts(list: Concept[], search: string, key: SortKey) {
  const found = list.filter((c) => matches(c, search));
  return {
    active: sortConcepts(found.filter((c) => !c.archivedAt), key),
    archived: sortConcepts(found.filter((c) => !!c.archivedAt), key),
  };
}

/** "design/schematic" -> '"Schematic" (Design)'. Quoted, because a label can itself contain "and". */
export function sectionName(hiddenKey: string) {
  const [stageKey, sectionKey] = hiddenKey.split("/");
  const stage = STAGES.find((s) => s.key === stageKey);
  const section = stage?.sections.find((s) => s.key === sectionKey);
  return stage && section ? `"${section.label}" (${stage.label})` : hiddenKey;
}

/** ["a"] -> "a"; ["a","b"] -> "a and b"; ["a","b","c"] -> "a, b and c". */
export function joinWords(words: string[]) {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** One sentence per product type on what it hides, built from the type's own list so it cannot drift. */
export function typeSentence(key: string) {
  const t = productType(key);
  if (!t.hidden.length) return "Shows every section. Nothing is hidden.";
  return `Hides ${joinWords(t.hidden.map(sectionName))}.`;
}

export const TYPE_OPTIONS = PRODUCT_TYPES.map((t) => ({ key: t.key, label: t.label, sentence: typeSentence(t.key) }));

/** Sections the new type hides that the current type shows. */
export function newlyHidden(fromType: string, toType: string) {
  const was = new Set(productType(fromType).hidden);
  return productType(toType).hidden.filter((k) => !was.has(k)).map(sectionName);
}

export const typeLabel = (key: string) => productType(key).label;
export const stageLabel = (key: string) => STAGES.find((s) => s.key === key)?.label ?? key;

export function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
