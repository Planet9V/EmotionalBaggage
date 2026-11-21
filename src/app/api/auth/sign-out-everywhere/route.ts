import { NextResponse } from "next/server";
import { audit } from "@/lib/db";
import { route, sessionOf } from "@/lib/api/route";
import { clearedSessionCookie, signOutEverywhere } from "@/lib/auth";

/** Ends every session of the signed-in user, in every browser, this one included, and clears this browser's cookie. */
export const POST = route(async (req: Request) => {
  const s = sessionOf(req);
  const ended = await signOutEverywhere(s.userId);
  await audit({ action: "session.ended.everywhere", summary: `${s.username} signed out everywhere (${ended} session${ended === 1 ? "" : "s"})`, detail: { sessions: ended } });
  return NextResponse.json({ ok: true, ended }, { headers: { "set-cookie": clearedSessionCookie(req), "cache-control": "no-store" } });
});
