import { NextResponse } from "next/server";
import { HttpError, requireProject, route } from "@/lib/api/route";
import { draftStatusFilter } from "@/lib/ai/drafts/schemas";
import { listDrafts, pendingByStore } from "@/lib/ai/drafts/store";

/** Drafts of a concept: `store`, `status` (default draft; `all` for every status), `runId`, `generator`. */
export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const projectId = p.get("projectId") ?? "";
  await requireProject(projectId);
  const status = draftStatusFilter.safeParse(p.get("status") ?? "draft");
  if (!status.success) throw new HttpError(400, "status must be one of: draft, approved, rejected, all.");
  const runId = p.get("runId") ?? undefined;
  if (runId && !/^[0-9a-f-]{36}$/i.test(runId)) throw new HttpError(400, "runId is not a run id.");
  const drafts = await listDrafts(projectId, { store: p.get("store") ?? undefined, status: status.data, runId, generator: p.get("generator") ?? undefined });
  return NextResponse.json({ drafts, pending: await pendingByStore(projectId) });
});
