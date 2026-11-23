import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoute } from "@/lib/admin/guard";
import { opsFor, refusalAsHttp } from "@/lib/admin/people";
import { body } from "@/lib/api/route";

const NO_STORE = { "cache-control": "no-store" };

/** Admin, Workspaces: every workspace (?q searches its name and its members). */
export const GET = adminRoute(
  async (req: Request) => {
    const ops = await opsFor(req);
    const q = new URL(req.url).searchParams.get("q") ?? undefined;
    return NextResponse.json({ workspaces: await refusalAsHttp(() => ops.listOrganizations(q)) }, { headers: NO_STORE });
  },
  { platformAdmin: true }
);

const Create = z.object({ name: z.string().max(400), ownerUserId: z.string().max(100) }).strict();

/** Makes a workspace with the chosen account as its owner. */
export const POST = adminRoute(
  async (req: Request) => {
    const b = await body(req, Create);
    const ops = await opsFor(req);
    return NextResponse.json(await refusalAsHttp(() => ops.createOrganization(b.name, b.ownerUserId)), { status: 201, headers: NO_STORE });
  },
  { platformAdmin: true }
);
