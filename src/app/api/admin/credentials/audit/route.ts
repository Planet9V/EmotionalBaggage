import { adminRoute, isPlatformAdmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";
import { readAudit } from "@/lib/admin/audit";

/** The most recent 200 saves, removals and tests, newest first. Never a value; addresses of the new providers only for the platform administrator. */
export const GET = adminRoute(async (req: Request) => NextResponse.json({ entries: await readAudit({ platformAdmin: await isPlatformAdmin(req) }) }));
