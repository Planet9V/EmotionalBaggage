import { asActor } from "@/lib/actor";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { q } from "@/lib/db";
import { sessionFromRequest, type Session } from "@/lib/auth";

/** Thrown inside a route to answer with a specific status and a plain message. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
    /** extra response headers, for example Retry-After */
    public headers?: Record<string, string>
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} was not found.`);

const PG: Record<string, [number, string]> = {
  "22P02": [400, "A value in the request has the wrong format."],
  "22003": [400, "A number in the request is out of range."],
  "22001": [400, "A value in the request is too long."],
  "23502": [400, "A required value is missing."],
  "23503": [404, "The concept or record this refers to does not exist."],
  "23505": [409, "That already exists."],
  "23514": [400, "A value in the request is not allowed."],
  // a NUL character or bytes that are not valid text
  "22021": [400, "A value in the request contains a character that cannot be stored."],
  "22P05": [400, "A value in the request contains a character that cannot be stored."],
  // program_limit_exceeded, for example a value too large for an index
  "54000": [400, "A value in the request is too large to store."],
};

export const NUL_REFUSED = "A value in the request contains a NUL character (\\u0000), which cannot be stored. Remove it and try again.";

/** True when any string (or object key) inside a parsed JSON value contains U+0000. */
function hasNul(v: unknown, depth = 0): boolean {
  if (typeof v === "string") return v.includes("\u0000");
  if (depth > 200 || v === null || typeof v !== "object") return false;
  if (Array.isArray(v)) return v.some((x) => hasNul(x, depth + 1));
  for (const [k, x] of Object.entries(v)) if (k.includes("\u0000") || hasNul(x, depth + 1)) return true;
  return false;
}

/** The largest request body a route takes unless it says otherwise (route(handler, { maxBodyBytes })). */
export const DEFAULT_MAX_BODY_BYTES = 4 * 1024 * 1024;

export type RouteOptions = {
  /** the largest body this route reads; a larger one is refused with 413 before it is parsed */
  maxBodyBytes?: number;
  /** the sentence for that 413 */
  tooLarge?: string;
};

const megabytes = (n: number) => `${Math.round((n / (1024 * 1024)) * 10) / 10} MB`;

/** Reads at most `max` bytes of a stream; null when there is more. */
async function readCapped(body: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      // not awaited: a cancelled branch of a cloned (teed) body settles only once the other branch is cancelled too
      void reader.cancel().catch(() => undefined);
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}

/**
 * Checks the request before the handler runs (robustness review S2 and S8), so before any model call:
 * - the body may not be larger than the route takes: a Content-Length over the limit is a 413 before
 *   anything is read; a body sent without one is counted as it is read, up to the limit;
 * - a NUL character (U+0000) may not appear in the path, the query or a non-multipart body: PostgreSQL text
 *   cannot hold it, so it could only end in a 500. A multipart upload's text fields are not read here; a NUL
 *   there reaches the database's 22021, which answers 400.
 */
async function guardRequest(req: Request, opts: RouteOptions) {
  let u: URL | null = null;
  try {
    u = new URL(req.url);
  } catch {
    u = null;
  }
  if (u) {
    for (const seg of u.pathname.split("/")) {
      let d = seg;
      try {
        d = decodeURIComponent(seg);
      } catch {
        // a malformed escape is the handler's to refuse
      }
      if (d.includes("\u0000")) throw new HttpError(400, NUL_REFUSED);
    }
    for (const [k, v] of u.searchParams) if (k.includes("\u0000") || v.includes("\u0000")) throw new HttpError(400, NUL_REFUSED);
  }
  if (SAFE_METHODS.has(req.method.toUpperCase()) || !req.body) return;
  const max = opts.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const tooLarge = () => new HttpError(413, opts.tooLarge ?? `The request is larger than ${megabytes(max)}, the most this address takes.`);
  const declared = req.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared) > max) throw tooLarge();
  const multipart = /multipart\/form-data/i.test(req.headers.get("content-type") ?? "");
  if (multipart) {
    // an upload sent in chunks with no length cannot be measured before it is parsed
    if (declared === null && /chunked/i.test(req.headers.get("transfer-encoding") ?? "")) throw new HttpError(411, "Send the upload with a Content-Length.");
    return;
  }
  const bytes = await readCapped(req.clone().body!, max);
  if (!bytes) throw tooLarge();
  const text = new TextDecoder().decode(bytes);
  if (text.includes("\u0000")) throw new HttpError(400, NUL_REFUSED);
  if (/\\u0000/i.test(text)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return; // not JSON: body() answers that
    }
    if (hasNul(parsed)) throw new HttpError(400, NUL_REFUSED);
  }
}

/** Unique rules the database enforces, in the user's terms. */
const CONFLICT: Record<string, string> = {
  items_part_ref_unique: "Another part in this concept already uses that reference. References must be unique because wires name parts by them.",
  items_key_unique: "Another row in this concept already uses that key. Keys must be unique because the order of operations and the decision tree address rows by them.",
  printers_name_unique: "A printer with that name already exists.",
  items_story_part_unique: "This concept's story already has that section. Edit it instead of adding a second one.",
};

function fail(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message, ...(e.detail ? { detail: e.detail } : {}) }, { status: e.status, ...(e.headers ? { headers: e.headers } : {}) });
  }
  if (e instanceof ZodError) {
    const issues = e.issues.map((i) => ({ field: i.path.join(".") || "(body)", problem: i.message }));
    const first = issues[0];
    return NextResponse.json(
      { error: `The request is not valid: ${first.field} — ${first.problem}`, issues },
      { status: 400 }
    );
  }
  const code = (e as { code?: unknown })?.code;
  if (typeof code === "string" && PG[code]) {
    const constraint = (e as { constraint?: unknown })?.constraint;
    if (code === "23505" && typeof constraint === "string" && CONFLICT[constraint]) {
      return NextResponse.json({ error: CONFLICT[constraint] }, { status: 409 });
    }
    const [status, error] = PG[code];
    return NextResponse.json({ error }, { status });
  }
  if ((e as { name?: string })?.name === "TimeoutError" || (e as { name?: string })?.name === "AbortError") {
    return NextResponse.json({ error: "An outside service took too long to answer." }, { status: 504 });
  }
  console.error("[api] unhandled error", e);
  return NextResponse.json({ error: "The server could not complete the request." }, { status: 500 });
}

const SIGN_IN_REQUIRED = "Sign in to continue.";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** The incoming request among a handler's arguments. Next.js passes it first to every handler, with or without parameters. */
function requestOf(args: unknown[]): Request | null {
  for (const a of args) {
    if (a instanceof Request) return a;
    const r = a as Partial<Request> | null;
    if (r && typeof r === "object" && typeof r.method === "string" && typeof r.url === "string" && typeof r.headers?.get === "function") {
      return a as Request;
    }
  }
  return null;
}

/**
 * Cross-site request forgery defence, together with the cookie's SameSite=Lax.
 *
 * SameSite=Lax means the browser leaves the session cookie off any request another site starts
 * with a method other than GET (a hidden form POST, a fetch from a script), so such a request
 * arrives signed out and gets 401. This check is the second layer, for the cases Lax does not
 * cover: an older browser that ignores SameSite, or another site on the same registrable domain
 * (same-site but not same-origin, e.g. another port or sub-domain on this machine). Browsers send
 * an Origin header on every cross-origin request that changes state, and a page cannot forge it;
 * when it is present it must name this host, or the request is refused with 403. Requests with
 * no Origin at all (curl, scripts, very old browsers) are allowed: they are not a browser being
 * tricked into sending someone's cookie. GET and HEAD never change anything here, so they are not
 * checked. Host comes from the request; a reverse proxy in front must pass the original Host.
 */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin === null) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host; // "null" (sandboxed pages, some redirects) is not a URL: refused
  } catch {
    return false;
  }
  let host = req.headers.get("host");
  if (!host) {
    try {
      host = new URL(req.url).host;
    } catch {
      return false;
    }
  }
  return originHost.toLowerCase() === host.toLowerCase();
}

/**
 * Who is signed in, for a route. With the new sign-in off: the old sign-in's session (src/lib/auth.ts), exactly as
 * before. With it on (src/lib/auth2/config.ts auth2Enabled): only the new sign-in's session, checked by Better Auth on
 * the server for this request; an old session is not accepted for anything, and a person who must set up two-step
 * sign-in first is refused (403) everywhere but the account screens (cut-over, accounts slice 2).
 */
export type AppSession =
  | (Session & { kind: "old" })
  | { kind: "auth2"; sessionId: string; userId: string; username: string; usingDefaultPassword: false };

const TWO_FACTOR_FIRST = "A workspace you belong to requires two-step sign-in. Set up an authenticator app first, at /auth/two-factor/setup.";

async function resolveSession(req: Request): Promise<AppSession | null> {
  const { auth2Enabled } = await import("@/lib/auth2/config");
  if (!(await auth2Enabled())) {
    const old = await sessionFromRequest(req);
    return old ? { ...old, kind: "old" } : null;
  }
  const { auth2Session } = await import("@/lib/auth2/server");
  const s = await auth2Session(req.headers).catch(() => null);
  if (!s) return null;
  const { ownerPool } = await import("@/lib/db");
  const { owed } = await import("@/lib/auth2/workspaces/twoFactor");
  if (await owed(ownerPool(), s.user.id)) throw new HttpError(403, TWO_FACTOR_FIRST);
  return { kind: "auth2", sessionId: s.session.id, userId: s.user.id, username: s.user.email, usingDefaultPassword: false };
}

/** For the old sign-in's open routes (sign-in, sign-out): not found while the new sign-in is on. */
export async function refuseWhenNewSignIn(): Promise<void> {
  const { auth2Enabled } = await import("@/lib/auth2/config");
  if (await auth2Enabled()) throw new HttpError(404, "Not found.");
}

/** Who is signed in, for "who am I": the new sign-in's session when it is on, else the old one. Never throws. */
export async function whoIsSignedIn(req: Request): Promise<{ username: string; usingDefaultPassword: boolean } | null> {
  try {
    const s = await resolveSession(req);
    return s ? { username: s.username, usingDefaultPassword: s.usingDefaultPassword } : null;
  } catch {
    return null;
  }
}

/** For the old sign-in's own routes: not found while the new sign-in is on (they are replaced by /api/auth2). */
export function oldSessionOf(req: Request): Session {
  const s = sessionOf(req);
  if (s.kind !== "old") throw new HttpError(404, "Not found.");
  return s;
}

const sessions = new WeakMap<Request, AppSession>();

/** The session route() found for this request. Only for handlers wrapped in route() (not route.open). */
export function sessionOf(req: Request): AppSession {
  const s = sessions.get(req);
  if (!s) throw new HttpError(401, SIGN_IN_REQUIRED);
  return s;
}

/**
 * What route() returns. A handler written without parameters still receives the request from
 * Next.js (it passes the request first to every route handler), so the wrapped function takes it.
 */
type Wrapped<A extends unknown[]> = (...args: A extends [] ? [req: Request] : A) => Promise<Response>;

function wrap<A extends unknown[]>(handler: (...args: A) => Promise<Response>, open: boolean, opts: RouteOptions = {}): Wrapped<A> {
  return async (...args): Promise<Response> => {
    try {
      const req = requestOf(args);
      // No request to read a session from means no session: fail closed.
      if (!req) throw new HttpError(open ? 400 : 401, open ? "The request could not be read." : SIGN_IN_REQUIRED);
      if (!SAFE_METHODS.has(req.method.toUpperCase()) && !sameOrigin(req)) {
        throw new HttpError(403, "This request came from another site and was refused.");
      }
      await guardRequest(req, opts);
      if (!open) {
        const session = await resolveSession(req);
        if (!session) throw new HttpError(401, SIGN_IN_REQUIRED);
        sessions.set(req, session);
        // Everything this request changes is recorded in the audit log against this name.
        return await asActor(session.username, () => handler(...(args as unknown as A)));
      }
      return await handler(...(args as unknown as A));
    } catch (e) {
      return fail(e);
    }
  };
}

/**
 * Wraps a route handler so that:
 * - it requires a signed-in session (401 `{ "error": "Sign in to continue." }` without one);
 * - a request that changes state (anything but GET, HEAD, OPTIONS) from another origin is refused (403);
 * - every failure leaves as JSON with a real status:
 *   validation → 400, missing → 404, conflict → 409, slow upstream → 504, anything else → 500.
 *
 * `route.open(handler)` is the same without the session requirement (the origin check stays).
 * Only sign-in, sign-out and "who am I" are open; tests/auth/routes.test.ts fails if another
 * route answers without a session.
 */
export const route = Object.assign(
  <A extends unknown[]>(handler: (...args: A) => Promise<Response>, opts?: RouteOptions) => wrap(handler, false, opts),
  { open: <A extends unknown[]>(handler: (...args: A) => Promise<Response>, opts?: RouteOptions) => wrap(handler, true, opts) }
);

/** Reads and validates a JSON body. A body that is not JSON is a 400, not an empty object. */
export async function body<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "The request body must be JSON.");
  }
  return schema.parse(raw);
}

/** Numeric record ids arrive as path text; anything else is a 404 for that record. */
export function recordId(value: string, what: string): number {
  if (!/^\d{1,15}$/.test(value)) throw notFound(what);
  return Number(value);
}

export async function requireProject(id: string) {
  const rows = await q<{ id: string; name: string; one_liner: string }>(
    "SELECT id, name, one_liner FROM projects WHERE id=$1",
    [id]
  );
  if (!rows.length) throw notFound("That concept");
  return rows[0];
}
