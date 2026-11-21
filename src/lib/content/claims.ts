// The "no proof" check. A line of copy that holds a number or a superlative must link to a row the
// concept can stand behind: a verified claim, a passing test, a requirement, or an approved price.
// A number must also appear in the text of one of the rows it links to. A superlative needs a verified
// claim or a passing test: a requirement says what is intended, not what is shown.
// The check is a pure function of the copy and the linked rows; the server runs it again on every
// edit and approval, so a stored flag is never trusted.
import type { ProofRef } from "@/lib/market/schemas";

export type ProofRow = { id: number; section: string; title: string; body: string; status: string; data: Record<string, unknown> };
export type Flag = { field: string; text: string; kind: "number" | "superlative"; reason: string };

export const SUPERLATIVES = [
  "best", "fastest", "cheapest", "lowest", "greatest", "biggest", "strongest", "safest", "smartest", "lightest", "quietest", "most", "only", "first", "perfect", "ultimate",
  "unbeatable", "guaranteed", "never", "always", "number one", "world's", "world-class", "leading", "revolutionary", "unmatched", "flawless", "zero", "100%", "#1",
];
const SUPER_RE = new RegExp(`(?:^|[^\\w])(${SUPERLATIVES.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\w])`, "i");

export type ProofState = "verified claim" | "passing test" | "requirement" | "approved price" | "not proof";

export function proofStateOf(r: ProofRow): ProofState {
  if (r.section === "research/claims") return r.status === "verified" ? "verified claim" : "not proof";
  if (r.section === "prototype/tests") return r.status === "pass" ? "passing test" : "not proof";
  if (r.section === "design/requirements") return "requirement";
  if (r.section === "marketing/pricing" && r.data?.kind === "price" && r.status === "approved") return "approved price";
  return "not proof";
}

/** The text a number may be found in. */
const rowText = (r: ProofRow) =>
  `${r.title} ${r.body} ${Object.values(r.data ?? {})
    .filter((v) => typeof v === "string" || typeof v === "number")
    .join(" ")} ${typeof r.data?.priceMinor === "number" ? (r.data.priceMinor / 100).toFixed(2) : ""}`;

const normNum = (s: string) => s.replace(/,/g, "").replace(/\.0+$/, "");

/** Number tokens in a line: 12, 3.5, 1,200, 99%. */
export function numbersIn(text: string): string[] {
  // A digit glued to the end of a word is a designation (MK1, V2, A4), not a quantity; "3x" and "50%" still count.
  return (text.match(/(?<![A-Za-z])\d[\d,]*(?:\.\d+)?/g) ?? []).map(normNum);
}

/** Removes words that may hold digits but are not claims: the product's own name and brand, and web addresses. */
export function stripNonClaims(text: string, names: string[]): string {
  let t = text.replace(/https?:\/\/\S+/g, " ").replace(/\b[\w.-]+\.(?:com|nl|org|net|io|co|app)\b\S*/gi, " ");
  for (const n of names.filter((x) => x && x.trim().length > 1)) t = t.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  return t;
}

export type CopyField = { field: string; text: string };

/** Flags for a set of copy fields, given the rows the copy links to. */
export function evaluate(fields: CopyField[], links: ProofRow[], names: string[] = []): Flag[] {
  const states = links.map((r) => ({ r, s: proofStateOf(r) })).filter((x) => x.s !== "not proof");
  const texts = states.map((x) => normNum(rowText(x.r)));
  const strong = states.some((x) => x.s === "verified claim" || x.s === "passing test");
  const out: Flag[] = [];
  for (const f of fields) {
    const clean = stripNonClaims(f.text, names);
    for (const n of new Set(numbersIn(clean))) {
      if (!states.length) {
        out.push({ field: f.field, text: n, kind: "number", reason: `"${n}" is a number with no proof row linked.` });
      } else if (!texts.some((t) => new RegExp(`(^|[^\\d.])${n.replace(/\./g, "\\.")}($|[^\\d])`).test(t))) {
        out.push({ field: f.field, text: n, kind: "number", reason: `"${n}" is not in any row this copy links to.` });
      }
    }
    const m = SUPER_RE.exec(clean);
    if (m && !strong) {
      out.push({ field: f.field, text: m[1], kind: "superlative", reason: `"${m[1]}" needs a verified claim or a passing test linked; ${states.length ? "only a requirement or price is linked" : "nothing is linked"}.` });
    }
  }
  return out;
}

export const noProof = (flags: Flag[]) => flags.length > 0;

/** Links as the rows store them. */
export type Links = ProofRef[];

export function flagSummary(flags: Flag[]): string {
  if (!flags.length) return "";
  return flags
    .slice(0, 3)
    .map((f) => f.reason)
    .join(" ");
}
