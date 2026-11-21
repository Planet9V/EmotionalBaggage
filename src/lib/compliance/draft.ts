// Drafting the compliance checklist (plan 3.8). The reasoning model reads the concept's brief, its
// product type, its parts and the sales regions the user chose, and proposes rows. Every row is saved
// as a DRAFT with what it was generated from; nothing is a row until the user confirms it. The page
// says, and the prompt says, that this is a prompt for the user's own checking and not advice.
import { z } from "zod";
import { completeJson } from "@/lib/ai/models";
import { productType } from "@/lib/productTypes";
import { toPart } from "@/lib/domain/part";
import { REGION_LABEL, type Region } from "@/lib/economics/schemas";
import type { Item } from "@/lib/types";

export const draftSchema = z.object({
  rows: z
    .array(
      z.object({
        /** the rule or topic, for example "Radio equipment: FCC Part 15 in the US, RED in the EU" */
        topic: z.string().trim().min(1).max(300),
        /** why it may apply: names the part or the claim that triggered it */
        why: z.string().trim().min(1).max(2000),
        /** what the person should check */
        check: z.string().trim().min(1).max(2000),
        /** the part reference or brief title that triggered it, when there is one */
        trigger: z.string().trim().max(300).optional(),
      }),
    )
    .max(25),
});
export type DraftRows = z.infer<typeof draftSchema>;

const SYSTEM = `You help someone prepare to check which product rules may apply to something they want to make and sell.
You are not a lawyer and you do not give advice. You produce a checklist of topics for the person to look into themselves.
Rules:
- Use only the sales regions listed. Do not add other regions.
- Each row is one topic. The topic names the rule or standard family and the region, for example "Radio equipment: FCC Part 15 in the US, RED in the EU".
- "why" says why it may apply and must name the part (by reference and name) or the claim in the brief that triggered it. Write "may apply", never "applies" or "you must".
- "check" says what the person should look up or confirm. Do not state a legal conclusion, a deadline or a fee.
- Think about: batteries and their transport, radio modules, mains power, contact with food or skin, products for children, materials and chemicals, labelling and marking, packaging and waste rules, safety of moving or hot parts, data and privacy for anything that records.
- Skip a topic when nothing in the brief or the parts could trigger it. Fewer, well-grounded rows beat many guesses.
- Do not repeat a topic already on the list.`;

export type DraftContext = {
  conceptName: string;
  oneLiner: string;
  productType: string;
  regions: Region[];
  brief: Item[];
  parts: Item[];
  existing: string[];
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}...` : s);

export function promptFor(c: DraftContext): string {
  const parts = c.parts.map(toPart).map((p) => `- ${p.ref || "(no ref)"} ${p.title}${p.spec ? `: ${clip(p.spec, 200)}` : ""}${p.qty ? ` (x${p.qty})` : ""}`);
  const brief = c.brief.map((b) => `- ${b.title}${b.body ? `: ${clip(b.body, 400)}` : ""}`);
  return [
    `Concept: ${c.conceptName}. ${c.oneLiner}`,
    `Product type: ${productType(c.productType).label}`,
    `Sales regions: ${c.regions.map((r) => REGION_LABEL[r]).join(", ")}`,
    `Brief:\n${brief.length ? brief.join("\n") : "(empty)"}`,
    `Parts:\n${parts.length ? parts.join("\n") : "(none listed yet)"}`,
    `Topics already on the list (do not repeat):\n${c.existing.length ? c.existing.map((t) => `- ${t}`).join("\n") : "(none)"}`,
  ].join("\n\n");
}

export const normalTopic = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Asks the reasoning model. Throws the model layer's ModelError (503 when no model is chosen). */
export async function askForDraft(c: DraftContext, signal?: AbortSignal) {
  return completeJson({
    system: SYSTEM,
    messages: [{ role: "user", content: promptFor(c) }],
    schema: draftSchema,
    maxOutputTokens: 4000,
    signal,
  });
}
