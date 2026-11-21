// Text helpers for the screens: one file name slug, one date-time, one byte size, one count with its noun.

/** Lower case ASCII with single hyphens: "Meta Feed #2!" becomes "meta-feed-2". Empty when nothing is left. */
export function slugify(text: string, max = 60): string {
  const s = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, max).replace(/-+$/g, "");
}

/** A slug for a file name, with a fallback word when the text leaves nothing. */
export function fileSlug(text: string, fallback = "concept"): string {
  return slugify(text, 48) || fallback;
}

/** "3 Nov 2026, 14:05" in the browser's locale. The input is returned as it is when it is not a date. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** 430 -> "7 h 10 min", 45 -> "45 min", 0 -> "0 min" */
export function fmtMinutes(m: number): string {
  const n = Math.max(0, Math.round(m));
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const r = n % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** "1 part", "12 parts": a count with its noun. */
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * A number for a person to read, rounded to `digits` decimals. Never "Infinity" or "NaN": a value that is
 * not a finite number reads as `missing` (U23). Every figure shown with a unit goes through here or fmtMm.
 */
export function fmtNum(n: number | null | undefined, digits = 2, missing = "not measured"): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return missing;
  const f = 10 ** digits;
  return String(Math.round(n * f) / f);
}

/** "12.5 mm", or "not measured" for a value that is not a finite number. */
export const fmtMm = (n: number | null | undefined, digits = 2) => (typeof n === "number" && Number.isFinite(n) ? `${fmtNum(n, digits)} mm` : "not measured");
