// Process review 3: an optional "why" travels with a change, as data.reason on the event, and is read back in
// History, Activity, the Process history and the audit log. Only a gate override still requires one.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as archive } from "@/app/api/projects/[id]/archive/route";
import { DELETE as deleteConcept } from "@/app/api/projects/[id]/route";
import { POST as moveStage } from "@/app/api/projects/[id]/stage/route";
import { POST as override, DELETE as withdraw } from "@/app/api/projects/[id]/gates/route";
import { POST as addReason } from "@/app/api/items/[id]/reason/route";
import { GET as itemHistory } from "@/app/api/items/[id]/history/route";
import { GET as activity } from "@/app/api/projects/[id]/activity/route";
import { GET as processState } from "@/app/api/projects/[id]/process/route";
import { ctx, json, read } from "../api/helpers";
import type { HistoryPage } from "@/lib/trace/history";
import type { ProcessResponse } from "@/lib/process/state";
import { add, drop, events, lines, newConcept, patch } from "./helpers";

let project = "";
let row = 0;

beforeAll(async () => {
  project = await newConcept("Why probe");
  row = (await add(project, "concept/questions", "Who pays?")).body.item.id;
});
afterAll(async () => {
  await drop(project);
  await pool().end();
});

const lastEvent = async (kind: string) => (await events(project)).filter((e) => e.kind === kind).at(-1)!;

describe("the why on an item change", () => {
  it("is kept on the status event and in the audit line, never on the row", async () => {
    const r = await patch(row, { status: "decided", why: "Jim confirmed it on the call" });
    expect(r.status).toBe(200);
    expect(r.body.item.data.why).toBeUndefined();
    const e = await lastEvent("item.status");
    expect(e.data.reason).toBe("Jim confirmed it on the call");
    const audit = (await lines(project)).filter((l) => l.action === "item.status").at(-1)!;
    expect(audit.detail.reason).toBe("Jim confirmed it on the call");
  });

  it("is kept on an ordinary edit too, and an edit without one carries none", async () => {
    await patch(row, { body: "Details", why: "Added the detail" });
    expect((await lastEvent("item.edited")).data.reason).toBe("Added the detail");
    await patch(row, { body: "More details" });
    expect((await lastEvent("item.edited")).data.reason).toBeUndefined();
  });

  it("a body that holds only a why changes nothing and is refused; an over-long why is refused", async () => {
    expect((await patch(row, { why: "just because" })).status).toBe(400);
    expect((await patch(row, { status: "open", why: "x".repeat(1001) })).status).toBe(400);
  });

  it("is optional: the same change without one is accepted", async () => {
    expect((await patch(row, { status: "open" })).status).toBe(200);
  });
});

describe("the why on stage moves, overrides and withdrawals", () => {
  it("moving back takes an optional why; moving forward through an override still needs its reason", async () => {
    // Concept gate: override it with the (required) reason, advance, then move back with a why.
    const noReason = await override(json("POST", { stage: "concept" }), ctx(project));
    expect(noReason.status).toBe(400);
    expect((await override(json("POST", { stage: "concept", reason: "Prototype first" }), ctx(project))).status).toBe(200);
    expect((await moveStage(json("POST", { stage: "research" }), ctx(project))).status).toBe(200);
    const back = await moveStage(json("POST", { stage: "concept", why: "The brief changed" }), ctx(project));
    expect(back.status).toBe(200);
    expect((await lastEvent("stage.moved-back")).data.reason).toBe("The brief changed");
    const plain = await moveStage(json("POST", { stage: "research" }), ctx(project));
    expect(plain.status).toBe(200);
    expect((await lastEvent("stage.advanced")).data.reason).toBeUndefined();
  });

  it("withdrawing an override takes an optional why and keeps the old reason in before", async () => {
    const w = await withdraw(json("DELETE", { stage: "concept", why: "We have the evidence now" }), ctx(project));
    expect(w.status).toBe(200);
    const e = await lastEvent("gate.override-withdrawn");
    expect(e.data.reason).toBe("We have the evidence now");
    expect((e.data.before as { note: string }).note).toBe("Prototype first");
  });

  it("the Process history carries the reason of a move back", async () => {
    const p = await read<ProcessResponse>(await processState(json("GET"), ctx(project)));
    const moved = p.body.history.find((h) => h.kind === "stage.moved-back");
    expect(moved?.data.reason).toBe("The brief changed");
  });
});

describe("a reason added afterwards", () => {
  let q1 = 0;
  const history = async () => (await read<HistoryPage>(await itemHistory(json("GET"), ctx(String(q1))))).body;
  beforeAll(async () => {
    q1 = (await add(project, "concept/questions", "Late reason probe")).body.item.id;
    await patch(q1, { status: "decided" });
  });

  it("is offered on the signed-in person's latest change, and written as a new line that names it", async () => {
    const before = await history();
    const latest = before.entries[0];
    expect(latest.canAddReason).toBe(true);
    expect(before.entries.filter((e) => e.canAddReason)).toHaveLength(1);
    const r = await read<{ ok: boolean }>(await addReason(json("POST", { why: "Decided in the review", forEvent: latest.id }), ctx(String(q1))));
    expect(r.status).toBe(200);
    // the old line is untouched
    const old = (await lines(project)).find((l) => l.id === latest.id)!;
    expect(old.detail.reason).toBeUndefined();
    const later = (await lines(project)).filter((l) => l.action === "item.reason").at(-1)!;
    expect(later.detail).toMatchObject({ forEvent: latest.id, reason: "Decided in the review", itemId: q1 });
    // History shows the reason on the change, marked as added later, and no longer offers it
    const after = await history();
    expect(after.entries.find((e) => e.id === latest.id)).toMatchObject({ reason: "Decided in the review", canAddReason: false });
    expect(after.entries.find((e) => e.id === latest.id)!.reasonLater).toMatchObject({ by: "demo" });
    expect(after.entries.some((e) => e.kind === "item.reason")).toBe(false);
  });

  it("refuses a second reason, a line that is not the latest, and a row nobody here changed", async () => {
    expect((await addReason(json("POST", { why: "again" }), ctx(String(q1)))).status).toBe(409);
    await patch(q1, { status: "open" });
    const h = await history();
    const older = h.entries[1];
    expect((await addReason(json("POST", { why: "too late", forEvent: older.id }), ctx(String(q1)))).status).toBe(409);
    expect((await addReason(json("POST", { why: "" }), ctx(String(q1)))).status).toBe(400);
    const other = (await add(project, "concept/questions", "Untouched")).body.item.id;
    expect((await addReason(json("POST", { why: "nothing to explain" }), ctx(String(other)))).status).toBe(409);
    expect((await addReason(json("POST", { why: "x" }), ctx("999999999"))).status).toBe(404);
  });

  it("shows on the Activity page, which hides the reason lines themselves", async () => {
    const a = (await read<HistoryPage>(await activity(json("GET", undefined, "http://test.local/api?kind=item"), ctx(project)))).body;
    expect(a.entries.some((e) => e.reason === "Decided in the review")).toBe(true);
    expect(a.entries.some((e) => e.kind === "item.reason")).toBe(false);
  });
});

describe("the why on archiving and deleting a concept", () => {
  it("archive and delete keep it in the audit log", async () => {
    const c = await newConcept("Why archive");
    expect((await archive(json("POST", { why: "Superseded by MK2" }), ctx(c))).status).toBe(200);
    expect((await lines(c)).find((l) => l.action === "project.archived")!.detail.reason).toBe("Superseded by MK2");
    // an archive with no body at all still works
    const c2 = await newConcept("Why archive plain");
    expect((await archive(json("POST"), ctx(c2))).status).toBe(200);
    expect((await lines(c2)).find((l) => l.action === "project.archived")!.detail.reason).toBeUndefined();
    const name = (await q<{ name: string }>("SELECT name FROM projects WHERE id=$1", [c]))[0].name;
    expect((await deleteConcept(json("DELETE", { confirm: name, why: "Not going ahead" }), ctx(c))).status).toBe(200);
    const gone = (await q<{ detail: Record<string, unknown> }>("SELECT detail FROM audit_log WHERE project_id=$1 AND action='project.deleted'", [c]))[0];
    expect(gone.detail.reason).toBe("Not going ahead");
    await drop(c2);
  });
});
