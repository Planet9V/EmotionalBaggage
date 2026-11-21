// 8.9 The landing page as structured sections. One run writes up to eight sections (hero, problem, how it
// works, proof, comparison, FAQ, price and call to action, footer), all tied to ONE approved message. A
// section of a kind the page already has becomes a replacement of that row.
import { z } from "zod";
import type { Generator } from "@/lib/ai/drafts/types";
import { block } from "@/lib/ai/drafts/prompt";
import { LANDING_CONTENT, KIND_LABEL, isSourced, type Competitor } from "../landing";
import { CONTENT, LANDING_KINDS, type LandingKind } from "../schemas";
import { BASE_FROM, CONTENT_RULES, clean, commonRow, header, messagesBlock, proofBlock, proofRows, resolve, voiceBlock, withProof } from "./shared";

const row = z.object({ ...commonRow, kind: z.enum(LANDING_KINDS), content: z.record(z.string(), z.unknown()) });
type Row = z.infer<typeof row>;

const SHAPES = `Sections and the "content" of each:
- hero: {"headline": short and specific, "subhead": one sentence, "ctaLabel": 2 to 4 words}
- problem: {"heading", "points": 2 to 4 short sentences about what the buyer lives with today}
- how: {"heading", "steps": 3 or 4 of {"title","text"}}
- proof: {"heading", "items": 2 to 5 of {"claim","evidence","proofItemId"}}; every item names a proof row id and states only what that row shows
- comparison: {"heading", "ourLine": one sentence, "competitorIds": ids from the sourced competitors list}
- faq: {"heading", "items": 4 to 6 of {"q","a"}} from the FAQ you are given
- price: {"heading", "note", "ctaLabel", "priceItemId": the id of an approved price row, or null}
- footer: {"text": one sentence}
Write each section once. Skip a section you have nothing sourced for. Do not put web addresses in the content.`;

export const landingPage: Generator<Row> = {
  id: "landing-page",
  label: "Landing page",
  action: "Draft the landing page",
  from: [...BASE_FROM, "concept/faq", "marketing/competitors"],
  to: CONTENT.landing,
  kind: "section",
  applies: () => true,
  revises: false,
  blocked: (ctx) => {
    const has = (ctx.rows["marketing/positioning"] ?? []).some((p) => p.status === "approved" && Array.isArray(p.data.messages) && p.data.messages.length);
    return has ? "" : "Approve a positioning with at least one message first (Marketing, Positioning). The page is tied to one approved message.";
  },
  buildPrompt: (ctx) => {
    const comps = (ctx.rows["marketing/competitors"] ?? []).filter((r) => isSourced(r.data as Competitor)).map((r) => `- #${r.id} ${r.title}: ${String(r.data.priceText ?? "")}; ${String(r.data.claim ?? "")}`);
    return {
      system: [
        "You write the sections of a one-page landing page for a product, for a buyer who has never heard of it. The page has one job and one call to action.",
        "Use exactly one approved message for the whole page. Do not make a row of numbers or statistics.",
        SHAPES,
        CONTENT_RULES,
      ].join("\n\n"),
      user: [header(ctx), messagesBlock(ctx), proofBlock(ctx), voiceBlock(ctx), comps.length ? `Sourced competitors you may compare against:\n${comps.join("\n")}` : "Sourced competitors: none. Skip the comparison.", block("FAQ on record", ctx.rows["concept/faq"]), block("Brief", ctx.rows["concept/brief"])].join("\n\n"),
    };
  },
  schema: row,
  toDraft(r, ctx, run) {
    const res = resolve(ctx, r.messageId, r.proofIds);
    if (!res.ok) return res;
    const pageMsg = run.memo.get("message") as string | undefined;
    if (pageMsg && pageMsg !== r.messageId) return { ok: false, reason: `the page is tied to message "${pageMsg}"; this section names "${r.messageId}"` };
    const seen = (run.memo.get("kinds") as Set<string> | undefined) ?? new Set<string>();
    if (seen.has(r.kind)) return { ok: false, reason: `there is already a ${KIND_LABEL[r.kind]} section in this run` };
    const kind = r.kind as LandingKind;
    const content: Record<string, unknown> = JSON.parse(JSON.stringify(r.content), (_k, v) => (typeof v === "string" ? clean(v) : v));
    const notes: string[] = [];
    if (kind === "proof" && Array.isArray(content.items)) {
      const ok = new Map(proofRows(ctx).map((p) => [p.id, p]));
      content.items = (content.items as { proofItemId?: number; claim?: string }[]).filter((it) => {
        const p = typeof it.proofItemId === "number" ? ok.get(it.proofItemId) : undefined;
        if (!p) {
          notes.push(`A proof line was dropped: it names row ${it.proofItemId}, which is not a verified claim, passing test, requirement or approved price.`);
          return false;
        }
        return true;
      });
    }
    if (kind === "comparison") {
      const sourced = new Set((ctx.rows["marketing/competitors"] ?? []).filter((x) => isSourced({ id: x.id, title: x.title, ...(x.data as object) } as Competitor)).map((x) => x.id));
      const ids = (Array.isArray(content.competitorIds) ? content.competitorIds : []).filter((i): i is number => typeof i === "number");
      content.competitorIds = ids.filter((i) => sourced.has(i));
      if ((content.competitorIds as number[]).length < ids.length) notes.push("Comparison: rows without a source were taken out.");
      if (!(content.competitorIds as number[]).length) return { ok: false, reason: "the comparison has no sourced competitor row to show" };
    }
    if (kind === "price") {
      const prices = new Set((ctx.rows["marketing/pricing"] ?? []).filter((p) => p.data.kind === "price" && p.status === "approved").map((p) => p.id));
      content.priceItemId = typeof content.priceItemId === "number" && prices.has(content.priceItemId) ? content.priceItemId : null;
    }
    const parsed = LANDING_CONTENT[kind].safeParse(content);
    if (!parsed.success) return { ok: false, reason: `its content does not fit a ${KIND_LABEL[kind]} section (${parsed.error.issues[0]?.path.join(".") || "content"}: ${parsed.error.issues[0]?.message})` };
    seen.add(kind);
    run.memo.set("kinds", seen);
    run.memo.set("message", r.messageId);
    const head = String((parsed.data as Record<string, unknown>).headline ?? (parsed.data as Record<string, unknown>).heading ?? (parsed.data as Record<string, unknown>).text ?? KIND_LABEL[kind]);
    const title = `${KIND_LABEL[kind]}: ${head}`.slice(0, 200);
    const existing = ctx.existing.find((i) => i.data.kind === kind);
    const data = withProof(ctx, CONTENT.landing, title, "", { page: "main", kind, order: LANDING_KINDS.indexOf(kind), content: parsed.data }, res.r);
    return { ok: true, drafts: [{ title, body: "", data, op: existing ? { op: "replace", reason: "A new version of this section." } : { op: "add" }, itemId: existing?.id, basedOn: r.basedOn }], notes };
  },
};
