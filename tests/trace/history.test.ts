// Plan 3.4: every write path records the values before and after, and the history reads them back.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rewriteAuditLog } from "../auditBypass";
import { pool, q } from "@/lib/db";
import { PATCH as patchProject } from "@/app/api/projects/[id]/route";
import { POST as addFile } from "@/app/api/projects/[id]/files/route";
import { DELETE as removeFile } from "@/app/api/files/[id]/route";
import { POST as addEvidence, DELETE as removeEvidence } from "@/app/api/research/evidence/route";
import { POST as askResearch } from "@/app/api/research/route";
import { GET as itemHistory } from "@/app/api/items/[id]/history/route";
import { GET as activity } from "@/app/api/projects/[id]/activity/route";
import { anonymous, ctx, form, json, read } from "../api/helpers";
import * as perplexity from "../standins/perplexity";
import type { StandIn } from "../standins/core";
import type { HistoryPage } from "@/lib/trace/history";
import { add, drop, events, lines, newConcept, patch, remove } from "./helpers";

let project = "";
let standIn: StandIn<perplexity.PerplexityOptions>;
const KEY = "pplx-history-test-key-1234";
const saved = process.env.PERPLEXITY_API_KEY;

beforeAll(async () => {
  project = await newConcept("History probe");
  delete process.env.PERPLEXITY_API_KEY;
  standIn = await perplexity.start({ apiKey: KEY, reply: "History answer[1].", citations: ["https://cite.example/h"] });
  process.env.PERPLEXITY_BASE_URL = standIn.url;
  await q("DELETE FROM credentials WHERE provider='perplexity' AND field='apiKey'");
  await q("INSERT INTO credentials (provider, field, value) VALUES ('perplexity','apiKey',$1)", [KEY]);
});

afterAll(async () => {
  delete process.env.PERPLEXITY_BASE_URL;
  if (saved !== undefined) process.env.PERPLEXITY_API_KEY = saved;
  await q("DELETE FROM credentials WHERE provider='perplexity' AND value=$1", [KEY]);
  await standIn.close();
  await drop(project);
  await pool().end();
});

type Detail = { itemId?: number | string; section?: string; title?: string; before?: Record<string, unknown>; after?: Record<string, unknown> };
const last = async (kind: string) => {
  const e = (await events(project)).filter((x) => x.kind === kind).at(-1);
  expect(e, `an event of kind ${kind}`).toBeTruthy();
  return e!.data as Detail;
};

describe("every write path records before and after", () => {
  let id = 0;

  it("adding a row records every field it starts with", async () => {
    const r = await add(project, "design/bom", "History part", { body: "first", data: { ref: "H1", qty: 2 } });
    id = r.body.item.id;
    const d = await last("item.added");
    expect(d.section).toBe("design/bom");
    expect(d.before).toBeUndefined();
    expect(d.after).toMatchObject({ title: "History part", body: "first", status: "to buy", "data.ref": "H1", "data.qty": 2 });
  });

  it("editing records only the fields that changed, with the value they had", async () => {
    await patch(id, { title: "History part v2", data: { qty: 3, source: "Amazon" } });
    const d = await last("item.edited");
    expect(d.before).toEqual({ title: "History part", "data.qty": 2 });
    expect(d.after).toEqual({ title: "History part v2", "data.qty": 3, "data.source": "Amazon" });
  });

  it("a save that changes nothing leaves no line", async () => {
    const n = (await events(project)).length;
    await patch(id, { title: "History part v2", data: { qty: 3 } });
    expect((await events(project)).length).toBe(n);
  });

  it("a status change records both statuses", async () => {
    await patch(id, { status: "ordered" });
    const d = await last("item.status");
    expect(d.before).toEqual({ status: "to buy" });
    expect(d.after).toEqual({ status: "ordered" });
  });

  it("reordering records the position before and after", async () => {
    const was = (await q<{ sort: number }>("SELECT sort FROM items WHERE id=$1", [id]))[0].sort;
    await patch(id, { sort: was + 50 });
    const d = await last("item.edited");
    expect(d.before).toEqual({ sort: was });
    expect(d.after).toEqual({ sort: was + 50 });
  });

  it("deleting records the whole row as it was", async () => {
    expect((await remove(id)).status).toBe(200);
    const d = await last("item.removed");
    expect(d.before).toMatchObject({ title: "History part v2", status: "ordered", "data.ref": "H1", "data.qty": 3 });
    expect(d.after).toBeUndefined();
  });

  it("the concept's own edits record before and after", async () => {
    await patchProject(json("PATCH", { oneLiner: "a new line" }), ctx(project));
    const d = await last("project.edited");
    expect(d.before).toEqual({ oneLiner: "" });
    expect(d.after).toEqual({ oneLiner: "a new line" });
  });

  it("files record what was stored and what was removed", async () => {
    const data = new FormData();
    data.set("file", new File(["solid x"], "probe.stl", { type: "model/stl" }));
    data.set("kind", "stl");
    const stored = await read<{ file: { id: number; sha256: string } }>(await addFile(form("POST", data), ctx(project)));
    expect(stored.status).toBe(201);
    const s = await last("file.stored");
    expect(s.before).toBeUndefined();
    expect(s.after).toMatchObject({ name: "probe.stl", kind: "stl", size: 7, sha256: stored.body.file.sha256 });
    expect((await removeFile(json("DELETE"), ctx(String(stored.body.file.id)))).status).toBe(200);
    const r = await last("file.removed");
    expect(r.before).toMatchObject({ name: "probe.stl", kind: "stl", size: 7, sha256: stored.body.file.sha256 });
  });

  it("research records the question, model and number of sources", async () => {
    const r = await askResearch(json("POST", { projectId: project, query: "test: history question" }));
    expect(r.status).toBe(201);
    const d = await last("research.asked");
    expect(d.after).toMatchObject({ query: "test: history question", sources: 1 });
    expect(typeof d.after?.model).toBe("string");
  });

  it("evidence records the status and the evidence list before and after", async () => {
    const claim = await add(project, "research/claims", "History claim");
    const url = "https://cite.example/h";
    // a supporting source verifies a claim only from a saved answer, with a quote
    const researchId = Number((await q<{ id: string }>("INSERT INTO research (project_id, query, answer, citations, model) VALUES ($1,'test: history evidence','a',$2,'m') RETURNING id", [project, JSON.stringify([url])]))[0].id);
    const body = { claimId: claim.body.item.id, url, researchId, quote: "It says so.", verdict: "supports" };
    expect((await addEvidence(json("POST", body))).status).toBe(201);
    const a = await last("claim.evidence.added");
    expect(a.title).toBe("History claim");
    expect(a.before).toMatchObject({ status: "unverified", evidence: [] });
    expect(a.after).toMatchObject({ status: "verified" });
    expect((a.after?.evidence as unknown[]).length).toBe(1);
    expect((await removeEvidence(json("DELETE", { claimId: claim.body.item.id, url }))).status).toBe(200);
    const d = await last("claim.evidence.removed");
    expect(d.before).toMatchObject({ status: "verified" });
    expect(d.after).toMatchObject({ status: "unverified", evidence: [] });
  });

  it("each line in the audit log carries the same before and after, with the signed-in name", async () => {
    const all = await lines(project);
    const edit = all.find((l) => l.action === "item.edited" && (l.detail.after as Record<string, unknown>)?.["data.source"] === "Amazon");
    expect(edit?.actor).toBe("demo");
    expect(edit?.detail.before).toEqual({ title: "History part", "data.qty": 2 });
  });
});

describe("reading the history", () => {
  let id = 0;
  const hist = async (rowId: number, query = "") => read<HistoryPage & { error?: string }>(await itemHistory(json("GET", undefined, `http://test.local/api/items/${rowId}/history${query}`), ctx(String(rowId))));

  it("lists one row's changes newest first with who, when and each field", async () => {
    id = (await add(project, "concept/brief", "Readable row", { body: "one" })).body.item.id;
    await patch(id, { body: "two" });
    await patch(id, { title: "Readable row, renamed", status: "done" });
    const h = await hist(id);
    expect(h.status).toBe(200);
    expect(h.body.entries.map((e) => e.kind)).toEqual(["item.status", "item.edited", "item.added"]);
    const [newest, middle, first] = h.body.entries;
    expect(newest.actor).toBe("demo");
    expect(new Date(newest.at).getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(newest.changes.map((c) => [c.field, c.before, c.after])).toEqual([
      ["title", "Readable row", "Readable row, renamed"],
      ["status", "open", "done"],
    ]);
    expect(newest.changes.every((c) => c.restorable)).toBe(true);
    expect(middle.changes).toEqual([{ field: "body", label: "Details", before: "one", after: "two", restorable: true }]);
    // an added row has nothing to restore
    expect(first.changes.every((c) => !c.restorable && !("before" in c))).toBe(true);
  });

  it("restoring a value is an ordinary save and is itself recorded", async () => {
    await patch(id, { body: "one" });
    const h = await hist(id);
    expect(h.body.entries[0].changes).toEqual([{ field: "body", label: "Details", before: "two", after: "one", restorable: true }]);
  });

  it("evidence changes are listed but cannot be restored by a save", async () => {
    const claim = (await q<{ id: string }>("SELECT id FROM items WHERE project_id=$1 AND title='History claim'", [project]))[0].id;
    const h = await hist(Number(claim));
    const ev = h.body.entries.find((e) => e.kind === "claim.evidence.added")!;
    expect(ev.changes.find((c) => c.field === "data.evidence")?.restorable).toBe(false);
    expect(ev.changes.find((c) => c.field === "status")?.label).toBe("Status");
  });

  it("pages with before and limit", async () => {
    const first = await hist(id, "?limit=2");
    expect(first.body.entries).toHaveLength(2);
    expect(first.body.next).toBe(first.body.entries[1].id);
    const rest = await hist(id, `?limit=2&before=${first.body.next}`);
    expect(rest.body.entries.map((e) => e.id).every((n) => n < first.body.next!)).toBe(true);
    expect(rest.body.next).toBeNull();
  });

  it("answers 404 for a row that is not there and 401 with no session", async () => {
    expect((await hist(999_999_999)).status).toBe(404);
    expect((await itemHistory(anonymous("GET", undefined, `http://test.local/api/items/${id}/history`), ctx(String(id)))).status).toBe(401);
  });
});

describe("the concept's activity", () => {
  const act = async (query = "") => read<HistoryPage>(await activity(json("GET", undefined, `http://test.local/api/projects/${project}/activity${query}`), ctx(project)));

  it("lists every change newest first and filters by section and by kind", async () => {
    const all = await act();
    expect(all.status).toBe(200);
    expect(all.body.entries[0].id).toBeGreaterThan(all.body.entries.at(-1)!.id);
    const bom = await act("?section=design/bom");
    expect(bom.body.entries.length).toBeGreaterThan(0);
    expect(bom.body.entries.every((e) => e.section === "design/bom")).toBe(true);
    const files = await act("?kind=file");
    expect(files.body.entries.map((e) => e.kind).sort()).toEqual(["file.removed", "file.stored"]);
    const claims = await act("?kind=claim&section=research/claims");
    expect(claims.body.entries.map((e) => e.kind).sort()).toEqual(["claim.evidence.added", "claim.evidence.removed"]);
  });

  it("finds the section of an older line from the row it is about", async () => {
    // a line written before `section` was recorded
    const row = (await add(project, "concept/names", "Old style row")).body.item;
    await rewriteAuditLog("UPDATE audit_log SET detail = detail - 'section' WHERE project_id=$1 AND detail->>'itemId' = $2", [project, String(row.id)]);
    const names = await act("?section=concept/names");
    expect(names.body.entries.some((e) => e.itemId === row.id)).toBe(true);
  });

  it("pages with before, and refuses a kind it does not know", async () => {
    const a = await act("?limit=3");
    expect(a.body.entries).toHaveLength(3);
    expect(a.body.next).not.toBeNull();
    const b = await act(`?limit=3&before=${a.body.next}`);
    expect(b.body.entries.every((e) => e.id < a.body.next!)).toBe(true);
    expect((await activity(json("GET", undefined, `http://test.local/api/projects/${project}/activity?kind=nope`), ctx(project))).status).toBe(400);
    expect((await activity(json("GET", undefined, `http://test.local/api/projects/no-such/activity`), ctx("no-such"))).status).toBe(404);
  });
});
