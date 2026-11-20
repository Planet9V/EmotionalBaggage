import type { Geometry, Item } from "@/lib/types";

/** A BOM item with its data fields read safely. Nothing is defaulted to a made-up value. */
export type Part = {
  item: Item;
  ref: string;
  qty: number;
  source: string;
  search: string;
  line: number;
  asin: string;
  geometry?: Geometry;
};

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (v == null ? "" : String(v));

export function toPart(item: Item): Part {
  const d = item.data ?? {};
  const g = d.geometry && typeof d.geometry === "object" ? (d.geometry as Geometry) : undefined;
  return { item, ref: str(d.ref), qty: num(d.qty), source: str(d.source), search: str(d.search), line: num(d.line), asin: str(d.asin), geometry: g };
}

export const money = (n: number) => n.toFixed(2);

/** Parse a money or quantity string. Returns null when it is not a number or is negative. */
export function parseAmount(s: string): number | null {
  const t = s.trim().replace(/^\$/, "").replace(/,/g, "");
  if (t === "") return 0;
  const n = Number(t);
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
  if (by === "none") return [{ key: "", parts, total: parts.reduce((a, p) => a + p.line, 0) }];
  const map = new Map<string, Part[]>();
  for (const p of parts) {
    const k = (by === "source" ? p.source.trim() : p.item.status.trim()) || "(none)";
    map.set(k, [...(map.get(k) ?? []), p]);
  }
  return [...map.entries()].map(([key, ps]) => ({ key, parts: ps, total: ps.reduce((a, p) => a + p.line, 0) }));
}

/* CSV */

export const CSV_COLUMNS = ["ref", "title", "spec", "qty", "source", "search", "line"] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(parts: Part[]): string {
  const rows = [CSV_COLUMNS.join(",")];
  for (const p of parts) {
    rows.push([p.ref, p.item.title, p.item.body, String(p.qty), p.source, p.search, money(p.line)].map(esc).join(","));
  }
  return rows.join("\r\n") + "\r\n";
}

/** RFC 4180 style parser. The delimiter is tab when the first line has a tab, else comma. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = firstLine.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
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
      const problem = !title ? "No title" : qty === null ? "Qty is not a number" : line === null ? "Line cost is not a number" : "";
      return { ref: at(r, "ref"), title, spec: at(r, "spec"), qty: qty ?? 0, source: at(r, "source"), search: at(r, "search"), line: line ?? 0, problem };
    }),
  };
}
