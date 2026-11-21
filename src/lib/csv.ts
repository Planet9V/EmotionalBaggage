// The one CSV writer (robustness review S7). papaparse's unparse does the quoting (RFC 4180) and the
// formula neutralising: a text cell that starts with = + - @, a tab or a carriage return gets a leading
// apostrophe, so a spreadsheet shows it instead of running it. Numbers are written as numbers.
//
// The pattern is passed as a RegExp because papaparse's own one for `escapeFormulae: true`
// (/^[=+\-@\t\r].*$/, no s flag) does not match a cell that also holds a line break, such as
// "=HYPERLINK(...)\nx", which would then reach the spreadsheet unchanged.
import Papa from "papaparse";

export const FORMULA_START = /^[=+\-@\t\r]/;

/** Rows to CSV text with CRLF line ends; `trailingNewline` (default true) ends the last row with CRLF too. */
export function toCsvText(rows: readonly (readonly unknown[])[], opts: { trailingNewline?: boolean } = {}): string {
  const clean = rows.map((r) => r.map((v) => (v === null || v === undefined ? "" : typeof v === "number" || typeof v === "boolean" ? v : String(v))));
  const text = Papa.unparse(clean, { newline: "\r\n", escapeFormulae: FORMULA_START, quotes: false });
  return opts.trailingNewline === false ? text : `${text}\r\n`;
}
