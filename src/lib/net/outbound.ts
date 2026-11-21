// The one rule for outbound calls to an address a user typed (robustness review S3).
//
// Allowed: public addresses, loopback, the private ranges (RFC 1918, IPv6 unique-local) and
// host.docker.internal, because printers, Ollama, LM Studio, the planner and the slicer legitimately
// live there. Refused: link-local (169.254.0.0/16, fe80::/10), which holds the cloud metadata services,
// AWS's IPv6 metadata address fd00:ec2::254, the unspecified addresses (0.0.0.0/8, ::), and any name
// that resolves to one of those.
//
// No DNS-rebinding gap: safeFetch() does not hand the name to fetch, which would resolve it again.
// It makes the request with node:http or node:https, whose `lookup` option is our own resolver, so the
// address checked is the address connected to. Literal IP addresses are checked before connecting.
// resolveAllowed() does the same for the non-HTTP clients (Bambu's MQTT and FTP): it answers the
// checked address, and the caller connects to that address.
//
// Redirects are never followed (fetch's redirect: "manual"): a 3xx comes back to the caller as it is.
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { Readable } from "node:stream";

/** The code on the error a refused address raises (inside a fetch-style TypeError's cause). */
export const BLOCKED_CODE = "EADDRBLOCKED";

const blocked = new BlockList();
blocked.addSubnet("169.254.0.0", 16, "ipv4"); // link-local, cloud metadata (169.254.169.254)
blocked.addSubnet("0.0.0.0", 8, "ipv4"); // "this network", 0.0.0.0 reaches the local host on Linux
blocked.addSubnet("fe80::", 10, "ipv6"); // link-local
blocked.addAddress("fd00:ec2::254", "ipv6"); // AWS IMDS over IPv6
blocked.addAddress("::", "ipv6"); // unspecified

/** Why an IP address may not be called, or null when it may. IPv4-mapped IPv6 is judged as IPv4. */
export function addressProblem(ip: string): string | null {
  let a = ip.trim().replace(/^\[|\]$/g, "");
  const zone = a.indexOf("%");
  if (zone >= 0) a = a.slice(0, zone);
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(a);
  if (mapped) a = mapped[1];
  const family = isIP(a);
  if (!family) return "it is not an IP address";
  if (blocked.check(a, family === 4 ? "ipv4" : "ipv6")) {
    if (a.startsWith("169.254.") || /^fe[89ab]/i.test(a)) return "it is a link-local address, where cloud metadata services live";
    if (/^fd00:ec2::254$/i.test(a)) return "it is the cloud metadata address";
    return "it is an unspecified address (0.0.0.0 or ::)";
  }
  return null;
}

export class BlockedAddress extends Error {
  code = BLOCKED_CODE;
  constructor(public host: string, public why: string) {
    super(`The address ${host} is not allowed: ${why}.`);
    this.name = "BlockedAddress";
  }
}

/** The sentence for a refused address, for the screen. */
export const blockedSentence = (e: { message?: string }) => `${e.message ?? "That address is not allowed."} Use the device's own address on your network.`;

/** The refused-address error inside an error's chain of causes (and retry wrappers), if there is one. */
export function blockedIn(e: unknown): BlockedAddress | null {
  let cur = e as { code?: string; cause?: unknown; lastError?: unknown; errors?: unknown[] } | null;
  for (let i = 0; i < 8 && cur && typeof cur === "object"; i++) {
    if (cur.code === BLOCKED_CODE) return cur as unknown as BlockedAddress;
    cur = (cur.cause ?? cur.lastError ?? (Array.isArray(cur.errors) ? cur.errors[0] : null)) as typeof cur;
  }
  return null;
}

/** True when an error (or anything in its chain of causes) is a refused address. */
export function isBlocked(e: unknown): boolean {
  return blockedIn(e) !== null;
}

/** Resolves a host name and refuses it if ANY address it resolves to is forbidden. */
function checkedAddresses(host: string, family: number, cb: (err: Error | null, list: LookupAddress[]) => void) {
  const bare = host.replace(/^\[|\]$/g, "");
  if (isIP(bare)) {
    const p = addressProblem(bare);
    cb(p ? new BlockedAddress(host, p) : null, p ? [] : [{ address: bare, family: isIP(bare) }]);
    return;
  }
  dnsLookup(bare, { all: true, family: family === 4 || family === 6 ? family : 0 }, (err, list) => {
    if (err) return cb(err, []);
    for (const a of list) {
      const p = addressProblem(a.address);
      if (p) return cb(new BlockedAddress(host, `it resolves to ${a.address}, and ${p}`), []);
    }
    cb(null, list);
  });
}

/** A `lookup` for node:net, node:http and node:https that only ever yields allowed addresses. */
export const checkedLookup: LookupFunction = (hostname, options, callback) => {
  const opts = (typeof options === "object" && options ? options : {}) as { all?: boolean; family?: number | string };
  const fam = typeof opts.family === "number" ? opts.family : opts.family === "IPv6" ? 6 : opts.family === "IPv4" ? 4 : 0;
  checkedAddresses(hostname, fam, (err, list) => {
    const cb = callback as (e: Error | null, a: string | LookupAddress[], f?: number) => void;
    if (err) return cb(err, opts.all ? [] : "", undefined);
    if (opts.all) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
};

/** The checked IP address to connect to for a host (for clients that are not fetch). */
export function resolveAllowed(host: string): Promise<string> {
  return new Promise((resolve, reject) => checkedAddresses(host, 0, (err, list) => (err ? reject(err) : resolve(list[0].address))));
}

/** Refuses an address before anything is sent; for checks at save time (for example a tracked link's destination). */
export async function checkAddress(url: string): Promise<string | null> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return "it is not a web address";
  }
  try {
    await resolveAllowed(host);
    return null;
  } catch (e) {
    const b = blockedIn(e);
    if (b) return b.why;
    return null; // a name that does not resolve today is not a forbidden address
  }
}

const NO_BODY = new Set([101, 103, 204, 205, 304]);

/**
 * fetch() for an address a user typed: same arguments and answer as fetch, redirects never followed,
 * every connection made only to an allowed address. Network failures reject like fetch's
 * (TypeError "fetch failed" with the cause); an abort rejects with the signal's reason.
 */
export async function safeFetch(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  const hasStream = typeof ReadableStream !== "undefined" && init.body instanceof ReadableStream;
  const req = new Request(input, { ...init, redirect: "manual", ...(hasStream ? { duplex: "half" } : {}) } as RequestInit);
  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new TypeError("fetch failed", { cause: new Error(`unsupported protocol ${url.protocol}`) });
  const signal = req.signal;
  if (signal.aborted) throw signal.reason;
  // A literal IP is connected to without a lookup, so it is checked here.
  const literal = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(literal)) {
    const p = addressProblem(literal);
    if (p) throw new TypeError("fetch failed", { cause: new BlockedAddress(url.hostname, p) });
  }
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (k !== "accept-encoding" && k !== "connection" && k !== "keep-alive") headers[k] = v;
  });
  const body = req.body ? Buffer.from(await req.arrayBuffer()) : null;
  if (body && headers["content-length"] === undefined) headers["content-length"] = String(body.length);
  const send = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    const fail = (e: unknown) => {
      if (settled) return;
      settled = true;
      reject(e);
    };
    const r = send(
      url,
      { method: req.method, headers, lookup: checkedLookup, agent: false },
      (res: IncomingMessage) => {
        const out = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (Array.isArray(v)) for (const x of v) out.append(k, x);
          else if (v !== undefined) out.set(k, v);
        }
        const status = res.statusCode ?? 502;
        const stream = NO_BODY.has(status) || req.method === "HEAD" ? null : (Readable.toWeb(res) as unknown as ReadableStream<Uint8Array>);
        if (!stream) res.resume();
        settled = true;
        try {
          resolve(new Response(stream, { status: status < 200 || status > 599 ? 502 : status, statusText: res.statusMessage, headers: out }));
        } catch (e) {
          reject(e);
        }
      }
    );
    const onAbort = () => {
      const reason = signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
      r.destroy(reason instanceof Error ? reason : new Error(String(reason)));
      fail(reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    r.on("close", () => signal.removeEventListener("abort", onAbort));
    r.on("error", (e: NodeJS.ErrnoException) => {
      if (signal.aborted) return fail(signal.reason);
      fail(new TypeError("fetch failed", { cause: e }));
    });
    if (body) r.end(body);
    else r.end();
  });
}
