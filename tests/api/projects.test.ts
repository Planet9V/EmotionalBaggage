import { afterAll, afterEach, describe, expect, inject, it } from "vitest";
import { createServer } from "node:net";
import type { Plan } from "@/lib/types";
import { pool, q } from "@/lib/db";
import { GET as listProjects, POST as addProject } from "@/app/api/projects/route";
import { GET as listFiles, POST as addFile } from "@/app/api/projects/[id]/files/route";
import { DELETE as removeFile, GET as getFile } from "@/app/api/files/[id]/route";
import { GET as events } from "@/app/api/projects/[id]/events/route";
import { GET as plan } from "@/app/api/projects/[id]/plan/route";
import { GET as search } from "@/app/api/search/route";
import { GET as challengeState, POST as challenge } from "@/app/api/challenge/route";
import { GET as researchState, POST as research } from "@/app/api/research/route";
import { ctx, form as formRequest, json, read, SEEDED } from "./helpers";

type Created = { project: { id: string; name: string } };

afterAll(async () => {
  await q("DELETE FROM projects WHERE id LIKE 'zz-test%'");
  await q("DELETE FROM files WHERE name LIKE 'test-%'");
  await pool().end();
});

describe("concepts", () => {
  it("lists the seeded concept", async () => {
    const r = await read<{ projects: { id: string }[] }>(await listProjects(json("GET")));
    expect(r.body.projects.map((p) => p.id)).toContain(SEEDED);
  });

  it("requires a name", async () => {
    expect((await addProject(json("POST", { name: "  " }))).status).toBe(400);
    expect((await addProject(json("POST", {}))).status).toBe(400);
  });

  it("creates a concept with its rows, and rejects the whole request if one row is invalid", async () => {
    const ok = await read<Created>(
      await addProject(json("POST", { name: "ZZ Test Rows", items: [{ section: "concept/brief", title: "What it is" }] }))
    );
    expect(ok.status).toBe(201);
    const rows = await q("SELECT 1 FROM items WHERE project_id=$1", [ok.body.project.id]);
    expect(rows.length).toBe(1);

    const bad = await addProject(
      json("POST", { name: "ZZ Test Bad", items: [{ section: "concept/brief", title: "ok" }, { section: "nope", title: "x" }] })
    );
    expect(bad.status).toBe(400);
    expect((await q("SELECT 1 FROM projects WHERE id='zz-test-bad'")).length).toBe(0);
  });

  it("gives the next free id when the name is taken, including the old collision case", async () => {
    // "ZZ Test Dup 2" takes the id zz-test-dup-2 first; the old code then crashed creating "ZZ Test Dup" twice.
    const ids: string[] = [];
    for (const name of ["ZZ Test Dup 2", "ZZ Test Dup", "ZZ Test Dup"]) {
      const r = await read<Created>(await addProject(json("POST", { name })));
      expect(r.status).toBe(201);
      ids.push(r.body.project.id);
    }
    expect(ids).toEqual(["zz-test-dup-2", "zz-test-dup", "zz-test-dup-3"]);
  });

  it("creates distinct concepts when the same name arrives twice at once", async () => {
    const both = await Promise.all([1, 2].map(() => addProject(json("POST", { name: "ZZ Test Race" }))));
    expect(both.map((r) => r.status)).toEqual([201, 201]);
    const ids = await Promise.all(both.map(async (r) => ((await r.json()) as Created).project.id));
    expect(new Set(ids).size).toBe(2);
  });
});

describe("unknown concept", () => {
  it.each([
    ["events", () => events(json("GET"), ctx("nope"))],
    ["plan", () => plan(json("GET"), ctx("nope"))],
    ["files", () => listFiles(json("GET"), ctx("nope"))],
    ["search", () => search(json("GET", undefined, "http://t/api/search?projectId=nope&q=a"))],
    ["challenge", () => challengeState(json("GET", undefined, "http://t/api/challenge?projectId=nope"))],
    ["research", () => researchState(json("GET", undefined, "http://t/api/research?projectId=nope"))],
  ])("%s answers 404", async (_n, call) => {
    expect((await call()).status).toBe(404);
  });
});

describe("files", () => {
  const upload = (project: string, meta = "{}") => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array([1, 2, 3, 4])], "test-file.bin", { type: "application/octet-stream" }));
    form.set("kind", "upload");
    form.set("meta", meta);
    return addFile(formRequest("POST", form, "http://t/api"), ctx(project));
  };

  it("stores, serves and removes a file", async () => {
    const made = await read<{ file: { id: number; size: number; sha256: string } }>(await upload(SEEDED));
    expect(made.status).toBe(201);
    expect(made.body.file.size).toBe(4);
    const id = String(made.body.file.id);
    const got = await getFile(json("GET"), ctx(id));
    expect(got.status).toBe(200);
    expect(got.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect((await removeFile(json("DELETE"), ctx(id))).status).toBe(200);
    expect((await getFile(json("GET"), ctx(id))).status).toBe(404);
  });

  it("answers 404 for an unknown concept and 400 for meta that is not an object", async () => {
    expect((await upload("nope")).status).toBe(404);
    expect((await upload(SEEDED, "[1]")).status).toBe(400);
    expect((await upload(SEEDED, "{broken")).status).toBe(400);
    expect((await getFile(json("GET"), ctx("abc"))).status).toBe(404);
  });
});

describe("search, plan and the assistants", () => {
  it("treats % and _ as text, not wildcards", async () => {
    // "%_%_" as wildcards would match every row (the cap of 50); as text it matches none. (A search for "%" alone
    // cannot tell the two apart once 50 rows hold a literal percent sign, as the example's files and sketch do.)
    const all = await read<{ items: unknown[] }>(await search(json("GET", undefined, `http://t/api/search?projectId=${SEEDED}&q=${encodeURIComponent("%_%_")}`)));
    const word = await read<{ items: unknown[] }>(await search(json("GET", undefined, `http://t/api/search?projectId=${SEEDED}&q=speaker`)));
    expect(word.body.items.length).toBeGreaterThan(0);
    expect(all.body.items).toHaveLength(0);
  });

  describe("plan", () => {
    const before = process.env.PLANNER_URL;
    afterEach(() => {
      if (before === undefined) delete process.env.PLANNER_URL;
      else process.env.PLANNER_URL = before;
    });

    it("plans the seeded build with the NetworkX planner when it is running", async () => {
      process.env.PLANNER_URL = inject("plannerUrl");
      const r = await read<Plan>(await plan(json("GET"), ctx(SEEDED)));
      expect(r.status).toBe(200);
      expect(r.body.engine).toBe("networkx");
      expect(r.body.criticalPath).toEqual(["go", "p0", "p1", "p6", "p7", "p8"]);
      // go, p0 15 + p1 210 + p6 20 + p7 30 + p8 10 minutes: the Rev D steps (the 2 x AA design's print took 345 and its fit 30: 430)
      expect([r.body.totalMinutes, r.body.plannedMinutes]).toEqual([285, 285]);
      expect(r.body.order.length).toBe(r.body.nodes.length);
      expect(r.body.note).toBeUndefined();
    });

    it("answers with the nodes and no order when the planner is not reachable", async () => {
      // a port that was free a moment ago and has nothing listening on it
      const port = await new Promise<number>((resolve) => {
        const s = createServer().listen(0, "127.0.0.1", () => {
          const a = s.address();
          s.close(() => resolve(typeof a === "object" && a ? a.port : 9));
        });
      });
      process.env.PLANNER_URL = `http://127.0.0.1:${port}`;
      const r = await read<Plan>(await plan(json("GET"), ctx(SEEDED)));
      expect(r.status).toBe(200);
      expect(r.body.engine).toBe("unavailable");
      expect(r.body.note).toMatch(/planner service is not running/);
      expect([r.body.order, r.body.criticalPath, r.body.totalMinutes]).toEqual([[], [], 0]);
      expect(r.body.nodes.length).toBeGreaterThan(0);
      expect(r.body.nodes.every((x) => x.wave === -1 && x.start === 0 && x.finish === 0 && !x.critical)).toBe(true);
    });

    it("says so when no planner address is set in Admin or in PLANNER_URL", async () => {
      delete process.env.PLANNER_URL;
      const r = await read<Plan>(await plan(json("GET"), ctx(SEEDED)));
      expect([r.status, r.body.engine, r.body.order]).toEqual([200, "unavailable", []]);
      expect(r.body.note).toMatch(/No planner address is set in Admin, Models or in PLANNER_URL/);
    });

    it("says in plain words why an unreachable planner did not answer, never 'fetch failed'", async () => {
      process.env.PLANNER_URL = "http://127.0.0.1:1";
      try {
        const r = await read<Plan>(await plan(json("GET"), ctx(SEEDED)));
        expect(r.body.engine).toBe("unavailable");
        expect(r.body.note).toMatch(/nothing is answering at that address/);
        expect(r.body.note).not.toMatch(/fetch failed/i);
      } finally {
        delete process.env.PLANNER_URL;
      }
    });
  });

  it("validates a challenge turn and a research question before anything else", async () => {
    expect((await challenge(json("POST", { projectId: SEEDED, message: " " }))).status).toBe(400);
    expect((await challenge(json("POST", { projectId: "nope", message: "hello" }))).status).toBe(404);
    expect((await research(json("POST", { projectId: SEEDED }))).status).toBe(400);
    expect((await research(json("POST", { projectId: "nope", query: "hello" }))).status).toBe(404);
  });
});
