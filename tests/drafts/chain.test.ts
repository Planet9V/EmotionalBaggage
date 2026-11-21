// A blank concept (a brief only) taken through press release, FAQ, requirements, parts, wiring,
// assembly steps and acceptance tests, every step approved through the routes, against the stand-in
// model; the reviewer attacks the approved press release and the critique drives a revision; then
// realignment against the real NetworkX planner (and without it), and "Propose updates".
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { pool, q } from "@/lib/db";
import { GET as CHALLENGE_GET, POST as CHALLENGE } from "@/app/api/challenge/route";
import { POST as ATTACK } from "@/app/api/drafts/attack/route";
import { PATCH as PATCH_ITEM } from "@/app/api/items/[id]/route";
import { attackOnce } from "@/lib/ai/drafts/attack";
import { POST as IMPACT } from "@/app/api/drafts/impact/route";
import { POST as PROPOSE } from "@/app/api/drafts/impact/propose/route";
import type { StandIn } from "../standins/core";
import type { OpenAIOptions } from "../standins/openai";
import { ctx, json, read } from "../api/helpers";
import { chooseReasoning, clearModelRows, closedPort } from "../ai/setup";
import { addItem, approve, approveRun, itemsOf, list, makeConcept, run, scriptedModel, askedBy, type Script } from "./helpers";
import type { ImpactReply } from "@/lib/ai/drafts/impact";
import type { RunResult } from "@/lib/ai/drafts/shared";

const P = "zz-drafts-chain";
let s: StandIn<OpenAIOptions>;
const script: Script = {};
const savedPlanner = process.env.PLANNER_URL;

beforeAll(async () => {
  s = await scriptedModel(script);
  await makeConcept(P, "ZZ Blank", "electronics", "");
  await addItem(P, "concept/brief", "A doorbell that tells you who is there", {}, "For people who work from home and miss deliveries.");
  await q("DELETE FROM settings WHERE key='planner.url'");
});

afterAll(async () => {
  await clearModelRows();
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await s.close();
  if (savedPlanner === undefined) delete process.env.PLANNER_URL;
  else process.env.PLANNER_URL = savedPlanner;
  await pool().end();
});

beforeEach(async () => {
  await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "stand-in-drafter" });
  s.requests.length = 0;
});

const approveAll = async (r: { body: RunResult }) => {
  const a = await approveRun(P, r.body.runId);
  expect(a.status, JSON.stringify(a.body)).toBe(200);
};

describe("blank concept to acceptance tests", () => {
  let pressId = 0;

  it("press release: drafted, approved, then attacked once by the reviewer on the server, with a link back to the row", async () => {
    script["press-release"] = { rows: [{ headline: "Doorbell names your visitor", text: "Today we announce a doorbell. Price to be confirmed." }] };
    script.reviewer = "Who pays for the cloud service, and what happens when the face is unknown?";
    const r = await run({ projectId: P, generator: "press-release" });
    expect(r.status).toBe(201);
    expect(r.body.drafts).toHaveLength(1);
    const a = await approve(r.body.drafts[0].id);
    pressId = a.body.item!.id;
    expect((await itemsOf(P, "concept/press"))[0].status).toBe("draft");

    // the attack runs on the server after the approval answers (integration item 11): wait for it
    let state = "";
    for (let i = 0; i < 100 && state !== "done"; i++) {
      state = String(((await itemsOf(P, "concept/press"))[0].data.attack as { state?: string } | undefined)?.state ?? "");
      if (state !== "done") await new Promise((res) => setTimeout(res, 50));
    }
    expect(state).toBe("done");
    const reviewerCall = s.requests.find((x) => String((x.body as { messages: { content: string }[] }).messages[0].content).includes("You review product concepts"))!;
    const sys = String((reviewerCall.body as { messages: { content: string }[] }).messages[0].content);
    expect(sys).toContain(`argue against this one row (id ${pressId}, section concept/press`);
    expect(sys).toContain("Title: Doorbell names your visitor");
    const thread = await read<{ messages: { itemId: number | null; role: string; content: string }[] }>(await CHALLENGE_GET(json("GET", undefined, `http://t/api/challenge?projectId=${P}`)));
    const mine = thread.body.messages.filter((m) => m.itemId === pressId);
    expect(mine.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(mine[0].content).toContain("Attack this press release");
    expect(mine[1].content).toBe(script.reviewer);
    const ev = await q<{ data: { after: Record<string, { state: string }> } }>("SELECT data FROM events WHERE project_id=$1 AND kind='challenge.row'", [P]);
    expect(ev).toHaveLength(1);
    expect(ev[0].data.after["data.attack"].state).toBe("done");

    // never twice: a second attack, by the route or directly, does not call the model again
    const before = s.requests.length;
    const again = await ATTACK(json("POST", { projectId: P, itemId: pressId }));
    expect(again.status).toBe(409);
    const both = await Promise.all([attackOnce(P, pressId), attackOnce(P, pressId)]);
    expect(both.every((x) => !x.ran && x.reason === "already attacked")).toBe(true);
    expect(s.requests.length).toBe(before);
    // and nobody can write the record by hand
    expect((await PATCH_ITEM(json("PATCH", { data: { attack: { state: "done" } } }), ctx(String(pressId)))).status).toBe(400);
  });

  it("two attacks started at once on a fresh row call the model once", async () => {
    const id = await addItem(P, "concept/faq", "zz Does it need Wi-Fi?", {}, "No.", "draft");
    const before = s.requests.length;
    const both = await Promise.all([attackOnce(P, id), attackOnce(P, id)]);
    expect(both.filter((x) => x.ran)).toHaveLength(1);
    expect(s.requests.length - before).toBe(1);
    await q("DELETE FROM items WHERE id=$1", [id]);
  });

  it("challenge refuses a row of another concept", async () => {
    const other = await addItem("baggage-claims", "concept/brief", "zz other concept row");
    const c = await CHALLENGE(json("POST", { projectId: P, itemId: other, message: "Attack" }));
    expect(c.status).toBe(404);
    await q("DELETE FROM items WHERE id=$1", [other]);
  });

  it("revise with the critique: a draft that would replace the press release, approved as a change", async () => {
    script["press-release"] = { rows: [{ headline: "Doorbell names your visitor, no cloud", text: "Recognition runs on the device.", replaces: pressId }] };
    const r = await run({ projectId: P, generator: "press-release", reviseIds: [pressId], critique: String(script.reviewer) });
    expect(r.status).toBe(201);
    const d = r.body.drafts[0];
    expect(d).toMatchObject({ itemId: pressId, op: { op: "replace" } });
    const user = String((s.requests[0].body as { messages: { content: string }[] }).messages[1].content);
    expect(user).toContain("The reviewer attacked the current version");
    expect(user).toContain(`#${pressId}`);
    const a = await approve(d.id);
    expect(a.body.item!.id).toBe(pressId);
    const rows = await itemsOf(P, "concept/press");
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Doorbell names your visitor, no cloud");
    const ev = await q<{ data: { before: { title: string }; after: { title: string } } }>("SELECT data FROM events WHERE project_id=$1 AND kind='draft.approved' ORDER BY id DESC LIMIT 1", [P]);
    expect(ev[0].data.before.title).toBe("Doorbell names your visitor");
    expect(ev[0].data.after.title).toBe("Doorbell names your visitor, no cloud");
  });

  it("a revision naming a row outside the allowed set is dropped", async () => {
    script["press-release"] = { rows: [{ headline: "Elsewhere", text: "x", replaces: 1 }] };
    const r = await run({ projectId: P, generator: "press-release", reviseIds: [pressId] });
    expect(r.body.drafts).toHaveLength(0);
    expect(r.body.dropped[0].reason).toContain("not one of the rows that may be changed");
  });

  it("FAQ, requirements, parts, wiring, steps and tests, each approved before the next", async () => {
    script.faq = { rows: [{ question: "Does it need the internet?", answer: "No." }, { question: "What does it cost?", answer: "To be confirmed." }] };
    await approveAll(await run({ projectId: P, generator: "faq" }));

    script.requirements = {
      rows: [
        { title: "Names a known visitor", detail: "Within 3 s." },
        { title: "Runs on a battery", detail: "Six months." },
      ],
    };
    await approveAll(await run({ projectId: P, generator: "requirements" }));
    const reqs = await itemsOf(P, "design/requirements");
    const [k1, k2] = reqs.map((r) => String(r.data.key));

    script.parts = {
      rows: [
        { ref: "U1", title: "Camera module", spec: "Small camera with on-board recognition", kind: "module", qty: 1, pins: [{ name: "VCC", role: "power in" }, { name: "GND", role: "ground" }, { name: "TX", role: "output" }], size: { x: 30, y: 30, z: 10 }, requirements: [k1] },
        { ref: "BT1", title: "Battery pack", spec: "Rechargeable", kind: "battery", qty: 1, pins: [{ name: "+", role: "power out" }, { name: "-", role: "ground" }], size: { x: 50, y: 20, z: 20 }, requirements: [k2] },
        { ref: "HW1", title: "M2 screws", spec: "M2 x 6", kind: "fastener", qty: 4 },
      ],
    };
    await approveAll(await run({ projectId: P, generator: "parts" }));

    script.wiring = { rows: [{ title: "Power", from: "BT1.+", to: "U1.VCC", netClass: "power" }, { title: "Ground", from: "BT1.-", to: "U1.GND", netClass: "ground" }] };
    await approveAll(await run({ projectId: P, generator: "wiring" }));

    script.assembly = { rows: [{ step: 1, title: "Fit the battery", detail: "", minutes: 5, parts: ["BT1"] }, { step: 2, title: "Fit the camera", detail: "", minutes: 10, parts: ["U1", "HW1"] }] };
    await approveAll(await run({ projectId: P, generator: "assembly" }));

    script.tests = { rows: [{ title: "Recognition", method: "Stand at the door.", pass: "Name within 3 s", requirements: [k1] }, { title: "Battery", method: "Bench.", pass: "Six months at 20 rings a day", requirements: [k2] }] };
    await approveAll(await run({ projectId: P, generator: "tests" }));

    expect((await itemsOf(P, "concept/faq")).length).toBe(2);
    expect((await itemsOf(P, "design/bom")).map((p) => p.data.ref)).toEqual(["U1", "BT1", "HW1"]);
    expect((await itemsOf(P, "design/wiring")).map((w) => `${w.data.from}.${w.data.fromPin}-${w.data.to}.${w.data.toPin}`)).toEqual(["BT1.+-U1.VCC", "BT1.--U1.GND"]);
    expect((await itemsOf(P, "prototype/assembly")).map((x) => x.data.after)).toEqual([[], ["asm-1"]]);
    expect((await itemsOf(P, "prototype/tests")).map((x) => x.data.requirements)).toEqual([[k1], [k2]]);
    expect((await list(P)).body.drafts).toHaveLength(0);
    // Every generator was asked once, in order.
    // (the approved FAQ entries are also put to the reviewer once, on the server: those calls are left out here)
    expect(s.requests.map((r) => askedBy(r.body)).filter((x) => x !== "reviewer")).toEqual(["faq", "requirements", "parts", "wiring", "assembly", "tests"]);
  });
});

describe("realignment", () => {
  const impact = async (itemId: number) => read<ImpactReply>(await IMPACT(json("POST", { projectId: P, itemId })));

  it("lists what a requirement affects, by section, with why, from the real planner", async () => {
    process.env.PLANNER_URL = inject("plannerUrl");
    const req = (await itemsOf(P, "design/requirements")).find((r) => r.data.key && r.title === "Names a known visitor")!;
    const r = await impact(Number(req.id));
    expect(r.status).toBe(200);
    if (r.body.engine !== "networkx") throw new Error(r.body.note);
    const by = Object.fromEntries(r.body.groups.map((g) => [g.section, g.rows.map((x) => x.title)]));
    expect(by["prototype/tests"]).toEqual(["Recognition"]);
    expect(by["design/bom"]).toEqual(["Camera module"]);
    expect(by["design/wiring"]?.sort()).toEqual(["Ground", "Power"]);
    expect(by["prototype/wiring"]?.sort()).toEqual(["Build sheet: Ground", "Build sheet: Power"]);
    // The battery step is reached through the power wire, which also joins the camera.
    expect(by["prototype/assembly"]?.sort()).toEqual(["Fit the battery", "Fit the camera"]);
    const battery = r.body.groups.find((g) => g.section === "prototype/assembly")!.rows.find((x) => x.title === "Fit the battery")!;
    expect(battery.why).toContain("the step works on a part this wire joins");
    expect(battery.path).toHaveLength(4);
    const tests = r.body.groups.find((g) => g.section === "prototype/tests")!;
    expect(tests.label).toBe("Acceptance tests");
    expect(tests.generator).toBe("tests");
    expect(tests.rows[0].why).toContain("checks requirement");
    const build = r.body.groups.find((g) => g.section === "prototype/wiring")!;
    expect(build.generator).toBe("wiring");
    expect(r.body.total).toBe(r.body.groups.reduce((a, g) => a + g.rows.length, 0));
  });

  it("says plainly when the planner is not reachable", async () => {
    process.env.PLANNER_URL = `http://127.0.0.1:${await closedPort()}`;
    const req = (await itemsOf(P, "design/requirements"))[0];
    const r = await impact(Number(req.id));
    expect(r.status).toBe(200);
    expect(r.body.engine).toBe("unavailable");
    if (r.body.engine === "unavailable") expect(r.body.note).toContain("The planner is not reachable");
    delete process.env.PLANNER_URL;
    const none = await impact(Number(req.id));
    expect(none.body.engine).toBe("unavailable");
  });

  it("a row of another concept is a 404", async () => {
    const other = await addItem("baggage-claims", "concept/brief", "zz other");
    expect((await IMPACT(json("POST", { projectId: P, itemId: other }))).status).toBe(404);
    await q("DELETE FROM items WHERE id=$1", [other]);
  });

  it("Propose updates: the tests generator revises only the affected test, as a draft that would replace it", async () => {
    const test = (await itemsOf(P, "prototype/tests")).find((t) => t.title === "Recognition")!;
    const req = (await itemsOf(P, "design/requirements")).find((r) => r.title === "Names a known visitor")!;
    await q("UPDATE items SET body='Within 1 s.' WHERE id=$1", [req.id]);
    script.tests = { rows: [{ title: "Recognition", method: "Stand at the door.", pass: "Name within 1 s", requirements: [String(req.data.key)], replaces: Number(test.id) }] };
    const r = await read<{ runs: RunResult[] }>(await PROPOSE(json("POST", { projectId: P, itemId: Number(req.id), groups: [{ generator: "tests", itemIds: [Number(test.id)] }] })));
    expect(r.status).toBe(201);
    const d = r.body.runs[0].drafts[0];
    expect(d).toMatchObject({ itemId: Number(test.id), op: { op: "replace" } });
    expect(d.data.pass).toBe("Name within 1 s");
    const user = String((s.requests[0].body as { messages: { content: string }[] }).messages[1].content);
    expect(user).toContain('This row changed: [design/requirements] "Names a known visitor": Within 1 s.');
    expect((await itemsOf(P, "prototype/tests")).find((t) => t.id === test.id)!.data.pass).toBe("Name within 3 s");
    await approve(d.id);
    expect((await itemsOf(P, "prototype/tests")).find((t) => t.id === test.id)!.data.pass).toBe("Name within 1 s");
  });

  it("approving a change to a row deleted since is refused", async () => {
    const test = (await itemsOf(P, "prototype/tests"))[1];
    const req = (await itemsOf(P, "design/requirements"))[1];
    script.tests = { rows: [{ title: "Battery", method: "Bench.", pass: "Five months", requirements: [String(req.data.key)], replaces: Number(test.id) }] };
    const r = await read<{ runs: RunResult[] }>(await PROPOSE(json("POST", { projectId: P, itemId: Number(req.id), groups: [{ generator: "tests", itemIds: [Number(test.id)] }] })));
    await q("DELETE FROM items WHERE id=$1", [test.id]);
    const a = await approve(r.body.runs[0].drafts[0].id);
    expect(a.status).toBe(409);
    expect(a.body.error).toContain("no longer exists");
  });
});
