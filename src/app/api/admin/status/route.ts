import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { firstRunStatus } from "@/lib/admin/status";

/** What is and is not configured yet, for the first-run screen. */
export const GET = route(async () => NextResponse.json(await firstRunStatus()));
