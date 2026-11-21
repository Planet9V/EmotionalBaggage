// Amazon SP-API against the stand-in (plan 8.17): token refresh and caching, rate limits and backoff,
// one row per order on repeated syncs, no buyer data stored, the routes, and no secret anywhere.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { PUT as AMAZON_PUT } from "@/app/api/channels/amazon/route";
import { POST as SYNC } from "@/app/api/channels/amazon/sync/route";
import { GET as STATUS } from "@/app/api/channels/status/route";
import { POST as TEST } from "@/app/api/admin/test/route";
import { amazonAccessToken, cleanOrder, resetAmazon, searchOrders } from "@/lib/channels/amazon";
import { TokenBucket, limited, backoffMs, setChannelClock, RateLimited } from "@/lib/channels/rateLimit";
import { byDayAndChannel, toSaleRow } from "@/lib/channels/salesByDay";
import type { StandIn } from "../standins/core";
import { startAmazon, type AmazonOptions, type AmazonOrder } from "../standins/channels";
import { json, read } from "../api/helpers";
import { makeConcept } from "../drafts/helpers";
import { clearChannelRows, expectNoSecrets, fakeClock, saveCreds } from "./helpers";

const P = "zz-channels-amazon";
let s: StandIn<AmazonOptions>;
const US = "ATVPDKIKX0DER";

const order = (n: number, day = "2026-11-20", status = "SHIPPED", qty = 2, unit = "19.99"): AmazonOrder => ({
  orderId: `111-0000000-${String(n).padStart(7, "0")}`,
  createdTime: `${day}T10:00:00Z`,
  lastUpdatedTime: `${day}T11:00:00Z`,
  status,
  items: [{ asin: "B0STANDIN1", sku: "BC-MK1", qty, unit }],
});

beforeAll(async () => {
  s = await startAmazon();
  process.env.AMAZON_LWA_TOKEN_URL = `${s.url}/auth/o2/token`;
  process.env.AMAZON_SP_BASE_URL = s.url;
  await makeConcept(P, "ZZ Amazon");
});

afterAll(async () => {
  setChannelClock(null);
  resetAmazon();
  await clearChannelRows();
  await q("DELETE FROM projects WHERE id=$1", [P]);
  delete process.env.AMAZON_LWA_TOKEN_URL;
  delete process.env.AMAZON_SP_BASE_URL;
  await s.close();
  await pool().end();
});

beforeEach(async () => {
  setChannelClock(null);
  resetAmazon();
  await clearChannelRows();
  await q("DELETE FROM items WHERE project_id=$1", [P]);
  await q("DELETE FROM events WHERE project_id=$1", [P]);
  s.set({ orders: [], throttle: 0, pageSize: 100, issued: [], expiresIn: 3600 });
  s.requests.length = 0;
});

const creds = () => saveCreds("amazon-sp", { refreshToken: "Atzr|stand-in-refresh-token-0001", clientId: "amzn1.application-oa2-client.standin0001", clientSecret: "amzn1.oa2-cs.v1.stand-in-secret-0001" });
const SECRETS = ["Atzr|stand-in-refresh-token-0001", "amzn1.oa2-cs.v1.stand-in-secret-0001", "Atza|stand-in-access-"];

describe("Login with Amazon", () => {
  it("refuses plainly when nothing is saved", async () => {
    await expect(amazonAccessToken()).rejects.toThrow(/Amazon is not connected/);
  });

  it("exchanges the refresh token once, caches the access token in memory, and refreshes when it expires", async () => {
    await creds();
    const clock = fakeClock();
    const t1 = await amazonAccessToken();
    const t2 = await amazonAccessToken();
    expect(t1).toBe(t2);
    expect(s.requests.filter((r) => r.path === "/auth/o2/token")).toHaveLength(1);
    const form = new URLSearchParams(s.requests[0].rawBody.toString());
    expect(form.get("grant_type")).toBe("refresh_token");
    expect(String(s.requests[0].headers["content-type"])).toContain("application/x-www-form-urlencoded");
    clock.t += 3600_000; // an hour later the token has expired
    const t3 = await amazonAccessToken();
    expect(t3).not.toBe(t1);
    expect(s.requests.filter((r) => r.path === "/auth/o2/token")).toHaveLength(2);
    const stored = await q<{ n: number }>("SELECT count(*)::int AS n FROM credentials WHERE value LIKE 'Atza|%'");
    expect(stored[0].n).toBe(0); // never stored
  });

  it("a wrong secret is a sentence without the secret", async () => {
    await saveCreds("amazon-sp", { refreshToken: "Atzr|wrong-refresh-token-9999", clientId: "amzn1.application-oa2-client.standin0001", clientSecret: "amzn1.oa2-cs.v1.wrong-secret-9999" });
    const e = (await amazonAccessToken().catch((x) => x)) as Error;
    expect(e.message).toMatch(/refused the saved refresh token/);
    expect(e.message).not.toContain("wrong-secret-9999");
    expect(e.message).not.toContain("wrong-refresh-token-9999");
  });

  it("the Admin connection test says what it proved and leaks nothing", async () => {
    await creds();
    const r = await read<{ ok: boolean; message: string }>(await TEST(json("POST", { kind: "amazon-sp" })));
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.message).toMatch(/Login with Amazon accepted/);
    await expectNoSecrets(SECRETS, [r.body]);
  });
});

describe("rate limits", () => {
  it("a token bucket allows the burst, then the documented rate", async () => {
    const clock = fakeClock();
    const b = new TokenBucket(0.5, 3);
    for (let i = 0; i < 3; i++) await b.take("op", 10_000);
    expect(clock.sleeps).toEqual([]);
    await b.take("op", 10_000);
    expect(clock.sleeps).toEqual([2000]); // one token per 2 s at 0.5 a second
    await expect(new TokenBucket(0.0056, 0).take("searchOrders", 20_000)).rejects.toBeInstanceOf(RateLimited);
  });

  it("backs off on 429 (1 s, 2 s, then Retry-After when given) and returns the answer that finally worked", async () => {
    const clock = fakeClock();
    expect(backoffMs(0, null)).toBe(1000);
    expect(backoffMs(2, null)).toBe(4000);
    expect(backoffMs(0, "7")).toBe(7000);
    let n = 0;
    const res = await limited(new TokenBucket(10, 10), "op", async () => new Response("{}", { status: ++n < 3 ? 429 : 200 }));
    expect(res.status).toBe(200);
    expect(clock.sleeps).toEqual([1000, 2000]);
  });

  it("searchOrders backs off on Amazon's 429 and still answers", async () => {
    await creds();
    const clock = fakeClock();
    s.set({ orders: [order(1)], throttle: 2 });
    const page = await searchOrders({ marketplaceId: US, lastUpdatedAfter: "2026-11-01T00:00:00Z" });
    expect(page.orders).toHaveLength(1);
    expect(clock.sleeps.slice(0, 2)).toEqual([1000, 2000]);
    expect(s.requests.filter((r) => r.path.startsWith("/orders")).length).toBe(3);
  });

  it("past the burst of 20 searchOrders calls, a sync stops with what it read and says when to try again", async () => {
    await creds();
    fakeClock();
    s.set({ orders: Array.from({ length: 25 }, (_, i) => order(i + 1)), pageSize: 1 });
    await read(await AMAZON_PUT(json("PUT", { projectId: P, marketplaceId: US })));
    const r = await read<{ partial: boolean; pages: number; added: number; waitSeconds: number; message: string }>(await SYNC(json("POST", { projectId: P })));
    expect(r.status).toBe(200);
    expect(r.body.partial).toBe(true);
    expect(r.body.pages).toBe(20);
    expect(r.body.added).toBe(20);
    expect(r.body.waitSeconds).toBe(179); // 1 / 0.0056 s, rounded up
    expect(r.body.message).toMatch(/rate limit/);
  });
});

describe("sync into the sales monitor", () => {
  it("imports one row per order, de-duplicated on the next sync, updating a cancelled order", async () => {
    await creds();
    s.set({ orders: [order(1), order(2, "2026-11-19", "SHIPPED", 1, "25.00")] });
    expect((await read(await SYNC(json("POST", { projectId: P })))).status).toBe(400); // no marketplace chosen yet
    await read(await AMAZON_PUT(json("PUT", { projectId: P, marketplaceId: US })));
    const first = await read<{ added: number; updated: number; unchanged: number }>(await SYNC(json("POST", { projectId: P })));
    expect(first.body).toMatchObject({ added: 2, updated: 0, unchanged: 0 });

    // Amazon reports order 1 again, now cancelled, and one new order.
    s.set({ orders: [{ ...order(1, "2026-11-20", "CANCELLED"), lastUpdatedTime: "2099-01-01T00:00:00Z" }, { ...order(2, "2026-11-19", "SHIPPED", 1, "25.00"), lastUpdatedTime: "2099-01-01T00:00:00Z" }, order(3, "2099-01-01")] });
    const second = await read<{ added: number; updated: number; unchanged: number }>(await SYNC(json("POST", { projectId: P })));
    expect(second.body).toMatchObject({ added: 1, updated: 1, unchanged: 1 });

    const rows = await q<{ data: Record<string, unknown>; status: string }>("SELECT data, status FROM items WHERE project_id=$1 AND section='sales/monitor' ORDER BY data->>'orderId'", [P]);
    expect(rows).toHaveLength(3);
    expect(rows[0].data).toMatchObject({ orderId: "111-0000000-0000001", channel: "Amazon", units: 0, revenue: 0, orderStatus: "CANCELLED", source: "sp-api" });
    expect(rows[1].data).toMatchObject({ date: "2026-11-19", units: 1, revenue: 25, currency: "USD", marketplaceId: US });
    expect(rows[2].data).toMatchObject({ units: 2, revenue: 39.98 });

    // The second sync read only orders updated since shortly before the first one.
    const calls = s.requests.filter((r) => r.path === "/orders/2026-01-01/orders");
    expect(calls.at(-1)!.query.lastUpdatedAfter > calls[0].query.lastUpdatedAfter).toBe(true);
    expect(calls.every((c) => c.query.includedData === "PROCEEDS,FULFILLMENT")).toBe(true);

    // The monitor's chart arithmetic: units and revenue by day and channel, from the rows.
    const agg = byDayAndChannel(rows.map((r) => toSaleRow(r.data)));
    expect(agg.cells.find((c) => c.day === "2026-11-20")).toMatchObject({ units: 0, revenue: 0 });
    expect(agg.cells.find((c) => c.day === "2099-01-01")).toMatchObject({ units: 2, revenue: 39.98, channel: "Amazon" });

    // Amazon's own daily totals are kept beside the rows for comparison, not as rows.
    const st = await read<{ amazon: { metrics: { day: string; units: number }[]; lastSyncAt: string } }>(await STATUS(json("GET", undefined, `http://t/api/channels/status?projectId=${P}`)));
    expect(st.body.amazon.metrics.length).toBeGreaterThan(0);
    expect(st.body.amazon.lastSyncAt).toBeTruthy();
    const ev = await q<{ kind: string }>("SELECT kind FROM events WHERE project_id=$1 AND kind='channel.amazon.sync'", [P]);
    expect(ev).toHaveLength(2);
  });

  it("stores no buyer or recipient data and never asks for it", async () => {
    await creds();
    s.set({ orders: [order(7)] });
    await read(await AMAZON_PUT(json("PUT", { projectId: P, marketplaceId: US })));
    await read(await SYNC(json("POST", { projectId: P })));
    const all = await q<{ t: string }>("SELECT concat_ws(' ', title, body, data::text) AS t FROM items WHERE project_id=$1", [P]);
    const text = all.map((r) => r.t).join(" ");
    for (const banned of ["Jane", "buyer", "Private Lane", "Springfield", "12345", "recipient", "Stand-in product"]) expect(text).not.toContain(banned);
    expect(Object.keys(cleanOrder({ orderId: "1", buyer: { buyerName: "X" }, recipient: {}, orderItems: [] })!).sort()).toEqual(["createdTime", "currency", "items", "lastUpdatedTime", "marketplaceId", "orderId", "status"]);
    expect(s.requests.some((r) => /BUYER|RECIPIENT/.test(r.query.includedData ?? ""))).toBe(false);
    await expectNoSecrets(SECRETS);
  });

  it("a token Amazon calls expired is replaced once, then the call succeeds", async () => {
    await creds();
    s.set({ orders: [order(1)] });
    await amazonAccessToken();
    s.set({ issued: [...(s.requests.length ? ["Atza|replaced-elsewhere"] : [])] }); // the cached token is no longer valid
    const page = await searchOrders({ marketplaceId: US, lastUpdatedAfter: "2026-11-01T00:00:00Z" });
    expect(page.orders).toHaveLength(1);
  });

  it("an unknown marketplace and a missing concept are refused", async () => {
    expect((await read(await AMAZON_PUT(json("PUT", { projectId: P, marketplaceId: "NOPE" })))).status).toBe(400);
    expect((await read(await AMAZON_PUT(json("PUT", { projectId: "zz-nope", marketplaceId: US })))).status).toBe(404);
  });
});
