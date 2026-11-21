import { NextResponse } from "next/server";
import { z } from "zod";
import { body, HttpError, requireProject, route } from "@/lib/api/route";
import { attackOnce } from "@/lib/ai/drafts/attack";

const attackRequest = z.object({ projectId: z.string().min(1).max(80), itemId: z.number().int().positive() });

/**
 * "Attack it" for an approved press release or FAQ entry whose attack after approval did not happen
 * (no model was chosen, or the provider failed). Refused with 409 once the row has been attacked or
 * while an attack is running: the reviewer attacks a row once.
 */
export const POST = route(async (req: Request) => {
  const b = await body(req, attackRequest);
  await requireProject(b.projectId);
  const r = await attackOnce(b.projectId, b.itemId);
  if (!r.ran && (r.record?.state === "done" || r.record?.state === "running" || r.reason === "no such row" || r.reason.startsWith("not a press"))) {
    throw new HttpError(r.reason === "no such row" ? 404 : 409, r.reason === "already attacked" ? "The reviewer has already attacked this row once." : r.reason === "being attacked" ? "The reviewer is attacking this row now." : r.reason === "no such row" ? "That row was not found in this concept." : "Only an approved press release or FAQ entry is attacked.");
  }
  return NextResponse.json(r);
});
