// The AI reviewer's prompt, in one place. The Challenge page, "Challenge this" on a row and the
// automatic attack on an approved press release or FAQ all go through POST /api/challenge, which
// builds its instructions here. There is one reviewer, not one per feature.
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import type { Item } from "@/lib/types";

export const REVIEWER_SYSTEM = `You review product concepts before money is spent on them. Your job is to push back.
- Question the proposition: who buys it, why now, what it replaces, what would make it fail.
- Name the weakest assumption first and say what evidence would settle it.
- Point out conflicts between the brief, the open questions and the claims marked unverified.
- Ask at most three sharp questions per reply. No praise, no summaries of what you were told.
- When the person answers well, say so in one line and move to the next weakest point.
- Never invent market figures, regulations or prices. If a fact is needed, say it must be researched.`;

/** Sections the reviewer always reads. */
export const REVIEWER_CONTEXT_SECTIONS = ["concept/brief", "concept/questions", "research/claims"] as const;

export const contextLine = (i: Pick<Item, "section" | "status" | "title" | "body">) => `[${i.section} | ${i.status}] ${i.title}${i.body ? `: ${i.body}` : ""}`;

/** The row a "Challenge this" or an attack is about, with its fields. */
export function focusBlock(row: Item) {
  const fields = Object.entries(row.data ?? {})
    .filter(([, v]) => v !== null && v !== "" && (typeof v !== "object" || Array.isArray(v)))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
    .slice(0, 30);
  return [
    `The person asks you to argue against this one row (id ${row.id}, section ${row.section}, status ${row.status}).`,
    `Title: ${row.title}`,
    row.body ? `Details: ${row.body}` : "",
    fields.length ? `Fields: ${fields.join("; ")}` : "",
    "Argue against it using what is on record for the concept. Say what would have to be true for it to hold, and what would show it is wrong.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The reviewer's instructions for a concept, optionally focused on one row. */
export async function reviewerSystem(project: { id: string; name: string; one_liner: string }, focus?: Item | null) {
  const ctx = (
    await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section = ANY($2) ORDER BY sort, id`, [project.id, [...REVIEWER_CONTEXT_SECTIONS]])
  ).map(toItem);
  const context = [`Concept: ${project.name}. ${project.one_liner}`, ...ctx.map(contextLine)].join("\n");
  return [REVIEWER_SYSTEM, `What is on record for this concept:\n${context}`, focus ? focusBlock(focus) : ""].filter(Boolean).join("\n\n");
}
