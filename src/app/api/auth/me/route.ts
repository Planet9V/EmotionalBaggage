import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { sessionFromRequest } from "@/lib/auth";

/** Open: answers who is signed in, or `{ user: null }`. */
export const GET = route.open(async (req: Request) => {
  const s = await sessionFromRequest(req);
  return NextResponse.json(
    { user: s ? { username: s.username, usingDefaultPassword: s.usingDefaultPassword } : null },
    { headers: { "cache-control": "no-store" } }
  );
});
