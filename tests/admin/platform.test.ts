// The platform admin area (WS10a): nothing in it may block the app. With the settings and credentials tables
// empty, the overview, every section's read and the public welcome page's levels still load; every accessor
// answers a typed "not configured". Then each section's store and test, against small stand-ins on 127.0.0.1:
// Stripe (GET /v1/balance), an SMTP server, an OpenAI-compatible speech endpoint and ElevenLabs. No real service
// is called and no real secret is used.
import { createServer as httpServer, type Server } from "node:http";
import { createServer as tcpServer, type Server as TcpServer, type Socket } from "node:net";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
import { DEMO_REFUSED } from "@/lib/admin/guard";
import { anonymous, asAdministrator, json, read } from "../api/helpers";

// Most of this file changes settings, as the administrator; "the public demo account" below puts the default
// password back for its own tests.
asAdministrator();

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
});

afterAll(async () => {
  setConnectionTestLimit(null);
  setServiceBaseForTests("stripe", null);
  setServiceBaseForTests("elevenlabs", null);
  await emptyStores();
  for (const r of savedSettings) await q("INSERT INTO settings (key, value) VALUES ($1, $2)", [r.key, JSON.stringify(r.value)]);
  for (const c of savedCreds) await q("INSERT INTO credentials (provider, field, value, bound_origin) VALUES ($1,$2,$3,$4)", [c.provider, c.field, c.value, c.bound_origin]);
  await pool().end();
});

beforeEach(emptyStores);

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
    const l = await publicLevels();
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

describe("the public demo account (still on the default password)", () => {
  beforeAll(() => q("UPDATE users SET password_changed_at = NULL WHERE username = 'demo'"));
  afterAll(() => q("UPDATE users SET password_changed_at = now() WHERE username = 'demo'"));

  const state = async () => ({
    settings: await q("SELECT key, value FROM settings ORDER BY key"),
    credentials: await q("SELECT provider, field, value FROM credentials ORDER BY provider, field"),
    audit: (await q<{ n: string }>("SELECT max(id)::text AS n FROM audit_log"))[0].n,
  });
  const writes = (): [string, () => Promise<Response>][] => {
    const c = builtInCatalogue();
    c.showPrices = true;
    c.tiers[1].priceMonthly = 1;
    return [
      ["PUT settings (mail)", () => call(settingsPut, "PUT", "/api/admin/settings", { mail: { mode: "smtp", fromName: "X", fromAddress: "x@example.test", host: "127.0.0.1", port: 2525, security: "none", username: null } })],
      ["PUT settings (models)", () => call(settingsPut, "PUT", "/api/admin/settings", { plannerUrl: "http://127.0.0.1:1" })],
      ["PUT credentials (stripe)", () => call(credPut, "PUT", "/api/admin/credentials/stripe", { fields: { publishableKey: PUB_TEST, secretKey: KEY_TEST } }, provider("stripe"))],
      ["PUT credentials (openrouter)", () => call(credPut, "PUT", "/api/admin/credentials/openrouter", { fields: { apiKey: "sk-or-v1-demo-attempt-0000" } }, provider("openrouter"))],
      ["DELETE credentials", () => call(credDelete, "DELETE", "/api/admin/credentials/stripe/secretKey", undefined, { params: Promise.resolve({ provider: "stripe", field: "secretKey" }) })],
      ["PUT plans", () => call(plansPut, "PUT", "/api/admin/plans", c)],
      ["DELETE plans", () => call(plansDelete, "DELETE", "/api/admin/plans")],
      ["test stripe", () => call(testPost, "POST", "/api/admin/test", { kind: "stripe" })],
      ["test smtp", () => call(testPost, "POST", "/api/admin/test", { kind: "smtp" })],
      ["test mail-message", () => call(testPost, "POST", "/api/admin/test", { kind: "mail-message", to: "x@example.test" })],
      ["test voice", () => call(testPost, "POST", "/api/admin/test", { kind: "voice" })],
    ];
  };

  it("can read every section, and is told it may not change them", async () => {
    for (const [h, p] of [[overviewGet, "/api/admin/overview"], [statusGet, "/api/admin/status"], [plansGet, "/api/admin/plans"], [paymentsGet, "/api/admin/payments"], [settingsGet, "/api/admin/settings"], [credsGet, "/api/admin/credentials"], [envGet, "/api/admin/environment"]] as const) {
      expect((await get(h as (r: Request) => Promise<Response>, p)).status, p).toBe(200);
    }
    expect(await read(await get(accessGet, "/api/admin/access"))).toEqual({ status: 200, body: { canWrite: false, reason: DEMO_REFUSED } });
  });

  it("every write and every test that sends a secret answers 403 with the one sentence, and changes nothing", async () => {
    // something saved first, so a refused DELETE has something it could have removed
    await q("INSERT INTO settings (key, value) VALUES ('plans.catalogue', $1)", [JSON.stringify(builtInCatalogue())]);
    await q("INSERT INTO credentials (provider, field, value) VALUES ('stripe', 'secretKey', $1)", [KEY_TEST]);
    const levels = await publicLevels();
    const before = await state();
    for (const [name, send] of writes()) {
      const r = await read<{ error: string }>(await send());
      expect({ name, ...r }).toEqual({ name, status: 403, body: { error: DEMO_REFUSED } });
    }
    expect(await state()).toEqual(before);
    expect(await publicLevels()).toEqual(levels);
  });

  it("the welcome page is unaffected by the refused calls", async () => {
    for (const [, send] of writes()) await send();
    const l = await publicLevels();
    expect(l.showPrices).toBe(false);
    expect(l.levels.map((x) => x.price)).not.toContain("$1");
  });

  it("a test that sends no secret still runs (the database)", async () => {
    expect((await call(testPost, "POST", "/api/admin/test", { kind: "database" })).status).toBe(200);
  });

  it("once the password is changed, the same calls go through", async () => {
    await q("UPDATE users SET password_changed_at = now() WHERE username = 'demo'");
    try {
      expect(await read(await get(accessGet, "/api/admin/access"))).toEqual({ status: 200, body: { canWrite: true, reason: null } });
      for (const [name, send] of writes()) expect({ name, status: (await send()).status }).toEqual({ name, status: 200 });
    } finally {
      await q("UPDATE users SET password_changed_at = NULL WHERE username = 'demo'");
    }
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
    const l = await publicLevels();
    expect(l.showPrices).toBe(true);
    expect(l.levels.map((x) => x.key)).toEqual(["free", "maker", "self"]);
    expect(l.levels[1]).toMatchObject({ price: "$19", per: "a month" });
    const line = await q<{ detail: { before: unknown; after: { showPrices: boolean } } }>("SELECT detail FROM audit_log WHERE action='setting.changed' AND detail->>'key'='plans.catalogue' ORDER BY id DESC LIMIT 1");
    expect(line[0].detail.after.showPrices).toBe(true);
    expect(line[0].detail.before).toBeTruthy();
    expect((await call(plansDelete, "DELETE", "/api/admin/plans")).status).toBe(200);
    expect((await publicLevels()).showPrices).toBe(false);
  });

  it("a saved document that no longer validates falls back to the built-in catalogue instead of breaking the page", async () => {
    await q("INSERT INTO settings (key, value) VALUES ('plans.catalogue', '{\"tiers\": 5}')");
    expect((await publicLevels()).levels).toHaveLength(4);
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

// A small SMTP server: greets, answers EHLO (with AUTH PLAIN), AUTH, MAIL, RCPT, DATA and QUIT. No TLS.
function smtpStandIn(password: string): Promise<{ port: number; messages: string[]; close: () => Promise<void> }> {
  const messages: string[] = [];
  const srv: TcpServer = tcpServer((sock: Socket) => {
    let data = false;
    let buf = "";
    let msg = "";
    sock.write("220 standin ESMTP\r\n");
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let i: number;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (data) {
          if (line === ".") {
            data = false;
            messages.push(msg);
            msg = "";
            sock.write("250 queued\r\n");
          } else msg += line + "\n";
          continue;
        }
        const cmd = line.toUpperCase();
        if (cmd.startsWith("EHLO") || cmd.startsWith("HELO")) sock.write("250-standin\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (cmd.startsWith("AUTH PLAIN")) {
          const decoded = Buffer.from(line.split(" ")[2] ?? "", "base64").toString("utf8").split("\u0000");
          sock.write(decoded[2] === password ? "235 ok\r\n" : "535 bad credentials\r\n");
        } else if (cmd.startsWith("MAIL") || cmd.startsWith("RCPT") || cmd.startsWith("RSET") || cmd.startsWith("NOOP")) sock.write("250 ok\r\n");
        else if (cmd === "DATA") {
          data = true;
          sock.write("354 go\r\n");
        } else if (cmd === "QUIT") {
          sock.write("221 bye\r\n");
          sock.end();
        } else sock.write("502 no\r\n");
      }
    });
    sock.on("error", () => undefined);
  });
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve({ port: (srv.address() as AddressInfo).port, messages, close: () => new Promise((r) => srv.close(() => r())) })));
}

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

describe("Voice", () => {
  let speech: Awaited<ReturnType<typeof standIn>>;
  const AUDIO = Buffer.from("ID3-fake-mp3-bytes");
  beforeAll(async () => {
    speech = await standIn((s) =>
      s.url.startsWith("/v1/audio/speech") || s.url.startsWith("/v1/text-to-speech/")
        ? s.headers.authorization === "Bearer voice-key-123456789" || s.headers["xi-api-key"] === "eleven-key-123456789"
          ? { status: 200, type: "audio/mpeg", body: AUDIO }
          : { status: 401, body: JSON.stringify({ detail: { message: "invalid key" } }) }
        : { status: 404, body: "{}" }
    );
  });
  afterAll(() => speech.close());
  afterEach(() => setServiceBaseForTests("elevenlabs", null));

  it("an OpenAI-compatible endpoint speaks the test sentence; the audio comes back to play and is not stored", async () => {
    await call(settingsPut, "PUT", "/api/admin/settings", { voice: { provider: "openai", baseUrl: `${speech.url}/v1`, model: "tts-1", voice: "alloy", speed: 1 } });
    expect((await call(credPut, "PUT", "/api/admin/credentials/voice-openai", { fields: { apiKey: "voice-key-123456789" } }, provider("voice-openai"))).status).toBe(200);
    expect(await getVoiceSettings()).toMatchObject({ configured: true, provider: "openai", voice: "alloy" });
    const t = await read<{ ok: boolean; detail: { audio?: string } }>(await call(testPost, "POST", "/api/admin/test", { kind: "voice" }));
    expect(t.body.ok).toBe(true);
    expect(t.body.detail.audio).toBe(`data:audio/mpeg;base64,${AUDIO.toString("base64")}`);
    expect(JSON.parse(speech.seen.at(-1)!.body)).toMatchObject({ model: "tts-1", voice: "alloy", input: "This is a test of the narration voice.", speed: 1 });
    const stored = JSON.stringify(await q("SELECT value FROM settings"));
    expect(stored).not.toContain(AUDIO.toString("base64"));
  });

  it("ElevenLabs needs its key; with it, the test speaks; the speed range is checked", async () => {
    setServiceBaseForTests("elevenlabs", speech.url);
    const bad = await read<{ issues: { field: string }[] }>(await call(settingsPut, "PUT", "/api/admin/settings", { voice: { provider: "elevenlabs", model: "eleven_multilingual_v2", voice: "abc123", speed: 2 } }));
    expect(bad.body.issues[0].field).toBe("voice.speed");
    await call(settingsPut, "PUT", "/api/admin/settings", { voice: { provider: "elevenlabs", model: "eleven_multilingual_v2", voice: "abc123", speed: 1.1 } });
    expect(await getVoiceSettings()).toMatchObject({ configured: false, reason: expect.stringMatching(/no ElevenLabs key/) });
    await call(credPut, "PUT", "/api/admin/credentials/elevenlabs", { fields: { apiKey: "eleven-key-123456789" } }, provider("elevenlabs"));
    const t = await read<{ ok: boolean }>(await call(testPost, "POST", "/api/admin/test", { kind: "voice" }));
    expect(t.body.ok).toBe(true);
    expect(speech.seen.at(-1)!.url).toMatch(/^\/v1\/text-to-speech\/abc123\?/);
  });
});
