// The platform admin area (WS10a): nothing in it may block the app. With the settings and credentials tables
// empty, the overview, every section's read and the public welcome page's levels still load; every accessor
// answers a typed "not configured". Then each section's store and test, against small stand-ins on 127.0.0.1:
// Stripe (GET /v1/balance), an SMTP server, and a Kokoro speech server (its OpenAI-compatible speech interface). No real service
// is called and no real secret is used.
import { createServer as httpServer, type Server } from "node:http";
import { createServer as tcpServer, type Server as TcpServer } from "node:net";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pool, q } from "@/lib/db";
import { GET as overviewGet } from "@/app/api/admin/overview/route";
import { GET as statusGet } from "@/app/api/admin/status/route";
import { DELETE as plansDelete, GET as plansGet, PUT as plansPut } from "@/app/api/admin/plans/route";
import { GET as paymentsGet } from "@/app/api/admin/payments/route";
import { GET as settingsGet, PUT as settingsPut } from "@/app/api/admin/settings/route";
import { GET as credsGet } from "@/app/api/admin/credentials/route";
import { PUT as credPut } from "@/app/api/admin/credentials/[provider]/route";
import { POST as testPost } from "@/app/api/admin/test/route";
import { GET as envGet } from "@/app/api/admin/environment/route";
import { getStripeSettings } from "@/lib/admin/stripe";
import { getMailSender, MailNotConfigured } from "@/lib/admin/mail";
import { getSpeechSynthesizer, getVoiceSettings } from "@/lib/voice/speech";
import { publicLevels } from "@/lib/admin/plans";
import { builtInCatalogue } from "@/lib/admin/planSchema";
import { setServiceBaseForTests } from "@/lib/secretOrigin";
import { setConnectionTestLimit } from "@/lib/admin/connection";
import { DELETE as credDelete } from "@/app/api/admin/credentials/[provider]/[field]/route";
import { GET as accessGet } from "@/app/api/admin/access/route";
import { PLATFORM_ADMIN_NOTICE } from "@/lib/admin/guard";
import { POST as passwordPost } from "@/app/api/auth/password/route";
import { readAudit } from "@/lib/admin/audit";
import { POST as voiceOptions } from "@/app/api/admin/voice/options/route";
import { anonymous, json, read } from "../api/helpers";
import { smtpStandIn } from "./smtpStandIn";

// The platform administrator exists only in the new sign-in (src/lib/admin/platformAdminHook.ts, false until accounts
// slice 2). Here the hook is stood in: most of the file runs as the platform administrator; the blocks about anyone
// else set hook.admin to false, which is how every account of the old sign-in is treated.
const hook = vi.hoisted(() => ({ admin: true }));
vi.mock("@/lib/admin/platformAdminHook", () => ({ platformAdminFromAuth2: async () => hook.admin }));

/** publicLevels() is kept for 60 seconds (review F6): move the clock past that to read what is saved now. */
async function freshLevels() {
  vi.setSystemTime(Date.now() + 61_000);
  return publicLevels();
}

// The welcome page asks Next.js for a request (connection()); a test has no request scope, so only that call is stubbed.
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection: async () => undefined }));

type Row = Record<string, unknown>;
let savedSettings: Row[] = [];
let savedCreds: Row[] = [];

const KEY_TEST = "sk_test_" + "a1B2c3D4e5F6g7H8i9J0zzzz";
const PUB_TEST = "pk_test_" + "a1B2c3D4e5F6g7H8i9J0";
const KEY_LIVE = "sk_live_" + "a1B2c3D4e5F6g7H8i9J0yyyy";

async function emptyStores() {
  await q("DELETE FROM settings");
  await q("DELETE FROM credentials");
}

beforeAll(async () => {
  savedSettings = await q("SELECT key, value FROM settings");
  savedCreds = await q("SELECT provider, field, value, bound_origin FROM credentials");
  setConnectionTestLimit(3000);
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterAll(async () => {
  vi.useRealTimers();
  setConnectionTestLimit(null);
  setServiceBaseForTests("stripe", null);
  await emptyStores();
  for (const r of savedSettings) await q("INSERT INTO settings (key, value) VALUES ($1, $2)", [r.key, JSON.stringify(r.value)]);
  for (const c of savedCreds) await q("INSERT INTO credentials (provider, field, value, bound_origin) VALUES ($1,$2,$3,$4)", [c.provider, c.field, c.value, c.bound_origin]);
  await pool().end();
});

beforeEach(async () => {
  hook.admin = true;
  await emptyStores();
});

const get = (h: (r: Request) => Promise<Response>, path: string) => h(json("GET", undefined, `http://test.local${path}`));
const call = <C,>(h: (r: Request, c: C) => Promise<Response>, method: string, path: string, body?: unknown, ctx?: C) => h(json(method, body, `http://test.local${path}`), ctx as C);
const provider = (id: string) => ({ params: Promise.resolve({ provider: id }) });

describe("with empty settings and credentials tables, nothing is a blocker", () => {
  it("the overview loads and names every service as not configured, with what is off and nothing failing", async () => {
    const r = await read<{ services: { key: string; state: string; without: string; source: string | null }[] }>(await get(overviewGet, "/api/admin/overview"));
    expect(r.status).toBe(200);
    const by = Object.fromEntries(r.body.services.map((s) => [s.key, s]));
    for (const k of ["payments", "email", "voice", "reasoningModel", "embeddingModel", "research", "amazon", "x", "instagram"]) {
      expect(by[k]?.state, k).toBe("not-configured");
      expect(by[k]?.without.length, k).toBeGreaterThan(10);
    }
    expect(by.pricing).toMatchObject({ state: "configured", source: "built-in" });
    expect(by.database.state).not.toBe("not-configured");
  });

  it("every section's read answers 200", async () => {
    for (const [h, p] of [[statusGet, "/api/admin/status"], [plansGet, "/api/admin/plans"], [paymentsGet, "/api/admin/payments"], [settingsGet, "/api/admin/settings"], [credsGet, "/api/admin/credentials"], [envGet, "/api/admin/environment"]] as const) {
      expect((await get(h as (r: Request) => Promise<Response>, p)).status, p).toBe(200);
    }
    const s = await read<{ settings: { mail: unknown; voice: unknown } }>(await get(settingsGet, "/api/admin/settings"));
    expect(s.body.settings.mail).toEqual({ mode: "none" });
    expect(s.body.settings.voice).toEqual({ provider: "none" });
  });

  it("the welcome page's levels are the built-in four, prices hidden, exactly as content.ts had them", async () => {
    const l = await freshLevels();
    expect(l.showPrices).toBe(false);
    expect(l.levels.map((x) => [x.key, x.name, x.paid, x.action])).toEqual([
      ["free", "Free", false, "request"],
      ["maker", "Maker", true, "request"],
      ["studio", "Studio", true, "request"],
      ["self", "Self-hosted", false, "run"],
    ]);
  });

  it("the welcome page renders, with the levels section and prices hidden", async () => {
    const { default: WelcomePage } = await import("@/app/welcome/page");
    const { renderToString } = await import("react-dom/server");
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
    const { createElement } = await import("react");
    const html = renderToString(createElement(QueryClientProvider, { client: new QueryClient() }, await WelcomePage()));
    const start = html.indexOf('id="levels"');
    expect(start).toBeGreaterThan(0);
    const levels = html.slice(start, html.indexOf("</section>", start));
    expect(levels).toContain("Self-hosted");
    expect(levels).toContain("Price to be announced");
    expect(levels).not.toContain("$29");
  }, 60_000);

  it("every accessor answers a typed not configured, and the mail sender logs no content", async () => {
    expect(await getStripeSettings()).toMatchObject({ configured: false });
    expect(await getVoiceSettings()).toMatchObject({ configured: false });
    expect(await getSpeechSynthesizer()).toMatchObject({ configured: false });
    const m = await getMailSender();
    expect(m.configured).toBe(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const link = "https://app.example/auth/reset?token=SECRET-TOKEN-123";
    await expect(m.sender.send({ to: "ada@example.test", subject: "Choose a new password", text: `Follow ${link}`, html: `<a href="${link}">x</a>` })).rejects.toBeInstanceOf(MailNotConfigured);
    const logged = [...warn.mock.calls, ...info.mock.calls].flat().join(" ");
    expect(logged).not.toContain("SECRET-TOKEN-123");
    expect(logged).not.toContain("ada@example.test");
    warn.mockRestore();
    info.mockRestore();
  });

  it("the tests for Payments, Email and Voice say plainly that nothing is set up", async () => {
    for (const kind of ["stripe", "smtp", "voice"]) {
      const r = await read<{ ok: boolean; message: string }>(await call(testPost, "POST", "/api/admin/test", { kind }));
      expect(r.status, kind).toBe(200);
      expect(r.body.ok, kind).toBe(false);
      expect(r.body.message, kind).toMatch(/No |not set up|Save it first/);
    }
  });

  it("a session is required, and the admin guard runs on the new routes", async () => {
    for (const h of [overviewGet, plansGet, paymentsGet, envGet]) expect((await h(anonymous("GET"))).status).toBe(401);
  });
});

describe("anyone but the platform administrator (every account of the old sign-in)", () => {
  beforeEach(() => {
    hook.admin = false;
  });

  const state = async () => ({
    settings: await q("SELECT key, value FROM settings ORDER BY key"),
    credentials: await q("SELECT provider, field, value FROM credentials ORDER BY provider, field"),
    audit: (await q<{ n: string }>("SELECT max(id)::text AS n FROM audit_log"))[0].n,
  });
  /** Every new power: the plan catalogue, the new providers, the mail and voice settings, the new test kinds. */
  const newPowers = (): [string, () => Promise<Response>][] => {
    const c = builtInCatalogue();
    c.showPrices = true;
    c.tiers[0].name = "PWNED by a visitor";
    c.tiers[1].priceMonthly = 0.01;
    return [
      ["PUT plans", () => call(plansPut, "PUT", "/api/admin/plans", c)],
      ["DELETE plans", () => call(plansDelete, "DELETE", "/api/admin/plans")],
      ["PUT settings mail", () => call(settingsPut, "PUT", "/api/admin/settings", { mail: { mode: "smtp", fromName: "X", fromAddress: "x@example.test", host: "127.0.0.1", port: 2525, security: "none", username: null } })],
      ["PUT settings voice", () => call(settingsPut, "PUT", "/api/admin/settings", { voice: { provider: "kokoro", baseUrl: "http://127.0.0.1:1/v1", model: "kokoro", voice: "af_heart", speed: 1 } })],
      ["POST voice options", () => call(voiceOptions, "POST", "/api/admin/voice/options", { baseUrl: "http://127.0.0.1:1/v1" })],
      ["PUT settings mail with a model", () => call(settingsPut, "PUT", "/api/admin/settings", { plannerUrl: "http://127.0.0.1:1", mail: { mode: "none" } })],
      ["PUT stripe", () => call(credPut, "PUT", "/api/admin/credentials/stripe", { fields: { publishableKey: PUB_TEST, secretKey: KEY_TEST } }, provider("stripe"))],
      ["PUT smtp", () => call(credPut, "PUT", "/api/admin/credentials/smtp", { fields: { password: "visitor-password-1" } }, provider("smtp"))],
      ["PUT kokoro", () => call(credPut, "PUT", "/api/admin/credentials/kokoro", { fields: { apiKey: "visitor-key-123456" } }, provider("kokoro"))],
      ["DELETE stripe secretKey", () => call(credDelete, "DELETE", "/api/admin/credentials/stripe/secretKey", undefined, { params: Promise.resolve({ provider: "stripe", field: "secretKey" }) })],
      ["test stripe", () => call(testPost, "POST", "/api/admin/test", { kind: "stripe" })],
      ["test smtp", () => call(testPost, "POST", "/api/admin/test", { kind: "smtp" })],
      ["test mail-message", () => call(testPost, "POST", "/api/admin/test", { kind: "mail-message", to: "x@example.test" })],
      ["test voice", () => call(testPost, "POST", "/api/admin/test", { kind: "voice" })],
    ];
  };
  const refusedAll = async () => {
    for (const [name, send] of newPowers()) {
      const r = await read<{ error: string }>(await send());
      expect({ name, ...r }).toEqual({ name, status: 403, body: { error: PLATFORM_ADMIN_NOTICE } });
    }
  };
  const seed = async () => {
    await q("INSERT INTO settings (key, value) VALUES ('plans.catalogue', $1)", [JSON.stringify(builtInCatalogue())]);
    await q("INSERT INTO credentials (provider, field, value, bound_origin) VALUES ('stripe','secretKey',$1,NULL),('stripe','publishableKey',$2,NULL),('stripe','webhookSecret','whsec_abcdefghijklmnop9876',NULL),('smtp','password','Tr0ub4dor-and-3xy','smtp://mail.internal.example:587')", [KEY_TEST, PUB_TEST]);
    await q("INSERT INTO settings (key, value) VALUES ('mail.smtp', $1)", [JSON.stringify({ mode: "smtp", fromName: "Owner", fromAddress: "owner@example.com", host: "mail.internal.example", port: 587, security: "starttls", username: "smtp-user@example.com" })]);
    await q("INSERT INTO settings (key, value) VALUES ('voice.tts', $1)", [JSON.stringify({ provider: "kokoro", baseUrl: "http://speech.internal.example/v1", model: "kokoro", voice: "af_heart", speed: 1 })]);
  };

  it("is told per capability that the new powers are the platform administrator's", async () => {
    expect(await read(await get(accessGet, "/api/admin/access"))).toEqual({
      status: 200,
      body: { platformAdmin: false, capabilities: { plans: false, payments: false, email: false, voice: false }, notice: PLATFORM_ADMIN_NOTICE },
    });
  });

  it("reads every section, but sees the new powers only as set or not set (review F5)", async () => {
    await seed();
    for (const [h, p] of [[overviewGet, "/api/admin/overview"], [statusGet, "/api/admin/status"], [plansGet, "/api/admin/plans"], [paymentsGet, "/api/admin/payments"], [settingsGet, "/api/admin/settings"], [credsGet, "/api/admin/credentials"], [envGet, "/api/admin/environment"]] as const) {
      expect((await get(h as (r: Request) => Promise<Response>, p)).status, p).toBe(200);
    }
    const creds = await read<{ providers: { id: string; locked?: boolean; fields: { name: string; set: boolean; last4: string | null; value: string | null; boundTo?: string | null; masked?: boolean }[] }[] }>(await get(credsGet, "/api/admin/credentials"));
    for (const p of creds.body.providers.filter((x) => ["stripe", "smtp", "kokoro"].includes(x.id))) {
      expect(p.locked, p.id).toBe(true);
      for (const f of p.fields.filter((x) => x.set)) expect({ id: `${p.id}.${f.name}`, last4: f.last4, value: f.value, boundTo: f.boundTo, masked: f.masked }).toEqual({ id: `${p.id}.${f.name}`, last4: null, value: null, boundTo: null, masked: true });
    }
    const text = JSON.stringify(creds.body);
    for (const leak of ["zzzz", "9876", "mail.internal.example", PUB_TEST]) expect(text, leak).not.toContain(leak);
    const settings = await read<{ settings: { mail: unknown; voice: unknown } }>(await get(settingsGet, "/api/admin/settings"));
    expect(settings.body.settings.mail).toEqual({ mode: "smtp", hidden: true });
    expect(settings.body.settings.voice).toEqual({ provider: "kokoro", hidden: true });
    expect(await read(await get(paymentsGet, "/api/admin/payments"))).toMatchObject({ body: { configured: true, hidden: true } });
    const ov = await (await get(overviewGet, "/api/admin/overview")).text();
    for (const leak of ["mail.internal.example", "owner@example.com", "speech.internal.example", "af_heart", " test keys"]) expect(ov, leak).not.toContain(leak);
  });

  it("every new-power write and test answers 403 with the one sentence, and changes nothing; /welcome is unchanged", async () => {
    await seed();
    const levels = await freshLevels();
    const before = await state();
    await refusedAll();
    expect(await state()).toEqual(before);
    expect(await freshLevels()).toEqual(levels);
  });

  it("review B1: changing the account's own password opens nothing", async () => {
    const user = (await q<{ id: string; password_hash: string; password_changed_at: Date | null }>("SELECT id, password_hash, password_changed_at FROM users WHERE username='demo'"))[0];
    try {
      await q("UPDATE users SET password_changed_at = NULL WHERE id=$1", [user.id]);
      const pw = await passwordPost(json("POST", { current: "demo", next: "visitor-owned-pass-1" }, "http://test.local/api/auth/password"));
      expect(pw.status).toBe(200);
      const levels = await freshLevels();
      const before = await state();
      await refusedAll();
      expect(await state()).toEqual(before);
      expect((await freshLevels()).levels.map((l) => l.name)).toEqual(levels.levels.map((l) => l.name));
      expect((await freshLevels()).showPrices).toBe(false);
    } finally {
      await q("UPDATE users SET password_hash=$2, password_changed_at=$3 WHERE id=$1", [user.id, user.password_hash, user.password_changed_at]);
    }
  });

  it("everything that existed before this branch is open, as on main", async () => {
    expect((await call(settingsPut, "PUT", "/api/admin/settings", { plannerUrl: "http://127.0.0.1:1" })).status).toBe(200);
    expect((await call(credPut, "PUT", "/api/admin/credentials/openrouter", { fields: { apiKey: "sk-or-v1-anyone-0000000000" } }, provider("openrouter"))).status).toBe(200);
    expect((await call(testPost, "POST", "/api/admin/test", { kind: "database" })).status).toBe(200);
  });

  it("review B5: a test by anyone else leaves admin.checks and the short credentials list alone", async () => {
    await q("INSERT INTO settings (key, value) VALUES ('audit.credentials', $1)", [JSON.stringify([{ at: "2026-01-01T00:00:00Z", action: "replaced", provider: "stripe", field: "secretKey" }])]);
    const short = JSON.stringify(await readAudit({ platformAdmin: true }));
    for (let i = 0; i < 5; i++) await call(testPost, "POST", "/api/admin/test", { kind: "database" });
    expect(await q("SELECT 1 FROM settings WHERE key='admin.checks'")).toHaveLength(0);
    expect(JSON.stringify(await readAudit({ platformAdmin: true }))).toBe(short);
  });
});

describe("Pricing and tiers", () => {
  const good = () => builtInCatalogue();

  it("refuses negative prices, duplicate keys and a catalogue with no tier shown, naming the field", async () => {
    const neg = good();
    neg.tiers[1].priceMonthly = -1;
    let r = await read<{ issues: { field: string }[] }>(await call(plansPut, "PUT", "/api/admin/plans", neg));
    expect(r.status).toBe(400);
    expect(r.body.issues[0].field).toBe("tiers.1.priceMonthly");
    const dup = good();
    dup.tiers[2].key = "maker";
    r = await read(await call(plansPut, "PUT", "/api/admin/plans", dup));
    expect(r.status).toBe(400);
    expect(r.body.issues[0].field).toBe("tiers.2.key");
    const hidden = good();
    for (const t of hidden.tiers) t.shown = false;
    r = await read(await call(plansPut, "PUT", "/api/admin/plans", hidden));
    expect(r.status).toBe(400);
    expect(r.body.issues[0].field).toBe("tiers");
  });

  it("a saved catalogue is what the public page shows, with before and after in the audit log; reset goes back", async () => {
    const c = good();
    c.showPrices = true;
    c.tiers[1].priceMonthly = 19;
    c.tiers[1].stripePriceMonthly = "price_TestMaker1";
    c.tiers[2].shown = false;
    const r = await read<{ source: string }>(await call(plansPut, "PUT", "/api/admin/plans", c));
    expect(r.status).toBe(200);
    expect(r.body.source).toBe("database");
    const l = await freshLevels();
    expect(l.showPrices).toBe(true);
    expect(l.levels.map((x) => x.key)).toEqual(["free", "maker", "self"]);
    expect(l.levels[1]).toMatchObject({ price: "$19", per: "a month" });
    const line = await q<{ detail: { before: unknown; after: { showPrices: boolean } } }>("SELECT detail FROM audit_log WHERE action='setting.changed' AND detail->>'key'='plans.catalogue' ORDER BY id DESC LIMIT 1");
    expect(line[0].detail.after.showPrices).toBe(true);
    expect(line[0].detail.before).toBeTruthy();
    expect((await call(plansDelete, "DELETE", "/api/admin/plans")).status).toBe(200);
    expect((await freshLevels()).showPrices).toBe(false);
  });

  it("a saved document that no longer validates falls back to the built-in catalogue instead of breaking the page", async () => {
    await q("INSERT INTO settings (key, value) VALUES ('plans.catalogue', '{\"tiers\": 5}')");
    expect((await freshLevels()).levels).toHaveLength(4);
  });
});

// --- stand-ins -------------------------------------------------------------------------------------------------

type Seen = { method: string; url: string; headers: Record<string, string | string[] | undefined>; body: string };
function standIn(answer: (s: Seen) => { status: number; type?: string; body: string | Buffer }): Promise<{ url: string; seen: Seen[]; close: () => Promise<void> }> {
  const seen: Seen[] = [];
  const srv: Server = httpServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const s = { method: req.method ?? "", url: req.url ?? "", headers: req.headers, body };
      seen.push(s);
      const a = answer(s);
      res.writeHead(a.status, { "content-type": a.type ?? "application/json" });
      res.end(a.body);
    });
  });
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`, seen, close: () => new Promise((r) => srv.close(() => r())) })));
}

describe("Payments (Stripe)", () => {
  let stripe: Awaited<ReturnType<typeof standIn>>;
  beforeAll(async () => {
    stripe = await standIn((s) => (s.headers.authorization === `Bearer ${KEY_TEST}` ? { status: 200, body: JSON.stringify({ object: "balance", livemode: false, available: [] }) } : { status: 401, body: JSON.stringify({ error: { message: "Invalid API Key provided" } }) }));
    setServiceBaseForTests("stripe", stripe.url);
  });
  afterAll(() => stripe.close());

  it("refuses keys that are not Stripe's shape, before saving", async () => {
    const r = await read<{ issues: { field: string; problem: string }[] }>(await call(credPut, "PUT", "/api/admin/credentials/stripe", { fields: { secretKey: "hello-world-1234567" } }, provider("stripe")));
    expect(r.status).toBe(400);
    expect(r.body.issues[0].field).toBe("fields.secretKey");
  });

  it("saves the keys write-only, derives the mode, and tests with a harmless read", async () => {
    expect((await call(credPut, "PUT", "/api/admin/credentials/stripe", { fields: { publishableKey: PUB_TEST, secretKey: KEY_TEST } }, provider("stripe"))).status).toBe(200);
    const list = await (await get(credsGet, "/api/admin/credentials")).text();
    expect(list).not.toContain(KEY_TEST);
    expect(list).toContain("zzzz"); // the last four only
    expect(await read(await get(paymentsGet, "/api/admin/payments"))).toMatchObject({ status: 200, body: { configured: true, mode: "test", webhookSecret: false } });
    const s = await getStripeSettings();
    expect(s).toMatchObject({ configured: true, mode: "test", secretKey: KEY_TEST });
    const t = await read<{ ok: boolean; message: string }>(await call(testPost, "POST", "/api/admin/test", { kind: "stripe" }));
    expect(t.body.ok).toBe(true);
    expect(t.body.message).toMatch(/test key/);
    expect(JSON.stringify(t.body)).not.toContain(KEY_TEST);
    expect(stripe.seen.at(-1)).toMatchObject({ method: "GET", url: "/v1/balance" });
    const audit = await q<{ detail: unknown }>("SELECT detail FROM audit_log WHERE action LIKE 'credential.%' ORDER BY id DESC LIMIT 5");
    expect(JSON.stringify(audit)).not.toContain(KEY_TEST);
  });

  it("a live secret with a test publishable key is not configured, and a refused key fails the test in plain words", async () => {
    await call(credPut, "PUT", "/api/admin/credentials/stripe", { fields: { publishableKey: PUB_TEST, secretKey: KEY_LIVE } }, provider("stripe"));
    expect(await getStripeSettings()).toMatchObject({ configured: false, reason: expect.stringMatching(/test key and the secret key a live key/) });
    const t = await read<{ ok: boolean; message: string }>(await call(testPost, "POST", "/api/admin/test", { kind: "stripe" }));
    expect(t.body.ok).toBe(false);
    const o = await read<{ services: { key: string; state: string }[] }>(await get(overviewGet, "/api/admin/overview"));
    expect(o.body.services.find((x) => x.key === "payments")?.state).toBe("not-configured");
  });
});

describe("Email", () => {
  const PW = "standin-password-9876";
  let smtp: Awaited<ReturnType<typeof smtpStandIn>>;
  beforeAll(async () => {
    smtp = await smtpStandIn(PW);
  });
  afterAll(() => smtp.close());
  const mail = (port: number, host = "127.0.0.1") => ({ mode: "smtp", fromName: "C2R", fromAddress: "noreply@example.test", host, port, security: "none", username: "c2r" });

  it("refuses an invalid server form, naming the field", async () => {
    const r = await read<{ issues: { field: string }[] }>(await call(settingsPut, "PUT", "/api/admin/settings", { mail: { ...mail(smtp.port), port: 70000 } }));
    expect(r.status).toBe(400);
    expect(r.body.issues[0].field).toBe("mail.port");
  });

  it("tests the server, sends a test message, and keeps the password out of every answer", async () => {
    expect((await call(settingsPut, "PUT", "/api/admin/settings", { mail: mail(smtp.port) })).status).toBe(200);
    // a user name without a password is "not configured", in plain words
    expect(await getMailSender()).toMatchObject({ configured: false, reason: expect.stringMatching(/no password is saved/) });
    expect((await call(credPut, "PUT", "/api/admin/credentials/smtp", { fields: { password: PW } }, provider("smtp"))).status).toBe(200);
    const v = await read<{ ok: boolean; message: string }>(await call(testPost, "POST", "/api/admin/test", { kind: "smtp" }));
    expect(v.body).toMatchObject({ ok: true });
    const m = await read<{ ok: boolean; message: string }>(await call(testPost, "POST", "/api/admin/test", { kind: "mail-message", to: "ada@example.test" }));
    expect(m.body.ok).toBe(true);
    expect(smtp.messages.at(-1)).toMatch(/Subject: Test message from Concept to Realization/);
    expect(JSON.stringify([v.body, m.body])).not.toContain(PW);
    const o = await read<{ services: { key: string; state: string; lastCheck: { ok: boolean } | null }[] }>(await get(overviewGet, "/api/admin/overview"));
    expect(o.body.services.find((x) => x.key === "email")).toMatchObject({ state: "configured", lastCheck: { ok: true } });
  });

  it("a wrong password fails in plain words and the overview says configured but failing", async () => {
    await call(settingsPut, "PUT", "/api/admin/settings", { mail: mail(smtp.port) });
    await call(credPut, "PUT", "/api/admin/credentials/smtp", { fields: { password: "not-the-password" } }, provider("smtp"));
    const v = await read<{ ok: boolean; message: string }>(await call(testPost, "POST", "/api/admin/test", { kind: "smtp" }));
    expect(v.body.ok).toBe(false);
    expect(v.body.message).toMatch(/refused the user name or password/);
    expect(v.body.message).not.toContain("not-the-password");
    const o = await read<{ services: { key: string; state: string }[] }>(await get(overviewGet, "/api/admin/overview"));
    expect(o.body.services.find((x) => x.key === "email")?.state).toBe("failing");
  });

  it("moving to another server removes the saved password, says so, and records it without the value", async () => {
    await call(settingsPut, "PUT", "/api/admin/settings", { mail: mail(smtp.port) });
    await call(credPut, "PUT", "/api/admin/credentials/smtp", { fields: { password: PW } }, provider("smtp"));
    const r = await read<{ notices: string[] }>(await call(settingsPut, "PUT", "/api/admin/settings", { mail: mail(smtp.port, "localhost") }));
    expect(r.body.notices.join(" ")).toMatch(/mail password was removed/);
    expect(await q("SELECT 1 FROM credentials WHERE provider='smtp'")).toHaveLength(0);
    const line = await q<{ detail: unknown }>("SELECT detail FROM audit_log WHERE action='credential.removed' ORDER BY id DESC LIMIT 1");
    expect(JSON.stringify(line)).not.toContain(PW);
  });
});

describe("Voice (Kokoro)", () => {
  let speech: Awaited<ReturnType<typeof standIn>>;
  const AUDIO = Buffer.from("ID3-fake-mp3-bytes");
  let lists = true;
  beforeAll(async () => {
    speech = await standIn((s) => {
      if (s.url.startsWith("/v1/audio/speech")) return !s.headers.authorization || s.headers.authorization === "Bearer voice-key-123456789" ? { status: 200, type: "audio/mpeg", body: AUDIO } : { status: 401, body: "{}" };
      if (!lists) return { status: 404, body: "INTERNAL-ONLY" };
      if (s.url === "/v1/audio/voices") return { status: 200, body: JSON.stringify({ voices: ["af_heart", "bm_george", "<script>"] }) };
      if (s.url === "/v1/models") return { status: 200, body: JSON.stringify({ data: [{ id: "kokoro" }, { id: "tts-1" }] }) };
      return { status: 404, body: "{}" };
    });
  });
  afterAll(() => speech.close());
  const kokoro = () => ({ voice: { provider: "kokoro", baseUrl: `${speech.url}/v1`, model: "kokoro", voice: "af_heart", speed: 1 } });

  it("speaks the test sentence; synthesize answers bytes and a content type; the audio is not stored", async () => {
    expect((await call(settingsPut, "PUT", "/api/admin/settings", kokoro())).status).toBe(200);
    expect((await call(credPut, "PUT", "/api/admin/credentials/kokoro", { fields: { apiKey: "voice-key-123456789" } }, provider("kokoro"))).status).toBe(200);
    expect(await getVoiceSettings()).toMatchObject({ configured: true, provider: "kokoro", voice: "af_heart" });
    const s = await getSpeechSynthesizer();
    if (!s.configured) throw new Error(s.reason);
    expect(await s.synth.synthesize("Hello.")).toEqual({ audio: new Uint8Array(AUDIO), contentType: "audio/mpeg" });
    const t = await read<{ ok: boolean; detail: { audio?: string } }>(await call(testPost, "POST", "/api/admin/test", { kind: "voice" }));
    expect(t.body.ok).toBe(true);
    expect(t.body.detail.audio).toBe(`data:audio/mpeg;base64,${AUDIO.toString("base64")}`);
    expect(JSON.parse(speech.seen.at(-1)!.body)).toMatchObject({ model: "kokoro", voice: "af_heart", input: "This is a test of the narration voice.", speed: 1 });
    expect(JSON.stringify(await q("SELECT value FROM settings"))).not.toContain(AUDIO.toString("base64"));
  });

  it("lists the server's voices and models for the pickers, dropping names that are not plain names", async () => {
    lists = true;
    const r = await read<{ voices: { ok: boolean; items: string[] }; models: { ok: boolean; items: string[] } }>(await call(voiceOptions, "POST", "/api/admin/voice/options", { baseUrl: `${speech.url}/v1` }));
    expect(r.body).toEqual({ voices: { ok: true, items: ["af_heart", "bm_george"] }, models: { ok: true, items: ["kokoro", "tts-1"] } });
  });

  it("a server that lists nothing leaves free text, in a fixed sentence that repeats nothing it sent", async () => {
    lists = false;
    try {
      const r = await read<{ voices: { ok: boolean; reason: string }; models: { ok: boolean; reason: string } }>(await call(voiceOptions, "POST", "/api/admin/voice/options", { baseUrl: `${speech.url}/v1` }));
      expect(r.body.voices).toEqual({ ok: false, reason: "The server does not list its voices (HTTP 404). Type the name instead." });
      expect(JSON.stringify(r.body)).not.toContain("INTERNAL-ONLY");
    } finally {
      lists = true;
    }
  });

  it("ElevenLabs and a bare OpenAI-compatible endpoint cannot be saved as a voice provider", async () => {
    for (const p of ["elevenlabs", "openai"]) {
      const r = await call(settingsPut, "PUT", "/api/admin/settings", { voice: { provider: p, model: "m", voice: "v", speed: 1 } });
      expect({ p, status: r.status }).toEqual({ p, status: 400 });
    }
    expect((await call(credPut, "PUT", "/api/admin/credentials/elevenlabs", { fields: { apiKey: "x".repeat(20) } }, provider("elevenlabs"))).status).toBe(400);
  });
});

// OpenRouter's speech API as the project manager read its documentation on 22 Nov 2026 (this machine cannot reach
// openrouter.ai): POST /api/v1/audio/speech, GET /api/v1/models?output_modalities=speech with supported_voices, and
// GET /api/v1/audio/speech/models. The stand-in answers those three; nothing here is checked against the real service.
describe("Voice (OpenRouter)", () => {
  let or: Awaited<ReturnType<typeof standIn>>;
  const KEY = "sk-or-v1-voice-test-0000000000";
  const AUDIO = Buffer.from("ID3-openrouter-mp3");
  let speechStatus = 200;
  beforeAll(async () => {
    or = await standIn((s) => {
      if (s.headers.authorization !== `Bearer ${KEY}`) return { status: 401, body: JSON.stringify({ error: { message: "No auth credentials found" } }) };
      if (s.method === "POST" && s.url === "/api/v1/audio/speech") {
        if (speechStatus !== 200) return { status: speechStatus, body: JSON.stringify({ error: { message: "INTERNAL-ONLY upstream detail" } }) };
        return { status: 200, type: "audio/mpeg", body: AUDIO };
      }
      if (s.url === "/api/v1/models?output_modalities=speech") {
        return {
          status: 200,
          body: JSON.stringify({
            data: [
              { id: "openai/gpt-4o-mini-tts", supported_voices: ["alloy", "nova", "<b>bad</b>"], pricing: { prompt: "0.0000006" } },
              { id: "acme/speech-no-voices", pricing: {} },
            ],
          }),
        };
      }
      if (s.url === "/api/v1/audio/speech/models") return { status: 200, body: JSON.stringify({ data: [{ id: "openai/gpt-4o-mini-tts" }] }) };
      return { status: 404, body: "{}" };
    });
  });
  afterAll(() => {
    setServiceBaseForTests("openrouter", null);
    return or.close();
  });
  /** OpenRouter's built-in address pointed at the stand-in (tests only), and the key bound there. */
  const useStandIn = async () => {
    setServiceBaseForTests("openrouter", `${or.url}/api/v1`);
    expect((await call(settingsPut, "PUT", "/api/admin/settings", { reasoningModel: { provider: "openrouter", baseUrl: `${or.url}/api/v1`, model: "openai/gpt-4o-mini" } })).status).toBe(200);
    expect((await call(credPut, "PUT", "/api/admin/credentials/openrouter", { fields: { apiKey: KEY }, address: `${or.url}/api/v1` }, provider("openrouter"))).status).toBe(200);
  };

  it("lists OpenRouter's speech models, and the chosen model's voices (plain names only)", async () => {
    await useStandIn();
    const r = await read<{ voices: { ok: boolean; items: string[] }; models: { ok: boolean; items: string[] } }>(await call(voiceOptions, "POST", "/api/admin/voice/options", { provider: "openrouter", model: "openai/gpt-4o-mini-tts" }));
    expect(r.status).toBe(200);
    expect(r.body.models).toEqual({ ok: true, items: ["openai/gpt-4o-mini-tts", "acme/speech-no-voices"] });
    expect(r.body.voices).toEqual({ ok: true, items: ["alloy", "nova"] });
    expect(or.seen.some((x) => x.url === "/api/v1/models?output_modalities=speech")).toBe(true);
  });

  it("a model with no supported_voices, or one not listed, leaves free text with a fixed sentence", async () => {
    await useStandIn();
    const none = await read<{ voices: { ok: boolean; reason: string } }>(await call(voiceOptions, "POST", "/api/admin/voice/options", { provider: "openrouter", model: "acme/speech-no-voices" }));
    expect(none.body.voices).toEqual({ ok: false, reason: "OpenRouter did not list the voices of that model. Type the voice instead." });
    const unknown = await read<{ voices: { ok: boolean; reason: string } }>(await call(voiceOptions, "POST", "/api/admin/voice/options", { provider: "openrouter", model: "nobody/nothing" }));
    expect(unknown.body.voices.reason).toBe("That model is not in OpenRouter's list of speech models. Type the name instead.");
    const noModel = await read<{ voices: { ok: boolean; reason: string } }>(await call(voiceOptions, "POST", "/api/admin/voice/options", { provider: "openrouter" }));
    expect(noModel.body.voices.reason).toBe("Choose a model first: the voices depend on it.");
  });

  it("speaks with the OpenRouter key: { model, input, voice, response_format: mp3 }, bytes and a content type back", async () => {
    await useStandIn();
    speechStatus = 200;
    expect((await call(settingsPut, "PUT", "/api/admin/settings", { voice: { provider: "openrouter", model: "openai/gpt-4o-mini-tts", voice: "nova" } })).status).toBe(200);
    const s = await getSpeechSynthesizer();
    if (!s.configured) throw new Error(s.reason);
    expect(await s.synth.synthesize("Hello.")).toEqual({ audio: new Uint8Array(AUDIO), contentType: "audio/mpeg" });
    const sent = or.seen.filter((x) => x.url === "/api/v1/audio/speech").at(-1)!;
    expect(sent.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(sent.body)).toEqual({ model: "openai/gpt-4o-mini-tts", input: "Hello.", voice: "nova", response_format: "mp3" });
    const t = await read<{ ok: boolean; message: string }>(await call(testPost, "POST", "/api/admin/test", { kind: "voice" }));
    expect(t.body).toMatchObject({ ok: true, message: expect.stringMatching(/^OpenRouter spoke the test sentence/) });
  });

  it("an upstream error is a fixed sentence and its status; the body is never repeated", async () => {
    await useStandIn();
    await call(settingsPut, "PUT", "/api/admin/settings", { voice: { provider: "openrouter", model: "openai/gpt-4o-mini-tts", voice: "nova" } });
    speechStatus = 502;
    try {
      const t = await read<{ ok: boolean; message: string }>(await call(testPost, "POST", "/api/admin/test", { kind: "voice" }));
      expect(t.body).toEqual({ ok: false, message: "OpenRouter answered with a server error (HTTP 502)." });
    } finally {
      speechStatus = 200;
    }
  });

  it("without an OpenRouter key, or with one saved for another host, it is not configured and nothing is sent", async () => {
    await call(settingsPut, "PUT", "/api/admin/settings", { voice: { provider: "openrouter", model: "openai/gpt-4o-mini-tts", voice: "nova" } });
    expect(await getSpeechSynthesizer()).toMatchObject({ configured: false, reason: "OpenRouter is chosen, but no OpenRouter key is saved. Add it in Admin, AI models." });
    // a key saved for OpenRouter's own address is not sent to the stand-in the model now points at
    await call(credPut, "PUT", "/api/admin/credentials/openrouter", { fields: { apiKey: KEY } }, provider("openrouter"));
    await q("UPDATE credentials SET bound_origin='https://openrouter.ai' WHERE provider='openrouter'");
    expect((await call(settingsPut, "PUT", "/api/admin/settings", { reasoningModel: { provider: "openrouter", baseUrl: `${or.url}/api/v1`, model: "m" } })).status).toBe(200);
    const before = or.seen.length;
    const s = await getSpeechSynthesizer();
    expect(s.configured).toBe(false);
    expect(or.seen.length).toBe(before);
  });

  it("is a new power: anyone but the platform administrator cannot choose it or list from OpenRouter", async () => {
    hook.admin = false;
    expect((await call(settingsPut, "PUT", "/api/admin/settings", { voice: { provider: "openrouter", model: "m", voice: "v" } })).status).toBe(403);
    expect((await call(voiceOptions, "POST", "/api/admin/voice/options", { provider: "openrouter" })).status).toBe(403);
  });
});

describe("review items", () => {
  it("passwords and signing secrets never show their last four, even to the platform administrator", async () => {
    await q("INSERT INTO settings (key, value) VALUES ('mail.smtp', $1)", [JSON.stringify({ mode: "smtp", fromName: "O", fromAddress: "o@example.com", host: "127.0.0.1", port: 2525, security: "none", username: null })]);
    await call(credPut, "PUT", "/api/admin/credentials/smtp", { fields: { password: "a-long-password-9876" } }, provider("smtp"));
    await call(credPut, "PUT", "/api/admin/credentials/stripe", { fields: { webhookSecret: "whsec_abcdefghijklmnop5432" } }, provider("stripe"));
    const text = await (await get(credsGet, "/api/admin/credentials")).text();
    expect(text).not.toContain("9876");
    expect(text).not.toContain("5432");
  });

  it("B4: the slicer test does not repeat the body of what answered", async () => {
    const s = await standIn(() => ({ status: 500, type: "text/plain", body: "INTERNAL-ONLY: db_host=10.0.0.5" }));
    try {
      const r = await read<{ ok: boolean; message: string; detail?: unknown }>(await call(testPost, "POST", "/api/admin/test", { kind: "slicer", url: s.url }));
      expect(r.body.ok).toBe(false);
      expect(JSON.stringify(r.body)).not.toContain("INTERNAL-ONLY");
    } finally {
      await s.close();
    }
  });

  it("B4: ? and # are refused in every base address an admin types", async () => {
    for (const [kind, body] of [
      ["slicer", { kind: "slicer", url: "http://127.0.0.1:1/x?y=1" }],
      ["planner", { kind: "planner", url: "http://127.0.0.1:1/#frag" }],
      ["model", { kind: "model", provider: "ollama", baseUrl: "http://127.0.0.1:1/v1?a=b" }],
    ] as const) {
      const r = await read<{ issues: { problem: string }[] }>(await call(testPost, "POST", "/api/admin/test", body));
      expect({ kind, status: r.status, problem: r.body.issues?.[0]?.problem }).toEqual({ kind, status: 400, problem: "must not contain ? or #; give the base address only" });
    }
    const v = await read<{ issues: { field: string }[] }>(await call(settingsPut, "PUT", "/api/admin/settings", { voice: { provider: "kokoro", baseUrl: "http://127.0.0.1:1/v1?x=1", model: "m", voice: "v", speed: 1 } }));
    expect(v.body.issues[0].field).toBe("voice.baseUrl");
  });

  it("F1: a mail password or speech key cannot be saved before its address", async () => {
    const m = await read<{ issues: { problem: string }[] }>(await call(credPut, "PUT", "/api/admin/credentials/smtp", { fields: { password: "early-password-123" } }, provider("smtp")));
    expect(m.status).toBe(400);
    expect(m.body.issues[0].problem).toMatch(/save the mail server in Admin, Email first/);
    const v = await read<{ issues: { problem: string }[] }>(await call(credPut, "PUT", "/api/admin/credentials/kokoro", { fields: { apiKey: "early-key-1234567" } }, provider("kokoro")));
    expect(v.status).toBe(400);
    expect(await q("SELECT 1 FROM credentials")).toHaveLength(0);
  });

  it("F1: an unbound one saved earlier is removed when the address is first set, not bound to it", async () => {
    await q("INSERT INTO credentials (provider, field, value, bound_origin) VALUES ('smtp','password','legacy-unbound-pass',NULL),('kokoro','apiKey','legacy-unbound-key',NULL)");
    const r = await read<{ notices: string[] }>(await call(settingsPut, "PUT", "/api/admin/settings", { mail: { mode: "smtp", fromName: "O", fromAddress: "o@example.com", host: "127.0.0.1", port: 2525, security: "none", username: null }, voice: { provider: "kokoro", baseUrl: "http://127.0.0.1:1/v1", model: "m", voice: "v", speed: 1 } }));
    expect(r.status).toBe(200);
    expect(r.body.notices.join(" ")).toMatch(/saved before any address was set/);
    expect(await q("SELECT 1 FROM credentials")).toHaveLength(0);
  });

  it("F2: voice audio is capped at 2 MB, must be a known audio type, and an error body is never repeated", async () => {
    let answer: { status: number; type?: string; body: string | Buffer } = { status: 200, type: "audio/mpeg", body: Buffer.alloc(3 * 1024 * 1024, 1) };
    const s = await standIn(() => answer);
    try {
      await call(settingsPut, "PUT", "/api/admin/settings", { voice: { provider: "kokoro", baseUrl: `${s.url}/v1`, model: "m", voice: "v", speed: 1 } });
      const test = async () => (await read<{ ok: boolean; message: string; detail?: { audio?: string } }>(await call(testPost, "POST", "/api/admin/test", { kind: "voice" }))).body;
      let t = await test();
      expect(t.ok).toBe(false);
      expect(t.message).toMatch(/more than 2 MB/);
      answer = { status: 200, type: "text/html", body: "<html>INTERNAL-PAGE</html>" };
      t = await test();
      expect(t.ok).toBe(false);
      expect(t.message).not.toContain("INTERNAL-PAGE");
      answer = { status: 500, body: JSON.stringify({ error: { message: "INTERNAL-ONLY admin_note=hunter2" } }) };
      t = await test();
      expect(t.message).toBe("The Kokoro server answered with a server error (HTTP 500).");
      answer = { status: 200, type: "audio/wav", body: Buffer.from("RIFF-small") };
      t = await test();
      expect(t.ok).toBe(true);
    } finally {
      await s.close();
    }
  });

  it("F3: a service that is not a mail server gets a fixed sentence, never its own text", async () => {
    const srv: TcpServer = tcpServer((sock) => {
      sock.write("HTTP/1.1 400 Bad Request\r\nX-Internal: INTERNAL-BANNER db=10.0.0.5\r\n\r\n");
      sock.end();
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
    try {
      await call(settingsPut, "PUT", "/api/admin/settings", { mail: { mode: "smtp", fromName: "O", fromAddress: "o@example.com", host: "127.0.0.1", port: (srv.address() as AddressInfo).port, security: "none", username: null } });
      const r = await read<{ ok: boolean; message: string }>(await call(testPost, "POST", "/api/admin/test", { kind: "smtp" }));
      expect(r.body.ok).toBe(false);
      expect(r.body.message).not.toMatch(/INTERNAL|HTTP\/1\.1|10\.0\.0\.5/);
    } finally {
      await new Promise((res) => srv.close(() => res(null)));
    }
  });

  it("F4: no security with a user name is refused unless the server is on this machine", async () => {
    const mail = (host: string) => ({ mail: { mode: "smtp", fromName: "O", fromAddress: "o@example.com", host, port: 25, security: "none", username: "user" } });
    const r = await read<{ issues: { field: string; problem: string }[] }>(await call(settingsPut, "PUT", "/api/admin/settings", mail("smtp.example.com")));
    expect(r.status).toBe(400);
    expect(r.body.issues[0].field).toBe("mail.security");
    expect(r.body.issues[0].problem).toMatch(/unless the server is on this machine/);
    expect((await call(settingsPut, "PUT", "/api/admin/settings", mail("localhost"))).status).toBe(200);
  });

  it("F6: the public levels are kept for a minute, and a save in Admin shows at once", async () => {
    const first = await freshLevels();
    await q("INSERT INTO settings (key, value) VALUES ('plans.catalogue', $1)", [JSON.stringify({ ...builtInCatalogue(), showPrices: true })]);
    expect(await publicLevels()).toEqual(first); // written behind Admin's back: still the kept answer
    vi.setSystemTime(Date.now() + 61_000);
    expect((await publicLevels()).showPrices).toBe(true);
    const c = builtInCatalogue();
    c.tiers[0].name = "Saved just now";
    expect((await call(plansPut, "PUT", "/api/admin/plans", c)).status).toBe(200);
    expect((await publicLevels()).levels[0].name).toBe("Saved just now");
  });
});

describe("S3: narration through OpenRouter goes only to OpenRouter's own address", () => {
  it("an OpenRouter address changed in the open model settings does not move it", async () => {
    await emptyStores();
    const seen: string[] = [];
    const evil = httpServer((req, res) => {
      seen.push(`${req.method} ${req.url} ${req.headers.authorization ?? ""}`);
      res.writeHead(200, { "content-type": "audio/mpeg" });
      res.end("ID3");
    });
    await new Promise<void>((r) => evil.listen(0, "127.0.0.1", () => r()));
    const url = `http://127.0.0.1:${(evil.address() as AddressInfo).port}`;
    // OpenRouter's own address, for this test a closed port on this machine: nothing leaves it.
    setServiceBaseForTests("openrouter", "http://127.0.0.1:9/api/v1");
    try {
      await q("INSERT INTO credentials (provider, field, value, bound_origin) VALUES ('openrouter', 'apiKey', 'sk-or-v1-owner-0000000000', 'http://127.0.0.1:9')");
      await q("INSERT INTO settings (key, value) VALUES ('voice.tts', $1)", [JSON.stringify({ provider: "openrouter", model: "openai/gpt-4o-mini-tts", voice: "nova" })]);
      // Anyone may change the model settings: point OpenRouter models elsewhere.
      await q("INSERT INTO settings (key, value) VALUES ('models.reasoning', $1)", [JSON.stringify({ provider: "openrouter", baseUrl: `${url}/api/v1`, model: "x" })]);
      const s = await getSpeechSynthesizer();
      expect(s.configured).toBe(true);
      if (s.configured) await s.synth.synthesize("hello", { timeoutMs: 1500 }).catch(() => undefined);
      expect(seen).toEqual([]);
    } finally {
      setServiceBaseForTests("openrouter", null);
      await new Promise((r) => evil.close(() => r(null)));
    }
  });
});

