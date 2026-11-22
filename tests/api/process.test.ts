import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { q } from "@/lib/db";
import { POST as addProject } from "@/app/api/projects/route";
import { GET as getProcess } from "@/app/api/projects/[id]/process/route";
import { POST as override, DELETE as withdraw } from "@/app/api/projects/[id]/gates/route";
import { POST as moveStage } from "@/app/api/projects/[id]/stage/route";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import type { ProcessResponse } from "@/lib/process/state";
import { anonymous, ctx, json, read } from "./helpers";

type Err = { error: string; detail?: { unmet: { id: string; label: string; detail: string; href: string }[] }; issues?: { field: string }[] };

async function create(name: string, extra: Record<string, unknown> = {}) {
  const r = await read<{ project: { id: string } }>(await addProject(json("POST", { name, ...extra })));
  expect(r.status).toBe(201);
  return r.body.project.id;
}
const state = async (id: string) => read<ProcessResponse & Err>(await getProcess(json("GET"), ctx(id)));
const doOverride = async (id: string, b: unknown) => read<ProcessResponse & Err>(await override(json("POST", b), ctx(id)));
const doWithdraw = async (id: string, stage: string) => read<ProcessResponse & Err>(await withdraw(json("DELETE", { stage }), ctx(id)));
const move = async (id: string, stage: string) => read<ProcessResponse & Err>(await moveStage(json("POST", { stage }), ctx(id)));
const add = (id: string, section: string, title: string, extra: Record<string, unknown> = {}) =>
  addItem(json("POST", { section, title, ...extra }), ctx(id));

// The audit log outlives deleted concepts, and a concept's id comes from its name, so lines from an
// earlier run can carry the same id: count only lines written by this run.
let since = 0;

/** The story's pitch, written, and one stored file: the first two checks of the Concept gate. */
async function storyAndSource(id: string) {
  expect((await add(id, "concept/story", "The pitch", { body: "A toy that teaches knots.", data: { part: "pitch" } })).status).toBe(201);
  const file = await q<{ id: string }>("INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes) VALUES ($1,'notes.txt','text/plain','source',5,'x',$2) RETURNING id", [id, Buffer.from("notes")]);
  expect((await add(id, "concept/files", "Notes", { status: "stored", data: { kind: "note", fileId: Number(file[0].id), fileName: "notes.txt" } })).status).toBe(201);
}

describe("process API", () => {
  beforeAll(async () => {
    since = Number((await q<{ n: string | null }>("SELECT max(id) AS n FROM audit_log"))[0].n ?? 0);
  });

  afterAll(async () => {
    await q("DELETE FROM projects WHERE name LIKE 'ZZ Process%'");
  });

  it("needs a session and answers 404 for an unknown concept", async () => {
    expect((await getProcess(anonymous("GET"), ctx("x"))).status).toBe(401);
    expect((await moveStage(anonymous("POST", { stage: "research" }), ctx("x"))).status).toBe(401);
    expect((await override(anonymous("POST", { stage: "concept", reason: "x" }), ctx("x"))).status).toBe(401);
    expect((await state("zz-no-such-concept")).status).toBe(404);
  });

  it("reads the stage, product type, gates and an empty history of a new concept", async () => {
    const id = await create("ZZ Process Read", { productType: "physical", oneLiner: "A wooden toy" });
    const r = await state(id);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ projectId: id, productType: "physical", stage: "concept", oneLiner: "A wooden toy", gates: [], history: [] });
  });

  it("refuses to advance past an unmet gate and lists the unmet checks", async () => {
    const id = await create("ZZ Process Refused");
    const r = await move(id, "research");
    expect(r.status).toBe(409);
    expect(r.body.error).toContain("The Concept gate is not passed");
    expect(r.body.detail?.unmet.map((c) => c.id)).toEqual(["concept.one-liner", "concept.story", "concept.files", "concept.brief", "concept.go"]);
    expect(r.body.detail?.unmet[1]).toMatchObject({ href: "/story#story-pitch" });
    expect(r.body.detail?.unmet[2]).toMatchObject({ href: "/files#add-file" });
    expect(r.body.detail?.unmet[3]).toMatchObject({ href: "/s/concept/brief#add-row", detail: "0 brief lines recorded, 3 needed." });
    expect((await q<{ stage: string }>("SELECT stage FROM projects WHERE id=$1", [id]))[0].stage).toBe("concept");
  });

  it("refuses skipping a stage and moving to the stage it is in, and validates the stage", async () => {
    const id = await create("ZZ Process Skip");
    expect((await move(id, "design")).body.error).toBe("Advance one stage at a time. The next stage is Research.");
    expect((await move(id, "concept")).status).toBe(400);
    const bad = await move(id, "launch");
    expect(bad.status).toBe(400);
    expect(bad.body.issues?.[0].field).toBe("stage");
  });

  it("override needs a typed reason", async () => {
    const id = await create("ZZ Process Reason");
    for (const reason of [undefined, "", "   "]) {
      const r = await doOverride(id, { stage: "concept", reason });
      expect(r.status).toBe(400);
      expect(r.body.issues?.[0].field).toBe("reason");
    }
    expect((await q("SELECT 1 FROM gates WHERE project_id=$1", [id])).length).toBe(0);
  });

  it("override records the reason, who and when on the gate, in the history and in the audit log; then advance is allowed", async () => {
    const id = await create("ZZ Process Override");
    const o = await doOverride(id, { stage: "concept", reason: "  Validated with ten buyers in person  " });
    expect(o.status).toBe(200);
    const gate = o.body.gates.find((g) => g.stage === "concept")!;
    expect(gate).toMatchObject({ status: "go", overridden: true, note: "Validated with ten buyers in person", decidedBy: "demo" });
    expect(gate.decidedAt).not.toBeNull();
    expect(o.body.history[0]).toMatchObject({ kind: "gate.overridden", summary: "Overrode the Concept gate: Validated with ten buyers in person" });

    const [line] = await q<{ actor: string; action: string; detail: { stage: string; reason: string; unmet: { id: string }[] } }>(
      "SELECT actor, action, detail FROM audit_log WHERE project_id=$1 AND action='gate.overridden' AND id > $2",
      [id, since]
    );
    expect(line.actor).toBe("demo");
    expect(line.detail.stage).toBe("concept");
    expect(line.detail.reason).toBe("Validated with ten buyers in person");
    expect(line.detail.unmet.map((u) => u.id)).toEqual(["concept.one-liner", "concept.story", "concept.files", "concept.brief", "concept.go"]);

    const m = await move(id, "research");
    expect(m.status).toBe(200);
    expect(m.body.stage).toBe("research");
    expect(m.body.history[0]).toMatchObject({ kind: "stage.advanced", data: { from: "concept", to: "research", passedBy: "override" } });
    expect((await q("SELECT 1 FROM audit_log WHERE project_id=$1 AND action='stage.advanced' AND id > $2", [id, since])).length).toBe(1);
  });

  it("an override of a gate whose checks are all met is refused", async () => {
    const id = await create("ZZ Process Met", { oneLiner: "x" });
    await storyAndSource(id);
    for (const t of ["What", "Who", "Why"]) expect((await add(id, "concept/brief", t)).status).toBe(201);
    expect((await add(id, "concept/decisions", "Build it?", { data: { key: "go", chosen: "yes", options: [{ id: "yes", label: "Yes", outcome: "" }] } })).status).toBe(201);
    const r = await doOverride(id, { stage: "concept", reason: "Just because" });
    expect(r.status).toBe(409);
    // ...and advancing on its checks records who passed the gate, without marking it overridden.
    const m = await move(id, "research");
    expect(m.status).toBe(200);
    expect(m.body.gates.find((g) => g.stage === "concept")).toMatchObject({ status: "go", overridden: false, decidedBy: "demo", note: "" });
    expect(m.body.history[0].data).toMatchObject({ passedBy: "checks" });
  });

  it("moving back is always allowed and recorded", async () => {
    const id = await create("ZZ Process Back");
    await q("UPDATE projects SET stage='prototype' WHERE id=$1", [id]);
    const r = await move(id, "concept");
    expect(r.status).toBe(200);
    expect(r.body.stage).toBe("concept");
    expect(r.body.history[0]).toMatchObject({ kind: "stage.moved-back", summary: "Moved back from Prototype to Concept" });
    expect((await q("SELECT 1 FROM audit_log WHERE project_id=$1 AND action='stage.moved-back' AND id > $2", [id, since])).length).toBe(1);
  });

  it("refuses a request from another site", async () => {
    const id = await create("ZZ Process Origin");
    const req = new Request("http://test.local/api", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://evil.example", host: "test.local", cookie: json("GET").headers.get("cookie") ?? "" },
      body: JSON.stringify({ stage: "concept", reason: "x" }),
    });
    expect((await override(req, ctx(id))).status).toBe(403);
  });

  it("an override can be withdrawn, recorded with who, when and the reason withdrawn; then the gate holds again", async () => {
    const id = await create("ZZ Process Withdraw");
    expect((await doWithdraw(id, "concept")).status).toBe(409);
    expect((await doOverride(id, { stage: "concept", reason: "Checked by phone" })).status).toBe(200);
    const w = await doWithdraw(id, "concept");
    expect(w.status).toBe(200);
    expect(w.body.gates.find((g) => g.stage === "concept")).toMatchObject({ overridden: false, note: "", decidedBy: "demo" });
    expect(w.body.history[0]).toMatchObject({ kind: "gate.override-withdrawn", data: { stage: "concept", by: "demo", before: { overridden: true, note: "Checked by phone" }, after: { overridden: false } } });
    expect((await q("SELECT 1 FROM audit_log WHERE project_id=$1 AND action='gate.override-withdrawn' AND id > $2", [id, since])).length).toBe(1);
    expect((await move(id, "research")).status).toBe(409);
    expect((await doWithdraw(id, "concept")).status).toBe(409);
  });

  it("the Design gate of an electronics concept reads the electrical checks: an error holds it", async () => {
    const id = await create("ZZ Process Electrical", { oneLiner: "x" });
    await q("UPDATE projects SET stage='design' WHERE id=$1", [id]);
    expect((await add(id, "design/bom", "Board", { data: { ref: "U1" } })).status).toBe(201);
    // a wire to a part that is not in the bill of materials is an electrical error
    expect((await add(id, "design/wiring", "Signal", { data: { from: "U1", fromPin: "GPIO1", to: "U9", toPin: "IN" } })).status).toBe(201);
    const r = await state(id);
    expect(r.body.facts.erc?.ok).toBe(false);
    const m = await move(id, "prototype");
    expect(m.status).toBe(409);
    const unmet = m.body.detail!.unmet;
    expect(unmet.find((u) => u.id === "design.electrical")).toMatchObject({ href: "/s/design/schematic" });
    expect(unmet.find((u) => u.id === "design.electrical")!.detail).toMatch(/error/);
    // a printed part shows no schematic, so it has no electrical check and no facts.erc
    const printed = await create("ZZ Process Printed", { productType: "printed" });
    expect((await state(printed)).body.facts).toMatchObject({ currency: "USD", erc: null });
  });

  it("flags a stage entered behind a gate that is neither passed nor overridden (process review 4)", async () => {
    const id = await create("ZZ Process Skipped");
    expect((await state(id)).body.skipped).toEqual([]);
    expect((await doOverride(id, { stage: "concept", reason: "Checked by phone" })).status).toBe(200);
    expect((await move(id, "research")).status).toBe(200);
    // overridden: nothing skipped
    expect((await state(id)).body.skipped).toEqual([]);
    // withdrawing the override leaves the concept in Research with the Concept gate unpassed
    const w = await doWithdraw(id, "concept");
    expect(w.body.stage).toBe("research");
    expect(w.body.skipped).toHaveLength(1);
    expect(w.body.skipped[0]).toMatchObject({ stage: "concept", label: "Concept", enteredStage: "research", enteredLabel: "Research", regressed: false });
    expect(w.body.skipped[0].unmet.length).toBeGreaterThan(0);
    expect(w.body.skipped[0].unmet[0]).toHaveProperty("href");
    // moving back clears it
    expect((await move(id, "concept")).status).toBe(200);
    expect((await state(id)).body.skipped).toEqual([]);
  });

  it("a gate that was passed on its checks and no longer is reads as regressed, not as never passed", async () => {
    const id = await create("ZZ Process Regressed", { oneLiner: "x" });
    await storyAndSource(id);
    const rows = [await add(id, "concept/brief", "One"), await add(id, "concept/brief", "Two"), await add(id, "concept/brief", "Three")];
    expect(rows.every((r) => r.status === 201)).toBe(true);
    const dec = await add(id, "concept/decisions", "Go?", { data: { key: "go", options: [{ id: "y", label: "Yes" }], chosen: "y" } });
    expect(dec.status).toBe(201);
    const adv = await move(id, "research");
    expect(adv.status, JSON.stringify(adv.body)).toBe(200);
    expect((await state(id)).body.skipped).toEqual([]);
    // a brief line removed after advancing
    const first = (await read<{ item: { id: number } }>(rows[0])).body.item.id;
    await q("DELETE FROM items WHERE id=$1", [first]);
    const after = await state(id);
    expect(after.body.skipped).toHaveLength(1);
    expect(after.body.skipped[0]).toMatchObject({ stage: "concept", regressed: true });
  });
});
