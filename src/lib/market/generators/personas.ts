// 8.1 Personas drafted from the brief, the verified claims and saved research answers.
import { z } from "zod";
import { squash, lines, stampOf, GROUNDING, type Entry, type Generator, type SourceRef, type ToRows } from "./types";

const schema = z.object({
  personas: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        who: z.string().max(600),
        job: z.string().max(600),
        trigger: z.string().max(600),
        objection: z.string().max(600),
        whereTheyLook: z.string().max(600),
        /** exact words from a saved research answer, with the research id; empty when research supplied none */
        theirWords: z.array(z.object({ quote: z.string().max(400), researchId: z.number().int() })).max(6).default([]),
        /** ids of the brief rows, claims and research answers this persona drew on */
        drewOn: z.array(z.object({ kind: z.enum(["brief", "claim", "research"]), id: z.number().int() })).max(30).default([]),
      })
    )
    .min(1)
    .max(6),
});

const generator: Generator<typeof schema> = {
  id: "personas",
  label: "Draft personas",
  from: ["concept/brief", "research/claims", "research"],
  to: "marketing/personas",
  applies: (c) => (c.brief.length ? { ok: true } : { ok: false, reason: "The brief is empty. Add what the product is and who it is for on the Brief page first." }),
  buildPrompt: (c) => {
    const verified = c.claims.filter((x) => x.status === "verified");
    const research = c.research.slice(0, 8).map((r) => `[research id ${r.id}] Question: ${r.query}\nAnswer: ${r.answer.slice(0, 2500)}`).join("\n\n");
    const n = typeof c.params.count === "number" ? Math.min(Math.max(1, c.params.count), 5) : 3;
    return {
      system: `You write audience personas for a product concept. A persona is a buyer with a job to get done, not a demographic.\n${GROUNDING}\nFor "theirWords" give only quotations copied exactly from a saved research answer below, with that answer's research id; if no answer holds a real quotation, give an empty list. "drewOn" lists the ids you used, as kind brief, claim or research.`,
      prompt: `Concept: ${c.project.name}. ${c.project.oneLiner}\n\nBrief:\n${lines(c.brief)}\n\nVerified claims (the only claims you may lean on):\n${verified.length ? lines(verified) : "(none yet)"}\n\nSaved research answers:\n${research || "(none yet)"}\n\nWrite ${n} distinct personas. For each: who they are, the job they are trying to get done, the trigger that makes them buy, their main objection, and where they look for products like this.${c.brand ? `\n\nBrand voice to follow:\n${c.brand}` : ""}${typeof c.params.note === "string" && c.params.note ? `\n\nThe user's note for this batch: ${c.params.note}` : ""}`,
      maxOutputTokens: 3000,
    };
  },
  schema,
};

const toRows: ToRows<typeof schema> = (out, c, stamp) => {
  const notes: string[] = [];
  const briefById = new Map(c.brief.map((i) => [i.id, i]));
  const claimById = new Map(c.claims.map((i) => [i.id, i]));
  const researchById = new Map(c.research.map((r) => [r.id, r]));
  const rows = out.personas.map((p) => {
    const sources: SourceRef[] = [];
    for (const d of p.drewOn) {
      const found = d.kind === "brief" ? briefById.get(d.id) : d.kind === "claim" ? claimById.get(d.id) : undefined;
      if (found) sources.push({ kind: d.kind, id: d.id, title: found.title });
      else if (d.kind === "research" && researchById.has(d.id)) sources.push({ kind: "research", id: d.id, title: researchById.get(d.id)!.query });
      else notes.push(`"${p.name}": dropped a source (${d.kind} ${d.id}) that is not in this concept.`);
    }
    const words = p.theirWords.filter((w) => {
      const r = researchById.get(w.researchId);
      const real = !!r && w.quote.trim().length > 0 && squash(r.answer).includes(squash(w.quote));
      if (!real) notes.push(`"${p.name}": dropped a quotation that is not in research answer ${w.researchId}.`);
      else if (!sources.some((s) => s.kind === "research" && s.id === w.researchId)) sources.push({ kind: "research", id: w.researchId, title: r!.query });
      return real;
    });
    if (!sources.length) sources.push(...c.brief.slice(0, 3).map((i) => ({ kind: "brief", id: i.id, title: i.title })));
    return {
      section: "marketing/personas",
      title: p.name.trim(),
      body: "",
      data: {
        who: p.who,
        job: p.job,
        trigger: p.trigger,
        objection: p.objection,
        whereTheyLook: p.whereTheyLook,
        ...(words.length ? { theirWords: words.map((w) => ({ quote: w.quote.trim(), researchId: w.researchId })) } : {}),
        generatedFrom: stampOf(sources, stamp),
      },
      status: "draft" as const,
    };
  });
  return { rows, notes };
};

export const entry: Entry<typeof schema> = { generator, toRows };
