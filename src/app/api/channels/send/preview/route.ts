import { NextResponse } from "next/server";
import { requireProject, route } from "@/lib/api/route";
import { previewQuery, queryOf } from "@/lib/channels/requests";
import { preview } from "@/lib/channels/send";

/** GET ?projectId&kind&itemId: exactly what would be sent, its SHA-256 and every reason it cannot be sent now. Sends nothing. */
export const GET = route(async (req: Request) => {
  const p = previewQuery.parse(queryOf(req));
  await requireProject(p.projectId);
  return NextResponse.json(await preview(p.projectId, p.kind, p.itemId));
});
