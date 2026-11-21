// Calendar days as plain "YYYY-MM-DD" text. All arithmetic is on whole days in UTC, so a change of
// clock (daylight saving) or of the machine's time zone never moves a date by a day.

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS = 86_400_000;

/** Whole days since 1970-01-01 for a valid date, else null ("2026-02-30" is not valid). */
export function dayNumber(day: string): number | null {
  if (!DAY_RE.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return t / MS;
}

export function dayFromNumber(n: number): string {
  return new Date(n * MS).toISOString().slice(0, 10);
}

export const isDay = (s: unknown): s is string => typeof s === "string" && dayNumber(s) !== null;

/** `day` moved by `days` (negative goes back). Null when `day` is not a date. */
export function addDays(day: string, days: number): string | null {
  const n = dayNumber(day);
  return n === null ? null : dayFromNumber(n + Math.trunc(days));
}

/** Days from `a` to `b`: positive when b is later. Null when either is not a date. */
export function daysBetween(a: string, b: string): number | null {
  const x = dayNumber(a);
  const y = dayNumber(b);
  return x === null || y === null ? null : y - x;
}

/** Inclusive count of days from start to end; null when either is missing or end is before start. */
export function inclusiveDays(start: string, end: string): number | null {
  const d = daysBetween(start, end);
  return d === null || d < 0 ? null : d + 1;
}

export const monthKey = (day: string) => day.slice(0, 7);

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Every "YYYY-MM" from the month of `start` to the month of `end`, in order. */
export function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let [y, m] = start.slice(0, 7).split("-").map(Number);
  const [ey, em] = end.slice(0, 7).split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** "12 Dec 2026" for a day, in English and UTC. */
export function formatDay(day: string): string {
  const n = dayNumber(day);
  if (n === null) return day;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(n * MS));
}
