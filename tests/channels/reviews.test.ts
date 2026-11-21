// Reviews and questions (plan 8.20): CSV and pasted import (papaparse), repeats skipped, grouping by
// tags and by meaning (counts are counts of rows), suggested tags and drafted replies as drafts, a
// review reply that can never be sent by the app, and "Turn into a requirement" through the drafts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as IMPORT } from "@/app/api/channels/reviews/import/route";
import { GET as GROUPS } from "@/app/api/channels/reviews/groups/route";
import { POST as TO_REQ } from "@/app/api/channels/reviews/requirement/route";
import { GET as PREVIEW } from "@/app/api/channels/send/preview/route";
import { groupVectors, parseReviews, type Grouping } from "@/lib/channels/reviews";
import type { Item } from "@/lib/types";
import type { StandIn } from "../standins/core";
import { start as startModel, type OpenAIOptions } from "../standins/openai";
import { json, read } from "../api/helpers";
import { approve, list, makeConcept, run } from "../drafts/helpers";
import { chooseEmbedding, chooseReasoning, clearModelRows } from "../ai/setup";

const P = "zz-channels-reviews";
let model: StandIn<OpenAIOptions>;
let modelReply = JSON.stringify({ rows: [] });

const CSV = `Rating,Review Title,Review Text,Date,Source,Version,Topic
5,"Great case","Fits under the seat, and the zip is strong, really",2026-11-01,Amazon,MK1,size
2,Too small,"Does not fit my 16 inch laptop. Will there be a bigger one?",2026-11-03,Amazon,MK1,size
4,Good,Battery lasts a week,2026-11-04,Own site,MK1,battery
9,Odd,"Rating out of range",2026-11-05,Amazon,MK1,
1,Broke,"The handle broke on day two",11/06/2026,Amazon,MK1,handle`;

beforeAll(async () => {
  model = await startModel({ prefix: "/v1", reply: () => modelReply, dimensions: 8 });
  await makeConcept(P, "ZZ Reviews");
});

afterAll(async () => {
  await clearModelRows();
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await model.close();
  await pool().end();
});

const groups = async (mode = "auto") => read<Grouping>(await GROUPS(json("GET", undefined, `http://t/api/channels/reviews/groups?projectId=${P}&mode=${mode}`)));
const rows = () => q<{ id: string; title: string; body: string; data: Record<string, unknown>; status: string }>("SELECT id, title, body, data, status FROM items WHERE project_id=$1 AND section='sales/reviews' ORDER BY id", [P]);

describe("import", () => {
  it("parses a CSV with papaparse, mapping columns by name and reporting what it could not use", () => {
    const r = parseReviews(CSV);
    expect(r.columns).toMatchObject({ text: "Review Text", title: "Review Title", rating: "Rating", date: "Date", source: "Source", productVersion: "Version", topic: "Topic" });
    expect(r.rows).toHaveLength(5);
    expect(r.rows[0]).toMatchObject({ text: "Fits under the seat, and the zip is strong, really", rating: 5, kind: "review" });
    expect(r.rows[1].kind).toBe("question"); // ends with a question mark
    expect(r.rows[3].rating).toBeNull();
    expect(r.problems.join(" ")).toMatch(/rating "9" is not 1 to 5/);
    expect(r.rows[4].date).toMatch(/^2026-11-0[56]$/);
    expect(parseReviews("a,b\n1,2").problems[0]).toMatch(/No column holds the review text/);
  });

  it("imports through the route, skipping repeats on a second import", async () => {
    const a = await read<{ added: number; skipped: number }>(await IMPORT(json("POST", { projectId: P, text: CSV })));
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ added: 5, skipped: 0 });
    const b = await read<{ added: number; skipped: number }>(await IMPORT(json("POST", { projectId: P, text: CSV })));
    expect(b.body).toMatchObject({ added: 0, skipped: 5 });
    const pasted = await read<{ added: number }>(await IMPORT(json("POST", { projectId: P, text: "Does it come in blue?\n\nLove the colour.", source: "E-mail" })));
    expect(pasted.body.added).toBe(2);
    const all = await rows();
    expect(all).toHaveLength(7);
    expect(all.find((r) => r.body === "Does it come in blue?")!.data).toMatchObject({ kind: "question", source: "E-mail" });
    expect(all[0].status).toBe("new");
  });
});

describe("what customers keep asking", () => {
  it("by tags: groups the tagged rows with counts computed from them, and counts the untagged ones", async () => {
    const g = await groups("tags");
    expect(g.body.method).toBe("tags");
    expect(g.body.groups[0]).toMatchObject({ label: "size", count: 2, questions: 1, averageRating: 3.5 });
    expect(g.body.groups.map((x) => x.label).sort()).toEqual(["battery", "handle", "size"]);
    expect(g.body.untagged).toBe(3);
    expect(g.body.total).toBe(7);
  });

  it("auto falls back to tags, saying why, when no embedding model is chosen", async () => {
    await clearModelRows();
    const g = await groups("auto");
    expect(g.body.method).toBe("tags");
    expect(g.body.note).toMatch(/needs an embedding model/);
  });

  it("by meaning: with an embedding model every row lands in exactly one group", async () => {
    await chooseEmbedding({ provider: "ollama", baseUrl: `${model.url}/v1`, model: "stand-in-embed", dims: 8 });
    const g = await groups("auto");
    expect(g.status, JSON.stringify(g.body)).toBe(200);
    expect(g.body.method).toBe("meaning");
    expect(g.body.groups.reduce((a, x) => a + x.count, 0)).toBe(7);
    await chooseEmbedding(null);
  });

  it("groupVectors joins rows at or above the similarity and names a group by its most used tag", () => {
    const it = (id: number, topic = "") => ({ id, title: `row ${id}`, body: "", data: { topic }, status: "new", section: "sales/reviews", projectId: P, sort: id }) as Item;
    const g = groupVectors([it(1, "fit"), it(2, "fit"), it(3), it(4, "battery")], [[1, 0], [0.95, 0.05], [0.9, 0.1], [0, 1]]);
    expect(g.map((x) => [x.label, x.count])).toEqual([["fit", 3], ["battery", 1]]);
  });
});

describe("drafts: tags, replies and requirements", () => {
  it("suggests topic and sentiment as drafts that replace the row only when approved", async () => {
    await chooseReasoning({ provider: "ollama", baseUrl: `${model.url}/v1`, model: "stand-in-drafter" });
    const blue = (await rows()).find((r) => r.body === "Does it come in blue?")!;
    modelReply = JSON.stringify({ rows: [{ id: Number(blue.id), topic: "colours", sentiment: "neutral" }] });
    const r = await run({ projectId: P, generator: "review-tags" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.drafts[0].op.op).toBe("replace");
    expect((await rows()).find((x) => x.id === blue.id)!.data.topic).toBeFalsy(); // not yet
    await approve(r.body.drafts[0].id);
    expect((await rows()).find((x) => x.id === blue.id)!.data).toMatchObject({ topic: "colours", sentiment: "neutral", kind: "question", source: "E-mail" });
  });

  it("drafts a reply to a review; once approved it is a reply row the app refuses to send (Amazon)", async () => {
    const broke = (await rows()).find((r) => r.body === "The handle broke on day two")!;
    modelReply = JSON.stringify({ rows: [{ answers: Number(broke.id), text: "Sorry the handle failed. We are checking it." }] });
    const r = await run({ projectId: P, generator: "review-replies" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const sys = String((model.requests.at(-1)!.body as { messages: { content: string }[] }).messages[0].content);
    expect(sys).toMatch(/must not ask for a review/);
    const a = await approve(r.body.drafts[0].id);
    expect(a.body.item!.data).toMatchObject({ channel: "Amazon", answers: Number(broke.id) });
    const p = await read<{ error: string }>(await PREVIEW(json("GET", undefined, `http://t/api/channels/send/preview?projectId=${P}&kind=reply&itemId=${a.body.item!.id}`)));
    expect(p.status).toBe(400);
    expect(p.body.error).toMatch(/Only X and Instagram/);
  });

  it("turns a group into a draft requirement citing its reviews; approval makes the requirement row", async () => {
    const g = (await groups("tags")).body.groups.find((x) => x.label === "size")!;
    expect((await read(await TO_REQ(json("POST", { projectId: P, title: "x", detail: "", reviewIds: [999999] })))).status).toBe(400);
    const r = await read<{ draftId: number; key: string }>(await TO_REQ(json("POST", { projectId: P, title: "Fits a 16 inch laptop", detail: "Two customers asked.", reviewIds: g.reviewIds })));
    expect(r.status).toBe(201);
    expect(r.body.key).toBe("req-1");
    const d = (await list(P, "&store=design/requirements")).body.drafts.find((x) => x.id === r.body.draftId)!;
    expect(d.status).toBe("draft");
    expect(d.sources.map((x) => x.id).sort()).toEqual([...g.reviewIds].sort());
    expect(await q("SELECT 1 FROM items WHERE project_id=$1 AND section='design/requirements'", [P])).toHaveLength(0);
    const a = await approve(r.body.draftId);
    expect(a.status, JSON.stringify(a.body)).toBe(200);
    expect(a.body.item!.data).toMatchObject({ key: "req-1", fromReviews: g.reviewIds, source: "customer reviews and questions" });
    const ev = await q<{ data: { sources: { id: number }[] } }>("SELECT data FROM events WHERE project_id=$1 AND kind='draft.approved' ORDER BY id DESC LIMIT 1", [P]);
    expect(ev[0].data.sources.map((x) => x.id).sort()).toEqual([...g.reviewIds].sort());
  });
});
