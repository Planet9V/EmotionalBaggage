import { createHash } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q, ready } from "@/lib/db";
import { GET as listProjects, POST as addProject } from "@/app/api/projects/route";
import { DELETE as deleteProject, GET as getProject, PATCH as patchProject } from "@/app/api/projects/[id]/route";
import { POST as archive } from "@/app/api/projects/[id]/archive/route";
import { POST as restore } from "@/app/api/projects/[id]/restore/route";
import { GET as exportProject } from "@/app/api/projects/[id]/export/route";
import { POST as duplicate } from "@/app/api/projects/[id]/duplicate/route";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import { SEED_PROJECT } from "@/lib/seed";
import { ctx, json, read, SEEDED } from "./helpers";

type Concept = {
  id: string;
  name: string;
  oneLiner: string;
  productType: string;
  stage: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  rowCount: number;
  rowsByStage: Record<string, number>;
};
type One = { project: Concept };
type List = { projects: Concept[] };
type Err = { error: string; issues?: { field: string; problem: string }[] };

const OWNED = ["items", "files", "events", "messages", "research", "gates"] as const;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

async function create(name: string, extra: Record<string, unknown> = {}) {
  const r = await read<One>(await addProject(json("POST", { name, ...extra })));
  expect(r.status).toBe(201);
  return r.body.project;
}
const list = async (query = "") => read<List>(await listProjects(json("GET", undefined, `http://t/api/projects${query}`)));
const get = async (id: string) => read<One & Err>(await getProject(json("GET"), ctx(id)));
const patch = async (id: string, b: unknown) => read<One & Err>(await patchProject(json("PATCH", b), ctx(id)));
const remove = async (id: string, b?: unknown) => read<Record<string, unknown> & Err>(await deleteProject(json("DELETE", b), ctx(id)));
const counts = async (id: string) => {
  const out: Record<string, number> = {};
  for (const t of OWNED) out[t] = (await q<{ n: number }>(`SELECT count(*)::int AS n FROM ${t} WHERE project_id=$1`, [id]))[0].n;
  return out;
};
async function addFile(id: string, name: string, bytes: Buffer) {
  const [r] = await q<{ id: string }>(
    "INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta) VALUES ($1,$2,'application/octet-stream','upload',$3,$4,$5,'{\"n\":1}') RETURNING id",
    [id, name, bytes.length, sha(bytes), bytes]
  );
  return Number(r.id);
}
/** A concept owning a row in every table: items in three stages, a file, a print job naming it, a message, research, a gate. */
async function fullConcept(name: string) {
  const p = await create(name, {
    items: [
      { section: "concept/brief", title: "What it is" },
      { section: "concept/brief", title: "Who it is for" },
      { section: "design/bom", title: "Board", data: { ref: "U1" } },
      { section: "prototype/assembly", title: "Step one", data: { key: "s1" } },
    ],
  });
  const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 10, 13]);
  const fileId = await addFile(p.id, "test-part.stl", bytes);
  await q(
    "INSERT INTO items (project_id, section, title, data, status, sort) VALUES ($1,'prototype/printing','Print shell',$2,'ready',9)",
    [p.id, JSON.stringify({ fileId, fileName: "test-part.stl" })]
  );
  await q("INSERT INTO messages (project_id, role, content) VALUES ($1,'user','Is it any good?')", [p.id]);
  await q("INSERT INTO research (project_id, query, answer, citations) VALUES ($1,'q','a','[]')", [p.id]);
  await q("INSERT INTO gates (project_id, stage, status) VALUES ($1,'concept','go')", [p.id]);
  return { ...p, fileId, bytes };
}

describe("concepts API", () => {
  afterAll(async () => {
    await q("DELETE FROM projects WHERE name LIKE 'ZZ Test%'");
  });

  describe("create and read", () => {
    it("defaults the product type to electronics and accepts another known type", async () => {
      const a = await create("ZZ Test Default Type");
      expect(a.productType).toBe("electronics");
      expect(a.stage).toBe("concept");
      expect(a.archivedAt).toBeNull();
      const b = await create("ZZ Test Printed", { productType: "printed" });
      expect(b.productType).toBe("printed");
      expect((await get(b.id)).body.project.productType).toBe("printed");
    });

    it("rejects an unknown product type, naming the field", async () => {
      const r = await read<Err>(await addProject(json("POST", { name: "ZZ Test Bad Type", productType: "wooden" })));
      expect(r.status).toBe(400);
      expect(r.body.issues?.[0].field).toBe("productType");
      expect((await q("SELECT 1 FROM projects WHERE name='ZZ Test Bad Type'")).length).toBe(0);
    });

    it("returns one concept in the list shape, and 404 for an unknown one", async () => {
      const p = await create("ZZ Test Get", { oneLiner: "One line" });
      const r = await get(p.id);
      expect(r.status).toBe(200);
      expect(r.body.project).toMatchObject({ id: p.id, name: "ZZ Test Get", oneLiner: "One line", productType: "electronics", stage: "concept" });
      expect(Object.keys(r.body.project).sort()).toEqual(
        ["archivedAt", "createdAt", "id", "lastActivityAt", "name", "oneLiner", "productType", "rowCount", "rowsByStage", "stage", "updatedAt"]
      );
      expect((await get("nope-not-here")).status).toBe(404);
    });

    it("keeps accepting rows of a section the product type hides", async () => {
      const p = await create("ZZ Test Hidden Rows", { productType: "physical" });
      const r = await addItem(json("POST", { section: "design/wiring", title: "A wire" }), ctx(p.id));
      expect(r.status).toBe(201);
      expect((await get(p.id)).body.project.rowsByStage.design).toBe(1);
    });
  });

  describe("list", () => {
    it("counts rows by stage and gives the latest event time", async () => {
      const p = await fullConcept("ZZ Test Counts");
      const r = await list();
      expect(r.status).toBe(200);
      const got = r.body.projects.find((x) => x.id === p.id)!;
      expect(got.rowsByStage).toEqual({ concept: 2, research: 0, design: 1, prototype: 2, production: 0, marketing: 0, sales: 0 });
      expect(got.rowCount).toBe(5);
      const [last] = await q<{ t: Date }>("SELECT max(created_at) AS t FROM events WHERE project_id=$1", [p.id]);
      expect(new Date(got.lastActivityAt!).getTime()).toBe(last.t.getTime());
      // The three fields the browser already relies on are still there.
      const seeded = r.body.projects.find((x) => x.id === SEEDED)!;
      expect(typeof seeded.name).toBe("string");
      expect(typeof seeded.oneLiner).toBe("string");
    });

    it("rejects an archived filter it does not know", async () => {
      const r = await read<Err>(await listProjects(json("GET", undefined, "http://t/api/projects?archived=yes")));
      expect(r.status).toBe(400);
      expect(r.body.error).toContain("archived");
    });
  });

  describe("edit", () => {
    it("changes the fields, keeps the id, and records before and after", async () => {
      const p = await create("ZZ Test Patch", { oneLiner: "Old line" });
      const r = await patch(p.id, { id: "something-else", name: "ZZ Test Patched", oneLiner: "New line", productType: "printed", stage: "design" });
      expect(r.status).toBe(200);
      expect(r.body.project).toMatchObject({ id: p.id, name: "ZZ Test Patched", oneLiner: "New line", productType: "printed", stage: "design" });
      expect((await q("SELECT 1 FROM projects WHERE id='something-else'")).length).toBe(0);
      const ev = await q<{ data: { before: object; after: object } }>(
        "SELECT data FROM events WHERE project_id=$1 AND kind='project.edited' ORDER BY id",
        [p.id]
      );
      expect(ev.length).toBe(1);
      expect(ev[0].data.before).toEqual({ name: "ZZ Test Patch", oneLiner: "Old line", productType: "electronics", stage: "concept" });
      expect(ev[0].data.after).toEqual({ name: "ZZ Test Patched", oneLiner: "New line", productType: "printed", stage: "design" });
      expect(new Date(r.body.project.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(p.updatedAt).getTime());
    });

    it("records only what changed, and nothing for a change to the same values", async () => {
      const p = await create("ZZ Test Patch Same");
      await patch(p.id, { name: "ZZ Test Patch Same", stage: "research" });
      const ev = await q<{ data: { before: object; after: object } }>("SELECT data FROM events WHERE project_id=$1 AND kind='project.edited'", [p.id]);
      expect(ev.map((e) => e.data)).toEqual([{ before: { stage: "concept" }, after: { stage: "research" } }]);
      await patch(p.id, { stage: "research" });
      expect((await q("SELECT 1 FROM events WHERE project_id=$1 AND kind='project.edited'", [p.id])).length).toBe(1);
    });

    it.each([
      [{ productType: "wooden" }, "productType"],
      [{ stage: "launch" }, "stage"],
      [{ name: "   " }, "name"],
      [{ oneLiner: "x".repeat(401) }, "oneLiner"],
      [{}, "(body)"],
    ])("rejects %j, naming %s", async (b, field) => {
      const p = await create("ZZ Test Patch Bad");
      const r = await patch(p.id, b);
      expect(r.status).toBe(400);
      expect(r.body.issues?.[0].field).toBe(field);
    });

    it("answers 404 for an unknown concept", async () => {
      expect((await patch("nope-not-here", { name: "x" })).status).toBe(404);
    });
  });

  describe("archive and restore", () => {
    it("archives, filters the list, archives twice without error, and restores", async () => {
      const p = await create("ZZ Test Archive");
      const a1 = await read<One & { changed: boolean }>(await archive(json("POST"), ctx(p.id)));
      expect(a1.status).toBe(200);
      expect(a1.body.changed).toBe(true);
      expect(a1.body.project.archivedAt).not.toBeNull();
      const a2 = await read<One & { changed: boolean }>(await archive(json("POST"), ctx(p.id)));
      expect(a2.status).toBe(200);
      expect(a2.body.changed).toBe(false);
      expect(a2.body.project.archivedAt).toBe(a1.body.project.archivedAt);

      const ids = async (query: string) => (await list(query)).body.projects.map((x) => x.id);
      expect(await ids("")).not.toContain(p.id);
      expect(await ids("?archived=0")).not.toContain(p.id);
      const only = await ids("?archived=1");
      expect(only).toContain(p.id);
      expect(only).not.toContain(SEEDED);
      const all = await ids("?archived=all");
      expect(all).toContain(p.id);
      expect(all).toContain(SEEDED);

      const r = await read<One & { changed: boolean }>(await restore(json("POST"), ctx(p.id)));
      expect(r.status).toBe(200);
      expect(r.body.changed).toBe(true);
      expect(r.body.project.archivedAt).toBeNull();
      expect(await ids("")).toContain(p.id);
      expect(await ids("?archived=1")).not.toContain(p.id);
      const again = await read<{ changed: boolean }>(await restore(json("POST"), ctx(p.id)));
      expect(again.status).toBe(200);
      expect(again.body.changed).toBe(false);

      const kinds = await q<{ kind: string }>("SELECT kind FROM events WHERE project_id=$1 AND kind LIKE 'project.%' ORDER BY id", [p.id]);
      expect(kinds.map((k) => k.kind)).toEqual(["project.created", "project.archived", "project.restored"]);
    });

    it("answers 404 for an unknown concept", async () => {
      expect((await archive(json("POST"), ctx("nope-not-here"))).status).toBe(404);
      expect((await restore(json("POST"), ctx("nope-not-here"))).status).toBe(404);
    });
  });

  describe("export", () => {
    it("sends one JSON download with everything the concept owns", async () => {
      const p = await fullConcept("ZZ Test Export");
      const res = await exportProject(json("GET"), ctx(p.id));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-disposition")).toBe(`attachment; filename="${p.id}-export.json"`);
      expect(res.headers.get("content-type")).toContain("application/json");
      const doc = JSON.parse(await res.text());
      expect(doc.format).toBe(1);
      expect(doc.concept.id).toBe(p.id);
      const db = await counts(p.id);
      expect(doc.items.length).toBe(db.items);
      expect(doc.events.length).toBe(db.events);
      expect(doc.messages.length).toBe(db.messages);
      expect(doc.research.length).toBe(db.research);
      expect(doc.gates.length).toBe(db.gates);
      expect(doc.files.length).toBe(db.files);
      expect(doc.counts).toEqual({ items: 5, events: db.events, research: 1, messages: 1, gates: 1, files: 1 });
      const f = doc.files[0];
      expect(f).toMatchObject({ id: p.fileId, name: "test-part.stl", size: p.bytes.length, sha256: sha(p.bytes), meta: { n: 1 } });
      const decoded = Buffer.from(f.bytesBase64, "base64");
      expect(decoded.equals(p.bytes)).toBe(true);
    });

    it("decodes a file larger than one base64 line", async () => {
      const p = await create("ZZ Test Export Big");
      const bytes = Buffer.alloc(5000, 0).map((_, i) => (i * 7) % 256);
      await addFile(p.id, "test-big.bin", Buffer.from(bytes));
      const doc = JSON.parse(await (await exportProject(json("GET"), ctx(p.id))).text());
      expect(Buffer.from(doc.files[0].bytesBase64, "base64").equals(Buffer.from(bytes))).toBe(true);
    });

    it("answers 404 for an unknown concept", async () => {
      expect((await exportProject(json("GET"), ctx("nope-not-here"))).status).toBe(404);
    });
  });

  describe("delete", () => {
    it.each([
      ["no body", undefined],
      ["a body that is not JSON", "{broken"],
      ["no confirm", {}],
      ["a wrong name", { confirm: "Something else" }],
      ["the name in other case", { confirm: "zz test delete guard" }],
      ["the id instead of the name", { confirm: "zz-test-delete-guard" }],
      ["a number", { confirm: 1 }],
    ])("refuses %s with a plain message", async (_n, b) => {
      const p = (await q<{ id: string }>("SELECT id FROM projects WHERE name='ZZ Test Delete Guard'"))[0]?.id ?? (await create("ZZ Test Delete Guard")).id;
      const r = await remove(p, b);
      expect(r.status).toBe(400);
      expect(r.body.error).toContain("confirm");
      expect((await get(p)).status).toBe(200);
    });

    it("answers 404 for an unknown concept", async () => {
      expect((await remove("nope-not-here", { confirm: "x" })).status).toBe(404);
    });

    it("deletes the concept and everything it owns, and says what went", async () => {
      const p = await fullConcept("ZZ Test Delete");
      const before = await counts(p.id);
      const r = await remove(p.id, { confirm: "ZZ Test Delete" });
      expect(r.status).toBe(200);
      expect(r.body.deleted).toEqual({ concept: p.id, name: "ZZ Test Delete", ...before });
      expect(before).toMatchObject({ items: 5, files: 1, messages: 1, research: 1, gates: 1 });
      expect(await counts(p.id)).toEqual({ items: 0, files: 0, events: 0, messages: 0, research: 0, gates: 0 });
      expect((await get(p.id)).status).toBe(404);
    });
  });

  describe("duplicate", () => {
    it("copies every item and file into a new concept, not the history", async () => {
      const src = await fullConcept("ZZ Test Dup Source");
      const r = await read<One & { source: string }>(await duplicate(json("POST", { name: "ZZ Test Dup Copy" }), ctx(src.id)));
      expect(r.status).toBe(201);
      const copy = r.body.project;
      expect(copy.id).toBe("zz-test-dup-copy");
      expect(copy).toMatchObject({ name: "ZZ Test Dup Copy", productType: src.productType, stage: src.stage, archivedAt: null });
      expect(r.body.source).toBe(src.id);

      const a = await counts(src.id);
      const b = await counts(copy.id);
      expect(b.items).toBe(a.items);
      expect(b.files).toBe(a.files);
      expect({ messages: b.messages, research: b.research, gates: b.gates, events: b.events }).toEqual({ messages: 0, research: 0, gates: 0, events: 1 });
      const [ev] = await q<{ kind: string; data: { sourceId: string } }>("SELECT kind, data FROM events WHERE project_id=$1", [copy.id]);
      expect(ev.kind).toBe("project.duplicated");
      expect(ev.data.sourceId).toBe(src.id);

      type It = { id: string; section: string; title: string; body: string; data: Record<string, unknown>; status: string; sort: number };
      const rows = (id: string) => q<It>("SELECT id, section, title, body, data, status, sort FROM items WHERE project_id=$1 ORDER BY sort, id", [id]);
      const ia = await rows(src.id);
      const ib = await rows(copy.id);
      const strip = (x: It) => ({ section: x.section, title: x.title, body: x.body, status: x.status, sort: x.sort, data: { ...x.data, fileId: undefined } });
      expect(ib.map(strip)).toEqual(ia.map(strip));
      expect(new Set([...ia, ...ib].map((x) => x.id)).size).toBe(ia.length + ib.length);
      // Keys and part references copy unchanged.
      expect(ib.find((x) => x.title === "Board")!.data.ref).toBe("U1");
      expect(ib.find((x) => x.title === "Step one")!.data.key).toBe("s1");

      const fa = await q<{ id: string; bytes: Buffer; sha256: string; name: string }>("SELECT id, bytes, sha256, name FROM files WHERE project_id=$1", [src.id]);
      const fb = await q<{ id: string; bytes: Buffer; sha256: string; name: string }>("SELECT id, bytes, sha256, name FROM files WHERE project_id=$1", [copy.id]);
      expect(fb[0].id).not.toBe(fa[0].id);
      expect(sha(fb[0].bytes)).toBe(sha(fa[0].bytes));
      expect(fb[0].sha256).toBe(fa[0].sha256);
      // The copied print job points at the copied file, not at the source's.
      expect(Number(ib.find((x) => x.title === "Print shell")!.data.fileId)).toBe(Number(fb[0].id));
      expect(Number(ia.find((x) => x.title === "Print shell")!.data.fileId)).toBe(Number(fa[0].id));

      // Independent after the copy.
      const boardCopy = ib.find((x) => x.title === "Board")!;
      expect((await patchItem(json("PATCH", { title: "Board changed" }), ctx(boardCopy.id))).status).toBe(200);
      expect((await rows(src.id)).find((x) => x.id === ia.find((y) => y.title === "Board")!.id)!.title).toBe("Board");
      await patch(copy.id, { name: "ZZ Test Dup Copy Renamed" });
      expect((await get(src.id)).body.project.name).toBe("ZZ Test Dup Source");
      expect((await remove(copy.id, { confirm: "ZZ Test Dup Copy Renamed" })).status).toBe(200);
      expect(await counts(src.id)).toEqual(a);
    });

    it("takes the next free id when the name is taken", async () => {
      const src = await create("ZZ Test Dup Twice");
      const r = await read<One>(await duplicate(json("POST", { name: "ZZ Test Dup Twice" }), ctx(src.id)));
      expect(r.status).toBe(201);
      expect(r.body.project.id).toBe("zz-test-dup-twice-2");
    });

    it("needs a name and a known source", async () => {
      const src = await create("ZZ Test Dup Bad");
      const r = await read<Err>(await duplicate(json("POST", {}), ctx(src.id)));
      expect(r.status).toBe(400);
      expect(r.body.issues?.[0].field).toBe("name");
      expect((await duplicate(json("POST", { name: "ZZ Test Dup Nowhere" }), ctx("nope-not-here"))).status).toBe(404);
      expect((await q("SELECT 1 FROM projects WHERE name='ZZ Test Dup Nowhere'")).length).toBe(0);
    });
  });
});

// The example concept can be deleted like any other and stays deleted across a restart of the
// database layer. This runs against its own scratch database, so the seeded concept the other
// test files rely on is untouched. The shared pool is closed first and the scratch one replaces it.
describe("the example concept stays deleted after a restart", () => {
  const base = new URL(process.env.DATABASE_URL ?? "postgresql://c2r:c2r@localhost:5432/c2r");
  const scratch = `c2r_concepts_seed_${process.pid}`;
  const scratchUrl = (() => {
    const u = new URL(base.toString());
    u.pathname = `/${scratch}`;
    return u.toString();
  })();
  const g = globalThis as { __c2rPool?: unknown; __c2rReady?: unknown };
  const admin = async (sql: string) => {
    const a = new Client({ connectionString: base.toString() });
    await a.connect();
    await a.query(sql);
    await a.end();
  };

  beforeAll(async () => {
    await pool().end();
    g.__c2rPool = undefined;
    g.__c2rReady = undefined;
    await admin(`DROP DATABASE IF EXISTS ${scratch}`);
    await admin(`CREATE DATABASE ${scratch}`);
    process.env.DATABASE_URL = scratchUrl;
    await ready();
  });

  afterAll(async () => {
    await pool().end();
    g.__c2rPool = undefined;
    g.__c2rReady = undefined;
    process.env.DATABASE_URL = base.toString();
    await admin(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`);
  });

  it("is deleted through the API and does not come back on the next start", async () => {
    expect((await get(SEED_PROJECT.id)).status).toBe(200);
    const r = await remove(SEED_PROJECT.id, { confirm: SEED_PROJECT.name });
    expect(r.status).toBe(200);
    expect((r.body.deleted as { items: number }).items).toBeGreaterThan(0);

    g.__c2rReady = undefined;
    await ready();
    expect((await get(SEED_PROJECT.id)).status).toBe(404);
    expect((await q("SELECT count(*)::int AS n FROM projects"))[0]).toEqual({ n: 0 });
    expect((await q("SELECT count(*)::int AS n FROM items"))[0]).toEqual({ n: 0 });
  });
});
