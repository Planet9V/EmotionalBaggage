// Each generator end to end through the run route against the stand-in model with a scripted JSON
// answer: valid rows become drafts with their sources, invalid rows are dropped and reported, and
// nothing reaches `items` before approval. Then approve, edit-then-approve, reject, approve a whole
// run, supersede, and product-type skipping.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { GET as GENERATORS } from "@/app/api/drafts/generators/route";
import type { StandIn } from "../standins/core";
import type { OpenAIOptions } from "../standins/openai";
import { json, read } from "../api/helpers";
import { chooseReasoning, clearModelRows } from "../ai/setup";
import { addItem, approve, approveRun, askedBy, edit, itemsOf, list, makeConcept, reject, run, scriptedModel, type Script } from "./helpers";
import type { GeneratorsReply } from "@/lib/ai/drafts/shared";

const P = "zz-drafts-gen";
const PHYS = "zz-drafts-phys";
let s: StandIn<OpenAIOptions>;
const script: Script = {};
let brief1 = 0;
let brief2 = 0;

beforeAll(async () => {
  s = await scriptedModel(script);
  await makeConcept(P, "ZZ Drafts", "electronics", "A lamp that dims itself when nobody is in the room");
  await makeConcept(PHYS, "ZZ Drafts physical", "physical", "A folding stool");
  brief1 = await addItem(P, "concept/brief", "Who it is for", {}, "People who forget to switch lights off");
  brief2 = await addItem(P, "concept/brief", "Why now", {}, "Electricity prices");
});

afterAll(async () => {
  await clearModelRows();
  await q("DELETE FROM projects WHERE id = ANY($1)", [[P, PHYS]]);
  await s.close();
  await pool().end();
});

beforeEach(async () => {
  for (const k of Object.keys(script)) delete script[k];
  await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "stand-in-drafter" });
  s.requests.length = 0;
});

describe("without a model", () => {
  it("answers 503 with the model layer's sentence and saves nothing", async () => {
    await clearModelRows();
    const r = await run({ projectId: P, generator: "requirements" });
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("No reasoning model is chosen. Choose one in Admin, Models.");
    expect(s.requests).toHaveLength(0);
    expect((await list(P)).body.drafts).toHaveLength(0);
  });

  it("the generator list says not configured and why", async () => {
    await clearModelRows();
    const r = await read<GeneratorsReply>(await GENERATORS(json("GET", undefined, `http://t/x?projectId=${P}&store=design/requirements`)));
    expect(r.body.configured).toBe(false);
    expect(r.body.reason).toContain("Admin, Models");
    expect(r.body.generators.map((g) => g.id)).toEqual(["requirements"]);
  });
});

describe("requirements from a brief", () => {
  it("keeps valid rows as drafts with sources and keys, drops an invalid one, writes nothing to items", async () => {
    script.requirements = {
      rows: [
        { title: "Dims within 2 minutes", detail: "Dims to 10% when no one is seen for 2 minutes. Test: leave the room, time it.", trigger: "No presence 2 min", response: "Dim", basedOn: [brief1] },
        { title: "Runs on mains", detail: "230 V or 120 V input.", basedOn: [9_999_999] },
        { detail: "no title at all" },
      ],
    };
    const r = await run({ projectId: P, generator: "requirements" });
    expect(r.status).toBe(201);
    expect(askedBy(s.requests[0].body)).toBe("requirements");
    expect(r.body.drafts).toHaveLength(2);
    expect(r.body.dropped).toEqual([{ title: "(untitled row)", reason: expect.stringContaining("title") }]);
    const [a, b] = r.body.drafts;
    expect(a).toMatchObject({ title: "Dims within 2 minutes", status: "draft", targetStore: "design/requirements", model: "stand-in-drafter", provider: "ollama", itemId: null });
    expect(a.data).toMatchObject({ key: "req-1", trigger: "No presence 2 min", response: "Dim" });
    expect(a.sources).toEqual([{ kind: "item", id: brief1, title: "Who it is for", section: "concept/brief" }]);
    // A cited id that does not exist is ignored; with nothing valid cited, the rows read are the sources.
    expect(b.data.key).toBe("req-2");
    expect(b.sources.map((x) => x.id).sort()).toEqual([brief1, brief2].sort());
    expect(await itemsOf(P, "design/requirements")).toHaveLength(0);
    // The prompt carried the brief rows with their ids, and the row schema.
    const sys = String((s.requests[0].body as { messages: { content: string }[] }).messages[0].content);
    const user = String((s.requests[0].body as { messages: { content: string }[] }).messages[1].content);
    expect(user).toContain(`#${brief1} [open] Who it is for: People who forget to switch lights off`);
    expect(sys).toContain('{"rows": [...]}');
    // The run is in the activity log.
    const ev = await q<{ data: { runId: string; drafts: number } }>("SELECT data FROM events WHERE project_id=$1 AND kind='draft.run' ORDER BY id DESC LIMIT 1", [P]);
    expect(ev[0].data).toMatchObject({ runId: r.body.runId, drafts: 2 });
  });

  it("re-running asks to confirm, then marks the earlier drafts superseded", async () => {
    script.requirements = { rows: [{ title: "Quiet", detail: "No audible hum.", basedOn: [brief1] }] };
    const refused = await run({ projectId: P, generator: "requirements" });
    expect(refused.status).toBe(409);
    expect(refused.body.detail).toEqual({ pending: 2 });
    expect(s.requests).toHaveLength(0);
    const ok = await run({ projectId: P, generator: "requirements", supersede: true });
    expect(ok.status).toBe(201);
    expect(ok.body.superseded).toBe(2);
    const old = (await list(P, "&status=rejected")).body.drafts;
    expect(old).toHaveLength(2);
    expect(old.every((d) => d.reason === "superseded" && d.decidedBy === "demo")).toBe(true);
    expect((await list(P)).body.drafts.map((d) => d.title)).toEqual(["Quiet"]);
  });

  it("approve makes an items row and records the sources; a second approve is refused", async () => {
    const [d] = (await list(P, "&store=design/requirements")).body.drafts;
    const r = await approve(d.id);
    expect(r.status).toBe(200);
    expect(r.body.item).toMatchObject({ title: "Quiet", section: "design/requirements" });
    expect(r.body.draft).toMatchObject({ status: "approved", itemId: r.body.item!.id, decidedBy: "demo" });
    const rows = await itemsOf(P, "design/requirements");
    expect(rows.map((x) => x.title)).toEqual(["Quiet"]);
    expect(rows[0].status).toBe("open");
    const ev = await q<{ data: { draftId: number; sources: { id: number }[] } }>("SELECT data FROM events WHERE project_id=$1 AND kind='draft.approved' ORDER BY id DESC LIMIT 1", [P]);
    expect(ev[0].data.draftId).toBe(d.id);
    expect(ev[0].data.sources.map((x) => x.id)).toEqual([brief1]);
    const audit = await q("SELECT 1 FROM audit_log WHERE project_id=$1 AND action='draft.approved'", [P]);
    expect(audit.length).toBeGreaterThan(0);
    expect((await approve(d.id)).status).toBe(409);
    expect((await reject(d.id)).status).toBe(409);
  });

  it("edit then approve saves the edited fields, checked against the section", async () => {
    script.requirements = { rows: [{ title: "Lasts", detail: "Ten years.", basedOn: [brief2] }] };
    const r = await run({ projectId: P, generator: "requirements" });
    const d = r.body.drafts[0];
    const bad = await edit(d.id, { data: { minutes: -4 } });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toContain("minutes");
    const e = await edit(d.id, { title: "Lasts ten years", data: { ...d.data, response: "Keep working" } });
    expect(e.status).toBe(200);
    expect(e.body.draft.title).toBe("Lasts ten years");
    const a = await approve(d.id);
    expect(a.body.item).toMatchObject({ title: "Lasts ten years" });
    expect(a.body.item!.data).toMatchObject({ key: d.data.key, response: "Keep working" });
  });

  it("reject records the reason and leaves items alone", async () => {
    script.requirements = { rows: [{ title: "Glows", detail: "Glows.", basedOn: [brief1] }] };
    const d = (await run({ projectId: P, generator: "requirements" })).body.drafts[0];
    const before = (await itemsOf(P, "design/requirements")).length;
    const r = await reject(d.id, "Not needed");
    expect(r.body.draft).toMatchObject({ status: "rejected", reason: "Not needed" });
    expect((await itemsOf(P, "design/requirements")).length).toBe(before);
    const ev = await q<{ data: { reason: string } }>("SELECT data FROM events WHERE project_id=$1 AND kind='draft.rejected' ORDER BY id DESC LIMIT 1", [P]);
    expect(ev[0].data.reason).toBe("Not needed");
  });
});

describe("parts, wiring, steps and tests", () => {
  let reqKeys: string[] = [];
  it("parts: kind, pins with roles, typical size as geometry, no price; a repeated reference is dropped", async () => {
    reqKeys = (await itemsOf(P, "design/requirements")).map((r) => String(r.data.key));
    script.parts = {
      rows: [
        { ref: "U1", title: "Microcontroller module", spec: "ESP32 class", kind: "module", qty: 1, pins: [{ name: "3V3", role: "power out" }, { name: "GND", role: "ground" }, { name: "GPIO4", role: "output" }], size: { x: 25, y: 4, z: 18 }, requirements: [reqKeys[0], "req-404"], basedOn: [] },
        { ref: "D1", title: "LED", spec: "White", kind: "led", qty: 1, pins: [{ name: "A", role: "passive" }, { name: "K", role: "passive" }], line: 3.5 },
        { ref: "U1", title: "Second U1", spec: "", kind: "module", qty: 1 },
        { ref: "X1", title: "Bad kind", spec: "", kind: "unobtainium", qty: 1 },
      ],
    };
    const r = await run({ projectId: P, generator: "parts" });
    expect(r.status).toBe(201);
    expect(r.body.drafts.map((d) => d.data.ref)).toEqual(["U1", "D1"]);
    expect(r.body.dropped.map((d) => d.title)).toEqual(["Second U1", "Bad kind"]);
    const u1 = r.body.drafts[0];
    expect(u1.data).toMatchObject({ kind: "module", qty: 1, pins: ["3V3", "GND", "GPIO4"], pinRoles: { "3V3": "power out", GND: "ground", GPIO4: "output" }, requirements: [reqKeys[0]] });
    expect(u1.data.geometry).toMatchObject({ shape: "box", size: [25, 4, 18], basis: "typical" });
    expect(r.body.notes.join(" ")).toContain("req-404");
    // A price the model slipped in is not in the row schema and never saved.
    expect(r.body.drafts[1].data.line).toBeUndefined();
    expect(await itemsOf(P, "design/bom")).toHaveLength(0);
    const ok = await approveRun(P, r.body.runId);
    expect(ok.status).toBe(200);
    expect((await itemsOf(P, "design/bom")).map((x) => x.data.ref)).toEqual(["U1", "D1"]);
  });

  it("approving a whole run needs confirm", async () => {
    const r = await approveRun(P, "00000000-0000-4000-8000-000000000000", false);
    expect(r.status).toBe(400);
  });

  it("wiring: only wires between pins that exist are kept; the rest are dropped with the reason", async () => {
    script.wiring = {
      rows: [
        { title: "LED drive", from: "U1.GPIO4", to: "D1.A", netClass: "signal", net: "LED", note: "Needs a series resistor (not in the list)." },
        { title: "LED return", from: "D1.K", to: "U1.GND", netClass: "ground" },
        { title: "Ghost pin", from: "U1.GPIO99", to: "D1.A", netClass: "signal" },
        { title: "Ghost part", from: "Q7.G", to: "D1.A", netClass: "signal" },
        { title: "No dot", from: "U1GND", to: "D1.K", netClass: "ground" },
        { title: "Same pin", from: "D1.K", to: "D1.K", netClass: "ground" },
        { title: "Repeat", from: "D1.A", to: "U1.GPIO4", netClass: "signal" },
      ],
    };
    const r = await run({ projectId: P, generator: "wiring" });
    expect(r.body.drafts.map((d) => d.title)).toEqual(["LED drive", "LED return"]);
    expect(r.body.drafts[0].data).toMatchObject({ from: "U1", fromPin: "GPIO4", to: "D1", toPin: "A", order: 1, netClass: "signal" });
    expect(r.body.drafts[1].data.order).toBe(2);
    expect(r.body.dropped.map((d) => d.reason)).toEqual([
      "part U1 has no pin GPIO99",
      "there is no part Q7",
      '"U1GND" is not written as ref.pin',
      "both ends are the same pin",
      "that wire already exists",
    ]);
    // The pin table the model saw named only real pins.
    expect(String((s.requests[0].body as { messages: { content: string }[] }).messages[1].content)).toContain("U1 #");
    expect((await approveRun(P, r.body.runId)).status).toBe(200);
  });

  it("assembly steps: order, minutes, keys and waits translated from step numbers", async () => {
    script.assembly = {
      rows: [
        { step: 1, title: "Lay out parts", detail: "Check against the list.", minutes: 10, parts: ["U1", "D1"] },
        { step: 2, title: "Solder the LED", detail: "Wire it.", minutes: 25.4, parts: ["D1", "ZZ9"] },
        { step: 3, title: "Print the shade", detail: "In parallel.", minutes: 120, after: [1] },
        { step: 4, title: "Close up", detail: "Fit everything.", minutes: 15, after: [2, 3, 7] },
        { step: 2, title: "Duplicate number", detail: "", minutes: 1 },
      ],
    };
    const r = await run({ projectId: P, generator: "assembly" });
    const d = r.body.drafts;
    expect(d.map((x) => x.data.key)).toEqual(["asm-1", "asm-2", "asm-3", "asm-4"]);
    expect(d.map((x) => x.data.after)).toEqual([[], ["asm-1"], ["asm-1"], ["asm-2", "asm-3"]]);
    expect(d[1].data).toMatchObject({ minutes: 25, time: "25 min", order: 2, parts: ["D1"] });
    expect(r.body.dropped).toEqual([{ title: "Duplicate number", reason: "step number 2 appears twice" }]);
    expect(r.body.notes.join(" ")).toContain("ZZ9");
    expect((await approveRun(P, r.body.runId)).status).toBe(200);
  });

  it("acceptance tests: each names requirement keys that exist; a test naming none is dropped", async () => {
    script.tests = {
      rows: [
        { title: "Dimming", method: "Leave the room.", pass: "Dims within 2 min", requirements: [reqKeys[0], "req-77"] },
        { title: "Made up", method: "?", pass: "?", requirements: ["req-77"] },
      ],
    };
    const r = await run({ projectId: P, generator: "tests" });
    expect(r.body.drafts).toHaveLength(1);
    expect(r.body.drafts[0].data).toEqual({ pass: "Dims within 2 min", requirements: [reqKeys[0]] });
    expect(r.body.dropped[0].reason).toContain("names no requirement that exists");
    expect(await itemsOf(P, "prototype/tests")).toHaveLength(0);
  });

  it("a key taken since the run makes approval fail with the database's sentence, and changes nothing", async () => {
    script.requirements = { rows: [{ title: "Taken", detail: "x" }] };
    const r = await run({ projectId: P, generator: "requirements", supersede: true });
    const key = String(r.body.drafts[0].data.key);
    await addItem(P, "concept/brief", "Squatter", { key });
    const a = await approve(r.body.drafts[0].id);
    expect(a.status).toBe(409);
    expect(a.body.error).toContain("key");
    expect((await list(P, "&store=design/requirements")).body.drafts[0].status).toBe("draft");
  });
});

describe("product types", () => {
  it("wiring does not apply to a product without electronics, and parts there carry no pins", async () => {
    const w = await run({ projectId: PHYS, generator: "wiring" });
    expect(w.status).toBe(400);
    expect(w.body.error).toContain("does not apply");
    const g = await read<GeneratorsReply>(await GENERATORS(json("GET", undefined, `http://t/x?projectId=${PHYS}&kind=section`)));
    expect(g.body.generators.map((x) => x.id)).toEqual(["press-release", "faq", "requirements", "parts", "assembly", "tests"]);
    await addItem(PHYS, "design/requirements", "Holds 120 kg", { key: "phys-1" });
    script.parts = { rows: [{ ref: "LEG1", title: "Leg", spec: "Beech", kind: "mechanical", qty: 3, pins: [{ name: "1", role: "passive" }] }] };
    const r = await run({ projectId: PHYS, generator: "parts" });
    expect(r.body.drafts[0].data.pins).toBeUndefined();
    expect(r.body.notes.join(" ")).toContain("no electronics");
  });

  it("the generator list for a section says what it will read", async () => {
    const g = await read<GeneratorsReply>(await GENERATORS(json("GET", undefined, `http://t/x?projectId=${P}&store=design/bom`)));
    const parts = g.body.generators[0];
    expect(parts.id).toBe("parts");
    expect(parts.counts["design/requirements"]).toBeGreaterThan(0);
    // Two brief lines from the start plus the one added to take a key in the test above.
    expect(parts.readsText).toBe("from 3 brief lines and 2 requirements");
    expect(parts.blocked).toBe("");
  });

  it("a generator with nothing to read says so and does not call the model", async () => {
    const r = await run({ projectId: PHYS, generator: "assembly" });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain("parts list is empty");
    expect(s.requests).toHaveLength(0);
  });

  it("an unknown generator is a 400", async () => {
    expect((await run({ projectId: P, generator: "nope" })).status).toBe(400);
  });
});
