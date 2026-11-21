import { NextResponse } from "next/server";
import { HttpError, recordId, route } from "@/lib/api/route";
import { rejectRequest } from "@/lib/ai/drafts/schemas";
import { rejectDraft } from "@/lib/ai/drafts/store";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That draft");
  let reason = "";
  const text = await req.text();
  if (text.trim()) {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new HttpError(400, "The request body must be JSON.");
    }
    reason = rejectRequest.parse(raw).reason ?? "";
  }
  return NextResponse.json({ draft: await rejectDraft(id, reason) });
});
