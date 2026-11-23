/**
 * Funnel events for the public welcome page: the names, the body the public route takes, and the shape of the Admin
 * report. Nothing here touches the database, so the browser can import it.
 *
 * Privacy: no name, email, network address or browser string is stored. A detail value that looks like an email
 * address is dropped; the referrer is kept as a host only; the path without its query.
 */
import { z } from "zod";

export const EVENT_NAMES = ["page_view", "section_view", "cta_click", "plan_click", "form_start", "form_submit", "form_error", "example_open", "film_start", "film_scene", "sound_on"] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/** A detail value: short text, a number or a flag. */
type DetailValue = string | number | boolean;
export type EventDetail = Record<string, DetailValue>;

const MAX_DETAIL_KEYS = 12;
const LOOKS_LIKE_EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

const detailValue = z.union([z.string().max(200), z.number().finite(), z.boolean()]);

/** The body of POST /api/events. Unknown keys are dropped, not refused, so an older page keeps working. */
export const EventBody = z.object({
  event: z.enum(EVENT_NAMES),
  path: z.string().max(500).default(""),
  section: z.string().regex(/^[a-z0-9:_-]{0,60}$/, "section must be a short id").default(""),
  visit: z.string().regex(/^[A-Za-z0-9_-]{8,40}$/, "visit must be the page's random visit id"),
  detail: z
    .record(z.string().regex(/^[a-z][a-z0-9_]{0,39}$/), detailValue)
    .refine((d) => Object.keys(d).length <= MAX_DETAIL_KEYS, `at most ${MAX_DETAIL_KEYS} details`)
    .default({}),
});


/** Only the host of a referrer address; "" for none, for this site, or for anything that is not an address. */
function referrerHost(referrer: string, ownHost = ""): string {
  if (!referrer) return "";
  try {
    const h = new URL(referrer).hostname.toLowerCase();
    return h === ownHost.toLowerCase() ? "" : h.slice(0, 100);
  } catch {
    return "";
  }
}

/** A path with no query or fragment, at most 200 characters. */
export function cleanPath(path: string): string {
  const p = path.split(/[?#]/)[0] ?? "";
  return p.startsWith("/") ? p.slice(0, 200) : "";
}

/** The detail as stored: no email-looking value, the referrer as a host, text trimmed. */
export function cleanDetail(d: EventDetail, ownHost = ""): EventDetail {
  const out: EventDetail = {};
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === "string") {
      if (LOOKS_LIKE_EMAIL.test(v)) continue;
      out[k] = k === "referrer" ? referrerHost(v.includes("://") ? v : `https://${v}`, ownHost) : v.trim().slice(0, 200);
    } else out[k] = v;
  }
  return out;
}

/** One row of the funnel: counted in visits (a visit counts once per step). */
export type FunnelCounts = { visits: number; reachedPricing: number; startedForm: number; sentForm: number; claimedPlace: number };
export type FunnelReport = {
  from: string;
  to: string;
  retentionDays: number;
  days: (FunnelCounts & { day: string })[];
  total: FunnelCounts;
  bySource: (FunnelCounts & { referrer: string; campaign: string })[];
};
