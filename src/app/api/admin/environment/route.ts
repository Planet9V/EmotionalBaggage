import { NextResponse } from "next/server";
import { adminRoute, isPlatformAdmin } from "@/lib/admin/guard";
import { environmentReport } from "@/lib/admin/environment";

/** Every environment variable the app reads: set or not, and what it does. Address values only for the platform administrator (S8). */
export const GET = adminRoute(async (req: Request) => {
  const values = await isPlatformAdmin(req);
  return NextResponse.json({ variables: environmentReport().map((v) => (values ? v : { ...v, value: null })) });
});
