import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute } from "@/lib/admin/guard";
import { opsFor, refusalAsHttp } from "@/lib/admin/people";
import { body } from "@/lib/api/route";

type Ctx = { params: Promise<{ id: string }> };
const NO_STORE = { "cache-control": "no-store" };
const stepUp = z.string().max(400).optional();

/** One change to one account. Each is a function of src/lib/auth2/adminOps.ts, which checks and audits it. */
const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), name: z.string().max(400), stepUp }).strict(),
  z.object({ action: z.literal("email"), email: z.string().max(320), markVerified: z.boolean().optional(), stepUp }).strict(),
  z.object({ action: z.literal("confirm"), stepUp }).strict(),
  z.object({ action: z.literal("admin"), on: z.boolean(), stepUp }).strict(),
  z.object({ action: z.literal("disabled"), on: z.boolean(), stepUp }).strict(),
  z.object({ action: z.literal("unlock"), stepUp }).strict(),
  z.object({ action: z.literal("password"), password: z.string().max(400), stepUp }).strict(),
  z.object({ action: z.literal("reset-link"), stepUp }).strict(),
  z.object({ action: z.literal("two-factor-required"), on: z.boolean(), stepUp }).strict(),
  z.object({ action: z.literal("two-factor-reset"), stepUp }).strict(),
  z.object({ action: z.literal("two-factor-off"), stepUp }).strict(),
  z.object({ action: z.literal("end-sessions"), stepUp }).strict(),
  z.object({ action: z.literal("invite-again"), stepUp }).strict(),
]);

export const POST = adminRoute(
  async (req: Request, { params }: Ctx) => {
    const id = (await params).id;
    const b = await body(req, Action);
    const ops = await opsFor(req, b.stepUp);
    const result = await refusalAsHttp(async (): Promise<unknown> => {
      switch (b.action) {
        case "rename": return ops.updateName(id, b.name);
        case "email": return ops.changeEmail(id, b.email, { markVerified: b.markVerified });
        case "confirm": return ops.confirmEmail(id);
        case "admin": return ops.setPlatformAdmin(id, b.on);
        case "disabled": return ops.setDisabled(id, b.on);
        case "unlock": return ops.unlock(id);
        case "password": return ops.setPassword(id, b.password);
        case "reset-link": return ops.sendResetLink(id);
        case "two-factor-required": return ops.setTwoFactorRequired(id, b.on);
        // The one-time code is shown once to the administrator, to hand to the person (/auth/re-enrol).
        case "two-factor-reset": return ops.resetTwoFactor(id);
        case "two-factor-off": return ops.disableTwoFactor(id);
        case "end-sessions": return ops.endAllSessions(id);
        case "invite-again": return ops.inviteAgain(id);
      }
    });
    return NextResponse.json({ ok: true, ...(result && typeof result === "object" ? result : {}) }, { headers: NO_STORE });
  },
  { platformAdmin: true, maxBodyBytes: 16 * 1024 }
);

const Delete = z
  .object({
    /** the address typed again, as the confirmation */
    confirmEmail: z.string().max(320),
    /** workspace id -> the member who becomes its owner */
    transfer: z.record(z.string().max(100), z.string().max(100)).optional(),
    deleteWorkspaces: z.boolean().optional(),
    stepUp,
  })
  .strict();

/** Deletes an account after the address is typed again (src/lib/auth2/adminOps.ts deleteUser for what goes with it). */
export const DELETE = adminRoute(
  async (req: Request, { params }: Ctx) => {
    const id = (await params).id;
    const b = await body(req, Delete);
    const ops = await opsFor(req, b.stepUp);
    await refusalAsHttp(() => ops.deleteUser(id, { transfer: b.transfer, deleteWorkspaces: b.deleteWorkspaces, confirmEmail: b.confirmEmail }));
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  },
  { platformAdmin: true, maxBodyBytes: 16 * 1024 }
);
