import { NextResponse } from "next/server";
import { route, whoIsSignedIn } from "@/lib/api/route";

/** Open: answers who is signed in (the new sign-in's account while it is on), or `{ user: null }`. */
export const GET = route.open(async (req: Request) => {
  const user = await whoIsSignedIn(req);
  return NextResponse.json({ user }, { headers: { "cache-control": "no-store" } });
});
