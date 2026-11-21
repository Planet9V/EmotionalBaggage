// scripts/import-files.mjs against the real routes: a small HTTP server hands each request to the route handler,
// as Next.js would, and the script uploads a folder with the test's session cookie. Word files are skipped, a text
// copy fills in a listed source, and a wrong cookie stops the run with a sentence.
import { createServer, type Server } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { pool, q, ready } from "@/lib/db";
import { GET as CONCEPT } from "@/app/api/projects/[id]/route";
import { POST as ADD } from "@/app/api/projects/[id]/sources/route";
import { sessionCookieHeader } from "../api/helpers";
import { main, parseArgs } from "../../scripts/import-files.mjs";

const P = "zz-import";
let server: Server;
let base = "";

beforeAll(async () => {
  await ready();
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await q("INSERT INTO projects (id, name) VALUES ($1, 'ZZ Import')", [P]);
  await q("INSERT INTO items (project_id, section, title, body, data, status) VALUES ($1,'concept/files','Notes.pdf','Listed','{\"kind\":\"document\"}','not uploaded')", [P]);
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const url = `${base}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    const request = new Request(url, { method: req.method, headers, body: req.method === "GET" ? undefined : Buffer.concat(chunks) });
    const m = new URL(url).pathname.match(/^\/api\/projects\/([^/]+)(\/sources)?$/);
    const params = { params: Promise.resolve({ id: decodeURIComponent(m?.[1] ?? "") }) };
    const r = !m ? new Response(JSON.stringify({ error: "no route" }), { status: 404 }) : m[2] ? await ADD(request, params) : await CONCEPT(request, params);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const a = server.address();
  base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});

afterAll(async () => {
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await new Promise((ok) => server.close(ok));
  await pool().end();
});

describe("import-files.mjs", () => {
  it("reads its arguments", () => {
    expect(parseArgs(["dir", "--concept", "c1", "--url", "http://x:3000/some/page", "--cookie", "c2r_session=abc"])).toMatchObject({ folder: "dir", concept: "c1", url: "http://x:3000", cookie: "abc" });
  });

  it("uploads a folder into a concept's Sources", async () => {
    const dir = mkdtempSync(join(tmpdir(), "import-"));
    writeFileSync(join(dir, "idea.md"), "# Idea\n\nA suitcase that complains at the carousel.");
    writeFileSync(join(dir, "Notes.pdf.txt"), "Notes, as text.");
    writeFileSync(join(dir, "brief.docx"), "PK");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const token = sessionCookieHeader().split("=")[1];
    const counts = await main([dir, "--concept", P, "--url", base, "--cookie", token]);
    const lines = log.mock.calls.map((c) => String(c[0]));
    log.mockRestore();
    expect(counts).toEqual({ added: 2, skipped: 1, failed: 0 });
    expect(lines.some((l) => l.startsWith("skip  brief.docx") && l.includes("save Word files as PDF"))).toBe(true);
    const rows = await q<{ title: string; status: string }>("SELECT title, status FROM items WHERE project_id=$1 AND section='concept/files'", [P]);
    expect(rows.sort((a, b) => a.title.localeCompare(b.title))).toEqual([
      { title: "idea.md", status: "stored" },
      { title: "Notes.pdf", status: "stored" },
    ]);
    // nothing the script printed carries the session
    expect(lines.join("\n")).not.toContain(token);
  });

  it("stops with a sentence when the session is not signed in", async () => {
    const dir = mkdtempSync(join(tmpdir(), "import-"));
    writeFileSync(join(dir, "a.txt"), "a");
    await expect(main([dir, "--concept", P, "--url", base, "--cookie", "not-a-session"])).rejects.toThrow("The session is not signed in.");
  });
});
