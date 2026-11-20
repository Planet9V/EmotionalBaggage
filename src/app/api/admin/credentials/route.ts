import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { listCredentials } from "@/lib/admin/credentials";

/** Every provider and field: set or not, where from, last four of long secrets, never a full secret. */
export const GET = route(async () => NextResponse.json({ providers: await listCredentials() }));
