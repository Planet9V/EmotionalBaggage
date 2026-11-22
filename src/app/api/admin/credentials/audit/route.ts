import { adminRoute } from "@/lib/admin/guard";
import { NextResponse } from "next/server";
import { readAudit } from "@/lib/admin/audit";

/** The most recent 200 saves, removals and tests, newest first. Never a value. */
export const GET = adminRoute(async () => NextResponse.json({ entries: await readAudit() }));
