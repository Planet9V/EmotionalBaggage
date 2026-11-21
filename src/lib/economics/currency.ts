// The one read of a concept's currency from the database. Server code only; the browser reads it with useProductionSettings.
import { q } from "@/lib/db";
import { DEFAULT_CURRENCY } from "./money";

/** The concept's currency (projects.currency), or USD when the concept is unknown or the column is empty. */
export async function currencyOf(projectId: string): Promise<string> {
  const r = await q<{ currency: string }>("SELECT currency FROM projects WHERE id=$1", [projectId]);
  return r[0]?.currency || DEFAULT_CURRENCY;
}
