// What every content generator shares: the approved messages it may write from, the proof it may
// link, the brand voice, and the step that turns one model row into a draft with its no-proof flags.
import { z } from "zod";
import type { Item } from "@/lib/types";
import type { GenContext } from "@/lib/ai/drafts/types";
import { RULES, conceptHeader } from "@/lib/ai/drafts/prompt";
import { brandText, findKit } from "@/lib/market/brandKit";
import { checkProof, type ProofRow as MarketProofRow } from "@/lib/market/proof";
import type { PositioningMessage, ProofRef } from "@/lib/market/schemas";
import { evaluate, proofStateOf, type Flag, type ProofRow } from "../claims";
import type { CopyField } from "../claims";
import { claimFields, type MessageRef } from "../schemas";
import { toInputText } from "@/lib/economics/money";

/** Stores every content generator reads. */
export const BASE_FROM = ["marketing/positioning", "marketing/brand", "research/claims", "prototype/tests", "design/requirements", "marketing/pricing", "marketing/personas", "concept/brief"];

export type Message = MessageRef & { id: string; proof: ProofRef[] };

/** The messages of positioning rows that are approved. A message is "positioningId:index". */
function approvedMessages(ctx: GenContext): Message[] {
  const out: Message[] = [];
  for (const p of ctx.rows["marketing/positioning"] ?? []) {
    if (p.status !== "approved") continue;
    const list = (Array.isArray(p.data.messages) ? p.data.messages : []) as PositioningMessage[];
    list.forEach((m, index) => {
      if (m && typeof m.text === "string" && m.text.trim()) out.push({ id: `${p.id}:${index}`, positioningId: p.id, index, text: m.text.trim(), proof: Array.isArray(m.proof) ? m.proof : [] });
    });
  }
  return out;
}

const NO_MESSAGE = "Approve a positioning with at least one message first (Marketing, Positioning). Everything written here is tied to one approved message.";

export const blockedNoMessage = (ctx: GenContext) => (approvedMessages(ctx).length ? "" : NO_MESSAGE);

const toProofRow = (i: Item): ProofRow => ({ id: i.id, section: i.section, title: i.title, body: i.body, status: i.status, data: i.data });

/** Rows copy may link to as proof: verified claims, passing tests, requirements and approved prices. */
export function proofRows(ctx: GenContext): ProofRow[] {
  const all = [...(ctx.rows["research/claims"] ?? []), ...(ctx.rows["prototype/tests"] ?? []), ...(ctx.rows["design/requirements"] ?? []), ...(ctx.rows["marketing/pricing"] ?? [])].map(toProofRow);
  return all.filter((r) => proofStateOf(r) !== "not proof");
}

export function messagesBlock(ctx: GenContext): string {
  const ms = approvedMessages(ctx);
  const rows = new Map<number, MarketProofRow>(
    [...(ctx.rows["research/claims"] ?? []), ...(ctx.rows["prototype/tests"] ?? []), ...(ctx.rows["design/requirements"] ?? [])].map((i) => [i.id, { id: i.id, section: i.section, title: i.title, status: i.status, data: i.data }])
  );
  return (
    "Approved messages (each piece you write is tied to exactly ONE of these; give its id in \"messageId\"):\n" +
    ms
      .map((m) => {
        const p = checkProof([{ text: m.text, proof: m.proof }], rows)[0];
        const links = p.links.map((l) => `#${l.ref.itemId} ${l.state}`).join(", ");
        return `- messageId "${m.id}": ${m.text}${links ? ` (proof: ${links})` : " (no proof linked)"}`;
      })
      .join("\n")
  );
}

export function proofBlock(ctx: GenContext): string {
  const rows = proofRows(ctx);
  if (!rows.length) return "Proof rows you may link: none. So the copy must not contain any number or superlative (best, fastest, only, most, first, never, always, guaranteed, 100%).";
  return (
    "Proof rows you may link in \"proofIds\" (verified claims, passing tests, requirements, approved prices). A number or a superlative in your copy is allowed only if you link a row that holds that same number or shows that claim; otherwise leave it out:\n" +
    rows.map((r) => `- #${r.id} ${proofStateOf(r)}: ${r.title}${r.body ? `: ${r.body.slice(0, 300)}` : ""}${typeof r.data.priceMinor === "number" ? ` (price ${toInputText(r.data.priceMinor, String(r.data.currency || "USD"))} ${String(r.data.currency ?? "")})` : ""}`).join("\n")
  );
}

export function voiceBlock(ctx: GenContext): string {
  const t = brandText(findKit(ctx.rows["marketing/brand"] ?? []));
  return t ? `Brand voice to follow:\n${t}` : "No brand voice is set up yet: write plain, concrete sentences.";
}

export const CONTENT_RULES = `${RULES}
- Write for a buyer. Short plain sentences, concrete nouns, no filler openers, no exclamation marks, no em dashes.
- Tie every piece to exactly one approved message ("messageId") and say which rows you used ("basedOn", "proofIds").
- Never state a number, a date, a price or a comparison that is not in a row you were given.`;

export const commonRow = {
  messageId: z.string().min(1).max(40).describe('the id of the one approved message this piece is tied to, e.g. "42:0"'),
  proofIds: z.array(z.number().int()).max(20).default([]).describe("ids of proof rows this copy relies on"),
  basedOn: z.array(z.number().int()).max(200).optional(),
};

/** Em and en dashes are not used in copy. */
export const clean = (s: string) => s.replace(/\s*[—–]\s*/g, ", ").replace(/\s+/g, " ").trim();
export const cleanBlock = (s: string) => s.replace(/[ \t]*[—–][ \t]*/g, ", ").replace(/[ \t]+\n/g, "\n").trim();

export type Resolved = { message: Message; proof: ProofRef[]; links: ProofRow[] };

/** The message a row names, and the proof links it may have: its message's proof plus the rows it chose. */
export function resolve(ctx: GenContext, messageId: string, proofIds: number[]): { ok: true; r: Resolved } | { ok: false; reason: string } {
  const message = approvedMessages(ctx).find((m) => m.id === messageId);
  if (!message) return { ok: false, reason: `its message "${messageId}" is not an approved message of this concept` };
  const candidates = new Map(proofRows(ctx).map((r) => [r.id, r]));
  const ids = new Set<number>(proofIds.filter((id) => candidates.has(id)));
  for (const p of message.proof) if (candidates.has(p.itemId)) ids.add(p.itemId);
  const links = [...ids].map((id) => candidates.get(id)!);
  const proof: ProofRef[] = links.map((r) => ({ itemId: r.id, section: r.section, title: r.title.slice(0, 300) }));
  return { ok: true, r: { message, proof, links } };
}

/** The data every content row carries from its message, proof and flags. */
export function withProof(ctx: GenContext, section: string, title: string, body: string, data: Record<string, unknown>, r: Resolved) {
  const full = { ...data, message: { positioningId: r.message.positioningId, index: r.message.index, text: r.message.text }, proof: r.proof };
  const fields: CopyField[] = claimFields(section, title, body, full);
  const flags: Flag[] = evaluate(fields, r.links, [ctx.concept.name]);
  return { ...full, flags, noProof: flags.length > 0 };
}

export const header = (ctx: GenContext) => conceptHeader(ctx);
