import { adminRoute } from "@/lib/admin/guard";
import { NextResponse } from "next/server";
import { sessionOf } from "@/lib/api/route";
import { listAccessRequests, refuseWhileDefaultPassword } from "@/lib/accessRequests/store";

/** Every access request, newest first. Refused while the account still uses the published demo password. */
export const GET = adminRoute(async (req: Request) => {
  refuseWhileDefaultPassword(sessionOf(req).usingDefaultPassword);
  return NextResponse.json({ requests: await listAccessRequests() }, { headers: { "cache-control": "no-store" } });
});
