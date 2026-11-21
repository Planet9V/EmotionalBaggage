// Reading the record back: safe for the browser (no database, no Node modules).
export type HistoryChange = {
  field: string;
  label: string;
  /** undefined: the field did not exist before (a new row, or a value that was never set) */
  before?: unknown;
  /** undefined: the field is gone (a removed row) */
  after?: unknown;
  /** a value that can be put back with a normal PATCH */
  restorable: boolean;
};

export type HistoryEntry = {
  id: number;
  at: string;
  actor: string;
  kind: string;
  summary: string;
  itemId: number | null;
  section: string | null;
  title: string | null;
  changes: HistoryChange[];
};

export type HistoryPage = { entries: HistoryEntry[]; next: number | null };

const LABELS: Record<string, string> = { title: "Title", body: "Details", status: "Status", sort: "Position", name: "Name", oneLiner: "One-liner", productType: "Product type", stage: "Stage" };

const humanize = (s: string) => {
  const t = s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const labelOf = (field: string) => LABELS[field] ?? humanize(field.replace(/^data\./, ""));

/** Written by code that computes a result, not by a person: shown nowhere. */
const HIDDEN = new Set(["disputed"]);

/** Fields a PATCH cannot put back: evidence has its own routes. */
const NOT_RESTORABLE = new Set(["data.evidence"]);

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** The field name as the record stores it: older events wrote evidence under a bare key. */
const fieldOf = (k: string) => (k === "evidence" ? "data.evidence" : k);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The field-by-field changes an event's data holds, or none for an event that carries no before and after. */
export function changesOf(detail: unknown, kind = ""): HistoryChange[] {
  if (!isObject(detail)) return [];
  const before = isObject(detail.before) ? detail.before : null;
  const after = isObject(detail.after) ? detail.after : null;
  if (!before && !after) return [];
  const edit = kind === "item.edited" || kind === "item.status";
  const out: HistoryChange[] = [];
  const names = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const raw of names) {
    if (HIDDEN.has(raw)) continue;
    const field = fieldOf(raw);
    const had = !!before && raw in before;
    const has = !!after && raw in after;
    if (had && has && same(before![raw], after![raw])) continue;
    out.push({
      field,
      label: labelOf(field),
      ...(had ? { before: before![raw] } : {}),
      ...(has ? { after: after![raw] } : {}),
      restorable: edit && had && !NOT_RESTORABLE.has(field),
    });
  }
  const rank = (f: string) => ["title", "body", "status", "sort"].indexOf(f);
  return out.sort((a, b) => (rank(a.field) + 1 || 99) - (rank(b.field) + 1 || 99) || a.field.localeCompare(b.field));
}

/** The PATCH body that puts one field back to a value. */
export function restoreBody(field: string, value: unknown): Record<string, unknown> {
  if (field.startsWith("data.")) return { data: { [field.slice(5)]: value } };
  return { [field]: value };
}

/** A value as plain text: strings as they are, lists joined, anything else as JSON. */
export function valueText(v: unknown): string {
  if (v === undefined) return "";
  if (v === null) return "empty";
  if (typeof v === "string") return v === "" ? "empty" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number")) return v.length ? v.join(", ") : "empty";
  if (Array.isArray(v) && !v.length) return "empty";
  // exit criteria read as a checklist, evidence as its verdicts and addresses
  if (Array.isArray(v) && v.every((x) => isObject(x) && typeof x.text === "string")) return v.map((x) => `${(x as { met?: unknown }).met === true ? "[x]" : "[ ]"} ${(x as { text: string }).text}`).join("\n");
  if (Array.isArray(v) && v.every((x) => isObject(x) && typeof x.url === "string")) return v.map((x) => `${typeof (x as { verdict?: unknown }).verdict === "string" ? `${(x as { verdict: string }).verdict}: ` : ""}${(x as { url: string }).url}`).join("\n");
  return JSON.stringify(v, null, 1);
}

/** A field's value on a row as the screen holds it. */
export function fieldValue(item: { title: string; body: string; status: string; sort: number; data: Record<string, unknown> }, field: string): unknown {
  if (field.startsWith("data.")) return item.data[field.slice(5)];
  return field === "title" || field === "body" || field === "status" || field === "sort" ? item[field] : undefined;
}

export const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
