// Early access (owner, 22 Nov: "limit early access to 50 only"): places up to the limit, then the waiting list;
// exactly `limit` places when many claim at once; a repeated address gets no second place; the plain form post
// without script (303 to /welcome/early with the token in a cookie); the confirmation step tied to the request by
// its token; a freed place going to the first who waits; and the Admin limit route, the platform administrator's.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pool, q } from "@/lib/db";
import { POST } from "@/app/api/access-requests/route";
import { POST as DETAILS } from "@/app/api/access-requests/details/route";
import { GET as LIMIT_GET, PUT as LIMIT_PUT } from "@/app/api/admin/early-access/route";
import { addRequestDetails, claimEarlyAccess, earlyAccessCount, EARLY_ACCESS_LIMIT_KEY, outcomeByToken, setEarlyAccessLimit } from "@/lib/accessRequests/places";
import { listAccessRequests, setAccessStatus } from "@/lib/accessRequests/store";
import { sendEarlyAccessConfirmation } from "@/lib/accessRequests/confirmMail";
import { EARLY_COOKIE } from "@/lib/accessRequests/noScript";
import { json, read } from "./helpers";

// The platform administrator exists only in the new sign-in; the hook is stood in, as in tests/admin/platform.test.ts.
const hook = vi.hoisted(() => ({ admin: false, cookie: "" }));
vi.mock("@/lib/admin/platformAdminHook", () => ({ platformAdminFromAuth2: async () => hook.admin }));
// the confirmation page reads its cookie through next/headers; a test has no request scope, so the cookie is stood in
vi.mock("next/headers", async (orig) => ({ ...(await orig<typeof import("next/headers")>()), cookies: async () => ({ get: (n: string) => (n === "c2r_early" && hook.cookie ? { name: n, value: hook.cookie } : undefined) }) }));

let address = 0;
const claim = (email: string, over: Partial<Parameters<typeof claimEarlyAccess>[0]> = {}) =>
  claimEarlyAccess({ email, building: "A thing I want to make", name: "", company: "", level: "", placement: "hero", ...over });

function post(url: string, body: string, type: string) {
  return new Request(url, { method: "POST", headers: { origin: "http://test.local", host: "test.local", "content-type": type, "x-c2r-client-address": `198.18.0.${++address}` }, body });
}
const formPost = (fields: Record<string, string>, url = "http://test.local/api/access-requests") => post(url, new URLSearchParams(fields).toString(), "application/x-www-form-urlencoded");
const jsonPost = (payload: unknown, url = "http://test.local/api/access-requests") => post(url, JSON.stringify(payload), "application/json");

async function fresh(limit: number) {
  await q("DELETE FROM access_requests");
  await q("DELETE FROM sign_in_attempts WHERE username_key LIKE ' access-%'");
  await q("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [EARLY_ACCESS_LIMIT_KEY, JSON.stringify(limit)]);
}

beforeAll(() => fresh(50));
beforeEach(() => {
  hook.admin = false;
});
afterAll(async () => {
  await q("DELETE FROM access_requests");
  await q("DELETE FROM settings WHERE key = $1", [EARLY_ACCESS_LIMIT_KEY]);
  await q("DELETE FROM sign_in_attempts WHERE username_key LIKE ' access-%'");
  await pool().end();
});

describe("places and the waiting list", () => {
  it("counts 50 by default, gives places in order, then the waiting list with its position", async () => {
    await q("DELETE FROM settings WHERE key = $1", [EARLY_ACCESS_LIMIT_KEY]);
    expect(await earlyAccessCount()).toEqual({ limit: 50, held: 0, left: 50, waiting: 0 });
    await fresh(2);
    expect((await claim("a@x.test")).outcome).toEqual({ kind: "place", place: 1 });
    expect((await claim("b@x.test")).outcome).toEqual({ kind: "place", place: 2 });
    expect((await claim("c@x.test")).outcome).toEqual({ kind: "waiting", position: 1 });
    expect((await claim("d@x.test")).outcome).toEqual({ kind: "waiting", position: 2 });
    expect(await earlyAccessCount()).toEqual({ limit: 2, held: 2, left: 0, waiting: 2 });
  });

  it("exactly `limit` get a place when many claim at the same moment", async () => {
    await fresh(5);
    const results = await Promise.all(Array.from({ length: 24 }, (_, i) => claim(`race${i}@x.test`)));
    const places = results.flatMap((r) => (r.outcome.kind === "place" ? [r.outcome.place] : [])).sort((a, b) => a - b);
    const waiting = results.flatMap((r) => (r.outcome.kind === "waiting" ? [r.outcome.position] : [])).sort((a, b) => a - b);
    expect(places).toEqual([1, 2, 3, 4, 5]);
    expect(waiting).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
    expect(await earlyAccessCount()).toEqual({ limit: 5, held: 5, left: 0, waiting: 19 });
  });

  it("gives an address no second place, in any letters, and stores nothing for the repeat", async () => {
    await fresh(3);
    expect((await claim("Same@X.test")).outcome.kind).toBe("place");
    const again = await claim("same@x.TEST", { building: "Something else" });
    expect(again).toEqual({ outcome: { kind: "listed" }, id: null, token: null });
    expect((await q<{ n: number }>("SELECT count(*)::int AS n FROM access_requests"))[0]!.n).toBe(1);
  });

  it("a declined request frees its place for the first who waits; a raised limit fills places at once", async () => {
    await fresh(2);
    const a = await claim("p1@x.test");
    await claim("p2@x.test");
    const w1 = await claim("w1@x.test");
    const w2 = await claim("w2@x.test");
    await setAccessStatus(a.id!, "declined");
    const rows = await listAccessRequests();
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(w1.id!)).toMatchObject({ place: 1, waitingPosition: null });
    expect(byId.get(w2.id!)).toMatchObject({ place: null, waitingPosition: 1 });
    expect(byId.get(a.id!)).toMatchObject({ status: "declined", place: 1, waitingPosition: null });
    // taken back: its number is held by another now, so it waits behind nobody earlier than itself
    await setAccessStatus(a.id!, "new");
    expect((await listAccessRequests()).find((r) => r.id === a.id)).toMatchObject({ place: null, waitingPosition: 1 });
    expect(await setEarlyAccessLimit(4)).toEqual({ limit: 4, held: 4, left: 0, waiting: 0 });
    const promoted = await q<{ detail: { ids: number[] } }>("SELECT detail FROM audit_log WHERE action = 'access.promoted' ORDER BY id DESC LIMIT 1");
    expect(promoted[0]!.detail.ids).toEqual([a.id, w2.id]);
    // lowering it takes no place back
    expect(await setEarlyAccessLimit(1)).toEqual({ limit: 1, held: 4, left: 0, waiting: 0 });
  });
});

describe("the open route", () => {
  it("answers a place, then the waiting list, in JSON with a token only for a request just stored", async () => {
    await fresh(1);
    const first = await read<{ outcome: unknown; token?: string; message: string }>(await POST(jsonPost({ email: "one@x.test", building: "A lamp", placement: "hero" })));
    expect(first.status).toBe(201);
    expect(first.body.outcome).toEqual({ kind: "place", place: 1 });
    expect(first.body.token).toBeTruthy();
    const second = await read<{ outcome: unknown; message: string }>(await POST(jsonPost({ email: "two@x.test", building: "A clock", placement: "close" })));
    expect(second.body).toMatchObject({ outcome: { kind: "waiting", position: 1 }, message: "Early access is full. You are number 1 on the waiting list. We write to this address when a place opens." });
    const dup = await read<{ token?: string }>(await POST(jsonPost({ email: "ONE@x.test", building: "Another" })));
    expect(dup.status).toBe(200);
    expect(dup.body.token).toBeUndefined();
    const stored = await q<{ placement: string; name: string }>("SELECT placement, name FROM access_requests ORDER BY id");
    expect(stored).toEqual([{ placement: "hero", name: "" }, { placement: "close", name: "" }]);
  });

  it("without script: a plain form post answers 303 to /welcome/early with the token in a page-scoped HttpOnly cookie", async () => {
    await fresh(10);
    const res = await POST(formPost({ email: "plain@x.test", building: "A shelf", placement: "close", website: "" }));
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/welcome/early");
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(new RegExp(`^${EARLY_COOKIE}=[A-Za-z0-9_-]+;`));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/welcome\/early/);
    const token = /=([^;]+);/.exec(cookie)![1]!;
    expect(await outcomeByToken(token)).toEqual({ kind: "place", place: 1 });
    // a refusal goes back with a short code and nothing that was typed
    const bad = await POST(formPost({ email: "not-an-email", building: "A shelf" }));
    expect(bad.status).toBe(303);
    const loc = new URL(bad.headers.get("location")!);
    expect(loc.searchParams.get("e")).toBe("email");
    expect(loc.href).not.toContain("not-an-email");
    // a repeat and a honeypot: "on the list", no cookie
    for (const f of [{ email: "plain@x.test", building: "Again", website: "" }, { email: "bot@x.test", building: "Spam here", website: "http://spam.example" }]) {
      const r = await POST(formPost(f));
      expect(new URL(r.headers.get("location")!).searchParams.get("r")).toBe("listed");
      expect(r.headers.get("set-cookie")).toBeNull();
    }
  });

  it("without script: the confirmation page shows the place and the details form, or the refusal and the form again", async () => {
    await fresh(10);
    const { default: Page } = await import("@/app/welcome/early/page");
    const { renderToString } = await import("react-dom/server");
    const res = await POST(formPost({ email: "page@x.test", building: "A shelf", placement: "hero" }));
    hook.cookie = /=([^;]+);/.exec(res.headers.get("set-cookie")!)![1]!;
    const html = renderToString(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("You have place number 1. We open workspaces in order and write to this address.");
    expect(html).toContain('action="/api/access-requests/details"');
    expect(html).toContain(`value="${hook.cookie}"`);
    const saved = renderToString(await Page({ searchParams: Promise.resolve({ saved: "1" }) }));
    expect(saved).toContain("Your details are saved");
    expect(saved).not.toContain('action="/api/access-requests/details"');
    hook.cookie = "";
    const refused = renderToString(await Page({ searchParams: Promise.resolve({ e: "email" }) }));
    expect(refused).toContain("Enter a working email address.");
    expect(refused).toContain('action="/api/access-requests"');
    const listed = renderToString(await Page({ searchParams: Promise.resolve({ r: "listed" }) }));
    expect(listed).toContain("You are on the list.");
  });

  it("the confirmation step adds name, company and plan by token only; an unknown or lapsed token is 410", async () => {
    await fresh(10);
    const r = await read<{ token: string }>(await POST(jsonPost({ email: "det@x.test", building: "A bike light" })));
    const ok = await DETAILS(jsonPost({ token: r.body.token, name: "Dee Tail", company: "Bikes BV", level: "studio" }, "http://test.local/api/access-requests/details"));
    expect(ok.status).toBe(200);
    expect((await q("SELECT name, company, level FROM access_requests WHERE email = 'det@x.test'"))[0]).toEqual({ name: "Dee Tail", company: "Bikes BV", level: "studio" });
    const line = await q<{ detail: unknown; summary: string }>("SELECT detail, summary FROM audit_log WHERE action = 'access.details' ORDER BY id DESC LIMIT 1");
    expect(JSON.stringify(line)).not.toMatch(/Dee Tail|Bikes BV/);
    expect((await DETAILS(jsonPost({ token: "x".repeat(32), name: "Nobody" }, "http://test.local/api/access-requests/details"))).status).toBe(410);
    expect((await DETAILS(jsonPost({ token: r.body.token, level: "free" }, "http://test.local/api/access-requests/details"))).status).toBe(400);
    await expect(addRequestDetails(r.body.token, { name: "Late", company: "", level: "" }, new Date(Date.now() + 25 * 3600_000))).rejects.toThrow(/expired/);
    // the email address cannot be used in place of the token
    expect((await DETAILS(jsonPost({ token: "det@x.test", name: "Nobody" }, "http://test.local/api/access-requests/details"))).status).toBe(400);
    // without script: back to the page, saved
    const plain = await DETAILS(formPost({ token: r.body.token, company: "Bikes Two" }, "http://test.local/api/access-requests/details"));
    expect(plain.status).toBe(303);
    expect(new URL(plain.headers.get("location")!).searchParams.get("saved")).toBe("1");
  });

  it("sends no confirmation email while no mail server is set up, and that is never a failure", async () => {
    expect(await sendEarlyAccessConfirmation("someone@x.test", { kind: "place", place: 1 })).toBe(false);
  });
});

describe("Admin: the number of places", () => {
  it("is the platform administrator's only", async () => {
    expect((await LIMIT_GET(json("GET", undefined, "http://test.local/api/admin/early-access"))).status).toBe(403);
    expect((await LIMIT_PUT(json("PUT", { limit: 10 }, "http://test.local/api/admin/early-access"))).status).toBe(403);
  });

  it("reads and saves it, records before and after, and refuses a number that is not a place count", async () => {
    hook.admin = true;
    await fresh(50);
    const r = await read<{ limit: number }>(await LIMIT_PUT(json("PUT", { limit: 12 }, "http://test.local/api/admin/early-access")));
    expect(r.body).toEqual({ limit: 12, held: 0, left: 12, waiting: 0 });
    expect((await read(await LIMIT_GET(json("GET", undefined, "http://test.local/api/admin/early-access")))).body).toMatchObject({ limit: 12 });
    const line = await q<{ detail: unknown }>("SELECT detail FROM audit_log WHERE action = 'setting.changed' AND detail->>'key' = $1 ORDER BY id DESC LIMIT 1", [EARLY_ACCESS_LIMIT_KEY]);
    expect(line[0]!.detail).toEqual({ key: EARLY_ACCESS_LIMIT_KEY, before: 50, after: 12 });
    for (const limit of [-1, 2.5, "10", 100_001]) expect((await LIMIT_PUT(json("PUT", { limit }, "http://test.local/api/admin/early-access"))).status).toBe(400);
  });
});
