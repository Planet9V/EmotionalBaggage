// Funnel events (docs/design/early-access.md): the public route takes only listed events and a capped body, drops
// crawlers and browsers that ask not to be tracked, stores no address, browser string or email, and is rate-limited
// per address; retention deletes old rows; the early-access form is counted by the server (also without script);
// the Admin funnel counts visits per step, per day and by source, and is the platform administrator's only.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pool, q } from "@/lib/db";
import { POST } from "@/app/api/events/route";
import { POST as REQUEST } from "@/app/api/access-requests/route";
import { GET as FUNNEL, PUT as FUNNEL_PUT } from "@/app/api/admin/funnel/route";
import { cleanupEvents, EVENTS_PER_WINDOW, funnelReport, resetEventLimits, RETENTION_KEY } from "@/lib/events/store";
import { EVENT_NAMES } from "@/lib/events/shared";
import { json, read } from "./helpers";

const hook = vi.hoisted(() => ({ admin: false }));
vi.mock("@/lib/admin/platformAdminHook", () => ({ platformAdminFromAuth2: async () => hook.admin }));

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const VISIT = "visitAAAA1111bbbb";

function ev(payload: unknown, headers: Record<string, string> = {}, client = "192.0.2.10") {
  return new Request("http://test.local/api/events", {
    method: "POST",
    headers: { origin: "http://test.local", host: "test.local", "content-type": "application/json", "user-agent": UA, "x-c2r-client-address": client, ...headers },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}
const rows = () => q<{ event: string; path: string; section: string; detail: Record<string, unknown>; visit: string }>("SELECT event, path, section, detail, visit FROM site_events ORDER BY id");

beforeAll(async () => {
  await q("DELETE FROM site_events");
});
beforeEach(async () => {
  hook.admin = false;
  resetEventLimits();
  await q("DELETE FROM site_events");
});
afterAll(async () => {
  await q("DELETE FROM site_events");
  await q("DELETE FROM settings WHERE key = $1", [RETENTION_KEY]);
  await q("DELETE FROM access_requests WHERE email LIKE '%@funnel.test'");
  await pool().end();
});

describe("POST /api/events", () => {
  it("stores a listed event with the path only, the referrer as a host, and no address or browser string", async () => {
    const r = await POST(ev({ event: "page_view", path: "/welcome?utm_source=x&email=a@b.test", visit: VISIT, detail: { referrer: "news.example.com", utm_campaign: "launch", device: "phone" } }));
    expect(r.status).toBe(204);
    const [row] = await rows();
    expect(row).toEqual({ event: "page_view", path: "/welcome", section: "", detail: { referrer: "news.example.com", utm_campaign: "launch", device: "phone" }, visit: VISIT });
    const all = JSON.stringify(await q("SELECT * FROM site_events"));
    expect(all).not.toContain("192.0.2.10");
    expect(all).not.toContain("Mozilla");
  });

  it("drops any detail value that looks like an email address, and its own host as a referrer", async () => {
    await POST(ev({ event: "cta_click", visit: VISIT, section: "hero", detail: { cta: "hero", note: "write to me at ada@example.test", referrer: "test.local" } }));
    expect((await rows())[0]!.detail).toEqual({ cta: "hero", referrer: "" });
  });

  it("takes every listed event name and refuses one that is not listed, a bad visit id and too many details", async () => {
    for (const event of EVENT_NAMES) expect((await POST(ev({ event, visit: VISIT }))).status, event).toBe(204);
    expect(await rows()).toHaveLength(EVENT_NAMES.length);
    expect((await POST(ev({ event: "purchase", visit: VISIT }))).status).toBe(400);
    expect((await POST(ev({ event: "page_view", visit: "short" }))).status).toBe(400);
    expect((await POST(ev({ event: "page_view", visit: VISIT, detail: Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`k${i}`, 1])) }))).status).toBe(400);
    expect((await POST(ev({ event: "page_view", visit: VISIT, detail: { nested: { a: 1 } } }))).status).toBe(400);
    expect((await POST(ev("{not json"))).status).toBe(400);
  });

  it("caps the body at 4 KB", async () => {
    expect((await POST(ev({ event: "page_view", visit: VISIT, detail: { a: "x".repeat(5000) } }))).status).toBe(413);
  });

  it("records nothing for Do Not Track, Global Privacy Control, a crawler or no browser string, and answers the same 204", async () => {
    const base = { event: "page_view", visit: VISIT };
    for (const h of [{ dnt: "1" }, { "sec-gpc": "1" }, { "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" }, { "user-agent": "curl/8.0" }, { "user-agent": "" }]) {
      expect((await POST(ev(base, h))).status).toBe(204);
    }
    expect(await rows()).toHaveLength(0);
  });

  it("is rate-limited per address, quietly", async () => {
    for (let i = 0; i < EVENTS_PER_WINDOW + 10; i++) await POST(ev({ event: "section_view", visit: VISIT, section: "faq" }, {}, "192.0.2.50"));
    expect(await rows()).toHaveLength(EVENTS_PER_WINDOW);
    expect((await POST(ev({ event: "section_view", visit: VISIT }, {}, "192.0.2.51"))).status).toBe(204);
    expect(await rows()).toHaveLength(EVENTS_PER_WINDOW + 1);
  });

  it("refuses a post from another site", async () => {
    expect((await POST(ev({ event: "page_view", visit: VISIT }, { origin: "https://evil.example" }))).status).toBe(403);
  });
});

describe("retention", () => {
  it("deletes events older than the setting (default 180 days)", async () => {
    await q("INSERT INTO site_events (at, event, visit) VALUES (now() - interval '181 days', 'page_view', $1), (now() - interval '10 days', 'page_view', $1)", [VISIT]);
    expect(await cleanupEvents()).toBe(1);
    await q("INSERT INTO settings (key, value) VALUES ($1, '5') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [RETENTION_KEY]);
    expect(await cleanupEvents()).toBe(1);
    expect(await rows()).toHaveLength(0);
    await q("DELETE FROM settings WHERE key = $1", [RETENTION_KEY]);
  });
});

describe("the funnel", () => {
  const today = new Date().toISOString().slice(0, 10);

  it("counts the early-access form on the server, with and without script, and opt-out is respected there too", async () => {
    await q("DELETE FROM access_requests WHERE email LIKE '%@funnel.test'");
    const send = (body: string, type: string, extra: Record<string, string> = {}) =>
      REQUEST(new Request("http://test.local/api/access-requests", { method: "POST", headers: { origin: "http://test.local", host: "test.local", "content-type": type, "x-c2r-client-address": `192.0.2.${Math.floor(Math.random() * 200) + 20}`, ...extra }, body }));
    await send(JSON.stringify({ email: "s1@funnel.test", building: "A lamp", placement: "hero", visit: VISIT }), "application/json");
    await send(new URLSearchParams({ email: "s2@funnel.test", building: "A lamp", placement: "close" }).toString(), "application/x-www-form-urlencoded");
    await send(JSON.stringify({ email: "s3@funnel.test", building: "A lamp", visit: VISIT }), "application/json", { "sec-gpc": "1" });
    const r = await rows();
    expect(r.map((x) => [x.event, x.visit, x.detail.script, x.detail.placement])).toEqual([
      ["form_submit", VISIT, true, "hero"],
      ["form_submit", "", false, "close"],
    ]);
    expect(JSON.stringify(r)).not.toContain("funnel.test");
  });

  it("counts each visit once per step, per day and by source", async () => {
    const a = "visitAAAAaaaaaaaa", b = "visitBBBBbbbbbbbb", c = "visitCCCCcccccccc";
    const add = (visit: string, event: string, section = "", detail: object = {}) => q("INSERT INTO site_events (event, section, visit, detail) VALUES ($1, $2, $3, $4)", [event, section, visit, JSON.stringify(detail)]);
    await add(a, "page_view", "", { referrer: "news.example.com", utm_campaign: "launch" });
    await add(a, "section_view", "pricing");
    await add(a, "section_view", "pricing");
    await add(a, "form_start", "hero");
    await add(a, "form_submit", "hero", { outcome: "place" });
    await add(b, "page_view");
    await add(b, "section_view", "pricing");
    await add(c, "page_view", "", { referrer: "news.example.com", utm_campaign: "launch" });
    await add(c, "form_start", "close");
    await add(c, "form_submit", "close", { outcome: "waiting" });
    await add("", "form_submit", "close", { outcome: "place" });
    const f = await funnelReport(today, today);
    expect(f.total).toEqual({ visits: 3, reachedPricing: 2, startedForm: 2, sentForm: 3, claimedPlace: 2 });
    expect(f.days).toEqual([{ day: today, ...f.total }]);
    expect(f.bySource).toContainEqual({ referrer: "news.example.com", campaign: "launch", visits: 2, reachedPricing: 1, startedForm: 2, sentForm: 2, claimedPlace: 1 });
    expect(f.bySource).toContainEqual({ referrer: "", campaign: "", visits: 1, reachedPricing: 1, startedForm: 0, sentForm: 1, claimedPlace: 1 });
    expect(f.retentionDays).toBe(180);
  });

  it("gives every day of the range a row, and refuses a bad range", async () => {
    const f = await funnelReport("2026-01-01", "2026-01-03");
    expect(f.days.map((d) => d.day)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(f.days.every((d) => d.visits === 0)).toBe(true);
    await expect(funnelReport("2026-02-01", "2026-01-01")).rejects.toThrow(/after the last/);
    await expect(funnelReport("2026-1-1", "2026-01-01")).rejects.toThrow(/YYYY-MM-DD/);
    await expect(funnelReport("2024-01-01", "2026-01-01")).rejects.toThrow(/at most/);
  });

  it("the Admin screen's routes are the platform administrator's only", async () => {
    expect((await FUNNEL(json("GET", undefined, "http://test.local/api/admin/funnel"))).status).toBe(403);
    expect((await FUNNEL_PUT(json("PUT", { retentionDays: 30 }, "http://test.local/api/admin/funnel"))).status).toBe(403);
    hook.admin = true;
    const r = await read<{ days: unknown[]; from: string; to: string }>(await FUNNEL(json("GET", undefined, "http://test.local/api/admin/funnel")));
    expect(r.status).toBe(200);
    expect(r.body.days).toHaveLength(30);
    expect((await read(await FUNNEL_PUT(json("PUT", { retentionDays: 30 }, "http://test.local/api/admin/funnel")))).body).toEqual({ retentionDays: 30 });
    expect((await FUNNEL_PUT(json("PUT", { retentionDays: 0 }, "http://test.local/api/admin/funnel"))).status).toBe(400);
    expect((await FUNNEL(json("GET", undefined, "http://test.local/api/admin/funnel?from=bad&to=2026-01-01"))).status).toBe(400);
  });
});
