import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { readAudit } from "@/lib/admin/audit";

/** The most recent 200 saves, removals and tests, newest first. Never a value. */
export const GET = route(async () => NextResponse.json({ entries: await readAudit() }));
