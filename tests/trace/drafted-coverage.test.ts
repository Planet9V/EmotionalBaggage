// F2: drafted tests and parts store the requirement link at their own end (`data.requirements`). After a
// fully drafted chain on a blank concept the coverage must show the requirements as covered, both ends must
// hold the link, and adding or removing a link at either end keeps the other end the same.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { coverageOf, traceOf } from "@/lib/trace/coverage";
import type { StandIn } from "../standins/core";
import type { OpenAIOptions } from "../standins/openai";
import { chooseReasoning, clearModelRows } from "../ai/setup";
import { addItem, approveRun, itemsOf, makeConcept, run, scriptedModel, type Script } from "../drafts/helpers";
import { add, events, patch, remove } from "./helpers";
import type { Item } from "@/lib/types";

const P = "zz-trace-drafted";
let s: StandIn<OpenAIOptions>;
const script: Script = {};

beforeAll(async () => {
  s = await scriptedModel(script);
  await makeConcept(P, "ZZ Trace blank", "electronics", "");
  await addItem(P, "concept/brief", "A plant pot that says when to water", {}, "For people who forget.");
});

afterAll(async () => {
  await clearModelRows();
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await s.close();
  await pool().end();
});

beforeEach(async () => {
  await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "stand-in-drafter" });
});

const all = async () => (await q<Item>("SELECT id, project_id AS \"projectId\", section, title, body, data, status, sort FROM items WHERE project_id=$1 ORDER BY id", [P])).map((r) => ({ ...r, id: Number(r.id) }));
const approveAll = async (generator: string) => {
  const r = await run({ projectId: P, generator });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const a = await approveRun(P, r.body.runId);
  expect(a.status, JSON.stringify(a.body)).toBe(200);
};

describe("coverage after a drafted chain", () => {
  it("requirements, parts and tests drafted and approved: every requirement is covered, read from either end", async () => {
    script.requirements = { rows: [{ title: "Reads soil moisture", detail: "Within 5 %." }, { title: "Runs a month on a battery", detail: "30 days." }] };
    await approveAll("requirements");
    const reqs = await itemsOf(P, "design/requirements");
    const [k1, k2] = reqs.map((r) => String(r.data.key));
    expect(k1).toBeTruthy();
    script.parts = { rows: [{ ref: "S1", title: "Moisture sensor", spec: "Capacitive", kind: "sensor", qty: 1, requirements: [k1] }, { ref: "BT1", title: "Battery", spec: "AA pair", kind: "battery", qty: 1, requirements: [k2] }] };
    await approveAll("parts");
    script.tests = { rows: [{ title: "Moisture reading test", method: "Compare with a meter.", pass: "Within 5 %", requirements: [k1] }, { title: "Battery life test", method: "Run 30 days.", pass: "Still running", requirements: [k2] }] };
    await approveAll("tests");

    const items = await all();
    const t = traceOf(items);
    expect(t.untested).toEqual([]);
    expect(t.orphanTests).toEqual([]);
    expect(t.unusedParts).toEqual([]);
    for (const r of t.requirements) expect(coverageOf(r, items)).toEqual({ tests: 1, parts: 1 });
    // both ends hold the link now: the requirement's own lists were written when the drafts were approved
    for (const r of t.requirements) expect(coverageOf(r)).toEqual({ tests: 1, parts: 1 });
    // a drafted test was given a key so its requirement can name it
    for (const x of t.tests) expect(typeof x.data.key).toBe("string");
    // the other end's change is recorded as an edit of the row that holds it
    const ev = await events(P);
    expect(ev.some((e) => e.kind === "item.edited" && e.summary.includes("from its other end"))).toBe(true);
  });

  it("a link removed at the requirement's end is removed at the test's end, and added back from the test's end", async () => {
    const req = (await itemsOf(P, "design/requirements"))[0];
    const testRow = (await itemsOf(P, "prototype/tests")).find((x) => (x.data.requirements as string[]).includes(String(req.data.key)))!;
    const r = await patch(Number(req.id), { data: { tests: [] } });
    expect(r.status).toBe(200);
    const after = (await itemsOf(P, "prototype/tests")).find((x) => x.id === testRow.id)!;
    expect(after.data.requirements).toEqual([]);
    expect(traceOf(await all()).untested.map((x) => x.id)).toContain(Number(req.id));

    const back = await patch(Number(testRow.id), { data: { requirements: [String(req.data.key)] } });
    expect(back.status).toBe(200);
    const reqNow = (await itemsOf(P, "design/requirements")).find((x) => x.id === req.id)!;
    expect(reqNow.data.tests).toEqual([String(testRow.data.key)]);
    expect(traceOf(await all()).untested).toEqual([]);
  });

  it("a test end naming a requirement that does not exist is refused, with a sentence", async () => {
    const testRow = (await itemsOf(P, "prototype/tests"))[0];
    const r = await patch(Number(testRow.id), { data: { requirements: ["req-nothing"] } });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('"req-nothing" names no requirement');
  });

  it("a new test written with its requirement keeps both ends; deleting it clears the requirement's list", async () => {
    const req = (await itemsOf(P, "design/requirements"))[1];
    const made = await add(P, "prototype/tests", "Drop the pot", { data: { requirements: [String(req.data.key)] } });
    expect(made.status).toBe(201);
    const row = (await itemsOf(P, "prototype/tests")).find((x) => Number(x.id) === Number(made.body.item.id))!;
    expect(row.data.key).toBeTruthy();
    let reqNow = (await itemsOf(P, "design/requirements")).find((x) => x.id === req.id)!;
    expect(reqNow.data.tests).toContain(row.data.key);
    expect((await remove(Number(row.id))).status).toBe(200);
    reqNow = (await itemsOf(P, "design/requirements")).find((x) => x.id === req.id)!;
    expect(reqNow.data.tests).not.toContain(row.data.key);
  });

  it("deleting a requirement removes it from the parts and tests that named it", async () => {
    const req = (await itemsOf(P, "design/requirements"))[1];
    const k = String(req.data.key);
    expect((await remove(Number(req.id))).status).toBe(200);
    for (const x of [...(await itemsOf(P, "prototype/tests")), ...(await itemsOf(P, "design/bom"))]) expect((x.data.requirements as string[] | undefined) ?? []).not.toContain(k);
  });
});
