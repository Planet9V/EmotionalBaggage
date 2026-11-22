/**
 * The client's address for the new sign-in's throttle and session rows (security review B4).
 *
 * Better Auth reads one header. This puts the app's own answer there, worked out the way the old sign-in does
 * (clientAddress in src/lib/auth.ts), with one addition:
 *
 * - Without TRUST_PROXY: the connection's own address, which scripts/client-address.cjs writes into
 *   x-c2r-client-address (overwriting anything a client sent).
 * - With TRUST_PROXY: X-Forwarded-For read from the right. Entries that are our own proxies (TRUSTED_PROXIES, a
 *   comma-separated list of addresses and ranges such as 10.0.0.0/8) are skipped; the first other entry is the
 *   client. With TRUSTED_PROXIES empty, the right-most entry is the client: the one the proxy in front appended,
 *   as the old sign-in reads it. Entries to the left of that are what the client claimed and are never used, so a
 *   forged entry cannot choose another visitor's bucket, and visitors behind one proxy do not share one.
 *
 * This holds only if the app cannot be reached around the proxy (docs/guide/admin.md, "Behind a reverse proxy").
 */
import { BlockList, isIP } from "node:net";
import { CLIENT_ADDRESS_HEADER } from "@/lib/auth";

const ON = /^(1|true|yes|on)$/i;

/** TRUSTED_PROXIES as a list; an entry that is not an address or range stops the start with a plain sentence. */
export function trustedProxies(): BlockList {
  const list = new BlockList();
  for (const raw of (process.env.TRUSTED_PROXIES ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const [ip, bits] = raw.split("/");
    const family = isIP(ip);
    const n = bits === undefined ? null : Number(bits);
    if (!family || (n !== null && (!Number.isInteger(n) || n < 0 || n > (family === 4 ? 32 : 128)))) {
      throw new Error(`TRUSTED_PROXIES has an entry that is not an address or range: ${raw} (for example 10.0.0.0/8 or 192.0.2.10).`);
    }
    const type = family === 4 ? "ipv4" : "ipv6";
    if (n === null) list.addAddress(ip, type);
    else list.addSubnet(ip, n, type);
  }
  return list;
}

const strip = (a: string) => a.trim().replace(/^\[|\]$/g, "").replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, "");

/** The client's address for a request, or "" when it cannot be told. */
export function auth2ClientAddress(req: Request, proxies: BlockList = trustedProxies()): string {
  const own = strip(req.headers.get(CLIENT_ADDRESS_HEADER) ?? "");
  if (!ON.test(process.env.TRUST_PROXY?.trim() ?? "")) return isIP(own) ? own : "";
  const chain = (req.headers.get("x-forwarded-for") ?? "").split(",").map(strip).filter(Boolean);
  for (let i = chain.length - 1; i >= 0; i--) {
    const a = chain[i];
    const family = isIP(a);
    // Not an address: what follows to the left is the client's own claim, so stop here.
    if (!family) break;
    if (proxies.check(a, family === 4 ? "ipv4" : "ipv6")) continue;
    return a;
  }
  return isIP(own) ? own : "";
}

/**
 * The address as it is counted (review B5): an IPv4 address as it is; an IPv6 address by its /64 network (written as
 * that network's first address, so it is still a valid address), because one subscriber is usually given a whole
 * /64 and could otherwise count as billions of clients.
 */
export function clientBucket(addr: string): string {
  if (isIP(addr) !== 6) return addr;
  let a = addr.toLowerCase().split("%")[0];
  // An IPv4 tail (::ffff:1.2.3.4 and the like) as two groups.
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(a);
  if (v4) {
    const [x, y, z, w] = v4.slice(1).map(Number);
    a = a.slice(0, v4.index) + `${((x << 8) | y).toString(16)}:${((z << 8) | w).toString(16)}`;
  }
  const [head, tail] = a.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const groups = tail === undefined ? h : [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  return `${groups.slice(0, 4).map((g) => parseInt(g || "0", 16).toString(16)).join(":")}::`;
}

/** The same request, with the address above (by its /64 for IPv6) as the only one Better Auth and the waits read. */
export function withClientAddress(req: Request): Request {
  const headers = new Headers(req.headers);
  headers.set(CLIENT_ADDRESS_HEADER, clientBucket(auth2ClientAddress(req)));
  return new Request(req, { headers });
}
