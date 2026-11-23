import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute } from "@/lib/admin/guard";
import { opsFor, refusalAsHttp } from "@/lib/admin/people";
import { body, sessionOf } from "@/lib/api/route";

const NO_STORE = { "cache-control": "no-store" };

/** Admin, Users: accounts with their state (?q, ?role=member|admin, ?state=active|invited|disabled|locked|reset, ?page). */
export const GET = adminRoute(
  async (req: Request) => {
    const u = new URL(req.url).searchParams;
    const role = u.get("role");
    const state = u.get("state");
    const ops = await opsFor(req);
    const page = await refusalAsHttp(() =>
      ops.listUsers({
        q: u.get("q") ?? undefined,
        role: role === "admin" || role === "member" ? role : undefined,
        state: state === "active" || state === "invited" || state === "disabled" || state === "locked" || state === "reset" ? state : undefined,
        page: Number(u.get("page") ?? 1) || 1,
        pageSize: Number(u.get("pageSize") ?? 25) || 25,
      })
    );
    // `me`: the acting administrator, so the screen can say "your own account" (the server refuses the rest anyway).
    return NextResponse.json({ ...page, me: sessionOf(req).userId }, { headers: NO_STORE });
  },
  { platformAdmin: true }
);

const Create = z
  .object({
    name: z.string().max(400),
    email: z.string().max(320),
    platformAdmin: z.boolean().optional(),
    /** "invite": an emailed (or handed-over) link; "password": a temporary password the administrator typed */
    how: z.enum(["invite", "password"]),
    password: z.string().max(400).optional(),
    markVerified: z.boolean().optional(),
    /** the acting administrator's own password, for making a platform administrator */
    stepUp: z.string().max(400).optional(),
  })
  .strict();

/** Creates an account. The temporary password goes from this body to the hash and nowhere else. */
export const POST = adminRoute(
  async (req: Request) => {
    const b = await body(req, Create);
    const ops = await opsFor(req, b.stepUp);
    const made = await refusalAsHttp(() =>
      ops.createUser(b.how === "invite" ? { email: b.email, name: b.name, platformAdmin: b.platformAdmin, invite: true } : { email: b.email, name: b.name, platformAdmin: b.platformAdmin, password: b.password ?? "", confirmed: b.markVerified === true })
    );
    return NextResponse.json(made, { status: 201, headers: NO_STORE });
  },
  { platformAdmin: true, maxBodyBytes: 16 * 1024 }
);
