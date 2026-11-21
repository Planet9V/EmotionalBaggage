import { NextResponse } from "next/server";
import { z } from "zod";
import { logEventIn, tx } from "@/lib/db";
import { body, notFound, recordId, requireProject, route } from "@/lib/api/route";

type Ctx = { params: Promise<{ id: string; linkId: string }> };

/** Turns a link's short address off or on. A disabled link answers 404 and counts nothing. */
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const { id, linkId } = await params;
  await requireProject(id);
  const lid = recordId(linkId, "That link");
  const b = await body(req, z.object({ disabled: z.boolean() }));
  await tx(async (c) => {
    const was = (await c.query<{ disabled: boolean }>("SELECT disabled FROM tracked_links WHERE id=$1 AND project_id=$2 FOR UPDATE", [lid, id])).rows[0];
    if (!was) throw notFound("That link");
    await c.query("UPDATE tracked_links SET disabled=$3 WHERE id=$1 AND project_id=$2", [lid, id, b.disabled]);
    await logEventIn(c, id, "campaign.link", `${b.disabled ? "Turned off" : "Turned on"} a tracked link`, { linkId: lid, disabled: b.disabled, before: { disabled: was.disabled }, after: { disabled: b.disabled } });
  });
  return NextResponse.json({ id: lid, disabled: b.disabled });
});

/** Deletes a link and its click counts. The short address stops working at once. */
export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { id, linkId } = await params;
  await requireProject(id);
  const lid = recordId(linkId, "That link");
  await tx(async (c) => {
    const r = await c.query<{ destination: string; code: string | null; campaign_id: string; creative_id: string | null; utm_content: string }>(
      "DELETE FROM tracked_links WHERE id=$1 AND project_id=$2 RETURNING destination, code, campaign_id, creative_id, utm_content",
      [lid, id]
    );
    if (!r.rows.length) throw notFound("That link");
    const x = r.rows[0];
    await logEventIn(c, id, "campaign.link", "Deleted a tracked link", { linkId: lid, before: { destination: x.destination, code: x.code, campaignId: Number(x.campaign_id), creativeId: x.creative_id === null ? null : Number(x.creative_id), utmContent: x.utm_content }, after: null });
  });
  return NextResponse.json({ ok: true });
});
