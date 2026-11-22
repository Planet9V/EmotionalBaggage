// Optimisation (plan 4.9): the three measurements are computed from rows, never from the model.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { GET as STATE, POST as OPTIMISE } from "@/app/api/drafts/optimise/route";
import { applyDrafts, describe as words, measureCost as costOf, measureCount, measurePrint, NO_COST_ROWS, printMinutes } from "@/lib/ai/drafts/measure";
import type { Draft, RunResult } from "@/lib/ai/drafts/shared";
import type { OptimiseState } from "@/lib/ai/drafts/service";
import type { Item } from "@/lib/types";
import type { StandIn } from "../standins/core";
import type { OpenAIOptions } from "../standins/openai";
import { json, read } from "../api/helpers";
import { chooseReasoning, clearModelRows } from "../ai/setup";
import { addItem, approve, itemsOf, makeConcept, scriptedModel, type Script } from "./helpers";

// the cost is read from the unit economics; these concepts have no cost lines beside the parts
const measureCost = (bom: Item[]) => costOf(bom, NO_COST_ROWS, "USD");

const item = (id: number, section: string, title: string, data: Record<string, unknown> = {}): Item => ({ id, projectId: "p", section, title, body: "", data, status: "open", sort: id });

describe("measurements", () => {
  it("cost is a sum only when every part has a cost; otherwise not priced, with what is priced", () => {
    const all = [item(1, "design/bom", "A", { line: 2.5 }), item(2, "design/bom", "B", { line: "1.25" })];
    expect(measureCost(all)).toEqual({ parts: 2, priced: 2, pricedTotal: 3.75, total: 3.75, unitCost: 3.75, batchSize: 1, unitComplete: true });
    expect(words("cost", measureCost(all))).toBe("3.75 for 2 parts; unit cost 3.75 at 1 unit");
    const some = [...all, item(3, "design/bom", "C")];
    expect(measureCost(some).total).toBeNull();
    expect(words("cost", measureCost(some))).toBe("Not priced (2 of 3 parts have a cost, adding up to 3.75)");
    expect(words("cost", measureCost([item(4, "design/bom", "D")]))).toBe("Not priced (none of 1 parts has a cost)");
  });

  it("part and fastener counts", () => {
    const rows = [item(1, "design/bom", "Board", { qty: 1 }), item(2, "design/bom", "M3 screws", { qty: 6 }), item(3, "design/bom", "Clip", { kind: "fastener", qty: 2 }), item(4, "design/bom", "Label")];
    expect(measureCount(rows)).toEqual({ rows: 4, pieces: 10, noQty: 1, fasteners: 8 });
    expect(words("parts", measureCount(rows))).toBe("4 parts, 10 pieces, 8 fasteners (1 with no quantity counted as one)");
  });

  it("print time is read from the rows; a row with none is not sliced yet", () => {
    expect(printMinutes(item(1, "x", "a", { estimate: "~62 g, 4-5 h" }))).toEqual([240, 300]);
    expect(printMinutes(item(1, "x", "a", { estimate: "45 min" }))).toEqual([45, 45]);
    expect(printMinutes(item(1, "x", "a", { estimate: "1 h 30 min" }))).toEqual([90, 90]);
    expect(printMinutes(item(1, "x", "a", { printMinutes: 12, estimate: "5 h" }))).toEqual([12, 12]);
    expect(printMinutes(item(1, "x", "a", { estimate: "" }))).toBeNull();
    expect(printMinutes(item(1, "x", "a", { estimate: "soon" }))).toBeNull();
    const m = measurePrint([item(1, "x", "a", { estimate: "4-5 h" }), item(2, "x", "b", { estimate: "45 min" }), item(3, "x", "c")]);
    expect(m).toEqual({ jobs: 3, sliced: 2, low: 285, high: 345 });
    expect(words("print", m)).toBe("4 h 45 min to 5 h 45 min over 2 of 3 print jobs (1 not sliced yet)");
    expect(words("print", measurePrint([item(3, "x", "c")]))).toBe("Not sliced yet (1 print jobs, none with a print time)");
  });

  it("the rows if every waiting draft were approved: replacements, removals, additions", () => {
    const rows = [item(1, "design/bom", "A", { line: 1 }), item(2, "design/bom", "B", { line: 2 })];
    const d = (over: Partial<Draft>): Draft => ({ id: 0, projectId: "p", generator: "g", targetStore: "design/bom", title: "T", body: "", data: {}, op: { op: "add" }, sources: [], model: "", provider: "", status: "draft", runId: "r", reason: "", createdAt: "", decidedAt: null, decidedBy: null, itemId: null, ...over });
    const after = applyDrafts(rows, [d({ op: { op: "replace" }, itemId: 1, title: "A2", data: {} }), d({ op: { op: "remove" }, itemId: 2 }), d({ op: { op: "add" }, title: "C" }), d({ op: { op: "remove" }, itemId: 1, status: "rejected" })]);
    expect(after.map((r) => r.title)).toEqual(["A2", "C"]);
    expect(measureCost(after).total).toBeNull();
  });
});

describe("optimisation runs", () => {
  const P = "zz-drafts-opt";
  let s: StandIn<OpenAIOptions>;
  const script: Script = {};
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    s = await scriptedModel(script);
    await makeConcept(P, "ZZ Optimise", "electronics", "A clock");
    ids.board = await addItem(P, "design/bom", "Dev board", { ref: "U1", qty: 1, line: 12 });
    ids.case = await addItem(P, "design/bom", "Case", { ref: "ENC1", qty: 1, line: 3 });
    ids.lid = await addItem(P, "design/bom", "Lid", { ref: "ENC2", qty: 1, line: 1 });
    ids.screws = await addItem(P, "design/bom", "M2 screws", { ref: "HW1", qty: 4, line: 0.4 });
    ids.shell = await addItem(P, "prototype/printing", "Shell", { material: "PETG", settings: "4 walls, 25% infill", estimate: "4-5 h" });
    ids.coupon = await addItem(P, "prototype/printing", "Coupon", { estimate: "45 min" });
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

  const state = async () => (await read<{ actions: OptimiseState[] }>(await STATE(json("GET", undefined, `http://t/x?projectId=${P}`)))).body.actions;
  const go = async (action: string) => read<RunResult & { error?: string }>(await OPTIMISE(json("POST", { projectId: P, action })));

  it("before any run each action shows its measurement now and no last run", async () => {
    const a = await state();
    expect(a.map((x) => x.id)).toEqual(["cost", "parts", "print"]);
    expect(a[0].now.text).toBe("16.40 for 4 parts; unit cost 16.40 at 1 unit");
    expect(a[1].now.text).toBe("4 parts, 7 pieces, 4 fasteners");
    expect(a[2].now.text).toBe("4 h 45 min to 5 h 45 min over 2 of 2 print jobs");
    expect(a.every((x) => x.last === null)).toBe(true);
  });

  it("lower cost: a substitute is unpriced, so the projected after is not priced until the user prices it", async () => {
    script["optimise-cost"] = { rows: [{ replaces: ids.board, title: "Bare module", spec: "The same chip without the dev board", reason: "No USB bridge or headers", search: "module" }, { replaces: 424242, title: "x", spec: "", reason: "y" }] };
    const r = await go("cost");
    expect(r.status).toBe(201);
    expect(r.body.drafts).toHaveLength(1);
    expect(r.body.dropped).toHaveLength(1);
    const d = r.body.drafts[0];
    expect(d).toMatchObject({ itemId: ids.board, op: { op: "replace", reason: "No USB bridge or headers" } });
    expect(d.data.line).toBeUndefined();
    expect(d.data.wasLine).toBe(12);
    expect(d.data.ref).toBe("U1");
    const a = (await state())[0];
    expect(a.last!.before.text).toBe("16.40 for 4 parts; unit cost 16.40 at 1 unit");
    expect(a.last!.ifApproved.text).toBe("Not priced (3 of 4 parts have a cost, adding up to 4.40; 1 substitute has no cost yet, was 12.00)");
    expect(a.last!.drafts).toEqual({ waiting: 1, approved: 0, rejected: 0 });
    await approve(d.id);
    // approved: the price is gone from the total, the old one kept on the row as "was"
    const mid = (await state())[0];
    expect(mid.now.text).toBe("Not priced (3 of 4 parts have a cost, adding up to 4.40; 1 substitute has no cost yet, was 12.00)");
    await q("UPDATE items SET data = data || '{\"line\": 4}'::jsonb WHERE id=$1", [ids.board]);
    const b = (await state())[0];
    expect(b.now.text).toBe("8.40 for 4 parts; unit cost 8.40 at 1 unit");
    expect(b.last!.before.text).toBe("16.40 for 4 parts; unit cost 16.40 at 1 unit");
  });

  it("fewer parts: a merge keeps one part and removes the other; counts before and after from rows", async () => {
    script["optimise-parts"] = {
      rows: [
        { action: "merge", replaces: ids.case, mergeWith: [ids.lid], title: "Snap-fit case", spec: "Case and lid in one print with a living hinge", reason: "Neither moves relative to the other in use" },
        { action: "remove", replaces: ids.screws, reason: "Snap fits replace them" },
        { action: "remove", replaces: ids.lid, reason: "Duplicate" },
      ],
    };
    const r = await go("parts");
    expect(r.body.drafts.map((d) => d.op.op)).toEqual(["replace", "remove", "remove"]);
    expect(r.body.dropped).toEqual([{ title: "(untitled row)", reason: expect.stringContaining("another proposal") }]);
    const a = (await state())[1];
    expect(a.last!.before.text).toBe("4 parts, 7 pieces, 4 fasteners");
    expect(a.last!.ifApproved.text).toBe("2 parts, 2 pieces, 0 fasteners");
    for (const d of r.body.drafts) expect((await approve(d.id)).status).toBe(200);
    expect((await itemsOf(P, "design/bom")).map((x) => x.title)).toEqual(["Bare module", "Snap-fit case"]);
    expect((await state())[1].now.text).toBe("2 parts, 2 pieces, 0 fasteners");
    const removed = await q("SELECT 1 FROM events WHERE project_id=$1 AND kind='draft.approved' AND data->>'op'='remove'", [P]);
    expect(removed).toHaveLength(2);
  });

  it("shorter print time: a changed job loses its old time and is not sliced yet", async () => {
    script["optimise-print"] = { rows: [{ replaces: ids.shell, settings: "3 walls, 15% infill, 0.28 mm layers", orientation: "Flat open", reason: "Fewer walls and less infill" }] };
    const r = await go("print");
    const d = r.body.drafts[0];
    expect(d.data).toMatchObject({ settings: "3 walls, 15% infill, 0.28 mm layers", orientation: "Flat open", estimate: "", material: "PETG" });
    const a = (await state())[2];
    expect(a.last!.before.text).toBe("4 h 45 min to 5 h 45 min over 2 of 2 print jobs");
    expect(a.last!.ifApproved.text).toBe("45 min over 1 of 2 print jobs (1 not sliced yet)");
    await approve(d.id);
    await q("UPDATE items SET data = data || '{\"estimate\": \"3 h\"}'::jsonb WHERE id=$1", [ids.shell]);
    expect((await state())[2].now.text).toBe("3 h 45 min over 2 of 2 print jobs");
  });

  it("an unknown action is refused", async () => {
    expect((await go("faster")).status).toBe(400);
  });
});
