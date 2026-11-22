import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute, isPlatformAdmin } from "@/lib/admin/guard";
import { signInStatus } from "@/lib/admin/signIn";
import { body, sessionOf } from "@/lib/api/route";
import { AUTH2_SETTING, writeAuth2Setting } from "@/lib/auth2/config";
import { audit, ownerPool } from "@/lib/db";

/** The new sign-in's switch and addresses. Its details are the platform administrator's once it is on. */
export const GET = adminRoute(async (req: Request) => NextResponse.json(await signInStatus({ platformAdmin: await isPlatformAdmin(req) })));

const change = z
  .object({
    /** turn the new sign-in off (or on again); first turned on from inside the container */
    enabled: z.boolean().optional(),
    baseURL: z.string().max(2000).nullable().optional(),
    trustedOrigins: z.array(z.string().max(2000)).max(20).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "nothing to change" });

/** Platform administrator only. Addresses go through adminOps().setAddresses (checked and audited there). */
export const PUT = adminRoute(
  async (req: Request) => {
    const b = await body(req, change);
    const s = sessionOf(req);
    if (b.baseURL !== undefined || b.trustedOrigins !== undefined) {
      const [{ adminOps }, { auth2 }, { resolveAuth2Config }] = await Promise.all([import("@/lib/auth2/adminOps"), import("@/lib/auth2/server"), import("@/lib/auth2/config")]);
      const config = await resolveAuth2Config(ownerPool());
      await adminOps({ db: ownerPool(), auth: await auth2(), actorId: String(s.userId), baseURL: config.baseURL ?? "" }).setAddresses({ baseURL: b.baseURL, trustedOrigins: b.trustedOrigins });
    }
    if (b.enabled !== undefined) {
      await writeAuth2Setting(ownerPool(), AUTH2_SETTING.enabled, b.enabled, s.username);
      await audit({ action: "auth2.switch", summary: `Turned the new sign-in ${b.enabled ? "on" : "off"} in Admin, Sign-in`, detail: { enabled: b.enabled } });
    }
    return NextResponse.json(await signInStatus({ platformAdmin: await isPlatformAdmin(req) }));
  },
  { platformAdmin: true }
);
