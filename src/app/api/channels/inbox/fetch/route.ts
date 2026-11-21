import { NextResponse } from "next/server";
import { body, requireProject, route } from "@/lib/api/route";
import { fetchInbox } from "@/lib/channels/inbox";
import { inboxFetch } from "@/lib/channels/requests";

/** POST { projectId, channel }: reads X mentions or Instagram comments into Replies and comments. Read only. */
export const POST = route(async (req: Request) => {
  const b = await body(req, inboxFetch);
  await requireProject(b.projectId);
  return NextResponse.json(await fetchInbox(b.projectId, b.channel));
});
