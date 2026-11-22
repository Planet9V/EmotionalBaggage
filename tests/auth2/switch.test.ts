// AUTH2 off (the default, and the live site): nothing of the new sign-in answers, and the old sign-in is unchanged.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  delete process.env.AUTH2;
});

afterAll(() => {
  delete process.env.AUTH2;
});

const req = (method: string, path: string, init: { origin?: string; body?: unknown } = {}) =>
  new Request(`http://localhost:3322/api/auth2${path}`, {
    method,
    headers: { host: "localhost:3322", ...(init.origin ? { origin: init.origin } : {}), ...(init.body ? { "content-type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

describe("with AUTH2 off", () => {
  it("every address under /api/auth2 answers 404, for every method and origin", async () => {
    const route = await import("@/app/api/auth2/[...all]/route");
    for (const v of ["", "0", "off", "false", "no"]) {
      if (v) process.env.AUTH2 = v;
      else delete process.env.AUTH2;
      for (const path of ["/get-session", "/ok", "/anything"]) expect((await route.GET(req("GET", path))).status).toBe(404);
      for (const path of ["/sign-up/email", "/sign-in/email", "/sign-out", "/two-factor/verify-totp", "/request-password-reset"]) {
        expect((await route.POST(req("POST", path, { origin: "http://localhost:3322", body: { email: "a@b.test", password: "x" } }))).status).toBe(404);
        expect((await route.POST(req("POST", path, { origin: "https://evil.example", body: {} }))).status).toBe(404);
      }
    }
  });

  it("does not build the new sign-in or need its secret", async () => {
    delete process.env.AUTH2;
    const saved = process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_SECRET;
    const g = globalThis as unknown as { __c2rAuth2?: unknown };
    delete g.__c2rAuth2;
    const route = await import("@/app/api/auth2/[...all]/route");
    expect((await route.POST(req("POST", "/sign-in/email", { origin: "http://localhost:3322", body: {} }))).status).toBe(404);
    expect(g.__c2rAuth2).toBeUndefined();
    if (saved !== undefined) process.env.BETTER_AUTH_SECRET = saved;
  });

  it("the old sign-in still answers", async () => {
    const { POST } = await import("@/app/api/auth/sign-in/route");
    const res = await POST(new Request("http://localhost:3322/api/auth/sign-in", { method: "POST", headers: { host: "localhost:3322", "content-type": "application/json" }, body: JSON.stringify({ username: "zz-nobody", password: "wrong password" }) }));
    expect(res.status).toBe(401);
  });

  it("with AUTH2 on but no secret, the new sign-in refuses to start with a plain sentence", async () => {
    process.env.AUTH2 = "1";
    const saved = process.env.BETTER_AUTH_SECRET;
    process.env.BETTER_AUTH_SECRET = "short";
    const g = globalThis as unknown as { __c2rAuth2?: unknown };
    delete g.__c2rAuth2;
    const { auth2 } = await import("@/lib/auth2/server");
    await expect(auth2()).rejects.toThrow(/BETTER_AUTH_SECRET must be set to at least 32 random characters/);
    if (saved !== undefined) process.env.BETTER_AUTH_SECRET = saved;
    else delete process.env.BETTER_AUTH_SECRET;
    delete process.env.AUTH2;
  });
});
