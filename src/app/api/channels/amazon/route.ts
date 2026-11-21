import { NextResponse } from "next/server";
import { body, HttpError, requireProject, route } from "@/lib/api/route";
import { logEvent } from "@/lib/db";
import { marketplace } from "@/lib/channels/amazon";
import { amazonPut } from "@/lib/channels/requests";
import { amazonState, saveAmazonState } from "@/lib/channels/state";

/** PUT { projectId, marketplaceId }: the Amazon marketplace the sales monitor reads for this concept. */
export const PUT = route(async (req: Request) => {
  const b = await body(req, amazonPut);
  await requireProject(b.projectId);
  const m = marketplace(b.marketplaceId);
  if (!m) throw new HttpError(400, "That is not an Amazon marketplace this app knows.");
  const st = await amazonState(b.projectId);
  if (st.marketplaceId !== m.id) {
    // A different marketplace starts again from the first-sync window; rows already imported stay.
    await saveAmazonState(b.projectId, { ...st, marketplaceId: m.id, cursor: null, metrics: [] });
    await logEvent(b.projectId, "channel.amazon.marketplace", `Amazon marketplace for the sales monitor set to ${m.name}`, { before: st.marketplaceId, after: m.id });
  }
  return NextResponse.json({ ok: true, marketplaceId: m.id });
});
