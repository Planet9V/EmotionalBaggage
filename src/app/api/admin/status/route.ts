import { adminRoute } from "@/lib/admin/guard";
import { NextResponse } from "next/server";
import { firstRunStatus } from "@/lib/admin/status";
import { defaultPasswordInUse } from "@/lib/auth";

/**
 * What is and is not configured yet, for the first-run screen. `defaultPassword` is true while any account
 * still has the published default password; it is not one of the items, so `complete` is about setup only.
 */
export const GET = adminRoute(async () => {
  const [status, defaultPassword] = await Promise.all([firstRunStatus(), defaultPasswordInUse()]);
  return NextResponse.json({ ...status, defaultPassword });
});
