import { NextResponse } from "next/server";
import { recordId, route } from "@/lib/api/route";
import { approveDraft } from "@/lib/ai/drafts/store";
import { scheduleAttacks } from "@/lib/ai/drafts/attack";

type Ctx = { params: Promise<{ id: string }> };

/** Approve one draft: creates, replaces or removes the items row in one transaction. */
export const POST = route(async (_req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That draft");
  const r = await approveDraft(id);
  // An approved press release or FAQ entry is attacked once by the reviewer, on the server, after the answer.
  if (r.item && r.draft.op.op === "add") scheduleAttacks(r.item.projectId, [r.item]);
  return NextResponse.json(r);
});
