import { NextResponse } from "next/server";
import { HttpError, route, sessionOf } from "@/lib/api/route";
import { audit } from "@/lib/db";
import { finishXSignIn, takePending } from "@/lib/channels/x";

const back = (req: Request, outcome: string) => NextResponse.redirect(new URL(`/admin?tab=credentials&x=${outcome}#x`, req.url), 303);

/**
 * GET ?code&state (or ?error): where X sends the browser back. The state must be one this session
 * started in the last ten minutes, used once; anything else is refused and nothing is saved. Tokens
 * go to the credentials table; the browser is sent back to Admin with only "connected" or a reason word.
 */
export const GET = route(async (req: Request) => {
  const s = sessionOf(req);
  const p = new URL(req.url).searchParams;
  const state = p.get("state") ?? "";
  let pending: ReturnType<typeof takePending>;
  try {
    if (!state || state.length > 500) throw new HttpError(400, "no valid state");
    pending = takePending(state, String(s.sessionId));
  } catch (e) {
    // A state this session did not start (or already used, or expired): refused, nothing exchanged or saved.
    await audit({ action: "channel.x.connect-refused", summary: "Refused an answer from X whose state did not match a sign-in started here", detail: { why: e instanceof Error ? e.message.slice(0, 200) : "state" } });
    return back(req, "state");
  }
  const error = p.get("error");
  if (error) {
    await audit({ action: "channel.x.connect-refused", summary: "Connecting an X account was cancelled or refused on X", detail: { error: error.slice(0, 80) } });
    return back(req, "refused");
  }
  const code = p.get("code");
  if (!code || code.length > 2000) throw new HttpError(400, "The answer from X has no code. Start connecting again from Admin.");
  try {
    const acct = await finishXSignIn(code, pending);
    await audit({ action: "channel.x.connected", summary: `Connected the X account @${acct.username || "unknown"}`, detail: { username: acct.username, scope: acct.scope } });
    return back(req, "connected");
  } catch (e) {
    await audit({ action: "channel.x.connect-failed", summary: "Connecting an X account failed", detail: { message: e instanceof Error ? e.message.slice(0, 300) : "failed" } });
    return back(req, "failed");
  }
});
