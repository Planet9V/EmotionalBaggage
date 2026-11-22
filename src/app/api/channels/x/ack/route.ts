import { NextResponse } from "next/server";
import { requirePlatformAdminUnderNewSignIn } from "@/lib/admin/guard";
import { body, HttpError, route } from "@/lib/api/route";
import { acknowledgeXCost } from "@/lib/channels/inbox";
import { ackBody } from "@/lib/channels/requests";
import { X_COST_STATEMENT } from "@/lib/channels/xCost";

/** POST { version, read: true }: records that the user read the current X cost statement (audit log). */
export const POST = route(async (req: Request) => {
  // Saves install-wide credentials or settings: the platform administrator's while the new sign-in is on (cut-over B3).
  await requirePlatformAdminUnderNewSignIn(req);
  const b = await body(req, ackBody);
  if (b.version !== X_COST_STATEMENT.version) throw new HttpError(409, "The cost statement changed since the page was opened. Read the new one.");
  return NextResponse.json(await acknowledgeXCost());
});
