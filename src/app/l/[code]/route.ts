// The short address of a tracked link: /l/<code> sends the visitor to the destination the signed-in user
// saved for that code and counts one click for today.
//
// This is the one page route that answers without a session, and it is open on purpose (src/app/sign-in/
// shared.ts lets the path through, tests/auth/routes.test.ts lists it). What keeps it safe:
//  - it only ever redirects to a `destination` stored with a link that a signed-in user made;
//    nothing in the request (a query, a header) chooses where it goes;
//  - it stores one number per link per day and nothing about the visitor: no address, no user agent,
//    no referrer, no cookie, no time of day;
//  - it is rate limited by code, never by visitor (src/lib/campaigns/rateLimit.ts);
//  - an unknown, disabled or malformed code answers 404 with nothing else, and 404s are limited too.
import { q } from "@/lib/db";
import { route } from "@/lib/api/route";
import { CODE_RE } from "@/lib/campaigns/links";
import { limiter } from "@/lib/campaigns/rateLimit";

type Ctx = { params: Promise<{ code: string }> };

const HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" };
const plain = (status: number, text: string, extra: Record<string, string> = {}) => new Response(text, { status, headers: { ...HEADERS, "Content-Type": "text/plain; charset=utf-8", ...extra } });

export const GET = route.open(async (_req: Request, { params }: Ctx) => {
  const { code } = await params;
  const rl = limiter();
  if (!CODE_RE.test(code)) {
    const u = rl.allowUnknown();
    return u.ok ? plain(404, "This link does not exist.") : plain(429, "Too many requests.", { "Retry-After": String(u.retryAfter) });
  }
  const gate = rl.allow(code);
  if (!gate.ok) return plain(429, "Too many requests.", { "Retry-After": String(gate.retryAfter) });
  // one statement: find the live link, add one to today's count, return where it goes
  const rows = await q<{ destination: string }>(
    `WITH l AS (SELECT id, destination FROM tracked_links WHERE code = $1 AND NOT disabled),
          c AS (INSERT INTO link_clicks (link_id, day, clicks)
                  SELECT id, (now() AT TIME ZONE 'UTC')::date, 1 FROM l
                ON CONFLICT (link_id, day) DO UPDATE SET clicks = link_clicks.clicks + 1
                RETURNING 1)
     SELECT destination FROM l`,
    [code]
  );
  if (!rows.length) {
    const u = rl.allowUnknown();
    return u.ok ? plain(404, "This link does not exist.") : plain(429, "Too many requests.", { "Retry-After": String(u.retryAfter) });
  }
  return new Response(null, { status: 302, headers: { ...HEADERS, Location: rows[0].destination } });
});
