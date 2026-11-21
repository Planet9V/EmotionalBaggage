// The one CSV writer and the one CSV reader (robustness review S7). papaparse's unparse does the quoting (RFC 4180) and the
// formula neutralising: a text cell that starts with = + - @, a tab or a carriage return gets a leading
// apostrophe, so a spreadsheet shows it instead of running it. Numbers are written as numbers.
//
// The pattern is passed as a RegExp because papaparse's own one for `escapeFormulae: true`
// (/^[=+\-@\t\r].*$/, no s flag) does not match a cell that also holds a line break, such as
// "=HYPERLINK(...)\nx", which would then reach the spreadsheet unchanged.
import Papa from "papaparse";

export type CsvProblem = { row: number; message: string };

/**
 * CSV or tab-separated text to rows of cells (RFC 4180, through papaparse). A leading byte-order mark is dropped and a row
 * with nothing in it is skipped. The delimiter is tab when the first line has a tab, else comma, unless `delimiters`
 * lists the ones to choose from (papaparse then guesses by which gives the steadiest column count).
 */
export function parseCsvText(text: string, opts: { delimiters?: string[] } = {}): { rows: string[][]; errors: CsvProblem[] } {
  const clean = text.replace(/^\uFEFF/, "");
  const first = clean.split(/\r?\n/, 1)[0] ?? "";
  const res = Papa.parse<string[]>(clean, opts.delimiters ? { skipEmptyLines: "greedy", delimitersToGuess: opts.delimiters } : { skipEmptyLines: "greedy", delimiter: first.includes("\t") ? "\t" : "," });
  return { rows: res.data.filter((r) => Array.isArray(r)), errors: res.errors.map((e) => ({ row: e.row ?? 0, message: e.message })) };
}

/** CSV text with a header row to one record per row, keyed by the trimmed header. Also returns the headers. */
export function parseCsvRecords(text: string): { records: Record<string, string>[]; headers: string[]; errors: CsvProblem[] } {
  const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  return { records: res.data, headers: res.meta.fields ?? [], errors: res.errors.map((e) => ({ row: e.row ?? 0, message: e.message })) };
}

const FORMULA_START = /^[=+\-@\t\r]/;

/** Rows to CSV text with CRLF line ends; `trailingNewline` (default true) ends the last row with CRLF too. */
export function toCsvText(rows: readonly (readonly unknown[])[], opts: { trailingNewline?: boolean } = {}): string {
  const clean = rows.map((r) => r.map((v) => (v === null || v === undefined ? "" : typeof v === "number" || typeof v === "boolean" ? v : String(v))));
  const text = Papa.unparse(clean, { newline: "\r\n", escapeFormulae: FORMULA_START, quotes: false });
  return opts.trailingNewline === false ? text : `${text}\r\n`;
}
