import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute } from "@/lib/admin/guard";
import { opsFor, refusalAsHttp } from "@/lib/admin/people";
import { body, HttpError } from "@/lib/api/route";

type Ctx = { params: Promise<{ id: string }> };
const NO_STORE = { "cache-control": "no-store" };
const role = z.enum(["owner", "admin", "member"]);
const member = z.string().min(1).max(100);

/** One workspace with its members. */
export const GET = adminRoute(
  async (req: Request, { params }: Ctx) => {
    const ops = await opsFor(req);
    const id = (await params).id;
    return NextResponse.json(await refusalAsHttp(() => ops.organization(id)), { headers: NO_STORE });
  },
  { platformAdmin: true }
);

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), name: z.string().max(400) }).strict(),
  z.object({ action: z.literal("add"), userId: member, role }).strict(),
  z.object({ action: z.literal("role"), memberId: member, role }).strict(),
  z.object({ action: z.literal("remove"), memberId: member }).strict(),
  z.object({ action: z.literal("transfer"), memberId: member }).strict(),
  z.object({ action: z.literal("two-factor"), on: z.boolean() }).strict(),
  z.object({ action: z.literal("delete"), confirmName: z.string().max(400) }).strict(),
]);

/** One change to one workspace; each is a function of src/lib/auth2/adminOps.ts, which checks and audits it. */
export const POST = adminRoute(
  async (req: Request, { params }: Ctx) => {
    const id = (await params).id;
    const b = await body(req, Action);
    const ops = await opsFor(req);
    await refusalAsHttp(async (): Promise<unknown> => {
      switch (b.action) {
        case "rename": return ops.renameOrganization(id, b.name);
        case "add": return ops.addMember(id, b.userId, b.role);
        case "role": return ops.changeMemberRole(id, b.memberId, b.role);
        case "remove": return ops.removeMember(id, b.memberId);
        case "transfer": return ops.transferOwnership(id, b.memberId);
        case "two-factor": return ops.setOrganizationTwoFactor(id, b.on);
        case "delete": {
          // The name typed again, as the confirmation.
          const { workspace } = await ops.organization(id);
          if (b.confirmName !== workspace.name) throw new HttpError(400, `Type the name "${workspace.name}" exactly to delete this workspace.`, { code: "CONFIRM_NAME_MISMATCH" });
          return ops.deleteOrganization(id);
        }
      }
    });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  },
  { platformAdmin: true }
);
