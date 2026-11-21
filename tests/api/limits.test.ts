// Robustness review S8: no size cap on item data (a 5 MB value was stored and came back on every list load),
// no cap on rows per concept, uploads measured only after the whole body was parsed (an over-size multipart
// answered 400 "file is required" instead of 413), and no security headers.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import { POST as upload } from "@/app/api/projects/[id]/files/route";
import { MAX_ROWS_PER_CONCEPT } from "@/lib/api/limits";
import { DATA_LIMIT_BYTES, dataLimitFor } from "@/lib/api/schemas";
import { DEFAULT_MAX_BODY_BYTES } from "@/lib/api/route";
import nextConfig from "../../next.config";
import { ctx, form, json, read, sessionCookieHeader } from "./helpers";

const P = "zz-limits";
const big = (bytes: number) => "x".repeat(bytes);

beforeAll(async () => {
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await q("INSERT INTO projects (id, name) VALUES ($1, 'ZZ Limits')", [P]);
});
afterAll(async () => {
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await pool().end();
});

type Err = { error: string; issues?: { field: string; problem: string }[] };

describe("item data", () => {
  it("the reviewer's repro: data over the section's limit is refused, naming the field", async () => {
    const r = await read<Err>(await addItem(json("POST", { section: "concept/brief", title: "zz big", data: { note: big(DATA_LIMIT_BYTES) } }), ctx(P)));
    expect(r.status).toBe(400);
    expect(r.body.issues?.[0]).toMatchObject({ field: "data" });
    expect(r.body.issues?.[0].problem).toMatch(/at most 64 KB/);
    expect(await q("SELECT 1 FROM items WHERE project_id=$1 AND title='zz big'", [P])).toHaveLength(0);
  });

  it("sections that need more get more: a routed wire and a landing section", async () => {
    expect(dataLimitFor("design/wiring")).toBeGreaterThan(DATA_LIMIT_BYTES);
    const r = await addItem(json("POST", { section: "design/wiring", title: "zz wire", data: { note: big(100 * 1024) } }), ctx(P));
    expect(r.status).toBe(201);
  });

  it("a patch is judged on the row as it will be, so data cannot grow past the limit in steps", async () => {
    const made = await read<{ item: { id: number } }>(await addItem(json("POST", { section: "concept/brief", title: "zz steps", data: { a: big(40 * 1024) } }), ctx(P)));
    const r = await read<Err>(await patchItem(json("PATCH", { data: { b: big(40 * 1024) } }), ctx(String(made.body.item.id))));
    expect(r.status).toBe(400);
    expect(r.body.issues?.[0].field).toBe("data");
  });
});

describe("request size", () => {
  it("a body over the route's limit is a 413 before it is parsed, with or without a Content-Length", async () => {
    const payload = JSON.stringify({ section: "concept/brief", title: "zz huge", body: big(DEFAULT_MAX_BODY_BYTES) });
    const r = await read<Err>(await addItem(json("POST", payload), ctx(P)));
    expect(r.status).toBe(413);
    expect(r.body.error).toMatch(/larger than 4 MB/);
    const declared = new Request("http://test.local/api", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(DEFAULT_MAX_BODY_BYTES + 1), cookie: sessionCookieHeader(), origin: "http://test.local", host: "test.local" },
      body: "{}",
    });
    expect((await addItem(declared, ctx(P))).status).toBe(413);
  });

  it("an upload over 25 MB answers 413 with the limit, not 400 'file is required'", async () => {
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array(26 * 1024 * 1024)], "zz-big.bin"));
    const res = await read<Err>(await upload(form("POST", fd), ctx(P)));
    expect(res).toEqual({ status: 413, body: { error: "Files are limited to 25 MB." } });
    const req = form("POST", new FormData());
    const declared = new Request(req.url, { method: "POST", headers: { ...Object.fromEntries(req.headers), "content-type": "multipart/form-data; boundary=x", "content-length": String(30 * 1024 * 1024) }, body: "--x--" });
    expect(await read<Err>(await upload(declared, ctx(P)))).toEqual({ status: 413, body: { error: "Files are limited to 25 MB." } });
  });
});

describe("rows per concept", () => {
  it("refuses a row past the limit with 413", async () => {
    await q(
      "INSERT INTO items (project_id, section, title, body, data, status, sort) SELECT $1, 'concept/brief', 'zz fill ' || g, '', '{}', 'open', g FROM generate_series(1, $2) g",
      [P, MAX_ROWS_PER_CONCEPT]
    );
    const r = await read<Err>(await addItem(json("POST", { section: "concept/brief", title: "zz one more" }), ctx(P)));
    expect(r.status).toBe(413);
    expect(r.body.error).toMatch(/at most 50,000/);
    await q("DELETE FROM items WHERE project_id=$1 AND title LIKE 'zz fill %'", [P]);
  });
});

describe("security headers", () => {
  it("every response carries a strict CSP, frame-ancestors none, nosniff, same-origin referrers and a permissions policy", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*")!;
    const h = Object.fromEntries(all.headers.map((x) => [x.key.toLowerCase(), x.value]));
    expect(h["content-security-policy"]).toMatch(/default-src 'self'/);
    expect(h["content-security-policy"]).toMatch(/frame-ancestors 'none'/);
    expect(h["content-security-policy"]).toMatch(/object-src 'none'/);
    expect(h["content-security-policy"]).not.toMatch(/https?:|\*/);
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("same-origin");
    expect(h["permissions-policy"]).toMatch(/camera=\(\)/);
  });
});
