import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { clearedSessionCookie, signOut, tokenFromRequest } from "@/lib/auth";

/** Open: signing out must work with an expired or unknown cookie too. It always clears the cookie. */
export const POST = route.open(async (req: Request) => {
  await signOut(tokenFromRequest(req));
  return NextResponse.json({ ok: true }, { headers: { "set-cookie": clearedSessionCookie(req), "cache-control": "no-store" } });
});
