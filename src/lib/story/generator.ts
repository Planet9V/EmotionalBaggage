// "Draft with AI" for the concept story: drafts or revises the story's parts from the concept's rows and the most
// relevant passages of its stored sources, and cites the sources it used. Every part comes back as a draft that
// waits for approval (src/lib/ai/drafts/store.ts); a part that exists already is proposed as a replacement.
import { z } from "zod";
import type { Generator } from "@/lib/ai/drafts/types";
import { RULES, basedOn, block, conceptHeader, critiqueBlock, passagesBlock } from "@/lib/ai/drafts/prompt";
import { CLAIM_BASES, SOURCES_STORE, STORY_PART_KEYS, STORY_PARTS, STORY_STORE, storyPart, type StoryPartKey } from "./parts";

const FROM = [STORY_STORE, "concept/brief", "concept/names", "concept/questions", "concept/decisions", "concept/faq", "concept/press", "research/claims", SOURCES_STORE];

const row = z.object({
  part: z.enum(STORY_PART_KEYS),
  text: z.string().min(1).max(20_000).describe("the part's text in Markdown: short paragraphs, lists or a table where they help"),
  position: z.string().max(400).optional().describe("positioning only: the one-line position"),
  examples: z.array(z.object({ text: z.string().min(1).max(600), context: z.string().max(300).optional() })).max(60).optional().describe("voice only: lines the product says, exactly as written in the sources, with when it says them"),
  claims: z
    .array(z.object({ text: z.string().min(1).max(1000), basis: z.enum(CLAIM_BASES), sourceIds: z.array(z.number().int()).max(20).optional(), note: z.string().max(500).optional() }))
    .max(60)
    .optional()
    .describe("why only: each claim, with basis sourced (stated in a source), measured (a recorded test result) or assumption (still to test), and the source ids it comes from"),
  basedOn,
});

/** The part asked for in this run, if one was. */
function askedPart(params: Record<string, unknown> | undefined): StoryPartKey | null {
  const p = params?.part;
  return typeof p === "string" && (STORY_PART_KEYS as string[]).includes(p) ? (p as StoryPartKey) : null;
}

export const conceptStory: Generator<z.infer<typeof row>> = {
  id: "concept-story",
  label: "Concept story",
  action: "Draft the concept story",
  from: FROM,
  to: STORY_STORE,
  kind: "section",
  applies: () => true,
  revises: true,
  ownsPassages: true,
  blocked: (ctx) =>
    ctx.concept.oneLiner.trim() || ctx.rows["concept/brief"]?.length || ctx.rows[SOURCES_STORE]?.length || ctx.existing.length
      ? ""
      : "Add a file, a brief line or a one-line description first: the story is written from them.",
  passageQuery: (ctx) => {
    const part = storyPart(askedPart(ctx.params));
    return [ctx.concept.name, ctx.concept.oneLiner, part ? `${part.heading}. ${part.covers}` : "the idea, where it came from, why it should work, who it is for, positioning, voice and humour"].join(". ");
  },
  buildPrompt: (ctx) => {
    const only = askedPart(ctx.params);
    const parts = only ? STORY_PARTS.filter((p) => p.key === only) : STORY_PARTS;
    return {
      system: [
        "You write the introduction to a product concept: long-form, readable prose that tells the whole idea, its humour and its reasoning, for someone meeting it for the first time.",
        "Write in the concept's own voice and keep its fun. Quote its own lines, jokes and names exactly as they are written in the rows or passages, in quotation marks.",
        "The parts, each one row:",
        ...parts.map((p) => `- ${p.key}: "${p.heading}". ${p.covers}`),
        "For part why, list every claim in claims with its basis: sourced (stated in a row or passage; add the note \"Stated in the source, not checked.\" unless a row marks it verified), measured (only a recorded test result) or assumption (still to test). Never call a claim measured without a recorded result.",
        "For part open, name every point where the sources disagree, and say which sources say what. Do not pick one side.",
        "When a part already exists, return it revised only if the rows or passages add something; keep what is right.",
        only ? `Return exactly one row, for part ${only}.` : "Return one row per part.",
        RULES,
        "List in basedOn the ids of the rows and of the sources (the number after # on each passage) you used.",
      ].join("\n"),
      user: [
        conceptHeader(ctx),
        block("The story so far", ctx.existing, { bodyMax: 4000 }),
        block("Brief", ctx.rows["concept/brief"]),
        block("Names and taglines", ctx.rows["concept/names"]),
        block("Open questions", ctx.rows["concept/questions"]),
        block("Decisions", ctx.rows["concept/decisions"]),
        block("Claims to verify (with whether they are verified)", ctx.rows["research/claims"]),
        block("FAQ", ctx.rows["concept/faq"]),
        block("Press release", ctx.rows["concept/press"]),
        block("Sources on record (what each document is)", ctx.rows[SOURCES_STORE]),
        passagesBlock(ctx) || "Passages from the sources: none stored yet.",
        critiqueBlock(ctx),
      ]
        .filter(Boolean)
        .join("\n\n"),
    };
  },
  schema: row,
  toDraft(r, ctx, run) {
    const only = askedPart(ctx.params);
    if (only && r.part !== only) return { ok: false, reason: `this run was for the part "${storyPart(only)!.heading}" only` };
    if (run.memo.has(r.part)) return { ok: false, reason: `the part "${storyPart(r.part)!.heading}" was already drafted in this run` };
    run.memo.set(r.part, true);
    const sourceIds = new Set([...(ctx.rows[SOURCES_STORE] ?? []).map((s) => s.id), ...(ctx.passages ?? []).map((p) => p.sourceId)]);
    const cites = (ids: number[] | undefined) => [...new Set((ids ?? []).filter((id) => sourceIds.has(id)))];
    const existing = ctx.existing.find((i) => i.data.part === r.part);
    const data: Record<string, unknown> = {
      ...(existing?.data ?? {}),
      part: r.part,
      sourceIds: cites(r.basedOn),
      ...(r.position ? { position: r.position.trim() } : {}),
      ...(r.examples?.length ? { examples: r.examples } : {}),
      ...(r.claims?.length ? { claims: r.claims.map((c) => ({ ...c, sourceIds: cites(c.sourceIds) })) } : {}),
    };
    return {
      ok: true,
      drafts: [
        {
          title: storyPart(r.part)!.heading,
          body: r.text.trim(),
          data,
          op: existing ? { op: "replace", reason: "A new version of this part of the story." } : { op: "add" },
          itemId: existing?.id,
          basedOn: r.basedOn,
        },
      ],
    };
  },
};
