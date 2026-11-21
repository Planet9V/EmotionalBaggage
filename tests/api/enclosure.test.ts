import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as generate } from "@/app/api/projects/[id]/enclosure/generate/route";
import { GET as status } from "@/app/api/projects/[id]/enclosure/status/route";
import { POST as addProject } from "@/app/api/projects/route";
import { POST as addItem, GET as listItems } from "@/app/api/projects/[id]/items/route";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import { anonymous, ctx, json, read, SEEDED } from "./helpers";

type Err = { error: string };
type Ok = { results: { key: string; ok: boolean; checks?: { key: string; ok: boolean }[]; error?: string }[]; openings: number };
const params = { wallThickness: 2, floorThickness: 2, lidThickness: 2, cornerRadius: 2, clearance: 0.5, openingMargin: 0.5, lidType: "snap", screwSize: "M2" };

let emptyId = "";
beforeAll(async () => {
  const r = await read<{ project: { id: string } }>(await addProject(json("POST", { name: "ZZ Enclosure Empty", items: [{ section: "concept/brief", title: "What it is" }] })));
  emptyId = r.body.project.id;
});
afterAll(async () => {
  await q("DELETE FROM items WHERE project_id=$1 AND section='design/enclosure'", [SEEDED]);
  if (emptyId) await q("DELETE FROM projects WHERE id=$1", [emptyId]);
  await pool().end();
});

describe("POST /enclosure/generate", () => {
  it("builds with CaseMaker on the seeded concept, checks the result and logs it", async () => {
    const r = await read<Ok>(await generate(json("POST", { generators: ["casemaker"], params }), ctx(SEEDED)));
    expect(r.status).toBe(200);
    expect(r.body.openings).toBe(3);
    expect(r.body.results[0].ok).toBe(true);
    expect(r.body.results[0].checks?.every((c) => c.ok)).toBe(true);
    const ev = await q<{ summary: string }>("SELECT summary FROM events WHERE project_id=$1 AND kind='enclosure.generated' ORDER BY id DESC LIMIT 1", [SEEDED]);
    expect(ev[0].summary).toMatch(/casemaker/);
  }, 90_000);

  it("reports YAPP_Box as unavailable inside the answer when the planner cannot be reached", async () => {
    const saved = process.env.PLANNER_URL;
    process.env.PLANNER_URL = "http://127.0.0.1:1";
    try {
      const r = await read<Ok>(await generate(json("POST", { generators: ["yapp"], params }), ctx(SEEDED)));
      expect(r.status).toBe(200);
      expect(r.body.results[0]).toMatchObject({ key: "yapp", ok: false, code: "unreachable" });
    } finally {
      if (saved === undefined) delete process.env.PLANNER_URL;
      else process.env.PLANNER_URL = saved;
    }
  });

  it("refuses parameters out of range", async () => {
    const r = await read<Err>(await generate(json("POST", { generators: ["casemaker"], params: { ...params, wallThickness: 0.2 } }), ctx(SEEDED)));
    expect(r.status).toBe(400);
  });
  it("refuses an unknown generator and an empty list", async () => {
    expect((await generate(json("POST", { generators: ["nope"], params }), ctx(SEEDED))).status).toBe(400);
    expect((await generate(json("POST", { generators: [], params }), ctx(SEEDED))).status).toBe(400);
  });
  it("answers 409 when no part has a box (nothing to build around)", async () => {
    const r = await read<Err>(await generate(json("POST", { generators: ["casemaker"], params }), ctx(emptyId)));
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/No part has a box/);
  });
  it("answers 409 with the reason when a part is taller than the inside", async () => {
    const made = await read<{ project: { id: string } }>(
      await addProject(
        json("POST", {
          name: "ZZ Enclosure Tall",
          items: [
            { section: "design/bom", title: "Shell", data: { ref: "E", geometry: { shape: "shell", size: [60, 30, 40], pos: [0, 15, 0] } } },
            { section: "design/bom", title: "Tall thing", data: { ref: "T", geometry: { shape: "box", size: [10, 40, 10], pos: [0, 15, 0] } } },
          ],
        })
      )
    );
    try {
      const r = await read<Err>(await generate(json("POST", { generators: ["casemaker"], params }), ctx(made.body.project.id)));
      expect(r.status).toBe(409);
      expect(r.body.error).toMatch(/T is 40 mm tall/);
    } finally {
      await q("DELETE FROM projects WHERE id=$1", [made.body.project.id]);
    }
  });
  it("answers 404 for an unknown concept and 401 without a session", async () => {
    expect((await generate(json("POST", { generators: ["casemaker"], params }), ctx("no-such-concept"))).status).toBe(404);
    expect((await generate(anonymous("POST", { generators: ["casemaker"], params }), ctx(SEEDED))).status).toBe(401);
  });
});

describe("GET /enclosure/status", () => {
  it("says CaseMaker can always run and gives the reason YAPP_Box cannot when no planner is set", async () => {
    const saved = process.env.PLANNER_URL;
    delete process.env.PLANNER_URL;
    try {
      const r = await read<{ casemaker: { available: boolean }; yapp: { available: boolean; code?: string; reason?: string } }>(await status(json("GET"), ctx(SEEDED)));
      expect(r.body.casemaker.available).toBe(true);
      expect(r.body.yapp).toMatchObject({ available: false, code: "not-configured" });
    } finally {
      if (saved !== undefined) process.env.PLANNER_URL = saved;
    }
  });
  it("is 401 without a session", async () => {
    expect((await status(anonymous("GET"), ctx(SEEDED))).status).toBe(401);
  });
});

describe("the saved choice (design/enclosure)", () => {
  it("stores the generator and the parameters, and refuses a bad generator", async () => {
    const bad = await addItem(json("POST", { section: "design/enclosure", title: "Enclosure settings", data: { enclosureGenerator: "other" } }), ctx(SEEDED));
    expect(bad.status).toBe(400);
    const ok = await read<{ item: { id: number } }>(await addItem(json("POST", { section: "design/enclosure", title: "Enclosure settings", data: { enclosureGenerator: "yapp", params: { clearance: "0.6", lidType: "screw" } } }), ctx(SEEDED)));
    expect(ok.status).toBe(201);
    const list = await read<{ items: { data: { params: { clearance: number } } }[] }>(await listItems(json("GET", undefined, "http://test.local/api?section=design/enclosure"), ctx(SEEDED)));
    expect(list.body.items[0].data.params.clearance).toBe(0.6);
    const patched = await patchItem(json("PATCH", { data: { enclosureGenerator: "casemaker" } }), ctx(String(ok.body.item.id)));
    expect(patched.status).toBe(200);
  });
});
