// "Draft links with AI" (Traceability): the generator proposes requirement-to-test and requirement-to-part
// links as drafts that cite both rows and give a reason; nothing is linked before approval; approval writes both
// ends; it is not offered by any section's Draft with AI button.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { GET as GENERATORS } from "@/app/api/drafts/generators/route";
import type { StandIn } from "../standins/core";
import type { OpenAIOptions } from "../standins/openai";
import { json, read } from "../api/helpers";
import { chooseReasoning, clearModelRows } from "../ai/setup";
import { addItem, approve, itemsOf, list, makeConcept, run, scriptedModel, type Script } from "./helpers";
import type { GeneratorsReply } from "@/lib/ai/drafts/shared";

const P = "zz-drafts-links";
let s: StandIn<OpenAIOptions>;
const script: Script = {};
let reqA = 0;
let reqB = 0;
let testA = 0;
let partA = 0;

beforeAll(async () => {
  s = await scriptedModel(script);
  await makeConcept(P, "ZZ Links", "electronics", "A lamp");
  reqA = await addItem(P, "design/requirements", "Dims when the room is empty", { key: "req-dim" });
  reqB = await addItem(P, "design/requirements", "Survives a drop", { key: "req-drop" });
  testA = await addItem(P, "prototype/tests", "Dark room test", { key: "t-dark", pass: "dims in 5 s" });
  partA = await addItem(P, "design/bom", "PIR sensor", { key: "pir", ref: "S1" });
});

afterAll(async () => {
  await clearModelRows();
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await s.close();
  await pool().end();
});

beforeEach(async () => {
  for (const k of Object.keys(script)) delete script[k];
  await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "stand-in-drafter" });
});

const info = async (query: string) => read<GeneratorsReply>(await GENERATORS(json("GET", undefined, `http://t/x?projectId=${P}${query}`)));

describe("draft links", () => {
  it("is listed under kind=links and under no section", async () => {
    expect((await info("&kind=links")).body.generators.map((g) => g.id)).toEqual(["trace-links"]);
    expect((await info("&kind=section&store=design/requirements")).body.generators.map((g) => g.id)).toEqual(["requirements"]);
    expect((await info("&store=design/requirements")).body.generators.map((g) => g.id)).toEqual(["requirements"]);
  });

  it("proposes drafts citing both rows with a reason, writes nothing, and drops what does not exist", async () => {
    script["trace-links"] = {
      rows: [
        { requirement: "req-dim", tests: [{ key: "t-dark", because: "It runs the room dark and times the dimming." }, { key: "nope", because: "x" }], parts: [{ key: "pir", because: "The sensor tells the lamp the room is empty." }] },
        { requirement: "ghost", tests: [{ key: "t-dark", because: "x" }] },
      ],
    };
    const r = await run({ projectId: P, generator: "trace-links" });
    expect(r.status).toBe(201);
    expect(r.body.drafts).toHaveLength(1);
    expect(r.body.dropped.map((d) => d.reason).join(" ")).toContain('no requirement with the key "ghost"');
    const d = r.body.drafts[0];
    expect(d.op.op).toBe("replace");
    expect(d.op.reason).toContain("Dark room test");
    expect(d.op.reason).toContain("PIR sensor");
    expect(d.sources.map((x) => x.id).sort()).toEqual([reqA, testA, partA].sort());
    // nothing linked yet
    const before = await itemsOf(P, "design/requirements");
    expect(before.find((i) => Number(i.id) === reqA)!.data.tests).toBeUndefined();
    expect((await list(P)).body.drafts).toHaveLength(1);
  });

  it("approving writes both ends and records the links", async () => {
    const pending = (await list(P)).body.drafts[0];
    const a = await approve(pending.id);
    expect(a.status).toBe(200);
    const reqs = await itemsOf(P, "design/requirements");
    expect(reqs.find((i) => Number(i.id) === reqA)!.data).toMatchObject({ tests: ["t-dark"], parts: ["pir"] });
    expect((await itemsOf(P, "prototype/tests"))[0].data.requirements).toEqual(["req-dim"]);
    expect((await itemsOf(P, "design/bom"))[0].data.requirements).toEqual(["req-dim"]);
    expect(reqB).toBeGreaterThan(0);
  });

  it("proposes nothing for a link that exists, and says so", async () => {
    script["trace-links"] = { rows: [{ requirement: "req-dim", tests: [{ key: "t-dark", because: "again" }] }] };
    const r = await run({ projectId: P, generator: "trace-links" });
    expect(r.body.drafts).toHaveLength(0);
    expect(r.body.dropped[0].reason).toContain("no new link");
  });

  it("is blocked when there is no gap or no model", async () => {
    await q("UPDATE items SET data = data || '{\"tests\":[\"t-dark\"],\"parts\":[\"pir\"]}'::jsonb WHERE id=$1", [reqB]);
    await q("UPDATE items SET data = data || '{\"requirements\":[\"req-drop\"]}'::jsonb WHERE id=$1", [testA]);
    const g = (await info("&kind=links")).body.generators[0];
    expect(g.blocked).toBe("There are no gaps to link.");
    await clearModelRows();
    expect((await info("&kind=links")).body.configured).toBe(false);
  });
});
