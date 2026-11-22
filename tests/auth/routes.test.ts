import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { SESSION_COOKIE } from "@/app/sign-in/shared";
import { anonymous, ctx, json, read, sessionCookieHeader } from "../api/helpers";

const API_DIR = join(process.cwd(), "src", "app", "api");
const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
/** The only routes that answer without a session. Adding one here is a decision, not a fix. */
// /api/auth2/[...all] is the new sign-in (Better Auth): its own endpoints decide which need a session, and with AUTH2
// off every address under it is a 404 (tests/auth2/switch.test.ts).
// /api/voiceovers/[cue] is the welcome film's sound, read by a signed-out visitor: a read route that serves only the
// published voice-over clip of a cue of the film (tests/voice/voiceovers.test.ts).
const OPEN = new Set(["/api/auth/sign-in", "/api/auth/sign-out", "/api/auth/me", "/api/health", "/api/access-requests", "/api/auth2/[...all]", "/api/voiceovers/[cue]"]);

/** Every route.ts under src/app/api, as its URL path, found on disk so a new route cannot be missed. */
function routeFiles(dir = API_DIR): { file: string; path: string }[] {
  const out: { file: string; path: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...routeFiles(full));
    else if (/^route\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      const rel = relative(API_DIR, dir).split(sep).join("/");
      out.push({ file: full, path: `/api${rel ? `/${rel}` : ""}` });
    }
  }
  return out;
}

const ROUTES = routeFiles();
const urlFor = (path: string) => `http://test.local${path.replace(/\[[^\]]+\]/g, "1")}`;

type Handler = (req: Request, context?: unknown) => Promise<Response>;
async function handlersOf(file: string) {
  const mod = (await import(file)) as Record<string, unknown>;
  return METHODS.filter((m) => typeof mod[m] === "function").map((m) => [m, mod[m] as Handler] as const);
}

const NAME = "zz-routes-user";
const PASSWORD = "routes-password";

beforeAll(async () => {
  await q("DELETE FROM users WHERE username = $1", [NAME]);
  await q("DELETE FROM sign_in_attempts WHERE username_key = $1 OR client IN ('unknown', '192.0.2.99')", [NAME]);
  await q("INSERT INTO users (username, password_hash) VALUES ($1, $2)", [NAME, await hashPassword(PASSWORD)]);
});

afterAll(async () => {
  await q("DELETE FROM users WHERE username = $1", [NAME]);
  await q("DELETE FROM sign_in_attempts WHERE username_key LIKE 'zz-routes-%' OR client IN ('unknown', '192.0.2.99')");
  await q("DELETE FROM projects WHERE id LIKE 'zz-test-origin%'");
  await pool().end();
});

describe("every API route requires a session", () => {
  it("finds the route files on disk", () => {
    expect(ROUTES.length).toBeGreaterThanOrEqual(16);
    for (const open of OPEN) expect(ROUTES.map((r) => r.path)).toContain(open);
  });

  it.each(ROUTES.filter((r) => !OPEN.has(r.path)).map((r) => [r.path, r.file]))(
    "%s answers 401 to every method without a session",
    async (path, file) => {
      const handlers = await handlersOf(file);
      expect(handlers.length).toBeGreaterThan(0);
      for (const [method, handler] of handlers) {
        const payload = method === "GET" || method === "HEAD" ? undefined : { projectId: "baggage-claims", name: "x", title: "x" };
        const res = await handler(anonymous(method, payload, urlFor(path)), ctx("1"));
        expect({ method, status: res.status }).toEqual({ method, status: 401 });
        expect(await res.json()).toEqual({ error: "Sign in to continue." });
      }
    }
  );

  it("answers 401 to a forged cookie and to a call with no request at all", async () => {
    const { GET } = await import("@/app/api/projects/route");
    const forged = new Request("http://test.local/api/projects", { headers: { cookie: `${SESSION_COOKIE}=${"x".repeat(43)}` } });
    expect((await GET(forged)).status).toBe(401);
    expect((await (GET as unknown as () => Promise<Response>)()).status).toBe(401);
  });

  it("lets a signed-in request through", async () => {
    const { GET } = await import("@/app/api/projects/route");
    expect((await GET(json("GET"))).status).toBe(200);
  });
});

/**
 * The one page route outside /api that answers without a session: the short address of a tracked link.
 * Adding another is a decision, so the list is checked against the disk here, as OPEN is above.
 */
const OPEN_PAGE_ROUTES = new Set(["/l/[code]"]);
function pageRouteFiles(dir = join(process.cwd(), "src", "app"), base = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = `${base}/${entry.name}`;
    if (entry.isDirectory()) {
      if (rel === "/api") continue;
      out.push(...pageRouteFiles(join(dir, entry.name), rel));
    } else if (/^route\.(ts|tsx|js|mjs)$/.test(entry.name)) out.push(base || "/");
  }
  return out;
}

describe("route handlers outside /api", () => {
  it("are exactly the deliberate open ones", () => {
    expect(new Set(pageRouteFiles())).toEqual(OPEN_PAGE_ROUTES);
  });
});

describe("the open routes work signed out", () => {
  it("me answers user null without a session and the user with one", async () => {
    const { GET } = await import("@/app/api/auth/me/route");
    expect(await read(await GET(anonymous("GET")))).toEqual({ status: 200, body: { user: null } });
    const me = await read<{ user: { username: string; usingDefaultPassword: boolean } }>(await GET(json("GET")));
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe("demo");
    expect(typeof me.body.user.usingDefaultPassword).toBe("boolean");
  });

  it("sign-in sets the cookie, the cookie works, and sign-out ends it", async () => {
    const signInRoute = await import("@/app/api/auth/sign-in/route");
    const signOutRoute = await import("@/app/api/auth/sign-out/route");
    const meRoute = await import("@/app/api/auth/me/route");
    const res = await signInRoute.POST(anonymous("POST", { username: NAME, password: PASSWORD }, "http://test.local/api/auth/sign-in"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { username: NAME, usingDefaultPassword: true } });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(new RegExp(`^${SESSION_COOKIE}=[A-Za-z0-9_-]{43}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax$`));
    expect(res.headers.get("cache-control")).toBe("no-store");
    const cookie = setCookie.split(";")[0];

    const asUser = (method: string, url: string) =>
      new Request(url, { method, headers: { cookie, origin: "http://test.local", host: "test.local" } });
    const me = await read<{ user: { username: string } }>(await meRoute.GET(asUser("GET", "http://test.local/api/auth/me")));
    expect(me.body.user.username).toBe(NAME);

    const out = await signOutRoute.POST(asUser("POST", "http://test.local/api/auth/sign-out"));
    expect(out.status).toBe(200);
    expect(out.headers.get("set-cookie")).toMatch(new RegExp(`^${SESSION_COOKIE}=; Path=/; Max-Age=0;`));
    expect(await read(await meRoute.GET(asUser("GET", "http://test.local/api/auth/me")))).toEqual({ status: 200, body: { user: null } });
    const { GET } = await import("@/app/api/projects/route");
    expect((await GET(asUser("GET", "http://test.local/api/projects"))).status).toBe(401);
  });

  it("sign-in over https sets a Secure cookie", async () => {
    const { POST } = await import("@/app/api/auth/sign-in/route");
    const req = new Request("http://127.0.0.1:3000/api/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-proto": "https", host: "127.0.0.1:3000" },
      body: JSON.stringify({ username: NAME, password: PASSWORD }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/; Secure$/);
  });

  it("sign-in gives one answer for an unknown name and a wrong password", async () => {
    const { POST } = await import("@/app/api/auth/sign-in/route");
    const wrong = await read(await POST(anonymous("POST", { username: NAME, password: "nope" })));
    const unknown = await read(await POST(anonymous("POST", { username: "zz-routes-nobody", password: "nope" })));
    expect(wrong).toEqual({ status: 401, body: { error: "The username or password is not right." } });
    expect(unknown).toEqual(wrong);
  });

  it("sign-in answers 429 with Retry-After while a name and address must wait, never a lockout", async () => {
    const { POST } = await import("@/app/api/auth/sign-in/route");
    const name = "zz-routes-locked";
    const from = (payload: unknown) => {
      const r = anonymous("POST", payload);
      r.headers.set("x-c2r-client-address", "192.0.2.99");
      return r;
    };
    for (let i = 0; i < 4; i++) expect((await POST(from({ username: name, password: "nope" }))).status).toBe(401);
    const res = await POST(from({ username: name, password: "nope" }));
    const r = await read<{ error: string }>(res);
    expect(r.status).toBe(429);
    expect(r.body.error).toMatch(/^Too many failed sign-in attempts from here\. Try again in [12] seconds?\.$/);
    expect(res.headers.get("retry-after")).toMatch(/^[12]$/);
  });

  it("sign-in validates its body", async () => {
    const { POST } = await import("@/app/api/auth/sign-in/route");
    expect((await POST(anonymous("POST", {}))).status).toBe(400);
    expect((await POST(anonymous("POST", "{not json"))).status).toBe(400);
    expect((await POST(anonymous("POST", { username: "x".repeat(201), password: "p" }))).status).toBe(400);
  });

  it("changing the password needs a session and reports the field", async () => {
    const { POST } = await import("@/app/api/auth/password/route");
    expect((await POST(anonymous("POST", { current: "demo", next: "something-long" }))).status).toBe(401);
    const short = await read<{ error: string; detail: { field: string } }>(await POST(json("POST", { current: "whatever", next: "short" })));
    expect(short.status).toBe(400);
    expect(short.body.detail.field).toBe("next");
    const wrong = await read<{ detail: { field: string } }>(await POST(json("POST", { current: "not-the-password", next: "long-enough-1" })));
    expect(wrong.status).toBe(400);
    expect(wrong.body.detail.field).toBe("current");
  });
});

describe("requests from another site", () => {
  const post = (headers: Record<string, string>) =>
    new Request("http://test.local/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: sessionCookieHeader(), host: "test.local", ...headers },
      body: JSON.stringify({ name: "ZZ Test Origin" }),
    });

  it("refuses a state-changing request whose Origin is another host, even with a valid session", async () => {
    const { POST } = await import("@/app/api/projects/route");
    for (const origin of ["https://evil.example", "http://test.local.evil.example", "http://test.local:4444", "null"]) {
      const r = await read(await POST(post({ origin })));
      expect({ origin, ...r }).toEqual({ origin, status: 403, body: { error: "This request came from another site and was refused." } });
    }
    expect(await q("SELECT 1 FROM projects WHERE id LIKE 'zz-test-origin%'")).toHaveLength(0);
  });

  it("refuses a cross-origin sign-in too (no signing a browser into someone else's account)", async () => {
    const { POST } = await import("@/app/api/auth/sign-in/route");
    const req = new Request("http://test.local/api/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example", host: "test.local" },
      body: JSON.stringify({ username: NAME, password: PASSWORD }),
    });
    expect((await POST(req)).status).toBe(403);
  });

  it("accepts the same origin, and a request with no Origin header", async () => {
    const { POST } = await import("@/app/api/projects/route");
    expect((await POST(post({ origin: "http://test.local" }))).status).toBe(201);
    expect((await POST(post({ origin: "HTTP://TEST.LOCAL" }))).status).toBe(201);
    expect((await POST(post({}))).status).toBe(201);
  });

  it("does not check GET requests", async () => {
    const { GET } = await import("@/app/api/projects/route");
    const req = new Request("http://test.local/api/projects", { headers: { cookie: sessionCookieHeader(), origin: "https://evil.example", host: "test.local" } });
    expect((await GET(req)).status).toBe(200);
  });
});
