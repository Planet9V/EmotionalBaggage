// Access requests from the public welcome page: the open form route (valid, invalid, honeypot, rate limit,
// audit line, the chosen service level) and the Admin routes (refused under the published demo password, list newest first, status
// change with before and after, CSV), on the real PostgreSQL.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { SESSION_COOKIE } from "@/app/sign-in/shared";
import { ACCESS_CONFIRMATION, ACCESS_LEVELS, ACCESS_LEVEL_LABEL } from "@/lib/accessRequests/shared";
import { LEVELS } from "@/components/welcome/content";
import { POST } from "@/app/api/access-requests/route";
import { GET as LIST } from "@/app/api/admin/access-requests/route";
import { PATCH } from "@/app/api/admin/access-requests/[id]/route";
import { GET as EXPORT } from "@/app/api/admin/access-requests/export/route";
import { ctx, json, read } from "./helpers";

const URL_POST = "http://test.local/api/access-requests";
const OWNER = "zz-access-owner";
let ownerCookie = "";
let address = 0;
let startedAt = new Date();

/** A signed-out POST from one network address, as the server's start script records it. */
function visitor(payload: unknown, client = `198.51.100.${++address}`) {
  return new Request(URL_POST, {
    method: "POST",
    headers: { origin: "http://test.local", host: "test.local", "content-type": "application/json", "x-c2r-client-address": client },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

/** A request from an account whose password has been changed (the owner, not the public demo). */
function asOwner(method: string, url: string, payload?: unknown) {
  return new Request(url, {
    method,
    headers: { origin: "http://test.local", host: "test.local", "content-type": "application/json", cookie: `${SESSION_COOKIE}=${ownerCookie}` },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

const good = (over: Record<string, string> = {}) => ({
  name: "Ada Tester",
  email: "Ada@Example.test",
  building: "A clip-on sensor that tells me when the plant needs water.",
  company: "",
  website: "",
  ...over,
});

async function auditSince(action: string) {
  return q<{ summary: string; detail: Record<string, unknown>; actor: string }>("SELECT summary, detail, actor FROM audit_log WHERE action = $1 AND at >= $2 ORDER BY id", [action, startedAt]);
}

beforeAll(async () => {
  startedAt = new Date(Date.now() - 1000);
  await q("DELETE FROM access_requests");
  await q("DELETE FROM sign_in_attempts WHERE username_key LIKE ' access-%'");
  await q("DELETE FROM users WHERE username = $1", [OWNER]);
  const u = await q<{ id: string }>("INSERT INTO users (username, password_hash, password_changed_at) VALUES ($1, $2, now()) RETURNING id", [OWNER, await hashPassword("owner-password-1")]);
  ownerCookie = await createSession(Number(u[0]!.id), "vitest-access");
});

afterAll(async () => {
  await q("DELETE FROM access_requests");
  await q("DELETE FROM sign_in_attempts WHERE username_key LIKE ' access-%'");
  await q("DELETE FROM users WHERE username = $1", [OWNER]);
  await pool().end();
});

describe("POST /api/access-requests (open)", () => {
  it("stores a valid request, answers the truthful confirmation and writes an audit line without the person's details", async () => {
    const res = await read<{ ok: boolean; message: string }>(await POST(visitor(good())));
    expect(res).toEqual({ status: 201, body: { ok: true, message: ACCESS_CONFIRMATION } });
    expect(ACCESS_CONFIRMATION).toBe("We have your request. Nothing is sent by email yet; the owner sees it in Admin.");
    const rows = await q<{ name: string; email: string; status: string; building: string }>("SELECT name, email, status, building FROM access_requests");
    expect(rows).toEqual([{ name: "Ada Tester", email: "ada@example.test", status: "new", building: good().building }]);
    const lines = await auditSince("access.requested");
    expect(lines).toHaveLength(1);
    expect(lines[0]!.actor).toBe("");
    expect(JSON.stringify(lines[0])).not.toMatch(/Ada|example\.test/i);
  });

  it("stores the chosen level with the request, and '' when none was chosen or the field is absent", async () => {
    for (const level of ACCESS_LEVELS) expect((await POST(visitor(good({ name: `Level ${level}`, level })))).status, level).toBe(201);
    expect((await POST(visitor(good({ name: "Level none", level: "" })))).status).toBe(201);
    // a page loaded before the field existed sends no level
    expect((await POST(visitor(good({ name: "Level absent" })))).status).toBe(201);
    const rows = await q<{ name: string; level: string }>("SELECT name, level FROM access_requests WHERE name LIKE 'Level %' ORDER BY id");
    expect(rows).toEqual([
      { name: "Level free", level: "free" },
      { name: "Level maker", level: "maker" },
      { name: "Level studio", level: "studio" },
      { name: "Level self", level: "self" },
      { name: "Level none", level: "" },
      { name: "Level absent", level: "" },
    ]);
    const lines = await auditSince("access.requested");
    expect(lines.some((l) => l.detail.level === "studio")).toBe(true);
    await q("DELETE FROM access_requests WHERE name LIKE 'Level %'");
  });

  it.each([["enterprise"], ["Maker"], ["maker "], ["free'; DROP TABLE access_requests; --"]])("refuses the unknown level %j with a 400 that says why, and stores nothing", async (level) => {
    const before = await q<{ n: number }>("SELECT count(*)::int AS n FROM access_requests");
    const res = await read<{ error: string }>(await POST(visitor(good({ level }))));
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain("Choose one of the listed levels.");
    expect((await POST(visitor({ ...good(), level: 3 }))).status).toBe(400);
    const after = await q<{ n: number }>("SELECT count(*)::int AS n FROM access_requests");
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  it("the database refuses a level the app does not know, and the form's levels are the welcome page's cards", async () => {
    await expect(q("INSERT INTO access_requests (name, email, building, level) VALUES ('X', 'x@y.test', 'Straight into the table', 'gold')")).rejects.toThrow(/access_requests_level_check/);
    expect(LEVELS.map((l) => l.key)).toEqual([...ACCESS_LEVELS]);
    expect(LEVELS.map((l) => l.name)).toEqual(ACCESS_LEVELS.map((l) => ACCESS_LEVEL_LABEL[l]));
  });

  it("needs no session", async () => {
    expect((await POST(visitor(good({ name: "No Session" })))).status).toBe(201);
  });

  it.each([
    [{ name: "" }, "Enter your name."],
    [{ email: "not-an-email" }, "That does not look like an email address."],
    [{ email: "" }, "Enter an email address so the owner can reply."],
    [{ building: "short" }, "Say in a sentence or two what you want to build."],
    [{ name: "x".repeat(121) }, "Keep your name under 120 characters."],
    [{ building: "y".repeat(2001) }, "Keep this under 2000 characters."],
    [{ company: "z".repeat(161) }, "Keep the company name under 160 characters."],
  ])("refuses %j with a 400 that says why, and stores nothing", async (over, message) => {
    const before = await q<{ n: number }>("SELECT count(*)::int AS n FROM access_requests");
    const res = await read<{ error: string }>(await POST(visitor(good(over as Record<string, string>))));
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain(message);
    const after = await q<{ n: number }>("SELECT count(*)::int AS n FROM access_requests");
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  it("refuses a body that is not JSON, and one with a missing field", async () => {
    expect((await POST(visitor("{not json"))).status).toBe(400);
    expect((await POST(visitor({ name: "A", email: "a@b.test" }))).status).toBe(400);
  });

  it("refuses a body over 16 KB", async () => {
    const res = await POST(visitor(good({ building: "b".repeat(20_000) })));
    expect(res.status).toBe(413);
  });

  it("refuses a post from another site", async () => {
    const r = new Request(URL_POST, { method: "POST", headers: { origin: "https://evil.example", host: "test.local", "content-type": "application/json" }, body: JSON.stringify(good()) });
    expect((await POST(r)).status).toBe(403);
  });

  it("answers a filled honeypot like a success, stores nothing and records the drop", async () => {
    const before = await q<{ n: number }>("SELECT count(*)::int AS n FROM access_requests");
    const res = await read<{ ok: boolean; message: string }>(await POST(visitor(good({ name: "Bot", website: "https://spam.example" }))));
    expect(res).toEqual({ status: 200, body: { ok: true, message: ACCESS_CONFIRMATION } });
    const after = await q<{ n: number }>("SELECT count(*)::int AS n FROM access_requests");
    expect(after[0]!.n).toBe(before[0]!.n);
    const lines = await auditSince("access.refused");
    expect(lines.some((l) => l.detail.reason === "honeypot")).toBe(true);
    expect(JSON.stringify(lines)).not.toContain("spam.example");
  });

  it("lets five requests through from one address, then refuses with 429 and Retry-After, and records it", async () => {
    const client = "203.0.113.77";
    for (let i = 0; i < 5; i++) expect((await POST(visitor(good({ name: `Burst ${i}` }), client))).status).toBe(201);
    const sixth = await POST(visitor(good({ name: "Burst 5" }), client));
    expect(sixth.status).toBe(429);
    expect(Number(sixth.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    expect(((await sixth.json()) as { error: string }).error).toMatch(/^Too many requests from here\. Try again in \d+ seconds?\.$/);
    expect(await q("SELECT 1 FROM access_requests WHERE name = 'Burst 5'")).toHaveLength(0);
    expect((await auditSince("access.refused")).some((l) => l.detail.reason === "rate-limited")).toBe(true);
    // another address is not slowed down
    expect((await POST(visitor(good({ name: "Elsewhere" }), "203.0.113.78"))).status).toBe(201);
  });

  it("a flood of refused tries from one address writes a few audit lines that carry the count, not one line each", async () => {
    const client = "203.0.113.90";
    for (let i = 0; i < 5; i++) expect((await POST(visitor(good({ name: `Flood ${i}`, email: `flood${i}@example.test` }), client))).status).toBe(201);
    const before = (await auditSince("access.refused")).length;
    for (let i = 0; i < 40; i++) expect((await POST(visitor(good({ name: "Flood more" }), client))).status).toBe(429);
    const lines = (await auditSince("access.refused")).slice(before);
    // one at the 1st, 2nd, 4th, 8th, 16th and 32nd: six lines for forty refusals
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(6);
    expect(lines.map((l) => l.detail.count)).toEqual([1, 2, 4, 8, 16, 32]);
    expect(lines.every((l) => l.detail.reason === "rate-limited")).toBe(true);
    // the five accepted requests are all still recorded, one line each
    expect((await q<{ n: number }>("SELECT count(*)::int AS n FROM access_requests WHERE name LIKE 'Flood %'"))[0]!.n).toBe(5);
    expect((await auditSince("access.requested")).filter((l) => l.detail.id !== undefined).length).toBeGreaterThanOrEqual(5);
    await q("DELETE FROM access_requests WHERE name LIKE 'Flood %'");
  });

  it("the same request sent again is kept once and answered like the first, and the repeats are counted, not audited each", async () => {
    const client = "203.0.113.91";
    const same = good({ name: "Twice Over", email: "twice@example.test" });
    const first = await POST(visitor(same, client));
    expect(first.status).toBe(201);
    const requested = (await auditSince("access.requested")).length;
    const refused = (await auditSince("access.refused")).length;
    const again = await read<{ ok: boolean; message: string }>(await POST(visitor(same, client)));
    expect(again.body).toEqual({ ok: true, message: ACCESS_CONFIRMATION });
    expect((await POST(visitor(same, client))).status).toBe(200);
    expect((await q<{ n: number }>("SELECT count(*)::int AS n FROM access_requests WHERE email = 'twice@example.test'"))[0]!.n).toBe(1);
    expect((await auditSince("access.requested")).length).toBe(requested);
    const lines = (await auditSince("access.refused")).slice(refused);
    expect(lines.map((l) => [l.detail.reason, l.detail.count])).toEqual([["duplicate", 1], ["duplicate", 2]]);
    await q("DELETE FROM access_requests WHERE name = 'Twice Over'");
  });

  it("keeps its count apart from sign-in counts: a username can never share the row", async () => {
    const rows = await q<{ username_key: string }>("SELECT username_key FROM sign_in_attempts WHERE client = '203.0.113.77'");
    // the form's own try count, and the count of its refusals: every key starts with a space, so no username can share a row
    expect(rows.map((r) => r.username_key).sort()).toEqual([" access-refused rate-limited", " access-request"]);
  });
});

describe("Admin: access requests", () => {
  it("refuses the list, a status change and the CSV while the account uses the published demo password", async () => {
    const demo = await q<{ changed: Date | null }>("SELECT password_changed_at AS changed FROM users WHERE username = 'demo'");
    expect(demo[0]!.changed).toBeNull();
    const list = await read<{ error: string }>(await LIST(json("GET", undefined, "http://test.local/api/admin/access-requests")));
    expect(list.status).toBe(403);
    expect(list.body.error).toMatch(/published demo password/);
    expect((await PATCH(json("PATCH", { status: "contacted" }, "http://test.local/api/admin/access-requests/1"), ctx("1"))).status).toBe(403);
    expect((await EXPORT(json("GET", undefined, "http://test.local/api/admin/access-requests/export"))).status).toBe(403);
  });

  it("lists every request newest first for the owner", async () => {
    const res = await read<{ requests: { id: number; name: string; status: string; level: string; createdAt: string }[] }>(await LIST(asOwner("GET", "http://test.local/api/admin/access-requests")));
    expect(res.status).toBe(200);
    const ids = res.body.requests.map((r) => r.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    expect(res.body.requests.at(-1)!.name).toBe("Ada Tester");
    expect(res.body.requests[0]!.name).toBe("Elsewhere");
    expect(res.body.requests.every((r) => r.status === "new")).toBe(true);
    expect(res.body.requests.every((r) => r.level === "")).toBe(true);
  });

  it("shows the owner the level each request named", async () => {
    expect((await POST(visitor(good({ name: "Wants Studio", level: "studio" })))).status).toBe(201);
    const res = await read<{ requests: { name: string; level: string }[] }>(await LIST(asOwner("GET", "http://test.local/api/admin/access-requests")));
    expect(res.body.requests[0]).toMatchObject({ name: "Wants Studio", level: "studio" });
    await q("DELETE FROM access_requests WHERE name = 'Wants Studio'");
  });

  it("sets a status, records before and after, and changes nothing when it is the same", async () => {
    const [row] = await q<{ id: string }>("SELECT id FROM access_requests WHERE name = 'Ada Tester'");
    const id = row!.id;
    const url = `http://test.local/api/admin/access-requests/${id}`;
    const res = await read<{ request: { status: string; statusChangedAt: string | null } }>(await PATCH(asOwner("PATCH", url, { status: "contacted" }), ctx(id)));
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe("contacted");
    expect(res.body.request.statusChangedAt).not.toBeNull();
    const lines = await auditSince("access.status");
    expect(lines.at(-1)).toMatchObject({ actor: OWNER, detail: { id: Number(id), before: "new", after: "contacted" } });
    await PATCH(asOwner("PATCH", url, { status: "contacted" }), ctx(id));
    expect(await auditSince("access.status")).toHaveLength(lines.length);
    expect((await PATCH(asOwner("PATCH", url, { status: "declined" }), ctx(id))).status).toBe(200);
    expect((await q<{ status: string }>("SELECT status FROM access_requests WHERE id = $1", [id]))[0]!.status).toBe("declined");
  });

  it("refuses an unknown status and an unknown request", async () => {
    const [row] = await q<{ id: string }>("SELECT id FROM access_requests LIMIT 1");
    expect((await PATCH(asOwner("PATCH", `http://test.local/api/admin/access-requests/${row!.id}`, { status: "spam" }), ctx(row!.id))).status).toBe(400);
    expect((await PATCH(asOwner("PATCH", "http://test.local/api/admin/access-requests/999999", { status: "new" }), ctx("999999"))).status).toBe(404);
    expect((await PATCH(asOwner("PATCH", "http://test.local/api/admin/access-requests/abc", { status: "new" }), ctx("abc"))).status).toBe(404);
  });

  it("downloads CSV with a header row, newest first, with formulas neutralised, and records the copy", async () => {
    await q("INSERT INTO access_requests (name, email, building, level) VALUES ('=HYPERLINK(\"x\")', 'f@x.test', 'Formula in the name field', 'self')");
    const res = await EXPORT(asOwner("GET", "http://test.local/api/admin/access-requests/export"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/csv/);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="access-requests-\d{4}-\d{2}-\d{2}\.csv"$/);
    const text = await res.text();
    const lines = text.trimEnd().split("\r\n");
    expect(lines[0]).toBe("id,received,status,level,name,email,company,building");
    expect(lines[1]).toContain("'=HYPERLINK");
    expect(lines[1]).toContain(",new,Self-hosted,");
    const n = (await q<{ n: number }>("SELECT count(*)::int AS n FROM access_requests"))[0]!.n;
    expect(lines).toHaveLength(n + 1);
    const copies = await auditSince("access.exported");
    expect(copies.at(-1)!.detail).toEqual({ rows: n });
  });
});
