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

const asDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Dates and times for the screens: one module. All of them use the browser's own locale and time zone,
// and none throws on a value that is not a date.

/** "3 Nov 2026, 14:05". The input is returned as it is when it is not a date. */
export function fmtDateTime(iso: string | null | undefined): string {
  const d = asDate(iso);
  return d ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : (iso ?? "");
}

/** "3 Nov, 14:05" for a list row or a message. Empty when there is no time or it cannot be read. */
export function fmtStamp(iso: string | null | undefined): string {
  return asDate(iso)?.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) ?? "";
}

/** "14:05:09": the time of a status reading. Empty when it cannot be read. */
export function fmtTime(iso: string | null | undefined): string {
  return asDate(iso)?.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) ?? "";
}

/** "3 Nov 2026" (medium) or "3 Nov" (short). Empty when it cannot be read. */
export function fmtDate(iso: string | null | undefined, style: "medium" | "short" = "medium"): string {
  const d = asDate(iso);
  if (!d) return "";
  return style === "short" ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** "2026-01-02 03:04" in local time: a fixed layout for a generated file, not for a screen. */
export function fmtFileStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
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
