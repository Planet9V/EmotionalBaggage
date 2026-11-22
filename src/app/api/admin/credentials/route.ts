import { adminRoute, isPlatformAdmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";
import { listCredentials } from "@/lib/admin/credentials";

/**
 * Every provider and field: set or not, where from, last four of long secrets, never a full secret. For the new
 * providers (src/lib/admin/guard.ts) anyone but the platform administrator sees only set or not set.
 */
export const GET = adminRoute(async (req: Request) => NextResponse.json({ providers: await listCredentials({ platformAdmin: await isPlatformAdmin(req) }) }));
