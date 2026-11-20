import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { q } from "@/lib/db";

/**
 * Open: the container health check calls this without a session. It says only whether the app can
 * read its database, and nothing about what is in it.
 */
export const GET = route.open(async () => {
  try {
    await q("SELECT 1");
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
});
