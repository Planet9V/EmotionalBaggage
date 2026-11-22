import { NextResponse } from "next/server";
import { adminRoute, isPlatformAdmin } from "@/lib/admin/guard";
import { serviceOverview } from "@/lib/admin/overview";

/** Every outside service: configured, not configured or failing, last checked, its source and what is off without it. */
export const GET = adminRoute(async (req: Request) => NextResponse.json({ services: await serviceOverview({ platformAdmin: await isPlatformAdmin(req) }) }));
