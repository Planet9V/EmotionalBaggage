import { route } from "@/lib/api/route";
import { clientAddress } from "@/lib/auth";
import { EventBody } from "@/lib/events/shared";
import { isCrawler, optedOut, storeEvent, underLimit } from "@/lib/events/store";

/** Every answer is the same empty 204, stored or not, so the page learns nothing from it and never shows an error. */
const done = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

/**
 * Open: one funnel event from the public welcome page (src/components/welcome/early/track.tsx). First-party only,
 * in PostgreSQL. The body is capped at 4 KB and checked against the event list; a browser that sent Do Not Track or
 * Global Privacy Control, a known crawler, and an address past 240 events in ten minutes are answered the same 204
 * and nothing is stored. No network address, browser string, name or email is kept; the visit id is a random value
 * the browser keeps for one session. A body that does not fit is a 400 (a mistake in the page, not a visitor's).
 */
export const POST = route.open(
  async (req: Request) => {
    if (optedOut(req) || isCrawler(req.headers.get("user-agent"))) return done();
    if (!underLimit(clientAddress(req))) return done();
    let raw: unknown;
    try {
      raw = JSON.parse(await req.text());
    } catch {
      return new Response(JSON.stringify({ error: "The event must be JSON." }), { status: 400, headers: { "content-type": "application/json" } });
    }
    const e = EventBody.safeParse(raw);
    if (!e.success) return new Response(JSON.stringify({ error: `The event is not valid: ${e.error.issues[0]?.path.join(".") || "(body)"}` }), { status: 400, headers: { "content-type": "application/json" } });
    await storeEvent(e.data, req);
    return done();
  },
  { maxBodyBytes: 4 * 1024, tooLarge: "An event is at most 4 KB." }
);
