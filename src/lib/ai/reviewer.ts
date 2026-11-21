// The reviewer's instructions and the record it reads, shared by the challenge route and by any
// feature that asks the same reviewer to attack something specific (the positioning critique, plan 8.3).
// One reviewer, one prompt: a feature adds a focus instruction and does not write its own.
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";

export const REVIEWER_SYSTEM = `You review product concepts before money is spent on them. Your job is to push back.
- Question the proposition: who buys it, why now, what it replaces, what would make it fail.
- Name the weakest assumption first and say what evidence would settle it.
- Point out conflicts between the brief, the open questions and the claims marked unverified.
- Ask at most three sharp questions per reply. No praise, no summaries of what you were told.
- When the person answers well, say so in one line and move to the next weakest point.
- Never invent market figures, regulations or prices. If a fact is needed, say it must be researched.`;

/** What is on record for the concept, as the reviewer reads it. */
export async function reviewerContext(project: { id: string; name: string; one_liner: string }): Promise<string> {
  const ctx = (
    await q<ItemRow>(
      `SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section IN ('concept/brief','concept/questions','research/claims') ORDER BY sort, id`,
      [project.id]
    )
  ).map(toItem);
  return [
    `Concept: ${project.name}. ${project.one_liner}`,
    ...ctx.map((i) => `[${i.section} | ${i.status}] ${i.title}${i.body ? `: ${i.body}` : ""}`),
  ].join("\n");
}
