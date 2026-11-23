import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api/route";
import { clientAddress, throttleOpenForm } from "@/lib/auth";
import { AccessRequestDetails } from "@/lib/accessRequests/shared";
import { addRequestDetails } from "@/lib/accessRequests/places";
import { backToPage, errorCode, isFormPost, readEither } from "@/lib/accessRequests/noScript";

/** More room than the request itself: a person may correct a field once or twice. */
const DETAILS_FREE_TRIES = 8;

/**
 * Open: the confirmation step after an early-access request. Adds the optional name, company and plan to the request
 * the token belongs to (the token came in that request's answer, or in the confirmation page's cookie without
 * script; only its hash is stored, and it lapses after a day). Throttled per address like the request form. A
 * token that is unknown or has lapsed answers 410, so this cannot be used to learn anything about other requests.
 */
export const POST = route.open(
  async (req: Request) => {
    const plain = isFormPost(req);
    try {
      const gate = await throttleOpenForm("access-details", clientAddress(req), DETAILS_FREE_TRIES);
      if (!gate.ok) throw new HttpError(429, "Too many tries from here. Wait a few minutes.", undefined, { "retry-after": String(gate.retryAfterSeconds) });
      const v = await readEither(req, AccessRequestDetails);
      await addRequestDetails(v.token, { name: v.name, company: v.company, level: v.level });
      if (plain) return backToPage(req, { query: { saved: "1" } });
      return NextResponse.json({ ok: true, message: "Thank you. Your details are saved with your request." }, { headers: { "cache-control": "no-store" } });
    } catch (e) {
      if (plain) return backToPage(req, { query: { e: errorCode(e) } });
      throw e;
    }
  },
  { maxBodyBytes: 4 * 1024 }
);
