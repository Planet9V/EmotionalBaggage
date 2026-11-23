import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin/guard";
import { opsFor, refusalAsHttp } from "@/lib/admin/people";

/** Admin, Users: account invitations (?status=pending|accepted|expired|revoked). */
export const GET = adminRoute(
  async (req: Request) => {
    const s = new URL(req.url).searchParams.get("status");
    const status = s === "pending" || s === "accepted" || s === "expired" || s === "revoked" ? s : undefined;
    const ops = await opsFor(req);
    return NextResponse.json({ invitations: await refusalAsHttp(() => ops.listInvitations(status)) }, { headers: { "cache-control": "no-store" } });
  },
  { platformAdmin: true }
);
