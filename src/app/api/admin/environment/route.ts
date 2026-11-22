import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin/guard";
import { environmentReport } from "@/lib/admin/environment";

/** Every environment variable the app reads: set or not, and what it does. Values only for addresses. */
export const GET = adminRoute(async () => NextResponse.json({ variables: environmentReport() }));
