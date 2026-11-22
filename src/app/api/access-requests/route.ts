import { NextResponse } from "next/server";
import { body, HttpError, route } from "@/lib/api/route";
import { clientAddress, throttleOpenForm } from "@/lib/auth";
import { ACCESS_CONFIRMATION, AccessRequestForm } from "@/lib/accessRequests/shared";
import { auditRefusedRequest, createAccessRequest, findRecentDuplicate } from "@/lib/accessRequests/store";

/**
 * The sign-in throttle's free count for this form. The try that goes past it is still let through but sets the
 * first wait, so five requests from one address go through at once and the sixth must wait 1 s, the next 2 s,
 * then 4 s and so on (at most 15 minutes). The count is forgotten after an hour with no request.
 */
const ACCESS_FREE_TRIES = 4;

/**
 * Open: the "Request your own workspace" form on /welcome is sent by a visitor who has no account.
 * The origin check in route() still applies, the body is capped at 16 KB, tries are throttled per network
 * address with the sign-in throttle, and a filled honeypot or a repeat of a request already kept is answered like a success and stored nowhere. Refusals are counted, not logged one by one.
 * No email is sent.
 */
export const POST = route.open(
  async (req: Request) => {
    const client = clientAddress(req);
    const gate = await throttleOpenForm("access-request", client, ACCESS_FREE_TRIES);
    if (!gate.ok) {
      await auditRefusedRequest("rate-limited", client);
      const secs = gate.retryAfterSeconds;
      const when = secs < 120 ? `${secs} second${secs === 1 ? "" : "s"}` : `${Math.ceil(secs / 60)} minutes`;
      throw new HttpError(429, `Too many requests from here. Try again in ${when}.`, undefined, { "retry-after": String(secs) });
    }
    const v = await body(req, AccessRequestForm);
    if (v.website.trim() !== "") {
      await auditRefusedRequest("honeypot", client);
      return NextResponse.json({ ok: true, message: ACCESS_CONFIRMATION }, { headers: { "cache-control": "no-store" } });
    }
    // the same request again is already with the owner: answered like the first, kept once, counted rather than audited each time
    const answers = { name: v.name, email: v.email, building: v.building, company: v.company, level: v.level };
    if ((await findRecentDuplicate(answers)) !== null) {
      await auditRefusedRequest("duplicate", client);
      return NextResponse.json({ ok: true, message: ACCESS_CONFIRMATION }, { headers: { "cache-control": "no-store" } });
    }
    await createAccessRequest(answers);
    return NextResponse.json({ ok: true, message: ACCESS_CONFIRMATION }, { status: 201, headers: { "cache-control": "no-store" } });
  },
  { maxBodyBytes: 16 * 1024, tooLarge: "This request is too large. Keep what you want to build under 2,000 characters." }
);
