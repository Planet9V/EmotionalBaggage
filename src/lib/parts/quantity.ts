// How many of a part go into one unit: a whole number from 1 to 100,000. One rule for the server's part schema, the
// forms, the CSV import and the screens that show a row saved before the rule. No I/O: the browser imports it too.

const QTY_MIN = 1;
export const QTY_MAX = 100_000;
export const QTY_MESSAGE = "Enter a whole number of pieces from 1 to 100,000.";

/** The message when a quantity breaks the rule, or null when it holds or none is set. */
export function quantityProblem(qty: number | null | undefined): string | null {
  if (qty === null || qty === undefined) return null;
  return Number.isInteger(qty) && qty >= QTY_MIN && qty <= QTY_MAX ? null : QTY_MESSAGE;
}
