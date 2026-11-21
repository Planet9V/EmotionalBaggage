import { NextResponse } from "next/server";
import { route, sessionOf } from "@/lib/api/route";
import { audit } from "@/lib/db";
import { startXSignIn } from "@/lib/channels/x";

/** POST: starts "Connect X account" (OAuth 2.0 with PKCE) and answers the X page to open. No secret is in the answer. */
export const POST = route(async (req: Request) => {
  const s = sessionOf(req);
  const { url, redirectUri } = await startXSignIn(String(s.sessionId), new URL(req.url).origin);
  await audit({ action: "channel.x.connect-started", summary: "Started connecting an X account", detail: { redirectUri } });
  return NextResponse.json({ url, redirectUri });
});
