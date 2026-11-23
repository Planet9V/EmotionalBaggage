import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute } from "@/lib/admin/guard";
import { opsFor, refusalAsHttp } from "@/lib/admin/people";
import { body } from "@/lib/api/route";

type Ctx = { params: Promise<{ id: string }> };
const Action = z.object({ action: z.enum(["resend", "revoke"]) }).strict();

/** Sends an account invitation again (a new link, a fresh expiry) or revokes it. A link without mail is shown once. */
export const POST = adminRoute(
  async (req: Request, { params }: Ctx) => {
    const id = (await params).id;
    const { action } = await body(req, Action);
    const ops = await opsFor(req);
    const r = await refusalAsHttp(async () => (action === "resend" ? ops.resendInvitation(id) : (await ops.revokeInvitation(id), {})));
    return NextResponse.json({ ok: true, ...r }, { headers: { "cache-control": "no-store" } });
  },
  { platformAdmin: true }
);
