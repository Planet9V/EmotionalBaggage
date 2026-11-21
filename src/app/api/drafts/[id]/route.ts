import { NextResponse } from "next/server";
import { body, recordId, route } from "@/lib/api/route";
import { draftEdit } from "@/lib/ai/drafts/schemas";
import { editDraft, getDraft } from "@/lib/ai/drafts/store";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  return NextResponse.json({ draft: await getDraft(recordId((await params).id, "That draft")) });
});

/** Edit a draft before deciding it. The fields are checked against the target section. */
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That draft");
  const b = await body(req, draftEdit);
  return NextResponse.json({ draft: await editDraft(id, b) });
});
