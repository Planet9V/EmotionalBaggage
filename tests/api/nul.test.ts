// Robustness review S2: a NUL character (U+0000) or an over-long data.externalId gave HTTP 500.
// Every route file on disk is walked (as tests/auth/routes.test.ts walks them) and every write method
// is sent a NUL in each string field of a payload shaped like the app's requests; GET routes get one in
// the query and every route one in its path id. Nothing may answer 500, and the wrapper must refuse the
// request before the handler runs (so before any model call), with the same sentence everywhere.
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { NUL_REFUSED } from "@/lib/api/route";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import { POST as upload } from "@/app/api/projects/[id]/files/route";
import { ctx, form, json, read, SEEDED } from "./helpers";

const API_DIR = join(process.cwd(), "src", "app", "api");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const OPEN = new Set(["/api/auth/sign-in", "/api/auth/sign-out", "/api/auth/me", "/api/health"]);

function routeFiles(dir = API_DIR): { file: string; path: string }[] {
  const out: { file: string; path: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...routeFiles(full));
    else if (/^route\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      const rel = relative(API_DIR, dir).split(sep).join("/");
      out.push({ file: full, path: `/api${rel ? `/${rel}` : ""}` });
    }
  }
  return out;
}
const ROUTES = routeFiles();
type Handler = (req: Request, context?: unknown) => Promise<Response>;
async function handlersOf(file: string) {
  const mod = (await import(file)) as Record<string, unknown>;
  return METHODS.filter((m) => typeof mod[m] === "function").map((m) => [m, mod[m] as Handler] as const);
}

const N = "a\u0000b";
/** The string fields the app's write routes read, each to be poisoned in turn. */
const BASE: Record<string, unknown> = {
  projectId: SEEDED,
  name: "zz nul",
  title: "zz nul",
  body: "text",
  section: "concept/brief",
  query: "q",
  q: "q",
  message: "m",
  text: "t",
  url: "https://example.com/x",
  confirm: "zz nul",
  data: { note: "x", externalId: "zz:1" },
};
const payloads = (): [string, unknown][] => {
  const out: [string, unknown][] = [];
  for (const k of Object.keys(BASE)) {
    if (k === "data") {
      out.push(["data value", { ...BASE, data: { note: N } }]);
      out.push(["data key", { ...BASE, data: { [N]: "x" } }]);
      out.push(["nested", { ...BASE, data: { list: [{ deep: N }] } }]);
    } else out.push([k, { ...BASE, [k]: N }]);
  }
  return out;
};

afterAll(async () => {
  await q("DELETE FROM items WHERE project_id=$1 AND title LIKE 'zz nul%'", [SEEDED]);
  await pool().end();
});

describe("NUL characters never reach the database or a model", () => {
  it.each(ROUTES.filter((r) => !OPEN.has(r.path)).map((r) => [r.path, r.file]))("%s refuses a NUL in every field, the query and the path", async (path, file) => {
    for (const [method, handler] of await handlersOf(file)) {
      const url = `http://test.local${path.replace(/\[[^\]]+\]/g, "1")}`;
      if (method === "GET" || method === "DELETE") {
        const r = await read<{ error: string }>(await handler(json(method, undefined, `${url}?q=%00&projectId=${SEEDED}`), ctx("1")));
        expect({ path, method, ...r }).toEqual({ path, method, status: 400, body: { error: NUL_REFUSED } });
      } else {
        for (const [field, p] of payloads()) {
          const r = await read<{ error: string }>(await handler(json(method, p, url), ctx("1")));
          expect({ path, method, field, ...r }).toEqual({ path, method, field, status: 400, body: { error: NUL_REFUSED } });
        }
      }
      const withId = `http://test.local${path.replace(/\[[^\]]+\]/g, "x%00y")}`;
      if (withId !== url) {
        const r = await handler(json(method, method === "GET" || method === "DELETE" ? undefined : BASE, withId), ctx("x\u0000y"));
        expect({ path, method, status: r.status }).toEqual({ path, method, status: 400 });
      }
    }
  });

  it("the reviewer's repro: an item titled a\\u0000b is a 400 with a plain sentence", async () => {
    const r = await read<{ error: string }>(await addItem(json("POST", { section: "concept/brief", title: N }), ctx(SEEDED)));
    expect(r).toEqual({ status: 400, body: { error: NUL_REFUSED } });
  });

  it("a NUL in an uploaded file's name reaches PostgreSQL's 22021, which answers 400", async () => {
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1, 2, 3])], `zz${N}.bin`, { type: "application/octet-stream" }));
    const res = await upload(form("POST", fd), ctx(SEEDED));
    expect(res.status).toBeLessThan(500);
    if (res.status !== 201) expect(res.status).toBe(400);
    else await q("DELETE FROM files WHERE project_id=$1 AND name LIKE 'zz%'", [SEEDED]);
  });

  it("a NUL written as raw bytes in a non-JSON body is refused too", async () => {
    const req = new Request("http://test.local/api", { method: "POST", headers: { ...Object.fromEntries(json("POST").headers), "content-type": "text/plain" }, body: `{"title":"a${"\u0000"}b"}` });
    const r = await read<{ error: string }>(await addItem(req, ctx(SEEDED)));
    expect(r).toEqual({ status: 400, body: { error: NUL_REFUSED } });
  });

  it("an escaped backslash before u0000 is ordinary text, not a NUL", async () => {
    const r = await read<{ item: { title: string } }>(await addItem(json("POST", { section: "concept/brief", title: "zz nul \\u0000 literal" }), ctx(SEEDED)));
    expect(r.status).toBe(201);
    expect(r.body.item.title).toBe("zz nul \\u0000 literal");
  });
});

describe("data.externalId", () => {
  it("over 120 characters is a 400 naming the field, not a 500 from the index", async () => {
    const r = await read<{ issues: { field: string }[] }>(await addItem(json("POST", { section: "concept/brief", title: "zz nul ext", data: { externalId: "x".repeat(6000) } }), ctx(SEEDED)));
    expect(r.status).toBe(400);
    expect(r.body.issues[0].field).toBe("data.externalId");
    const ok = await addItem(json("POST", { section: "concept/brief", title: "zz nul ext ok", data: { externalId: "x".repeat(120) } }), ctx(SEEDED));
    expect(ok.status).toBe(201);
  });
});
