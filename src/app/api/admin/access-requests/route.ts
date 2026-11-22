import { adminRoute, guardAccessRequests } from "@/lib/admin/guard";
import { NextResponse } from "next/server";
import { listAccessRequests } from "@/lib/accessRequests/store";

/** Every access request, newest first. The platform administrator's with the new sign-in on; with it off, refused while the account still uses the published demo password. */
export const GET = adminRoute(async (req: Request) => {
  await guardAccessRequests(req);
  return NextResponse.json({ requests: await listAccessRequests() }, { headers: { "cache-control": "no-store" } });
});
