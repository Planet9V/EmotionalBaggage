import { adminRoute, isPlatformAdmin, platformAdminOnly, requirePlatformAdmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";
import { body } from "@/lib/api/route";
import { runConnectionTest } from "@/lib/admin/connection";
import { connectionTest } from "@/lib/admin/schemas";

/** One cheap read-only call. A failed test is still 200, with ok false and the reason in plain words. */
export const POST = adminRoute(async (req: Request) => {
  const t = await body(req, connectionTest);
  // The new sections' tests send a saved key or password out, or send mail: platform administrator only.
  if (platformAdminOnly.test(t.kind)) await requirePlatformAdmin(req);
  // Only the platform administrator's tests are kept for the Overview and the short credentials list (review B5);
  // every test is still written to the install-wide audit log, as before.
  return NextResponse.json(await runConnectionTest(t, { record: await isPlatformAdmin(req) }));
});
