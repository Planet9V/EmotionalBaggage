// Wiring check 8: parts drafted by the assistant do not duplicate parts entered in the wizard. A part
// is stored once: a drafted row that is a part already in the list (named by its id, or under the same
// name) completes that row instead of adding a second one, and keeps what the person entered.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { buildItems, emptyAnswers } from "@/components/wizard/model";
import { samePartName } from "@/lib/domain/part";
import type { StandIn } from "../standins/core";
import type { OpenAIOptions } from "../standins/openai";
import { chooseReasoning, clearModelRows } from "../ai/setup";
import { addItem, approveRun, itemsOf, makeConcept, run, scriptedModel, type Script } from "../drafts/helpers";

const P = "zz-wiring-parts";
let s: StandIn<OpenAIOptions>;
const script: Script = {};
const ids: Record<string, number> = {};

beforeAll(async () => {
  s = await scriptedModel(script);
  await makeConcept(P, "ZZ Wizard parts", "electronics", "A lamp that dims itself");
  await addItem(P, "design/requirements", "Dims when the room is empty", { key: "req-dim" });
  // the parts as the new-concept wizard writes them (src/components/wizard/model.ts)
  const a = emptyAnswers();
  Object.assign(a, { name: "ZZ Wizard parts", oneLiner: "A lamp that dims itself" });
  a.parts = [
    { ...a.parts[0], name: "ESP32-S3 dev board", qty: "1", source: "Amazon", search: "esp32-s3 devkit", line: "9.99" },
    { ...a.parts[0], key: 2, name: "PIR motion sensors", qty: "2", source: "Amazon", search: "hc-sr501", line: "4.50" },
  ];
  for (const it of buildItems(a).filter((i) => i.section === "design/bom")) ids[it.title] = await addItem(P, "design/bom", it.title, it.data ?? {}, it.body ?? "", it.status ?? "to buy");
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

describe("the same part, by name", () => {
  it("ignores case, punctuation, spacing and a plural s; a different part is different", () => {
    expect(samePartName("ESP32-S3 dev board", "esp32 s3  Dev Board.")).toBe(true);
    expect(samePartName("PIR motion sensors", "PIR motion sensor")).toBe(true);
    expect(samePartName("Battery", "Battery holder")).toBe(false);
    expect(samePartName("", "")).toBe(false);
  });
});

describe("drafting a parts list after the wizard", () => {
  it("a drafted part the wizard already entered completes that row; only new parts are added", async () => {
    script.parts = {
      rows: [
        // the same part under the same name, with a reference of the model's own
        { ref: "U1", title: "ESP32-S3 Dev Board", spec: "Microcontroller module", kind: "module", qty: 1, pins: [{ name: "3V3", role: "power out" }, { name: "GND", role: "ground" }], size: { x: 25, y: 4, z: 18 }, requirements: ["req-dim"] },
        // the same part, named by its id as the instructions ask, under another name and another quantity
        { ref: "U2", title: "Passive infrared sensor", spec: "HC-SR501", kind: "sensor", qty: 1, replaces: ids["PIR motion sensors"] },
        // a part the wizard did not have
        { ref: "D1", title: "LED", spec: "White", kind: "led", qty: 1 },
      ],
    };
    const r = await run({ projectId: P, generator: "parts" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.drafts.map((d) => [d.op.op, d.itemId, d.title])).toEqual([
      ["replace", ids["ESP32-S3 dev board"], "ESP32-S3 dev board"],
      ["replace", ids["PIR motion sensors"], "PIR motion sensors"],
      ["add", null, "LED"],
    ]);
    // what the person entered stays: the name, the reference, the quantity, the supplier search and the cost
    expect(r.body.drafts[0].data).toMatchObject({ ref: "P1", qty: 1, source: "Amazon", search: "esp32-s3 devkit", line: 9.99, kind: "module", pins: ["3V3", "GND"], requirements: ["req-dim"] });
    expect(r.body.drafts[1].data).toMatchObject({ ref: "P2", qty: 2, line: 4.5, kind: "sensor" });
    expect(r.body.notes.join(" ")).toMatch(/already in the parts list/);
    // the model is shown the list with ids and told not to propose a listed part again
    const sent = JSON.stringify(s.requests.at(-1)!.body);
    expect(sent).toContain("A part already in the list is never proposed again as a new row");

    expect((await approveRun(P, r.body.runId)).status).toBe(200);
    const bom = await itemsOf(P, "design/bom");
    expect(bom.map((x) => x.title).sort()).toEqual(["ESP32-S3 dev board", "LED", "PIR motion sensors"]);
    expect(bom.map((x) => x.data.ref).sort()).toEqual(["D1", "P1", "P2"]);
  });

  it("the same listed part proposed twice in one run is taken once", async () => {
    script.parts = { rows: [{ ref: "U7", title: "LED", spec: "Warm white", kind: "led", qty: 1 }, { ref: "U8", title: "LEDs", spec: "Again", kind: "led", qty: 3 }] };
    const r = await run({ projectId: P, generator: "parts", supersede: true });
    expect(r.body.drafts.map((d) => d.op.op)).toEqual(["replace"]);
    expect(r.body.dropped.map((d) => d.reason).join(" ")).toMatch(/already proposed in this run/);
  });
});
