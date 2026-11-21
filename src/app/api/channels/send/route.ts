import { NextResponse } from "next/server";
import { body, requireProject, route } from "@/lib/api/route";
import { send, sendBody } from "@/lib/channels/send";

/**
 * POST { projectId, kind, itemId, confirm: { channel, itemId, textSha256, imageUrl? } }: sends ONE approved
 * post or reply to X or Instagram. The only route that posts anywhere; every check is in src/lib/channels/send.ts.
 */
export const POST = route(async (req: Request) => {
  const b = await body(req, sendBody);
  await requireProject(b.projectId);
  return NextResponse.json(await send(b));
});
