import { NextResponse } from "next/server";
import { requirePlatformAdminUnderNewSignIn } from "@/lib/admin/guard";
import { body, HttpError, route } from "@/lib/api/route";
import { currentActor } from "@/lib/actor";
import { audit } from "@/lib/db";
import { setSetting } from "@/lib/settings";
import { IG_CHECKLIST } from "@/lib/channels/igChecklist";
import { reviewTicks } from "@/lib/channels/requests";
import { igReview, IG_REVIEW } from "@/lib/channels/state";

/** GET: the Meta App Review checklist and its ticks. PUT { ticks }: saves the ticks (audit log). */
export const GET = route(async (req: Request) => {
  // Part of Admin, Channels and install-wide: the platform administrator's while the new sign-in is on (cut-over B3).
  await requirePlatformAdminUnderNewSignIn(req);
  return NextResponse.json({ items: IG_CHECKLIST, ...(await igReview()) });
});

export const PUT = route(async (req: Request) => {
  await requirePlatformAdminUnderNewSignIn(req);
  const b = await body(req, reviewTicks);
  const known = new Set(IG_CHECKLIST.map((i) => i.key));
  const unknown = Object.keys(b.ticks).filter((k) => !known.has(k));
  if (unknown.length) throw new HttpError(400, `Not checklist items: ${unknown.join(", ")}.`);
  const before = await igReview();
  const next = { ticks: { ...before.ticks, ...b.ticks }, updatedAt: new Date().toISOString(), by: currentActor() || null };
  await setSetting(IG_REVIEW, next);
  await audit({ action: "channel.instagram.review-checklist", summary: "Updated the Meta App Review checklist", detail: { before: before.ticks, after: next.ticks } });
  return NextResponse.json({ items: IG_CHECKLIST, ...next });
});
