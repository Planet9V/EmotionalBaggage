import { partSource, sumLine, type Part } from "@/lib/domain";
import { readMoney } from "@/lib/moneyText";
import { toCsvText } from "@/lib/csv";
import { DEFAULT_CURRENCY, majorText } from "@/lib/economics/money";
import { quantityProblem } from "@/lib/parts/quantity";

/** A cost held in major units as fixed text with the currency's own decimals (src/lib/economics/money.ts); two decimals when no currency is given. */
export const money = (n: number, currency?: string) => majorText(n, currency || DEFAULT_CURRENCY);

/** Parse a money or quantity string. Returns null when it is not a number or is negative. */
export function parseAmount(s: string): number | null {
  const n = readMoney(s);
  if (n === null) return 0;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const sourceKind = (source: string): "amazon" | "microcenter" | "own" | "other" => {
  const s = source.trim().toLowerCase();
  if (s === "amazon") return "amazon";
  if (s === "micro center" || s === "microcenter") return "microcenter";
  if (s === "own printer") return "own";
  return "other";
};

export const amazonSearchUrl = (term: string) => `https://www.amazon.com/s?k=${encodeURIComponent(term)}`;
export const microCenterSearchUrl = (term: string) => `https://www.microcenter.com/search/search_results.aspx?Ntt=${encodeURIComponent(term)}`;

export const ASIN_RE = /^[A-Z0-9]{10}$/;

export function cartUrl(entries: { asin: string; qty: number }[]): string {
  const q = entries.map((e, i) => `ASIN.${i + 1}=${encodeURIComponent(e.asin)}&Quantity.${i + 1}=${Math.max(1, Math.round(e.qty) || 1)}`).join("&");
  return `https://www.amazon.com/gp/aws/cart/add.html?${q}`;
}

export type Group = { key: string; parts: Part[]; total: number };

export function groupParts(parts: Part[], by: "none" | "source" | "status"): Group[] {
  if (by === "none") return [{ key: "", parts, total: sumLine(parts) }];
  const map = new Map<string, Part[]>();
  for (const p of parts) {
    const k = (by === "source" ? partSource(p).trim() : p.item.status.trim()) || "(none)";
    map.set(k, [...(map.get(k) ?? []), p]);
  }
  return [...map.entries()].map(([key, ps]) => ({ key, parts: ps, total: sumLine(ps) }));
}

/* CSV */

const CSV_COLUMNS = ["ref", "title", "spec", "qty", "source", "search", "line"] as const;
type CsvColumn = (typeof CSV_COLUMNS)[number];

/** The parts list as CSV, through the one CSV writer (src/lib/csv.ts), which neutralises formula-looking cells. */
export function toCsv(parts: Part[]): string {
  const rows: unknown[][] = [[...CSV_COLUMNS]];
  for (const p of parts) rows.push([p.ref, p.item.title, p.item.body, p.qty === null ? "" : p.qty, p.source, p.search, p.line === null ? "" : money(p.line)]);
  return toCsvText(rows);
}

const ALIASES: Record<CsvColumn, string[]> = {
  ref: ["ref", "reference", "designator", "refdes"],
  title: ["title", "part", "name", "item"],
  spec: ["spec", "specification", "description", "body", "details"],
  qty: ["qty", "quantity", "count"],
  source: ["source", "vendor", "supplier", "store"],
  search: ["search", "search term", "searchterm", "query"],
  line: ["line", "line cost", "linecost", "cost", "price", "total"],
};

export type ImportRow = { ref: string; title: string; spec: string; qty: number; source: string; search: string; line: number; problem: string };

/**
 * Map rows to parts. If the first row names at least the title column it is a header and columns are
 * matched by name; otherwise columns are taken in the order ref,title,spec,qty,source,search,line.
 */
export function mapImport(rows: string[][]): { rows: ImportRow[]; usedHeader: boolean } {
  if (!rows.length) return { rows: [], usedHeader: false };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const idx: Partial<Record<CsvColumn, number>> = {};
  for (const col of CSV_COLUMNS) {
    const i = head.findIndex((h) => ALIASES[col].includes(h));
    if (i >= 0) idx[col] = i;
  }
  const usedHeader = idx.title !== undefined;
  const at = (r: string[], col: CsvColumn) => {
    const i = usedHeader ? idx[col] : CSV_COLUMNS.indexOf(col);
    return i === undefined ? "" : (r[i] ?? "").trim();
  };
  const body = usedHeader ? rows.slice(1) : rows;
  return {
    usedHeader,
    rows: body.map((r) => {
      const title = at(r, "title");
      const qty = parseAmount(at(r, "qty") || "1");
      const line = parseAmount(at(r, "line"));
      const problem = !title ? "No title" : qty === null ? "Qty is not a number" : quantityProblem(qty) ?? (line === null ? "Line cost is not a number" : "");
      return { ref: at(r, "ref"), title, spec: at(r, "spec"), qty: qty ?? 0, source: at(r, "source"), search: at(r, "search"), line: line ?? 0, problem };
    }),
  };
}
