// Tracked links: the destination with UTM parameters built to one stated convention, and the code
// for the optional short address (/l/<code>) the app serves. Pure apart from `makeCode`, which uses
// the system's random number source.
import { randomBytes } from "node:crypto";

/**
 * The convention, shown beside every link so a report can be read later:
 *  - utm_source: where the click comes from (the channel): amazon-ads, meta, google, x, email
 *  - utm_medium: the kind of traffic: cpc, paid-social, social, email, referral, qr, print
 *  - utm_campaign: the concept and the campaign, "<concept>-<campaign>"
 *  - utm_content: the creative (the ad or post), so two creatives of one campaign can be told apart
 *  - utm_term: a search term or audience, optional
 * Every value is lower case ASCII: letters, digits and hyphens only, at most 60 characters.
 */
export const UTM_CONVENTION = [
  "utm_source: the channel the click comes from (amazon-ads, meta, google, x, email)",
  "utm_medium: the kind of traffic (cpc, paid-social, social, email, referral, qr, print)",
  "utm_campaign: the concept and the campaign, written concept-campaign",
  "utm_content: the creative, so two ads of one campaign can be told apart",
  "utm_term: a search term or audience; optional",
  "All values are lower case letters, digits and hyphens, at most 60 characters.",
] as const;

export const MEDIA = ["cpc", "paid-social", "social", "email", "referral", "qr", "print", "affiliate", "other"] as const;

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

export type DestinationCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** A destination must be a public web address: http or https, a host, no login in it, no spaces. */
export function checkDestination(raw: string): DestinationCheck {
  const text = raw.trim();
  if (!text) return { ok: false, reason: "Enter the page the link should open." };
  if (text.length > 2000) return { ok: false, reason: "The address is longer than 2,000 characters." };
  if (/\s/.test(text)) return { ok: false, reason: "The address contains a space." };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, reason: "That is not a web address. Start it with https://." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "Only http and https addresses can be used." };
  if (!url.hostname) return { ok: false, reason: "The address has no host." };
  if (url.username || url.password) return { ok: false, reason: "An address with a user name or password in it cannot be used." };
  return { ok: true, url };
}

export type Utm = { source: string; medium: string; campaign: string; content?: string; term?: string };

const PARAM = { source: "utm_source", medium: "utm_medium", campaign: "utm_campaign", content: "utm_content", term: "utm_term" } as const;

export type BuiltLink = { url: string; params: Record<string, string>; notes: string[] };

/**
 * The destination with the UTM parameters set. Parameters already on the address stay, except UTM
 * ones, which are replaced (and a note says so). Values are slugged to the convention.
 */
export function buildUtmUrl(base: string, utm: Utm): { ok: true; link: BuiltLink } | { ok: false; reason: string } {
  const c = checkDestination(base);
  if (!c.ok) return c;
  const url = c.url;
  const notes: string[] = [];
  const params: Record<string, string> = {};
  for (const [field, name] of Object.entries(PARAM) as [keyof Utm, string][]) {
    const raw = utm[field];
    if (raw === undefined || raw === "") continue;
    const slug = slugify(raw);
    if (!slug) return { ok: false, reason: `${name} has nothing left once it is written to the convention (lower case letters, digits and hyphens).` };
    if (slug !== raw) notes.push(`${name} was written as "${slug}" to follow the convention.`);
    if (url.searchParams.has(name)) notes.push(`The address already had ${name}; it was replaced.`);
    url.searchParams.set(name, slug);
    params[name] = slug;
  }
  for (const need of ["source", "medium", "campaign"] as const) {
    if (!params[PARAM[need]]) return { ok: false, reason: `${PARAM[need]} is required.` };
  }
  if (url.toString().length > 2000) return { ok: false, reason: "The finished address is longer than 2,000 characters." };
  return { ok: true, link: { url: url.toString(), params, notes } };
}

/** Letters and digits without the look-alikes (no 0 o 1 l i), so a code can be read out or typed from print. */
export const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const CODE_LENGTH = 8;
export const CODE_RE = /^[a-z0-9]{6,12}$/;

/** A random code. 31 symbols over 8 places is about 8.5 x 10^11 codes, which cannot be guessed by trying. */
export function makeCode(length = CODE_LENGTH): string {
  const bytes = randomBytes(length * 2);
  let out = "";
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    // 31 divides into 248 (8 x 31), so values 248 and above are skipped to keep every symbol equally likely
    if (bytes[i] < 248) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out.length === length ? out : makeCode(length);
}

export const shortPath = (code: string) => `/l/${code}`;
