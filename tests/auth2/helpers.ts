// Helpers for tests/auth2: the new sign-in switched on with a secret made for this run, emails captured instead of
// logged, a cookie-keeping "browser" that calls the real catch-all route (src/app/api/auth2/[...all]/route.ts) as a
// page on this site would, and an authenticator app written from RFC 6238.
import { createHmac, randomBytes } from "node:crypto";
import type { Pool } from "pg";
import type { MailMessage } from "@/lib/auth2/mail";

const BASE = "http://localhost:3322";
export const PASSWORD = "correct horse battery";

/** Switches AUTH2 on for this file, with a fresh secret, and puts an instance with a capturing mailer in place. */
export async function useAuth2(opts: { rateLimit?: boolean } = {}) {
  process.env.AUTH2 = "1";
  process.env.BETTER_AUTH_URL = BASE;
  // Generated per run: never a secret written in the repository.
  process.env.BETTER_AUTH_SECRET = randomBytes(36).toString("base64url");
  const dbm = await import("@/lib/db");
  await dbm.ready();
  const db = dbm.ownerPool();
  const { makeAuth } = await import("@/lib/auth2/auth");
  const auth = makeAuth(db, { mail: { send: async (m) => void sent.push(m) }, rateLimit: opts.rateLimit });
  (globalThis as unknown as { __c2rAuth2?: unknown }).__c2rAuth2 = { db, auth };
  const route = await import("@/app/api/auth2/[...all]/route");
  return { db, auth, route };
}

export const sent: MailMessage[] = [];

const SUBJECT = { "confirm-email": /^Confirm your email address/, "reset-password": /^Choose a new password/ } as const;

/** The newest captured email of one kind to one address, its link and the token in it. */
export function lastMail(kind: keyof typeof SUBJECT, to: string) {
  const m = [...sent].reverse().find((x) => SUBJECT[kind].test(x.subject) && x.to.toLowerCase() === to.toLowerCase());
  if (!m) throw new Error(`No ${kind} email was captured for ${to}.`);
  const link = /https?:\/\/\S+/.exec(m.text)?.[0] ?? "";
  return { ...m, link, token: new URL(link).searchParams.get("token") ?? "" };
}

let n = 0;
/** A fresh address per call; every test address ends in @zz-auth2.test so cleanup can find it. */
export const email = (who: string) => `${who}-${Date.now().toString(36)}-${n++}@zz-auth2.test`;

export type Reply<T = Record<string, unknown>> = { status: number; body: T; headers: Headers };
type Route = { GET: (req: Request) => Promise<Response>; POST: (req: Request) => Promise<Response> };

let addresses = 0;
/** Each browser comes from its own network address unless told otherwise, so the throttle counts them apart. */
const nextAddress = () => `198.51.${100 + Math.floor(addresses / 250)}.${1 + (addresses++ % 250)}`;

/** One browser: keeps the cookies the server sets and sends them back, with the Origin a page on this site sends. */
export function browser(route: Route, opts: { address?: string; origin?: string | null } = {}) {
  const address = opts.address ?? nextAddress();
  const jar = new Map<string, string>();
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  async function call<T = Record<string, unknown>>(method: "GET" | "POST", path: string, payload?: unknown, origin = opts.origin === undefined ? BASE : opts.origin): Promise<Reply<T>> {
    const headers: Record<string, string> = { host: new URL(BASE).host, "x-c2r-client-address": address };
    if (origin) headers.origin = origin;
    if (payload !== undefined) headers["content-type"] = "application/json";
    if (jar.size) headers.cookie = cookieHeader();
    const req = new Request(`${BASE}/api/auth2${path}`, { method, headers, body: payload === undefined ? undefined : JSON.stringify(payload), redirect: "manual" });
    const res = await route[method](req);
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const gone = value === "" || attrs.some((a) => /^\s*max-age=0\s*$/i.test(a));
      if (gone) jar.delete(name);
      else jar.set(name, value);
    }
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body: body as T, headers: res.headers };
  }
  return {
    jar,
    address,
    cookieHeader,
    post: <T = Record<string, unknown>>(path: string, payload: unknown = {}, origin?: string | null) => call<T>("POST", path, payload, origin === undefined ? (opts.origin === undefined ? BASE : opts.origin) : origin),
    get: <T = Record<string, unknown>>(path: string) => call<T>("GET", path),
    /** The session token in the cookie (before Better Auth's signature). */
    sessionToken: () => {
      const v = [...jar].find(([k]) => k.endsWith("session_token"))?.[1];
      return v ? decodeURIComponent(v).split(".")[0] : null;
    },
  };
}
export type Browser = ReturnType<typeof browser>;

/** Signs up, follows the link in the confirmation email, and signs in. */
export async function newAccount(route: Route, who: string) {
  const address = email(who);
  const b = browser(route);
  const up = await b.post("/sign-up/email", { name: who, email: address, password: PASSWORD });
  if (up.status !== 200) throw new Error(`sign-up answered ${up.status}: ${JSON.stringify(up.body)}`);
  const verified = await b.get(`/verify-email?token=${encodeURIComponent(lastMail("confirm-email", address).token)}`);
  if (verified.status >= 400) throw new Error(`verify answered ${verified.status}: ${JSON.stringify(verified.body)}`);
  const inn = await b.post("/sign-in/email", { email: address, password: PASSWORD });
  if (inn.status !== 200) throw new Error(`sign-in answered ${inn.status}: ${JSON.stringify(inn.body)}`);
  const s = await b.get<{ user: { id: string }; session: { activeOrganizationId: string } }>("/get-session");
  return { b, email: address, userId: s.body.user.id, workspaceId: s.body.session.activeOrganizationId };
}

/** Removes everything the auth2 tests made: their workspaces, accounts and throttle counts. */
export async function cleanUp(db: Pool) {
  const orgs = `SELECT m."organizationId" FROM member m JOIN "user" u ON u.id = m."userId" WHERE u.email LIKE '%@zz-auth2.test'`;
  await db.query(`DELETE FROM "organization" WHERE id IN (${orgs})`);
  await db.query(`DELETE FROM "user" WHERE email LIKE '%@zz-auth2.test'`);
  await db.query(`DELETE FROM "rateLimit"`);
}

// --- an authenticator app (RFC 6238, SHA-1, 6 digits, 30 seconds), written here from the standard and not taken
// from Better Auth or src/lib/auth2, so a passing test shows its codes are the ones a real authenticator app shows.
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(s: string): Buffer {
  let bits = "";
  for (const ch of s.replace(/=+$/, "").toUpperCase()) bits += B32.indexOf(ch).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** The code an authenticator app shows for an otpauth:// address at a given time. */
export function authenticatorCode(otpauthUri: string, at = Date.now()): string {
  const u = new URL(otpauthUri);
  const secret = base32Decode(u.searchParams.get("secret") ?? "");
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const mac = createHmac("sha1", secret).update(counter).digest();
  const o = mac[mac.length - 1] & 0xf;
  const bin = ((mac[o] & 0x7f) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3];
  return String(bin % 1e6).padStart(6, "0");
}

/** Forgets which code step a user used last, so a test can sign in again within the same 30 seconds. */
export async function forgetLastCode(db: Pool, userId: string) {
  await db.query("DELETE FROM auth2_totp_steps WHERE user_id = $1", [userId]);
}
