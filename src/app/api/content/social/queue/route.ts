import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { socialChannel } from "@/lib/content/channels";
import { projectOf } from "@/lib/content/http";
import { rowsOf } from "@/lib/content/load";
import { CONTENT } from "@/lib/content/schemas";

/**
 * What the posting code reads: posts that are approved or scheduled, with their channel, text, media and date.
 * This app only sets the status; posting and marking a post posted belong to the channel connection.
 */
export const GET = route(async (req: Request) => {
  const p = await projectOf(req);
  const posts = (await rowsOf(p.id, CONTENT.social))
    .filter((r) => r.status === "approved" || r.status === "scheduled")
    .map((r) => ({
      id: r.id,
      status: r.status,
      channel: String(r.data.channel ?? ""),
      channelLabel: socialChannel(String(r.data.channel ?? ""))?.label ?? "",
      title: typeof r.data.postTitle === "string" ? r.data.postTitle : "",
      text: r.body,
      mediaShotKeys: Array.isArray(r.data.mediaShotKeys) ? r.data.mediaShotKeys : [],
      scheduledAt: typeof r.data.scheduledAt === "string" ? r.data.scheduledAt : null,
    }))
    .sort((a, b) => (a.scheduledAt ?? "9").localeCompare(b.scheduledAt ?? "9") || a.id - b.id);
  return NextResponse.json({ posts });
});
