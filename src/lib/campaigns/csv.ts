// Importing results from a platform's report file. The file is read in the browser (papaparse); this
// file holds everything that does not need the browser: finding the header row, recognising a
// platform's layout, applying a column mapping and turning cells into numbers, money and dates.
//
// Layouts recognised: Amazon Ads (Sponsored Products and Brands reports), Meta Ads Manager and Google
// Ads, by the column names each shows. Where a layout is not verified against a real export file it
// says so (`verified: false`), and in any case the mapping screen shows what was recognised and lets
// the user correct it: a recognised layout is a suggestion, never a silent decision.
import { parseCsvText } from "@/lib/csv";
import { dayFromNumber, dayNumber, isDay } from "./days";
import { toMinor } from "@/lib/economics/money";

export const FIELDS = ["day", "campaign", "creative", "spend", "impressions", "clicks", "orders", "revenue"] as const;
export type Field = (typeof FIELDS)[number];
export const FIELD_LABEL: Record<Field, string> = {
  day: "Date",
  campaign: "Campaign name (to pick one campaign out of the file)",
  creative: "Ad or creative name (to match a creative)",
  spend: "Spend",
  impressions: "Impressions",
  clicks: "Clicks",
  orders: "Orders",
  revenue: "Sales (revenue)",
};
/** A file can be imported with a date and at least one of these. */
export const REQUIRED: Field[] = ["day"];
export const MEASURES = ["spend", "impressions", "clicks", "orders", "revenue"] as const satisfies readonly Field[];

export type Mapping = Partial<Record<Field, string>>;

export type Layout = {
  id: string;
  label: string;
  /** the channel the mapping is remembered under */
  channel: string;
  synonyms: Record<Field, string[]>;
  /** where the column names were read from */
  source: string;
  /** read against a real export file, or only from a description of one */
  verified: boolean;
  note: string;
};

export const LAYOUTS: Layout[] = [
  {
    id: "amazon-ads",
    label: "Amazon Ads report",
    channel: "amazon-ads",
    synonyms: {
      day: ["Date", "Start Date"],
      campaign: ["Campaign Name"],
      creative: ["Ad Group Name", "Advertised SKU", "Advertised ASIN"],
      spend: ["Spend"],
      impressions: ["Impressions"],
      clicks: ["Clicks"],
      orders: ["7 Day Total Orders (#)", "14 Day Total Orders (#)", "Total Orders (#)", "Orders"],
      revenue: ["7 Day Total Sales", "14 Day Total Sales", "Total Sales", "Sales"],
    },
    source: "Column names listed for the targeting and advertised product reports in the Jungle Scout guide to Amazon PPC reports (https://www.junglescout.com/blog/amazon-advertising-ppc-reports-guide/), a third-party page, not Amazon's own.",
    verified: false,
    note: "Choose the report with a daily time unit so every row is one day. Amazon changes attribution windows (7 or 14 day) by campaign type; the order and sales columns of the window you use are matched.",
  },
  {
    id: "meta-ads",
    label: "Meta Ads Manager export (Facebook and Instagram)",
    channel: "meta",
    synonyms: {
      day: ["Day", "Reporting starts"],
      campaign: ["Campaign name"],
      creative: ["Ad name", "Ad set name"],
      spend: ["Amount spent (USD)", "Amount spent (EUR)", "Amount spent (GBP)", "Amount spent (CAD)", "Amount spent (AUD)", "Amount spent"],
      impressions: ["Impressions"],
      clicks: ["Link clicks", "Clicks (all)", "Outbound clicks"],
      orders: ["Purchases", "Website purchases", "Results"],
      revenue: ["Purchases conversion value", "Purchase conversion value", "Website purchases conversion value"],
    },
    source: "Column names as Meta Ads Manager shows them in its reports (Amount spent, Impressions, Link clicks, Purchases, Reporting starts).",
    verified: false,
    note: "Break the report down by Day before exporting so each row is one day. A currency is part of the spend column's name; the amount is read in the concept's currency.",
  },
  {
    id: "google-ads",
    label: "Google Ads report",
    channel: "google",
    synonyms: {
      day: ["Day", "Date"],
      campaign: ["Campaign"],
      creative: ["Ad group", "Ad"],
      spend: ["Cost"],
      impressions: ["Impr.", "Impressions"],
      clicks: ["Clicks"],
      orders: ["Conversions", "All conv."],
      revenue: ["Conv. value", "All conv. value"],
    },
    source: "Column names as the Google Ads report editor shows them (Cost, Impr., Clicks, Conversions, Conv. value, Day).",
    verified: false,
    note: "Segment the report by Day. Google Ads puts a title and the date range above the header and a total row below; both are skipped.",
  },
  {
    id: "generic",
    label: "Any other file",
    channel: "other",
    synonyms: {
      day: ["Date", "Day"],
      campaign: ["Campaign"],
      creative: ["Creative", "Ad"],
      spend: ["Spend", "Cost"],
      impressions: ["Impressions"],
      clicks: ["Clicks"],
      orders: ["Orders", "Conversions"],
      revenue: ["Revenue", "Sales"],
    },
    source: "Plain English names.",
    verified: true,
    note: "Map each column yourself if the names do not match.",
  },
];

export const layoutFor = (id: string) => LAYOUTS.find((l) => l.id === id) ?? null;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

export type ParsedFile = {
  headers: string[];
  /** rows under the header, as text */
  rows: string[][];
  /** how many lines above the header were skipped (a title, a date range) */
  skippedAbove: number;
  errors: string[];
};

const ALL_SYNONYMS = new Set(LAYOUTS.flatMap((l) => FIELDS.flatMap((f) => l.synonyms[f].map(norm))));

/** Reads CSV or tab-separated text. The header is the first of the first ten lines with at least three known column names. */
export function parseReport(text: string): ParsedFile {
  const res = parseCsvText(text, { delimiters: [",", "\t", ";", "|"] });
  const all = res.rows;
  const errors = res.errors.map((e) => `Line ${e.row + 1}: ${e.message}`);
  let at = all.slice(0, 10).findIndex((r) => r.filter((c) => ALL_SYNONYMS.has(norm(c))).length >= 3);
  if (at < 0) at = 0;
  const headers = (all[at] ?? []).map((h) => h.trim());
  return { headers, rows: all.slice(at + 1), skippedAbove: at, errors };
}

export type Detection = { layout: Layout; mapping: Mapping; matched: number };

/** The mapping a layout's names give for these headers. Only headers that exist are used. */
export function mappingFor(layout: Layout, headers: string[]): Mapping {
  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  const out: Mapping = {};
  for (const f of FIELDS) {
    for (const name of layout.synonyms[f]) {
      const hit = byNorm.get(norm(name));
      if (hit) {
        out[f] = hit;
        break;
      }
    }
  }
  return out;
}

/** The best-matching platform layout (not the generic one) when it matches the date and at least two measures; else null. */
export function detectLayout(headers: string[]): Detection | null {
  let best: Detection | null = null;
  for (const layout of LAYOUTS.filter((l) => l.id !== "generic")) {
    const mapping = mappingFor(layout, headers);
    const matched = Object.keys(mapping).length;
    const measures = MEASURES.filter((m) => mapping[m]).length;
    if (!mapping.day || measures < 2) continue;
    if (!best || matched > best.matched) best = { layout, mapping, matched };
  }
  return best;
}

// Cells --------------------------------------------------------------------------------------------

/**
 * A number from a cell: "1,234.56", "$12", "1.234,56", "12,5", "(3)", "5%". Null when it is not a number.
 * A percent sign is dropped (the figure is not used as a rate). Brackets are a negative, which the
 * import then refuses.
 */
export function parseNumber(cell: string): number | null {
  let t = cell.trim();
  if (!t || t === "-" || t === "--" || /^n\/?a$/i.test(t)) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1);
  }
  t = t.replace(/[\s$€£¥%]|USD|EUR|GBP|CAD|AUD/gi, "");
  if (t.startsWith("-")) {
    neg = !neg;
    t = t.slice(1);
  }
  if (!/^[0-9.,]+$/.test(t) || !/[0-9]/.test(t)) return null;
  const lastDot = t.lastIndexOf(".");
  const lastComma = t.lastIndexOf(",");
  let canon: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ",";
    const thou = dec === "." ? "," : ".";
    canon = t.split(thou).join("").replace(dec, ".");
  } else if (lastComma >= 0) {
    // "12,5" and "1234,56" are decimals; "1,234" and "12,345,678" are thousands
    const decimal = (t.match(/,/g) ?? []).length === 1 && /,\d{1,2}$/.test(t);
    canon = decimal ? t.replace(",", ".") : t.split(",").join("");
  } else if (lastDot >= 0 && (t.match(/\./g) ?? []).length > 1) {
    canon = t.split(".").join("");
  } else canon = t;
  const n = Number(canon);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export type DateOrder = "mdy" | "dmy";

/** A day from a cell: 2026-12-01 (with or without a time), 12/01/2026, 1 Dec 2026, Dec 1, 2026. Null when it is not a date. */
export function parseDayCell(cell: string, order: DateOrder = "mdy"): string | null {
  const t = cell.trim();
  if (!t) return null;
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(t);
  const mk = (y: number, m: number, d: number) => {
    const s = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return isDay(s) ? s : null;
  };
  if (iso) return mk(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const num = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/.exec(t);
  if (num) {
    const a = Number(num[1]);
    const b = Number(num[2]);
    const y = num[3].length === 2 ? 2000 + Number(num[3]) : Number(num[3]);
    return order === "mdy" ? mk(y, a, b) : mk(y, b, a);
  }
  const named = /^(?:[A-Za-z]+,?\s+)?(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(t) ?? null;
  if (named) {
    const m = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase());
    return m >= 0 ? mk(Number(named[3]), m + 1, Number(named[1])) : null;
  }
  const us = /^(?:[A-Za-z]+,?\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(t);
  if (us) {
    const m = MONTHS.indexOf(us[1].slice(0, 3).toLowerCase());
    return m >= 0 ? mk(Number(us[3]), m + 1, Number(us[2])) : null;
  }
  return null;
}

// Applying a mapping -------------------------------------------------------------------------------

export type ImportRecord = {
  day: string;
  /** the ad or creative name in the file, "" when the file has none or the cell was empty */
  creativeName: string;
  spend: number;
  impressions: number;
  clicks: number;
  orders: number;
  revenue: number;
};

export type ImportProblem = { line: number; problem: string };

export type ImportOptions = {
  currency: string;
  dateOrder?: DateOrder;
  /** keep only rows whose campaign cell equals this (case-insensitive); needs the campaign column mapped */
  campaign?: string;
};

export type ImportResult = {
  records: ImportRecord[];
  problems: ImportProblem[];
  /** rows read from the file under the header */
  rowsRead: number;
  /** rows that were totals, empty or in another campaign, left out on purpose */
  skipped: number;
  /** rows that became part of a record (several rows for one day and creative are added together) */
  rowsUsed: number;
  campaigns: string[];
};

const whole = (n: number) => Math.round(n);

/**
 * Turns the file's rows into records, one per day and creative. Rows with the same day and creative
 * (an ad group split, a second ad) are added together. A bad cell refuses its row and is listed with
 * its line number in the file; nothing is guessed. `lineOffset` is the number of lines above the rows.
 */
export function applyMapping(headers: string[], rows: string[][], mapping: Mapping, opts: ImportOptions, lineOffset = 1): ImportResult {
  const idx = (f: Field) => (mapping[f] ? headers.indexOf(mapping[f] as string) : -1);
  const col = Object.fromEntries(FIELDS.map((f) => [f, idx(f)])) as Record<Field, number>;
  const problems: ImportProblem[] = [];
  const out = new Map<string, ImportRecord>();
  const campaigns = new Set<string>();
  let skipped = 0;
  let used = 0;
  if (col.day < 0) {
    return { records: [], problems: [{ line: 0, problem: "Choose the column that holds the date." }], rowsRead: rows.length, skipped: 0, rowsUsed: 0, campaigns: [] };
  }
  const wanted = opts.campaign?.trim().toLowerCase();
  rows.forEach((row, k) => {
    const line = k + 1 + lineOffset;
    const cell = (f: Field) => (col[f] >= 0 ? (row[col[f]] ?? "").trim() : "");
    const first = (row[0] ?? "").trim();
    if (row.every((c) => !c.trim()) || /^total\b/i.test(first) || /^total\b/i.test(cell("day"))) {
      skipped++;
      return;
    }
    const camp = cell("campaign");
    if (camp) campaigns.add(camp);
    if (wanted && col.campaign >= 0 && camp.toLowerCase() !== wanted) {
      skipped++;
      return;
    }
    const day = parseDayCell(cell("day"), opts.dateOrder);
    if (!day) {
      problems.push({ line, problem: `"${cell("day")}" is not a date I can read.` });
      return;
    }
    const rec: ImportRecord = { day, creativeName: cell("creative"), spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0 };
    for (const f of MEASURES) {
      const raw = cell(f);
      if (col[f] < 0 || raw === "") continue;
      const n = parseNumber(raw);
      if (n === null) {
        problems.push({ line, problem: `${FIELD_LABEL[f].split(" (")[0]}: "${raw}" is not a number.` });
        return;
      }
      if (n < 0) {
        problems.push({ line, problem: `${FIELD_LABEL[f].split(" (")[0]}: ${raw} is negative; refunds and corrections are not imported.` });
        return;
      }
      if (f === "spend" || f === "revenue") rec[f] = toMinor(n, opts.currency);
      // Meta and Google can report fractional conversions; counts are kept whole by rounding
      else rec[f] = whole(n);
    }
    const key = `${day}\u0000${rec.creativeName.toLowerCase()}`;
    const have = out.get(key);
    if (have) {
      have.spend += rec.spend;
      have.impressions += rec.impressions;
      have.clicks += rec.clicks;
      have.orders += rec.orders;
      have.revenue += rec.revenue;
    } else out.set(key, rec);
    used++;
  });
  return { records: [...out.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.creativeName.localeCompare(b.creativeName))), problems, rowsRead: rows.length, skipped, rowsUsed: used, campaigns: [...campaigns] };
}

/** Pasted lines are read as one more file: a header line and rows, tab or comma separated. */
export const parsePaste = parseReport;

/** Whole days covered by the records, first to last. */
export function dateSpan(records: ImportRecord[]): { from: string; to: string; days: number } | null {
  if (!records.length) return null;
  const nums = records.map((r) => dayNumber(r.day) as number);
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return { from: dayFromNumber(lo), to: dayFromNumber(hi), days: hi - lo + 1 };
}

