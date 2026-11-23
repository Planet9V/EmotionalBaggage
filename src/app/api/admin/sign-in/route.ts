import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, isPlatformAdmin } from "@/lib/admin/guard";
import { signInStatus } from "@/lib/admin/signIn";
import { body, HttpError, sessionOf } from "@/lib/api/route";
import { AUTH2_SETTING, forgetAuth2Switch, writeAuth2Setting } from "@/lib/auth2/config";
import { audit, ownerPool, ownerTx } from "@/lib/db";

/** The new sign-in's switch and addresses. Its details are the platform administrator's once it is on. */
export const GET = adminRoute(async (req: Request) => NextResponse.json(await signInStatus({ platformAdmin: await isPlatformAdmin(req) })));

const change = z
  .object({
    /** turn the new sign-in off (or on again); first turned on from inside the container */
    enabled: z.boolean().optional(),
    baseURL: z.string().max(2000).nullable().optional(),
    trustedOrigins: z.array(z.string().max(2000)).max(20).optional(),
    /** the account rules (src/lib/auth2/rules.ts), each checked against its bounds there */
    rules: z
      .object({
        inviteExpiryDays: z.number().optional(),
        maxFailures: z.number().optional(),
        lockMinutes: z.number().optional(),
        password: z
          .object({ minLength: z.number().optional(), upper: z.boolean().optional(), lower: z.boolean().optional(), digit: z.boolean().optional(), symbol: z.boolean().optional(), notEmailOrName: z.boolean().optional(), notCommon: z.boolean().optional() })
          .strict()
          .optional(),
        notifySignupRequestsTo: z.string().max(254).optional(),
        signUpOpen: z.boolean().optional(),
        viewAsMinutes: z.number().optional(),
        viewAsNotifyUser: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "nothing to change" });

/** A refusal of src/lib/auth2/adminOps.ts (Better Auth's APIError) as the same sentence and code, with its status. */
async function refusalAsHttp(run: () => Promise<void>) {
  try {
    await run();
  } catch (e) {
    const { APIError } = await import("better-auth/api");
    if (!(e instanceof APIError)) throw e;
    const b = e.body as { code?: string; message?: string } | undefined;
    throw new HttpError(e.statusCode, b?.message ?? "The change was refused.", b?.code ? { code: b.code } : undefined);
  }
}

/** Platform administrator only. Addresses go through adminOps().setAddresses (checked and audited there). */
export const PUT = adminRoute(
  async (req: Request) => {
    const b = await body(req, change);
    const s = sessionOf(req);
    if (b.baseURL !== undefined || b.trustedOrigins !== undefined) {
      const [{ adminOps }, { auth2 }, { resolveAuth2Config }] = await Promise.all([import("@/lib/auth2/adminOps"), import("@/lib/auth2/server"), import("@/lib/auth2/config")]);
      const config = await resolveAuth2Config(ownerPool());
      // The request's own Origin: a new address must be it, and it must stay trusted (cut-over review F2).
      const ops = adminOps({ db: ownerPool(), auth: await auth2(), actorId: String(s.userId), baseURL: config.baseURL ?? "" });
      await refusalAsHttp(() => ops.setAddresses({ baseURL: b.baseURL, trustedOrigins: b.trustedOrigins, requestOrigin: req.headers.get("origin") ?? "" }));
    }
    if (b.rules) {
      const rules = b.rules;
      const { writeRules } = await import("@/lib/auth2/rules");
      await refusalAsHttp(async () => {
        await ownerTx((c) => writeRules(c, rules, s.username));
      });
    }
    if (b.enabled !== undefined) {
      const enabled = b.enabled;
      // Turning it on ends every session of the old sign-in (cut-over review F3), in the same transaction.
      const ended = await ownerTx(async (c) => {
        await writeAuth2Setting(c, AUTH2_SETTING.enabled, enabled, s.username);
        return enabled ? ((await c.query("DELETE FROM sessions")).rowCount ?? 0) : 0;
      });
      forgetAuth2Switch(); // after the commit, so no request caches the value from before it
      await audit({ action: "auth2.switch", summary: `Turned the new sign-in ${enabled ? "on" : "off"} in Admin, Sign-in`, detail: { enabled, ...(enabled ? { oldSessionsEnded: ended } : {}) } });
    }
    return NextResponse.json(await signInStatus({ platformAdmin: await isPlatformAdmin(req) }));
  },
  { platformAdmin: true }
);
