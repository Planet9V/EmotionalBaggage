// The public count of early-access places (GET /api/access-requests/count): only { left, limit, full }, one database
// reading served for a few seconds, read again at once after a claim, and a limit per network address.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { GET } from "@/app/api/access-requests/count/route";
import { POST } from "@/app/api/access-requests/route";
import { EARLY_ACCESS_LIMIT_KEY } from "@/lib/accessRequests/places";
import { cachedPlaces, COUNT_CACHE_MS, COUNT_READS_PER_WINDOW, countReadWait, forgetCachedPlaces } from "@/lib/accessRequests/publicCount";

const URL_COUNT = "http://test.local/api/access-requests/count";
let address = 0;
const ask = (client = `203.0.113.${++address}`) => GET(new Request(URL_COUNT, { headers: { host: "test.local", "x-c2r-client-address": client } }));
const insert = (email: string, place: number | null) => q("INSERT INTO access_requests (name, email, building, place) VALUES ('', $1, 'A thing', $2)", [email, place]);

beforeAll(async () => {
  await q("DELETE FROM access_requests");
  await q("DELETE FROM sign_in_attempts WHERE username_key LIKE ' access-%'");
  await q("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [EARLY_ACCESS_LIMIT_KEY, JSON.stringify(3)]);
  forgetCachedPlaces();
});

afterAll(async () => {
  await q("DELETE FROM access_requests");
  await q("DELETE FROM settings WHERE key = $1", [EARLY_ACCESS_LIMIT_KEY]);
  await pool().end();
});

describe("GET /api/access-requests/count", () => {
  it("answers signed out with the three fields and nothing more, cacheable for a few seconds", async () => {
    await insert("held@example.test", 1);
    await q("INSERT INTO access_requests (name, email, building, place, status) VALUES ('', 'gone@example.test', 'x', NULL, 'declined')");
    const res = await ask();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=5");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ left: 2, limit: 3, full: false });
    expect(Object.keys(body).sort()).toEqual(["full", "left", "limit"]);
    expect(JSON.stringify(body)).not.toMatch(/example\.test|held|waiting/);
  });

  it("serves one reading for COUNT_CACHE_MS, and reads again at once after a claim through the form", async () => {
    const start = Date.now();
    expect(await cachedPlaces(start)).toEqual({ left: 2, limit: 3, full: false });
    // a place taken behind the cache's back (an Admin change, another process) shows only once the reading is old
    await insert("behind@example.test", 2);
    expect(await cachedPlaces(start + 1000)).toEqual({ left: 2, limit: 3, full: false });
    expect(await cachedPlaces(start + COUNT_CACHE_MS + 1)).toEqual({ left: 1, limit: 3, full: false });
    // the form's claim makes the next reading fresh
    const claim = await POST(new Request("http://test.local/api/access-requests", { method: "POST", headers: { origin: "http://test.local", host: "test.local", "content-type": "application/json", "x-c2r-client-address": "203.0.113.250" }, body: JSON.stringify({ email: "last@example.test", building: "The last place" }) }));
    expect(claim.status).toBe(201);
    expect(await (await ask()).json()).toEqual({ left: 0, limit: 3, full: true });
  });

  it("limits each network address and says when to try again; another address is not slowed", async () => {
    const t = 1_000_000;
    for (let i = 0; i < COUNT_READS_PER_WINDOW; i++) expect(countReadWait("198.51.100.77", t + i)).toBe(0);
    const wait = countReadWait("198.51.100.77", t + 1000);
    expect(wait).toBeGreaterThan(500);
    expect(wait).toBeLessThanOrEqual(600);
    expect(countReadWait("198.51.100.78", t + 1000)).toBe(0);
    // ten minutes later the address starts again
    expect(countReadWait("198.51.100.77", t + 10 * 60 * 1000)).toBe(0);

    const client = "203.0.113.200";
    for (let i = 0; i < COUNT_READS_PER_WINDOW; i++) expect((await ask(client)).status).toBe(200);
    const refused = await ask(client);
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(refused.headers.get("cache-control")).toBe("no-store");
    expect(await refused.json()).toEqual({ error: expect.stringMatching(/^Too many requests from here/) });
  });
});
