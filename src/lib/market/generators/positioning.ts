// 8.3 One positioning line, three supporting messages and the proof for each, from the personas
// and the competitors. Proof is chosen from rows the concept holds (verified claims, tests,
// requirements); the model cannot invent a link, and a message with none is flagged on screen.
import { z } from "zod";
import { PROOF_SECTIONS } from "../proof";
import { lineTitle, positioningLine } from "../positioning";
import { lines, stampOf, GROUNDING, type Entry, type Generator, type SourceRef, type ToRows } from "./types";

const schema = z.object({
  forWhom: z.string().max(300),
  need: z.string().max(300),
  productIs: z.string().max(300),
  thatDoes: z.string().max(400),
  unlike: z.string().max(300),
  difference: z.string().max(400),
  messages: z
    .array(z.object({ text: z.string().min(1).max(300), proofIds: z.array(z.number().int()).max(6).default([]) }))
    .min(1)
    .max(3),
});

export const generator: Generator<typeof schema> = {
  id: "positioning",
  label: "Draft the positioning",
  from: ["marketing/personas", "marketing/competitors", "research/claims", "prototype/tests", "design/requirements"],
  to: "marketing/positioning",
  applies: (c) => {
    if (!c.personas.length) return { ok: false, reason: "Draft or add at least one persona first (Personas)." };
    if (!c.competitors.length) return { ok: false, reason: "Add at least one competitor or alternative first (Competitors)." };
    return { ok: true };
  },
  buildPrompt: (c) => {
    const verified = c.claims.filter((x) => x.status === "verified");
    const passing = c.tests.filter((x) => x.status === "pass");
    const personas = c.personas.map((p) => `- [id ${p.id}, ${p.status}] ${p.title}: job: ${String(p.data.job ?? "")}; trigger: ${String(p.data.trigger ?? "")}; objection: ${String(p.data.objection ?? "")}`).join("\n");
    const comps = c.competitors
      .map((p) => `- [id ${p.id}, ${p.status}] ${p.title} (${String(p.data.kind ?? "product")}): claim: ${String(p.data.claim ?? "")}; weakness: ${String(p.data.weakness ?? "")}; ${p.data.basis === "unsourced" ? "UNSOURCED" : "sourced"}`)
      .join("\n");
    return {
      system: `You write product positioning from the audience and the alternatives. Positioning line shape: For [who], who need [what], [product] is a [what it is] that [what it does]. Unlike [the main alternative], [product] [the difference]. \"unlike\" names the main alternative (a product or doing nothing); \"difference\" says what the product does that the alternative does not.\n${GROUNDING}\nEach supporting message is one plain sentence a buyer would care about. For each message list "proofIds": ids from the PROOF list below (verified claims, passing tests, requirements) that back it. Never use an id that is not in that list. If nothing in the list backs a message, give an empty list: do not stretch a claim to fit.`,
      prompt: `Concept: ${c.project.name}. ${c.project.oneLiner}\n\nBrief:\n${lines(c.brief, 20)}\n\nPersonas:\n${personas}\n\nCompetitors and alternatives:\n${comps}\n\nPROOF you may link (verified claims):\n${verified.length ? lines(verified) : "(none)"}\n(passing tests):\n${passing.length ? lines(passing) : "(none)"}\n(requirements):\n${c.requirements.length ? lines(c.requirements, 30) : "(none)"}${c.brand ? `\n\nBrand voice to follow:\n${c.brand}` : ""}\n\nWrite the positioning line parts and exactly three supporting messages.`,
      maxOutputTokens: 2000,
    };
  },
  schema,
};

export const toRows: ToRows<typeof schema> = (out, c, stamp) => {
  const notes: string[] = [];
  const proofById = new Map<number, { item: (typeof c.claims)[number]; ok: boolean }>();
  for (const i of c.claims) proofById.set(i.id, { item: i, ok: i.status === "verified" });
  for (const i of c.tests) proofById.set(i.id, { item: i, ok: i.status === "pass" });
  for (const i of c.requirements) proofById.set(i.id, { item: i, ok: true });
  const messages = out.messages.map((m, n) => {
    const proof = m.proofIds.flatMap((id) => {
      const p = proofById.get(id);
      if (!p || !PROOF_SECTIONS.includes(p.item.section as (typeof PROOF_SECTIONS)[number])) {
        notes.push(`Message ${n + 1}: dropped a proof link (${id}) that is not a claim, test or requirement of this concept.`);
        return [];
      }
      if (!p.ok) notes.push(`Message ${n + 1}: "${p.item.title}" is linked but is not verified or passing, so it does not count as proof.`);
      return [{ itemId: p.item.id, section: p.item.section, ...(typeof p.item.data.key === "string" && p.item.data.key ? { key: p.item.data.key } : {}), title: p.item.title }];
    });
    return { text: m.text.trim(), proof };
  });
  const sources: SourceRef[] = [
    ...c.personas.map((i) => ({ kind: "persona", id: i.id, title: i.title })),
    ...c.competitors.map((i) => ({ kind: "competitor", id: i.id, title: i.title })),
    ...messages.flatMap((m) => m.proof.map((p) => ({ kind: p.section === "research/claims" ? "claim" : p.section === "prototype/tests" ? "test" : "requirement", id: p.itemId, title: p.title ?? "" }))),
  ];
  const line = positioningLine(out, c.project.name);
  return {
    rows: [
      {
        section: "marketing/positioning",
        title: lineTitle(line),
        body: "",
        data: { kind: "statement", forWhom: out.forWhom, need: out.need, productIs: out.productIs, thatDoes: out.thatDoes, unlike: out.unlike, difference: out.difference, messages, generatedFrom: stampOf(sources, stamp) },
        status: "draft" as const,
      },
    ],
    notes,
  };
};

export const entry: Entry<typeof schema> = { generator, toRows };
