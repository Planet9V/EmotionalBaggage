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
    const r = await c.query("UPDATE tracked_links SET disabled=$3 WHERE id=$1 AND project_id=$2 RETURNING id", [lid, id, b.disabled]);
    if (!r.rows.length) throw notFound("That link");
    await logEventIn(c, id, "campaign.link", `${b.disabled ? "Turned off" : "Turned on"} a tracked link`, { linkId: lid, disabled: b.disabled });
  });
  return NextResponse.json({ id: lid, disabled: b.disabled });
});

/** Deletes a link and its click counts. The short address stops working at once. */
export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { id, linkId } = await params;
  await requireProject(id);
  const lid = recordId(linkId, "That link");
  await tx(async (c) => {
    const r = await c.query("DELETE FROM tracked_links WHERE id=$1 AND project_id=$2 RETURNING id", [lid, id]);
    if (!r.rows.length) throw notFound("That link");
    await logEventIn(c, id, "campaign.link", "Deleted a tracked link", { linkId: lid });
  });
  return NextResponse.json({ ok: true });
});
