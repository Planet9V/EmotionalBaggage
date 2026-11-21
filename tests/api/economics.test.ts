// The production routes: settings, validation of the new row kinds, compliance drafting and confirming.
// Drafting runs against the OpenAI-compatible stand-in, not a real model.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { GET as getSettings, PATCH as patchSettings } from "@/app/api/projects/[id]/production-settings/route";
import { POST as draft } from "@/app/api/projects/[id]/compliance/draft/route";
import { POST as approveRun } from "@/app/api/drafts/approve-run/route";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import { start } from "../standins/openai";
import type { StandIn } from "../standins/core";
import type { OpenAIOptions } from "../standins/openai";
import { chooseReasoning, clearModelRows } from "../ai/setup";
import { anonymous, ctx, json, read } from "./helpers";

const PROJECT = "zz-economics";
type Err = { error: string; issues?: { field: string; problem: string }[] };
type Item = { id: number; status: string; title: string; data: Record<string, unknown> };

const REPLY = JSON.stringify({
  rows: [
    { topic: "Radio equipment: FCC Part 15 in the US, RED in the EU", why: "The Wi-Fi module W1 transmits radio.", check: "Find the module's existing certificates.", trigger: "W1" },
    { topic: "Batteries: transport and labelling", why: "BAT is a lithium cell.", check: "Read the cell's transport documents." },
    { topic: "radio equipment FCC part 15 in the us, red in the eu", why: "A repeat.", check: "None." },
  ],
});
let s: StandIn<OpenAIOptions>;

beforeAll(async () => {
  s = await start({ prefix: "/v1", reply: REPLY });
  await q("DELETE FROM projects WHERE id=$1", [PROJECT]);
  await q("INSERT INTO projects (id, name, one_liner, product_type) VALUES ($1, 'ZZ Economics', 'A radio toy', 'electronics')", [PROJECT]);
  await q("INSERT INTO items (project_id, section, title, body, data) VALUES ($1,'concept/brief','Sold to children','Ages 6 to 10', '{}')", [PROJECT]);
  await q("INSERT INTO items (project_id, section, title, body, data) VALUES ($1,'design/bom','Wi-Fi module','ESP32', '{\"ref\":\"W1\"}')", [PROJECT]);
});
afterAll(async () => {
  await clearModelRows();
  await q("DELETE FROM projects WHERE id=$1", [PROJECT]);
  await s.close();
  await pool().end();
});
beforeEach(async () => {
  await clearModelRows();
  s.requests.length = 0;
  await q("DELETE FROM items WHERE project_id=$1 AND section='production/compliance'", [PROJECT]);
  await q("UPDATE projects SET sales_regions='[]', currency='USD' WHERE id=$1", [PROJECT]);
});

const settings = (payload: unknown) => patchSettings(json("PATCH", payload), ctx(PROJECT));
const add = (section: string, title: string, data: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  addItem(json("POST", { section, title, data, ...extra }), ctx(PROJECT));

describe("currency and sales regions", () => {
  it("default to USD and no regions, and report the product type", async () => {
    const r = await read<{ currency: string; regions: string[]; productType: string }>(await getSettings(json("GET"), ctx(PROJECT)));
    expect(r.body).toEqual({ currency: "USD", regions: [], productType: "electronics" });
  });
  it("change, in menu order and without repeats, and are recorded", async () => {
    const r = await read<{ currency: string; regions: string[] }>(await settings({ currency: "eur", regions: ["uk", "us", "uk"] }));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ currency: "EUR", regions: ["us", "uk"] });
    const events = await q<{ kind: string }>("SELECT kind FROM events WHERE project_id=$1 AND kind IN ('project.currency','project.regions')", [PROJECT]);
    expect(events.map((e) => e.kind).sort()).toEqual(["project.currency", "project.regions"]);
  });
  it("refuse a bad currency, an unknown region and an empty change", async () => {
    for (const payload of [{ currency: "dollars" }, { regions: ["mars"] }, {}]) {
      const r = await read<Err>(await settings(payload));
      expect(r.status).toBe(400);
    }
  });
  it("answer 404 for an unknown concept and 401 signed out", async () => {
    expect((await getSettings(json("GET"), ctx("zz-nope"))).status).toBe(404);
    expect((await getSettings(anonymous("GET"), ctx(PROJECT))).status).toBe(401);
  });
});

describe("validation of the new rows", () => {
  it("accepts money typed with a symbol, and keeps it as a number", async () => {
    const r = await read<{ item: Item }>(await add("production/economics", "test: tape", { kind: "packaging", amount: "$1,250.50" }));
    expect(r.status).toBe(201);
    expect(r.body.item.data.amount).toBe(1250.5);
  });
  it("refuses a negative amount, a percent over 100 and an unknown kind, naming the field", async () => {
    const bad = [
      ["production/economics", { kind: "packaging", amount: -1 }, "data.amount"],
      ["production/economics", { kind: "scrap", percent: 120 }, "data.percent"],
      ["production/economics", { kind: "gifts" }, "data.kind"],
      ["sales/channels", { price: "free" }, "data.price"],
      ["production/batches", { units: 0 }, "data.units"],
      ["production/batches", { units: 2.5 }, "data.units"],
      ["production/batches", { targetDate: "next week" }, "data.targetDate"],
      ["production/methods", { method: "magic" }, "data.method"],
    ] as const;
    for (const [section, data, field] of bad) {
      const r = await read<Err>(await add(section, "test: bad", data));
      expect(r.status, `${section} ${JSON.stringify(data)}`).toBe(400);
      expect(r.body.issues?.[0].field).toBe(field);
    }
  });
  it("keeps a supplier to a public web address and refuses an email, a phone number and a script", async () => {
    const ok = await read<{ item: Item }>(await add("production/suppliers", "test: Acme", { code: "ACME", url: "https://acme.example.com/parts", leadTimeDays: "14" }));
    expect(ok.status).toBe(201);
    expect(ok.body.item.data.leadTimeDays).toBe(14);
    for (const url of ["mailto:sales@acme.example.com", "sales@acme.example.com", "+1 555 0100", "javascript:alert(1)", "https://user:pw@acme.example.com"]) {
      const r = await read<Err>(await add("production/suppliers", "test: Acme", { url }));
      expect(r.status, url).toBe(400);
      expect(r.body.issues?.[0].field).toBe("data.url");
    }
  });
  it("gives a new compliance row the status 'to check', not 'draft'", async () => {
    const r = await read<{ item: Item }>(await add("production/compliance", "test: Toy safety"));
    expect(r.body.item.status).toBe("to check");
  });
  it("accepts price breaks and a supplier on a part, and refuses a break with no quantity", async () => {
    const ok = await read<{ item: Item }>(await add("design/bom", "test: part", { ref: "Z9", unit: "1.2", supplier: "ACME", priceBreaks: [{ qty: "100", unit: 0.9 }] }));
    expect(ok.status).toBe(201);
    expect(ok.body.item.data).toMatchObject({ unit: 1.2, priceBreaks: [{ qty: 100, unit: 0.9 }] });
    const bad = await read<Err>(await add("design/bom", "test: part", { ref: "Z8", priceBreaks: [{ unit: 1 }] }));
    expect(bad.status).toBe(400);
    await q("DELETE FROM items WHERE project_id=$1 AND title LIKE 'test:%'", [PROJECT]);
  });
});

describe("drafting the compliance checklist", () => {
  it("says to choose regions first, and asks no model", async () => {
    await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "stand-in-chat" });
    const r = await read<Err>(await draft(json("POST"), ctx(PROJECT)));
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/regions/);
    expect(s.requests).toHaveLength(0);
  });
  it("answers 503 with the model layer's sentence and saves nothing when no model is chosen", async () => {
    await settings({ regions: ["us"] });
    const res = await draft(json("POST"), ctx(PROJECT));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("No reasoning model is chosen. Choose one in Admin, Models.");
    expect(await q("SELECT 1 FROM items WHERE project_id=$1 AND section='production/compliance'", [PROJECT])).toHaveLength(0);
  });
  it("saves each proposed row as a draft of the drafting engine with what it came from, drops repeats, and only approval makes rows", async () => {
    await settings({ regions: ["us", "eu"] });
    await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "stand-in-chat" });
    type D = { title: string; data: { why: string; generated: { sources: { title: string }[]; model: string; at: string; regions: string[]; trigger?: string } }; sources: { kind: string; title: string }[] };
    const r = await read<{ runId: string; generator: string; drafts: D[]; dropped: { title: string; reason: string }[]; model: string }>(await draft(json("POST", { supersede: true }), ctx(PROJECT)));
    expect(r.status).toBe(201);
    expect(r.body.generator).toBe("compliance");
    expect(r.body.drafts).toHaveLength(2);
    expect(r.body.dropped).toHaveLength(1);
    const first = r.body.drafts[0];
    expect(first.data.why).toMatch(/W1/);
    expect(first.data.generated.model).toBe("stand-in-chat");
    expect(first.data.generated.regions).toEqual(["us", "eu"]);
    expect(first.data.generated.sources.map((x) => x.title).sort()).toEqual(["Sold to children", "Wi-Fi module"]);
    expect(first.sources.map((x) => x.title).sort()).toEqual(["Sold to children", "Wi-Fi module"]);
    expect(first.data.generated.trigger).toBe("W1");
    expect(Number.isNaN(Date.parse(first.data.generated.at))).toBe(false);
    // nothing is a row until approved
    expect(await q("SELECT 1 FROM items WHERE project_id=$1 AND section='production/compliance'", [PROJECT])).toHaveLength(0);
    const a = await approveRun(json("POST", { projectId: PROJECT, runId: r.body.runId, confirm: true }));
    expect(a.status).toBe(200);
    const rows = await q<{ status: string; title: string }>("SELECT status, title FROM items WHERE project_id=$1 AND section='production/compliance' ORDER BY id", [PROJECT]);
    expect(rows.map((x) => x.status)).toEqual(["to check", "to check"]);
    // what the model was shown: the regions, the parts and the brief
    const prompt = JSON.stringify(s.requests.at(-1)?.body);
    expect(prompt).toContain("United States");
    expect(prompt).toContain("Wi-Fi module");
    expect(prompt).toContain("Sold to children");
    await q("DELETE FROM items WHERE project_id=$1 AND section='production/compliance'", [PROJECT]);
  });
  it("does not draft a topic that is already on the list", async () => {
    await settings({ regions: ["us"] });
    await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "stand-in-chat" });
    await add("production/compliance", "Radio equipment: FCC Part 15 in the US, RED in the EU");
    const r = await read<{ drafts: Item[] }>(await draft(json("POST", { supersede: true }), ctx(PROJECT)));
    expect(r.body.drafts.map((i) => i.title)).toEqual(["Batteries: transport and labelling"]);
    await q("DELETE FROM items WHERE project_id=$1 AND section='production/compliance'", [PROJECT]);
  });
});

describe("a compliance row left at draft by the earlier drafting path", () => {
  // The drafting engine never leaves a row at "draft" (approval makes a row at "to check"), so there is no
  // confirm step. An older row at "draft" is an ordinary row: its status is changed like any other.
  it("is changed with an ordinary edit, which records before and after", async () => {
    const r = await q<{ id: string }>(
      "INSERT INTO items (project_id, section, title, body, data, status) VALUES ($1,'production/compliance','test: radio rules','',$2,'draft') RETURNING id",
      [PROJECT, JSON.stringify({ why: "W1 transmits.", check: "Certificates.", generated: { model: "stand-in-chat", at: new Date().toISOString(), sources: [] } })]
    );
    const out = await read<{ item: Item }>(await patchItem(json("PATCH", { status: "applies" }), ctx(r[0].id)));
    expect(out.status).toBe(200);
    expect(out.body.item.status).toBe("applies");
    expect(out.body.item.data).toMatchObject({ generated: { model: "stand-in-chat" } });
    const ev = await q<{ data: { before: { status: string }; after: { status: string } } }>("SELECT data FROM events WHERE project_id=$1 AND kind='item.status' ORDER BY id DESC LIMIT 1", [PROJECT]);
    expect(ev[0].data).toMatchObject({ before: { status: "draft" }, after: { status: "applies" } });
    await q("DELETE FROM items WHERE project_id=$1 AND title LIKE 'test:%'", [PROJECT]);
  });
  it("has no confirm route any more", async () => {
    expect(existsSync(join(process.cwd(), "src/app/api/items/[id]/confirm/route.ts"))).toBe(false);
  });
});
