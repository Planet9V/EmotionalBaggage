// The short address of a tracked link: /l/<code> sends the visitor to the destination the signed-in user
// saved for that code and counts one click for today.
//
// This is the one page route that answers without a session, and it is open on purpose (src/app/sign-in/
// shared.ts lets the path through, tests/auth/routes.test.ts lists it). What keeps it safe:
//  - it only ever redirects to a `destination` stored with a link that a signed-in user made;
//    nothing in the request (a query, a header) chooses where it goes;
//  - it follows only an https destination on the concept's allow-list (Marketing budget and rules) that
//    passes the outbound address rule; a link that no longer does answers the same 404 as an unknown code;
//  - it stores one number per link per day and nothing about the visitor: no address, no user agent,
//    no referrer, no cookie, no time of day;
//  - it is rate limited by code, never by visitor (src/lib/campaigns/rateLimit.ts);
//  - an unknown, disabled or malformed code answers 404 with nothing else, and 404s are limited too.
import { q } from "@/lib/db";
import { route } from "@/lib/api/route";
import { checkDestination, CODE_RE, hostAllowed } from "@/lib/campaigns/links";
import { addressProblem } from "@/lib/net/outbound";
import { limiter } from "@/lib/campaigns/rateLimit";

type Ctx = { params: Promise<{ code: string }> };

const HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" };
const plain = (status: number, text: string, extra: Record<string, string> = {}) => new Response(text, { status, headers: { ...HEADERS, "Content-Type": "text/plain; charset=utf-8", ...extra } });

function destinationStillAllowed(destination: string, hosts: unknown): boolean {
  const c = checkDestination(destination);
  if (!c.ok) return false;
  const list = Array.isArray(hosts) ? hosts.filter((x): x is string => typeof x === "string") : [];
  if (!hostAllowed(c.url.hostname, list)) return false;
  const literal = c.url.hostname.replace(/^\[|\]$/g, "");
  return !/^[\d.]+$|:/.test(literal) || addressProblem(literal) === null;
}

export const GET = route.open(async (_req: Request, { params }: Ctx) => {
  const { code } = await params;
  const rl = limiter();
  if (!CODE_RE.test(code)) {
    const u = rl.allowUnknown();
    return u.ok ? plain(404, "This link does not exist.") : plain(429, "Too many requests.", { "Retry-After": String(u.retryAfter) });
  }
  const gate = rl.allow(code);
  if (!gate.ok) return plain(429, "Too many requests.", { "Retry-After": String(gate.retryAfter) });
  // find the live link and the concept's allow-list; a click is counted only for a destination that is followed
  const rows = await q<{ id: string; destination: string; hosts: unknown }>(
    `SELECT t.id, t.destination,
            (SELECT i.data->'linkHosts' FROM items i WHERE i.project_id = t.project_id AND i.section = 'marketing/campaigns' AND i.data->>'kind' = 'plan' ORDER BY i.id LIMIT 1) AS hosts
       FROM tracked_links t WHERE t.code = $1 AND NOT t.disabled`,
    [code]
  );
  // A destination saved before the current rules, or a host since taken off the list, is not followed:
  // the visitor gets the same plain 404 as for an unknown code, and nothing else (robustness review S5).
  if (rows.length && !destinationStillAllowed(rows[0].destination, rows[0].hosts)) rows.length = 0;
  if (!rows.length) {
    const u = rl.allowUnknown();
    return u.ok ? plain(404, "This link does not exist.") : plain(429, "Too many requests.", { "Retry-After": String(u.retryAfter) });
  }
  await q(
    `INSERT INTO link_clicks (link_id, day, clicks) VALUES ($1, (now() AT TIME ZONE 'UTC')::date, 1)
     ON CONFLICT (link_id, day) DO UPDATE SET clicks = link_clicks.clicks + 1`,
    [rows[0].id]
  );
  return new Response(null, { status: 302, headers: { ...HEADERS, Location: rows[0].destination } });
});
