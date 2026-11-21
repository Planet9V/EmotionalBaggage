import { NextResponse } from "next/server";
import { HttpError, requireProject, route } from "@/lib/api/route";
import { generatorsInfo } from "@/lib/ai/drafts/service";

/** Generators that apply to the concept (`store` limits to one target section; `kind` to section or optimise). */
export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const projectId = p.get("projectId") ?? "";
  await requireProject(projectId);
  const kind = p.get("kind");
  if (kind !== null && kind !== "section" && kind !== "optimise") throw new HttpError(400, "kind must be section or optimise.");
  return NextResponse.json(await generatorsInfo(projectId, { store: p.get("store") ?? undefined, kind: kind ?? undefined }));
});
