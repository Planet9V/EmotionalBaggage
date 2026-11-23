import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as generate } from "@/app/api/projects/[id]/enclosure/generate/route";
import { GET as status } from "@/app/api/projects/[id]/enclosure/status/route";
import { POST as addProject } from "@/app/api/projects/route";
import { POST as addItem, GET as listItems } from "@/app/api/projects/[id]/items/route";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import { anonymous, ctx, json, read, SEEDED } from "./helpers";
import { ITEM_COLS, toItem, type ItemRow } from "@/lib/db";
import { enclosureCheck } from "@/lib/process/computed";

type Err = { error: string };
type Ok = { results: { key: string; ok: boolean; checks?: { key: string; ok: boolean }[]; error?: string }[]; openings: number };
// the example's own enclosure settings since the Rev D tag (its 3.0 rim, 2.4 back plate, 1.6 front skin, 0.3 clearance):
// the app's defaults leave the slim tag's parts touching the lid
const params = { wallThickness: 3, floorThickness: 2.4, lidThickness: 1.6, cornerRadius: 4, clearance: 0.3, openingMargin: 0.3, lidType: "snap", screwSize: "M2" };

let emptyId = "";
beforeAll(async () => {
  const r = await read<{ project: { id: string } }>(await addProject(json("POST", { name: "ZZ Enclosure Empty", items: [{ section: "concept/brief", title: "What it is" }] })));
  emptyId = r.body.project.id;
  // the example's own enclosure row (the authored Rev D tag) is set aside: these tests start with no choice saved
  await q("DELETE FROM items WHERE project_id=$1 AND section='design/enclosure'", [SEEDED]);
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

  it("keeps the measured checks on the saved choice, where the Design gate reads them, and records the change", async () => {
    const rows = async () => (await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 ORDER BY sort, id`, [SEEDED])).map(toItem);
    const saved = (await rows()).find((r) => r.section === "design/enclosure")!;
    expect(saved.data.enclosureGenerator).toBe("casemaker");
    const checked = (saved.data.checked as Record<string, { fingerprint: string; checks: { ok: boolean }[] }>).casemaker;
    expect(checked.checks.length).toBeGreaterThanOrEqual(5);
    expect(enclosureCheck(await rows())).toMatchObject({ met: true });
    const ev = await q<{ data: { itemId: number; after: Record<string, unknown> } }>("SELECT data FROM events WHERE project_id=$1 AND kind='enclosure.generated' ORDER BY id DESC LIMIT 1", [SEEDED]);
    expect(ev[0].data.itemId).toBe(saved.id);
    expect(Object.keys(ev[0].data.after)).toEqual(expect.arrayContaining([expect.stringMatching(/^data\./)]));
    // the saved settings change: the checks no longer describe them
    await q("UPDATE items SET data = jsonb_set(data, '{params,wallThickness}', '3.2') WHERE id=$1", [saved.id]);
    expect(enclosureCheck(await rows())).toMatchObject({ met: false, action: "Generate the enclosure again" });
  });

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
    const list = await read<{ items: { id: number; data: { params: { clearance: number } } }[] }>(await listItems(json("GET", undefined, "http://test.local/api?section=design/enclosure"), ctx(SEEDED)));
    expect(list.body.items.find((i) => i.id === ok.body.item.id)!.data.params.clearance).toBe(0.6);
    const patched = await patchItem(json("PATCH", { data: { enclosureGenerator: "casemaker" } }), ctx(String(ok.body.item.id)));
    expect(patched.status).toBe(200);
  });
});
