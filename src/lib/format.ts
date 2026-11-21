// Text helpers for the screens: one file name slug, one date-time, one byte size, one count with its noun.

/**
 * Lower case ASCII with single hyphens: "Meta Feed #2!" becomes "meta-feed-2", "Café déjà vu" becomes "cafe-deja-vu".
 * The one slug function. The rules differ between callers only in length and in what to return when nothing is left,
 * so those are the options: `max` (default 60; Infinity for none, as a heading anchor wants) and `fallback` (default
 * empty). A number as the second argument is `max`. The cut never leaves a hyphen at the end.
 *
 * Named uses: a concept id (`max` 48, fallback "concept"), a download file name (`fileSlug`, 48; `fileSafe` in
 * content/http, 60), a tracking value (campaigns, 60 or less, empty allowed), a row key (40, fallback the section
 * prefix), a heading anchor (no limit).
 */
export function slugify(text: string, opts: number | { max?: number; fallback?: string } = {}): string {
  const { max = 60, fallback = "" } = typeof opts === "number" ? { max: opts } : opts;
  const s = String(text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, max).replace(/-+$/g, "") || fallback;
}

/** A slug for a file name, with a fallback word when the text leaves nothing. */
export function fileSlug(text: string, fallback = "concept"): string {
  return slugify(text, { max: 48, fallback });
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

/** "1 part", "12 parts", "1,200 parts": a count with its noun. English formatting on purpose, so a server sentence and a screen agree. */
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
