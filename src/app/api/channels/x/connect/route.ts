import { NextResponse } from "next/server";
import { requirePlatformAdminUnderNewSignIn } from "@/lib/admin/guard";
import { route, sessionOf } from "@/lib/api/route";
import { audit } from "@/lib/db";
import { browserOrigin, startXSignIn } from "@/lib/channels/x";

/** POST: starts "Connect X account" (OAuth 2.0 with PKCE) and answers the X page to open. No secret is in the answer. */
export const POST = route(async (req: Request) => {
  // Saves install-wide credentials or settings: the platform administrator's while the new sign-in is on (cut-over B3).
  await requirePlatformAdminUnderNewSignIn(req);
  const s = sessionOf(req);
  const { url, redirectUri } = await startXSignIn(String(s.sessionId), browserOrigin(req));
  await audit({ action: "channel.x.connect-started", summary: "Started connecting an X account", detail: { redirectUri } });
  return NextResponse.json({ url, redirectUri });
});
