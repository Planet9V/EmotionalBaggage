import { adminRoute, requirePlatformAdmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";
import { body } from "@/lib/api/route";
import { runConnectionTest } from "@/lib/admin/connection";
import { connectionTest } from "@/lib/admin/schemas";

const SENDS_SECRET = new Set<string>(["stripe", "smtp", "mail-message", "voice"]);

/** One cheap read-only call. A failed test is still 200, with ok false and the reason in plain words. */
export const POST = adminRoute(async (req: Request) => {
  const t = await body(req, connectionTest);
  // The new sections' tests send a saved key or password to an outside service (or send mail): administrator only.
  if (SENDS_SECRET.has(t.kind)) requirePlatformAdmin(req);
  return NextResponse.json(await runConnectionTest(t));
});
