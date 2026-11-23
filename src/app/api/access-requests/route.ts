import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api/route";
import { clientAddress, throttleOpenForm } from "@/lib/auth";
import { AccessRequestForm, outcomeMessage, type AccessRequestAnswer, type EarlyAccessOutcome } from "@/lib/accessRequests/shared";
import { auditRefusedRequest } from "@/lib/accessRequests/store";
import { claimEarlyAccess } from "@/lib/accessRequests/places";
import { sendEarlyAccessConfirmation } from "@/lib/accessRequests/confirmMail";
import { backToPage, errorCode, isFormPost, readEither } from "@/lib/accessRequests/noScript";

/**
 * The sign-in throttle's free count for this form. The try that goes past it is still let through but sets the
 * first wait, so five requests from one address go through at once and the sixth must wait 1 s, the next 2 s,
 * then 4 s and so on (at most 15 minutes). The count is forgotten after an hour with no request.
 */
const ACCESS_FREE_TRIES = 4;

const LISTED: EarlyAccessOutcome = { kind: "listed" };
const answer = (outcome: EarlyAccessOutcome, token?: string | null): AccessRequestAnswer => ({ ok: true, message: outcomeMessage(outcome), outcome, ...(token ? { token } : {}) });

/**
 * Open: the early-access form on /welcome ("Claim an early-access place"), sent by a visitor who has no account.
 * Email and "What do you want to make?" are required; name, company and plan are optional (and can be added on the
 * confirmation step, POST /api/access-requests/details, with the token in the answer). The request gets a place
 * up to the limit, then a place on the waiting list (src/lib/accessRequests/places.ts).
 *
 * The origin check in route() still applies, the body is capped at 16 KB, tries are throttled per network address
 * with the sign-in throttle, and a filled honeypot or an address already on the list is answered "you are on the
 * list" and stored nowhere. Refusals are counted, not logged one by one. A confirmation email goes out only when a
 * mail server is set up in Admin, Email, and never holds up the answer.
 *
 * Sent as JSON (with script) it answers JSON; sent as a plain form (without script) it answers a 303 to
 * /welcome/early, which shows the same outcome.
 */
export const POST = route.open(
  async (req: Request) => {
    const plain = isFormPost(req);
    const client = clientAddress(req);
    try {
      const gate = await throttleOpenForm("access-request", client, ACCESS_FREE_TRIES);
      if (!gate.ok) {
        await auditRefusedRequest("rate-limited", client);
        const secs = gate.retryAfterSeconds;
        const when = secs < 120 ? `${secs} second${secs === 1 ? "" : "s"}` : `${Math.ceil(secs / 60)} minutes`;
        throw new HttpError(429, `Too many requests from here. Try again in ${when}.`, undefined, { "retry-after": String(secs) });
      }
      const v = await readEither(req, AccessRequestForm);
      if (v.website.trim() !== "") {
        await auditRefusedRequest("honeypot", client);
        return plain ? backToPage(req, { query: { r: "listed" } }) : NextResponse.json(answer(LISTED), { headers: { "cache-control": "no-store" } });
      }
      const fields = { email: v.email, building: v.building, name: v.name, company: v.company, level: v.level, placement: v.placement };
      const claim = await claimEarlyAccess(fields);
      if (claim.outcome.kind === "listed") await auditRefusedRequest("duplicate", client);
      // after the answer is decided; a slow or absent mail server never holds it up
      if (claim.outcome.kind !== "listed") void sendEarlyAccessConfirmation(fields.email, claim.outcome);
      if (plain) return backToPage(req, claim.token ? { token: claim.token } : { query: { r: "listed" } });
      return NextResponse.json(answer(claim.outcome, claim.token), { status: claim.outcome.kind === "listed" ? 200 : 201, headers: { "cache-control": "no-store" } });
    } catch (e) {
      if (plain) return backToPage(req, { query: { e: errorCode(e) } });
      throw e;
    }
  },
  { maxBodyBytes: 16 * 1024, tooLarge: "This request is too large. Keep what you want to make under 2,000 characters." }
);
