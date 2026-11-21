import { NextResponse } from "next/server";
import { body, HttpError, notFound, requireProject, route } from "@/lib/api/route";
import { ITEM_COLS, logEventIn, toItem, tx, type ItemRow } from "@/lib/db";
import { publicImageProblem } from "@/lib/channels/instagram";
import { imageBody } from "@/lib/channels/requests";
import { CHANNEL } from "@/lib/channels/schemas";
import { checkAddress } from "@/lib/net/outbound";

/** POST { projectId, itemId, imageUrl, altText? }: the public JPEG address Instagram will fetch for this post. Empty clears it. */
export const POST = route(async (req: Request) => {
  const b = await body(req, imageBody);
  await requireProject(b.projectId);
  if (b.imageUrl) {
    const problem = publicImageProblem(b.imageUrl);
    if (problem) throw new HttpError(400, problem);
    // the shared outbound rule, after resolving the name (src/lib/net/outbound.ts)
    const refused = await checkAddress(b.imageUrl);
    if (refused) throw new HttpError(400, `The image address is not allowed: ${refused}.`);
  }
  const item = await tx(async (c) => {
    const r = await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 AND project_id=$2 AND section=$3 FOR UPDATE`, [b.itemId, b.projectId, CHANNEL.social]);
    if (!r.rows[0]) throw notFound("That post");
    const before = r.rows[0].data;
    if (before.sent) throw new HttpError(409, "This post was already sent.");
    const patch: Record<string, unknown> = { publicImageUrl: b.imageUrl };
    if (b.altText !== undefined) patch.altText = b.altText;
    const u = await c.query<ItemRow>(`UPDATE items SET data = data || $2::jsonb, updated_at=now() WHERE id=$1 RETURNING ${ITEM_COLS}`, [b.itemId, JSON.stringify(patch)]);
    await logEventIn(c, b.projectId, "item.updated", `Set the Instagram image address of "${r.rows[0].title}"`, { itemId: b.itemId, before: { publicImageUrl: before.publicImageUrl ?? null }, after: patch });
    return toItem(u.rows[0]);
  });
  return NextResponse.json(item);
});
