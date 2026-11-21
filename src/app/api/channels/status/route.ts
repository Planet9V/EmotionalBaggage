import { NextResponse } from "next/server";
import { requireProject, route } from "@/lib/api/route";
import { channelStatus } from "@/lib/channels/status";
import { queryOf } from "@/lib/channels/requests";

/** GET ?projectId=: the three connections, the concept's Amazon sync state, the X cost statement. Nothing secret. */
export const GET = route(async (req: Request) => {
  const id = queryOf(req).projectId?.trim() || null;
  if (id) await requireProject(id);
  return NextResponse.json(await channelStatus(id));
});
