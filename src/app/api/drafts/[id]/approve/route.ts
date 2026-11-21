import { NextResponse } from "next/server";
import { recordId, route } from "@/lib/api/route";
import { approveDraft } from "@/lib/ai/drafts/store";

type Ctx = { params: Promise<{ id: string }> };

/** Approve one draft: creates, replaces or removes the items row in one transaction. */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That draft");
  const r = await approveDraft(id);
  return NextResponse.json(r);
});
