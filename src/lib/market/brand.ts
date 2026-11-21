// Server side of the brand kit: what other generators and the landing page read.
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import { brandCssVariables, brandText, findKit } from "./brandKit";

async function kitRow(projectId: string) {
  const rows = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section='marketing/brand' ORDER BY sort, id`, [projectId]);
  return findKit(rows.map(toItem));
}

/** The concept's brand kit as text for a prompt ("" when there is none). Every generator that writes copy calls this. */
export async function brandContext(projectId: string): Promise<string> {
  return brandText(await kitRow(projectId));
}

/** CSS variables for the landing page (plan 8.9): `:root { --brand-primary: ... }`, or "". */
export async function brandVariables(projectId: string): Promise<string> {
  return brandCssVariables(await kitRow(projectId));
}
