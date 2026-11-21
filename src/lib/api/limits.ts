// How many rows one concept may hold (robustness review S8). Every row of a concept comes back on its
// list loads, so an unbounded section would make the screens slow for everyone. Server only.
import type { PoolClient } from "pg";
import { HttpError } from "./route";

export const MAX_ROWS_PER_CONCEPT = 50_000;

/** Refuses (413) when adding `adding` rows would take the concept over the limit. Call inside the write's transaction. */
export async function assertRoomFor(c: PoolClient, projectId: string, adding = 1): Promise<void> {
  const r = await c.query<{ n: number }>("SELECT count(*)::int AS n FROM items WHERE project_id=$1", [projectId]);
  const n = r.rows[0]?.n ?? 0;
  if (n + adding > MAX_ROWS_PER_CONCEPT) {
    throw new HttpError(413, `This concept already holds ${n.toLocaleString("en")} rows; one concept holds at most ${MAX_ROWS_PER_CONCEPT.toLocaleString("en")}. Delete or archive rows first.`);
  }
}
