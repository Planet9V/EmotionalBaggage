import { adminRoute } from "@/lib/admin/guard";
import { NextResponse } from "next/server";
import { listCredentials } from "@/lib/admin/credentials";

/** Every provider and field: set or not, where from, last four of long secrets, never a full secret. */
export const GET = adminRoute(async () => NextResponse.json({ providers: await listCredentials() }));
