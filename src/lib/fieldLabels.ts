// How a row's data fields are named and shown to a person: the section's own column labels first, then the labels
// shared by sections, then the key made readable. Values are plain text, never JSON. Used where a row's proposed
// or changed data is previewed (a draft).
import { STAGES, storeKey } from "@/lib/menu";

/** Fields that several sections share, or that no section lists as a column. */
const SHARED: Record<string, string> = {
  ref: "Reference",
  qty: "Quantity",
  unit: "Unit cost",
  line: "Line total",
  spec: "Specification",
  kind: "Kind",
  source: "Source",
  supplier: "Supplier",
  search: "Search words",
  asin: "ASIN",
  pins: "Pins",
  pinRoles: "Pin roles",
  geometry: "Shape and place",
  schematic: "Place on the schematic",
  size: "Size",
  pos: "Position",
  basedOn: "Based on",
  replaces: "Replaces",
  requirements: "Requirements",
  detail: "Detail",
  note: "Note",
  net: "Net",
  netClass: "Net class",
  from: "From",
  fromPin: "From pin",
  to: "To",
  toPin: "To pin",
  options: "Options",
  noProof: "Without proof",
  key: "Key",
};

const humanise = (key: string) => {
  const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : key;
};

/** The label of a data field in a store: the section's column, a shared label, or the key as words. */
export function fieldLabel(store: string, key: string): string {
  for (const stage of STAGES) {
    for (const section of stage.sections) {
      if (storeKey(stage, section) !== store) continue;
      const column = section.columns?.find((c) => c.key === key);
      if (column) return column.label;
    }
  }
  return SHARED[key] ?? humanise(key);
}

/** A value as text a person reads: lists joined, nested records as "Label: value" pairs, yes or no. Never JSON. */
export function readableValue(store: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) {
    if (v.length === 0) return "(empty)";
    const objects = v.some((x) => x !== null && typeof x === "object");
    return v.map((x) => readableValue(store, x)).join(objects ? " / " : ", ");
  }
  if (typeof v === "object") {
    const pairs = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== "" && x !== null && x !== undefined);
    if (pairs.length === 0) return "(empty)";
    return pairs.map(([k, x]) => `${fieldLabel(store, k)}: ${readableValue(store, x)}`).join("; ");
  }
  return String(v);
}
