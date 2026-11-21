import { NextResponse } from "next/server";
import { body, requireProject, route } from "@/lib/api/route";
import { resolveBody, resolveUnknown } from "@/lib/channels/send";

/**
 * POST { projectId, kind, itemId, outcome: "not-posted" | "posted", externalId?, url? }: records what the user found on
 * the channel after a send whose outcome is unknown. Until this is recorded, the row cannot be sent again.
 */
export const POST = route(async (req: Request) => {
  const b = await body(req, resolveBody);
  await requireProject(b.projectId);
  return NextResponse.json({ item: await resolveUnknown(b) });
});
