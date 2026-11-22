// The security review of 22 Nov (B1 to B5, F1, F2, F4 to F7): each finding, shown fixed through the real route or
// the start-up checks. Roles (B3, F3) are in ./roles.test.ts; the shell (N3) in ./screens.test.tsx.
import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { auth2ClientAddress } from "@/lib/auth2/clientAddress";
import { checkAuth2Settings, secretProblem } from "@/lib/auth2/config";
import { authenticatorCode, browser, cleanUp, email, forgetLastCode, lastMail, newAccount, PASSWORD, sent, useAuth2, waitForMail } from "./helpers";

let db: Pool;
let route: Awaited<ReturnType<typeof useAuth2>>["route"];
const saved = { ...process.env };

beforeAll(async () => {
  ({ db, route } = await useAuth2());
  await cleanUp(db);
});

afterEach(() => {
  for (const k of ["NODE_ENV", "BETTER_AUTH_URL", "TRUST_PROXY", "TRUSTED_PROXIES"] as const) {
    if (saved[k] === undefined) delete (process.env as Record<string, string | undefined>)[k];
    else (process.env as Record<string, string | undefined>)[k] = saved[k];
  }
  process.env.BETTER_AUTH_URL = "http://localhost:3322";
});

afterAll(async () => {
  await cleanUp(db);
  delete process.env.AUTH2;
});

const env = process.env as Record<string, string | undefined>;
const goodSecret = () => randomBytes(36).toString("base64url");

describe("B1, as changed by the owner on 22 Nov: production without mail starts, and logs no link", () => {
  it("in production with no mail service there is no sender, and the new sign-in still builds", async () => {
    env.NODE_ENV = "production";
    const { currentMailSender } = await import("@/lib/auth2/mail");
    expect(await currentMailSender()).toBeNull();
    const { makeAuth } = await import("@/lib/auth2/auth");
    expect(() => makeAuth(db, { baseURL: "https://app.example.test", secret: goodSecret() })).not.toThrow();
    await expect(checkAuth2Settings()).resolves.toBeUndefined();
  });

  it("a sign-up and a reset in 'no mail' mode write no link or token to the log", async () => {
    const { makeAuth } = await import("@/lib/auth2/auth");
    const g = globalThis as unknown as { __c2rAuth2?: unknown };
    const keep = g.__c2rAuth2;
    g.__c2rAuth2 = { db, auth: makeAuth(db, { mail: null, rateLimit: false }) };
    const lines: string[] = [];
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((k) => vi.spyOn(console, k).mockImplementation((...a: unknown[]) => void lines.push(a.map(String).join(" "))));
    try {
      const who = email("nomail");
      const b = browser(route);
      expect((await b.post("/sign-up/email", { name: "No Mail", email: who, password: PASSWORD })).status).toBe(200);
      expect((await b.post("/request-password-reset", { email: who, redirectTo: "/auth/reset/new" })).status).toBe(200);
      await new Promise((r) => setTimeout(r, 300));
      expect(lines.join("\n")).not.toMatch(/token=|\/auth\/(confirm|reset)/);
      expect(lines.some((l) => /no mail service is configured/.test(l))).toBe(true);
      const u = await db.query<{ emailVerified: boolean }>('SELECT "emailVerified" FROM "user" WHERE email = $1', [who]);
      expect(u.rows[0].emailVerified).toBe(false);
    } finally {
      for (const s of spies) s.mockRestore();
      g.__c2rAuth2 = keep;
    }
  });

  it("outside production the log sender is used and shows the link, for development", async () => {
    const { currentMailSender } = await import("@/lib/auth2/mail");
    expect(await currentMailSender()).not.toBeNull();
  });
});

describe("B2: signing up an address before its owner does", () => {
  it("the owner's later sign-up replaces the attacker's password and name, and only the new link works", async () => {
    const victim = email("victim");
    const attacker = browser(route);
    const first = await attacker.post<{ token: null; user: Record<string, unknown> }>("/sign-up/email", { name: "Attacker", email: victim, password: "attacker password" });
    expect(first.status).toBe(200);
    const oldLink = lastMail("confirm-email", victim).token;

    const owner = browser(route);
    const before = sent.length;
    const again = await owner.post<{ token: null; user: Record<string, unknown> }>("/sign-up/email", { name: "Victim", email: victim, password: "victim password" });
    // The same answer as a new sign-up: status, shape, and no session.
    expect(again.status).toBe(200);
    expect(Object.keys(again.body).sort()).toEqual(Object.keys(first.body).sort());
    expect(Object.keys(again.body.user).sort()).toEqual(Object.keys(first.body.user).sort());
    expect(again.body.token).toBeNull();

    await waitForMail("confirm-email", victim, 2);
    expect(sent.length).toBe(before + 1);
    const newLink = lastMail("confirm-email", victim).token;
    expect(newLink).not.toBe(oldLink);

    expect((await owner.get(`/verify-email?token=${encodeURIComponent(oldLink)}`)).status).toBe(401);
    expect((await owner.get(`/verify-email?token=${encodeURIComponent(newLink)}`)).status).toBe(200);
    expect((await browser(route).post("/sign-in/email", { email: victim, password: "attacker password" })).status).toBe(401);
    expect((await browser(route).post("/sign-in/email", { email: victim, password: "victim password" })).status).toBe(200);
    const u = await db.query<{ name: string }>('SELECT name FROM "user" WHERE email=$1', [victim]);
    expect(u.rows[0].name).toBe("Victim");
  });

  it("a sign-up for a confirmed address answers the same and changes nothing", async () => {
    const a = await newAccount(route, "settled");
    const before = sent.length;
    const res = await browser(route).post<{ token: null }>("/sign-up/email", { name: "Someone else", email: a.email, password: "other password 1" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeNull();
    await new Promise((r) => setTimeout(r, 1500));
    expect(sent.length).toBe(before);
    expect((await browser(route).post("/sign-in/email", { email: a.email, password: PASSWORD })).status).toBe(200);
    expect((await browser(route).post("/sign-in/email", { email: a.email, password: "other password 1" })).status).toBe(401);
  });
});

describe("B4: the client's address behind a proxy", () => {
  const req = (xff: string | null, own = "10.0.0.1") => new Request("http://x/", { headers: { ...(xff ? { "x-forwarded-for": xff } : {}), "x-c2r-client-address": own } });

  it("without TRUST_PROXY: the connection's address, whatever X-Forwarded-For says", () => {
    delete env.TRUST_PROXY;
    expect(auth2ClientAddress(req("203.0.113.9"))).toBe("10.0.0.1");
  });

  it("with TRUST_PROXY: the right-most entry, never what the client wrote to its left", () => {
    env.TRUST_PROXY = "1";
    expect(auth2ClientAddress(req("198.51.100.7, 203.0.113.9"))).toBe("203.0.113.9");
    expect(auth2ClientAddress(req("garbage, 203.0.113.9"))).toBe("203.0.113.9");
    expect(auth2ClientAddress(req(null))).toBe("10.0.0.1");
  });

  it("with TRUSTED_PROXIES: our proxies are skipped from the right", () => {
    env.TRUST_PROXY = "1";
    env.TRUSTED_PROXIES = "10.0.0.0/8, 192.0.2.10";
    expect(auth2ClientAddress(req("203.0.113.9, 192.0.2.10, 10.1.2.3"))).toBe("203.0.113.9");
    expect(auth2ClientAddress(req("forged, 203.0.113.9, 10.1.2.3"))).toBe("203.0.113.9");
    env.TRUSTED_PROXIES = "not-an-address";
    expect(() => auth2ClientAddress(req("203.0.113.9"))).toThrow(/TRUSTED_PROXIES has an entry/);
  });

  it("through the route: forged entries do not get past the throttle, and two clients behind one proxy are counted apart", async () => {
    env.TRUST_PROXY = "1";
    env.TRUSTED_PROXIES = "10.0.0.0/8";
    const a = await newAccount(route, "proxied");
    let n = 0;
    const forger = browser(route, { address: "10.9.9.9", headers: () => ({ "x-forwarded-for": `198.51.100.${n++}, 203.0.113.50, 10.0.0.2` }) });
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await forger.post("/sign-in/email", { email: a.email, password: "wrong password" })).status);
    expect(codes).toEqual([401, 401, 401, 429, 429]);
    const other = browser(route, { address: "10.9.9.9", headers: () => ({ "x-forwarded-for": "203.0.113.51, 10.0.0.2" }) });
    expect((await other.post("/sign-in/email", { email: a.email, password: PASSWORD })).status).toBe(200);
  });
});

describe("B5: no password oracle", () => {
  it("/verify-password is not offered", async () => {
    const a = await newAccount(route, "oracle");
    expect((await a.b.post("/verify-password", { password: PASSWORD })).status).toBe(404);
  });
});

describe("F1: names and pictures", () => {
  it("refuses a name over 80 characters or with a web address, and flattens line breaks", async () => {
    const tooLong = await browser(route).post<{ code: string }>("/sign-up/email", { name: "x".repeat(81), email: email("long"), password: PASSWORD });
    expect([tooLong.status, tooLong.body.code]).toEqual([400, "NAME_TOO_LONG"]);
    const link = await browser(route).post<{ code: string }>("/sign-up/email", { name: "Win at https://evil.example", email: email("link"), password: PASSWORD });
    expect([link.status, link.body.code]).toEqual([400, "NAME_HAS_LINK"]);
    expect((await browser(route).post("/sign-up/email", { name: "Visit evil.com now", email: email("dom"), password: PASSWORD })).status).toBe(400);
    const address = email("lines");
    expect((await browser(route).post("/sign-up/email", { name: "Ada\r\nBcc: x\u0007", email: address, password: PASSWORD })).status).toBe(200);
    const u = await db.query<{ name: string }>('SELECT name FROM "user" WHERE email=$1', [address]);
    expect(u.rows[0].name).toBe("Ada Bcc: x");
  });

  it("applies the same to update-user, and takes only an https picture", async () => {
    const a = await newAccount(route, "upd");
    expect((await a.b.post("/update-user", { name: "see www.evil.example" })).status).toBe(400);
    expect((await a.b.post("/update-user", { name: "y".repeat(81) })).status).toBe(400);
    expect((await a.b.post("/update-user", { image: "javascript:alert(1)" })).status).toBe(400);
    expect((await a.b.post("/update-user", { image: "http://img.example/a.png" })).status).toBe(400);
    expect((await a.b.post("/update-user", { image: "https://img.example/a.png" })).status).toBe(200);
    expect((await a.b.post("/update-user", { name: "  Ada\tLovelace " })).status).toBe(200);
    const u = await db.query<{ name: string }>('SELECT name FROM "user" WHERE id=$1', [a.userId]);
    expect(u.rows[0].name).toBe("Ada Lovelace");
  });
});

describe("F2: audit lines name the account, not the request", () => {
  it("a second sign-up for a confirmed address writes no sign-up line", async () => {
    const a = await newAccount(route, "audited");
    const count = async () => (await db.query("SELECT 1 FROM audit_log WHERE actor=$1 AND action='account.signed_up'", [a.email])).rowCount;
    expect(await count()).toBe(1);
    await browser(route).post("/sign-up/email", { name: "Mallory", email: a.email, password: "other password 1" });
    await new Promise((r) => setTimeout(r, 300));
    expect(await count()).toBe(1);
  });
});

describe("F4 and F5: settings checked at start", () => {
  it("refuses a short, repetitive or dictionary-like secret and takes a random one", () => {
    expect(secretProblem("short")).toMatch(/at least 32/);
    expect(secretProblem("a".repeat(48))).toMatch(/not random enough/);
    expect(secretProblem("abababababababababababababababababab")).toMatch(/not random enough/);
    expect(secretProblem(`my-better-auth-secret-${goodSecret()}`)).toMatch(/word/);
    for (let i = 0; i < 50; i++) expect(secretProblem(goodSecret())).toBeNull();
  });

  it("ready() runs the checks when AUTH2 is on, before any query", async () => {
    const dbm = await import("@/lib/db");
    const g = globalThis as unknown as { __c2rReady?: unknown };
    const keep = env.BETTER_AUTH_SECRET;
    env.BETTER_AUTH_SECRET = "x".repeat(40);
    delete g.__c2rReady;
    await expect(dbm.ready()).rejects.toThrow(/not random enough/);
    env.BETTER_AUTH_SECRET = keep;
    delete g.__c2rReady;
    await dbm.ready();
  });

  /** The settings as resolved now (the five-second cache forgotten, review N15). */
  const fresh = async () => {
    const c = await import("@/lib/auth2/config");
    c.forgetAuth2Switch();
    return c.resolveAuth2Config(db);
  };
  const saveBase = async (v: string | null) => (await import("@/lib/auth2/config")).writeAuth2Setting(db, "auth2.baseUrl", v);

  it("N13: ready() runs the checks when the switch is on in the database, with no AUTH2 in the environment", async () => {
    const dbm = await import("@/lib/db");
    const c = await import("@/lib/auth2/config");
    const g = globalThis as unknown as { __c2rReady?: unknown };
    const keep = { secret: env.BETTER_AUTH_SECRET, auth2: env.AUTH2 };
    await c.writeAuth2Setting(db, "auth2.enabled", true);
    delete env.AUTH2;
    env.BETTER_AUTH_SECRET = "x".repeat(40);
    try {
      delete g.__c2rReady;
      await expect(dbm.ready()).rejects.toThrow(/not random enough/);
      // Off in the database: a weak value nobody uses does not stop the app.
      await c.writeAuth2Setting(db, "auth2.enabled", null);
      delete g.__c2rReady;
      await expect(dbm.ready()).resolves.not.toThrow();
    } finally {
      env.BETTER_AUTH_SECRET = keep.secret;
      env.AUTH2 = keep.auth2;
      await c.writeAuth2Setting(db, "auth2.enabled", null);
      delete g.__c2rReady;
      await dbm.ready();
    }
  });

  it("with no secret set, one is made, stored where requests cannot read it, and kept", async () => {
    const keep = env.BETTER_AUTH_SECRET;
    delete env.BETTER_AUTH_SECRET;
    try {
      const first = await fresh();
      expect(secretProblem(first.secret)).toBeNull();
      expect((await fresh()).secret).toBe(first.secret);
      const { WITHHELD } = await import("@/lib/auth2/dbRoles");
      expect(WITHHELD).toContain("auth2_secrets");
      // An environment value still wins.
      env.BETTER_AUTH_SECRET = keep;
      expect((await fresh()).secret).toBe(keep);
    } finally {
      env.BETTER_AUTH_SECRET = keep;
    }
  });

  it("in production a missing or http address is a warning, never a refusal", async () => {
    env.NODE_ENV = "production";
    delete env.BETTER_AUTH_URL;
    await saveBase(null);
    const none = await fresh();
    expect(none.baseURL).toBeNull();
    expect(none.warnings.join(" ")).toMatch(/not set yet/);
    env.BETTER_AUTH_URL = "http://app.example.test";
    const http = await fresh();
    expect(http.baseURL).toBe("http://app.example.test");
    expect(http.warnings.join(" ")).toMatch(/not https/);
    delete env.BETTER_AUTH_URL;
    await saveBase("https://saved.example.test/");
    try {
      const saved = await fresh();
      expect(saved.baseURL).toBe("https://saved.example.test");
      expect(saved.warnings).toEqual([]);
      env.BETTER_AUTH_URL = "https://env.example.test";
      expect((await fresh()).baseURL).toBe("https://env.example.test");
    } finally {
      await saveBase(null);
    }
  });

  it("N15: the resolved settings are kept for a few seconds, and a stored change is seen at once", async () => {
    const c = await import("@/lib/auth2/config");
    const before = await fresh();
    await db.query(`INSERT INTO auth2_settings (key, value) VALUES ('auth2.trustedOrigins', '["https://other.example.test"]') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
    try {
      // Written behind its back: the cached answer stands for now...
      expect((await c.resolveAuth2Config(db)).trustedOrigins).toEqual(before.trustedOrigins);
      // ...and a change through writeAuth2Setting is seen at once.
      await c.writeAuth2Setting(db, "auth2.trustedOrigins", ["https://third.example.test"]);
      expect((await c.resolveAuth2Config(db)).trustedOrigins).toContain("https://third.example.test");
    } finally {
      await c.writeAuth2Setting(db, "auth2.trustedOrigins", null);
    }
  });
});

describe("F6 and F7: codes", () => {
  it("a malformed code does not use up its time step; trust-this-device is never set", async () => {
    const a = await newAccount(route, "codes");
    const en = await a.b.post<{ totpURI: string }>("/two-factor/enable", { password: PASSWORD });
    expect((await a.b.post("/two-factor/verify-totp", { code: authenticatorCode(en.body.totpURI, Date.now() - 30_000) })).status).toBe(200);
    await forgetLastCode(db, a.userId);

    const b = browser(route);
    await b.post("/sign-in/email", { email: a.email, password: PASSWORD });
    const code = authenticatorCode(en.body.totpURI);
    expect((await b.post("/two-factor/verify-totp", { code: ` ${code}` })).status).toBe(401);
    expect((await b.post("/two-factor/verify-totp", { code: `${code}\n` })).status).toBe(401);
    const ok = await b.post("/two-factor/verify-totp", { code, trustDevice: true });
    expect(ok.status).toBe(200);
    expect(ok.headers.getSetCookie().some((c) => /trust_device=[^;]/.test(c))).toBe(false);
    expect([...b.jar.keys()].some((k) => k.includes("trust_device"))).toBe(false);
  });
});
