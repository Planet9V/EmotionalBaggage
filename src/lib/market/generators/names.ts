// 8.5 Name and tagline candidates, in batches, with a short reason each. The generator does not
// know whether a name is free: that is what the screening checklist on the page is for.
import { z } from "zod";
import { lines, stampOf, GROUNDING, type Entry, type Generator, type ToRows } from "./types";

const schema = z.object({
  candidates: z.array(z.object({ text: z.string().min(1).max(120), kind: z.enum(["Name", "Tagline"]), reason: z.string().max(300) })).min(1).max(12),
});

export const generator: Generator<typeof schema> = {
  id: "names",
  label: "Suggest names and taglines",
  from: ["concept/brief", "concept/names", "marketing/personas", "marketing/brand"],
  to: "concept/names",
  applies: (c) => (c.brief.length ? { ok: true } : { ok: false, reason: "The brief is empty. Add what the product is on the Brief page first." }),
  buildPrompt: (c) => {
    const kind = c.params.kind === "Tagline" ? "Tagline" : c.params.kind === "Name" ? "Name" : "both";
    const n = typeof c.params.count === "number" ? Math.min(Math.max(1, c.params.count), 10) : 6;
    const existing = c.names.map((i) => i.title).slice(0, 60).join("; ");
    const personas = c.personas.slice(0, 5).map((p) => `${p.title}: ${String(p.data.job ?? "")}`).join("\n");
    return {
      system: `You suggest names and taglines for a product concept. Each comes with one short reason. You do not know whether a name is taken, trademarked or available and must not say or imply that it is free.\n${GROUNDING}\nDo not repeat a candidate already listed. Prefer names that are short, easy to say and spell, and that a buyer could search for.`,
      prompt: `Concept: ${c.project.name}. ${c.project.oneLiner}\n\nBrief:\n${lines(c.brief, 15)}${personas ? `\n\nAudience:\n${personas}` : ""}\n\nAlready listed (do not repeat): ${existing || "(none)"}${c.brand ? `\n\nBrand voice:\n${c.brand}` : ""}${typeof c.params.note === "string" && c.params.note ? `\n\nThe user's direction for this batch: ${c.params.note}` : ""}\n\nSuggest ${n} candidates${kind === "both" ? " (names and taglines)" : ` (all ${kind === "Name" ? "names" : "taglines"})`}.`,
      maxOutputTokens: 1800,
    };
  },
  schema,
};

export const toRows: ToRows<typeof schema> = (out, c, stamp) => {
  const notes: string[] = [];
  const have = new Set(c.names.map((i) => i.title.trim().toLowerCase()));
  const sources = c.brief.slice(0, 6).map((i) => ({ kind: "brief", id: i.id, title: i.title }));
  const rows = out.candidates.flatMap((x) => {
    const key = x.text.trim().toLowerCase();
    if (have.has(key)) {
      notes.push(`"${x.text}" is already listed and was skipped.`);
      return [];
    }
    have.add(key);
    return [
      {
        section: "concept/names",
        title: x.text.trim(),
        body: x.reason,
        data: { kind: x.kind, reason: x.reason, generatedFrom: stampOf(sources, stamp) },
        status: "draft" as const,
      },
    ];
  });
  return { rows, notes };
};

export const entry: Entry<typeof schema> = { generator, toRows };
