// The concept story: its rows through the ordinary item routes with their history, the one-row-per-part rule, the
// drafting generator against the stand-in model (with the sources' passages and citations), and a story and its
// sources carried by export, duplicate and delete.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q, ready } from "@/lib/db";
import { GET as HISTORY } from "@/app/api/items/[id]/history/route";
import { GET as EXPORT } from "@/app/api/projects/[id]/export/route";
import { POST as DUPLICATE } from "@/app/api/projects/[id]/duplicate/route";
import { DELETE as DELETE_CONCEPT } from "@/app/api/projects/[id]/route";
import { POST as ADD_SOURCE } from "@/app/api/projects/[id]/sources/route";
import { ctx, json, read } from "../api/helpers";
import { add, patch } from "../trace/helpers";
import { chooseReasoning, clearModelRows } from "../ai/setup";
import { approve, list, MARKERS, run, scriptedModel, type Script } from "../drafts/helpers";
import type { StandIn } from "../standins/core";
import type { OpenAIOptions } from "../standins/openai";

const P = "zz-story";
let s: StandIn<OpenAIOptions>;
const script: Script = {};
MARKERS["concept-story"] = "You write the introduction to a product concept";

const addSource = async (projectId: string, title: string, text: string) =>
  read<{ item: { id: number } }>(await ADD_SOURCE(json("POST", { title, text, kind: "note" }, `http://t/api/projects/${projectId}/sources`), ctx(projectId)));

beforeAll(async () => {
  await ready();
  s = await scriptedModel(script);
  await q("DELETE FROM projects WHERE id = ANY($1)", [[P]]);
  await q("INSERT INTO projects (id, name, one_liner) VALUES ($1, 'ZZ Story', 'A suitcase that heckles the trip')", [P]);
});

afterAll(async () => {
  await clearModelRows();
  await q("DELETE FROM projects WHERE id LIKE 'zz-story%' OR name LIKE 'ZZ Story copy%'");
  await s.close();
  await pool().end();
});

beforeEach(() => {
  for (const k of Object.keys(script)) delete script[k];
  s.requests.length = 0;
});

describe("story rows", () => {
  it("adds, edits and reads back a part with its history; one row per part; data is checked", async () => {
    const a = await add(P, "concept/story", "The pitch", { body: "A puck that **talks**.", data: { part: "pitch" }, status: "draft" });
    expect(a.status).toBe(201);
    const twice = await add(P, "concept/story", "The pitch again", { data: { part: "pitch" } });
    expect(twice.status).toBe(409);
    expect(twice.body.error).toContain("already has that section");
    const bad = await add(P, "concept/story", "Nonsense", { data: { part: "nonsense" } });
    expect(bad.status).toBe(400);
    const badClaim = await add(P, "concept/story", "Why", { data: { part: "why", claims: [{ text: "x", basis: "guessed" }] } });
    expect(badClaim.status).toBe(400);

    const e = await patch(a.body.item.id, { body: "A puck that heckles.", status: "written", why: "Tighter" });
    expect(e.status).toBe(200);
    const h = await read<{ entries: { kind: string; changes: { field: string; before: unknown; after: unknown }[]; reason?: string }[] }>(await HISTORY(json("GET"), ctx(String(a.body.item.id))));
    expect(h.body.entries[0].kind).toBe("item.status");
    expect(h.body.entries[0].changes.find((c) => c.field === "body")).toMatchObject({ before: "A puck that **talks**.", after: "A puck that heckles." });
    expect(h.body.entries.at(-1)!.kind).toBe("item.added");
  });
});

describe("Draft with AI for the story", () => {
  it("says so without a reasoning model", async () => {
    await clearModelRows();
    const r = await run({ projectId: P, generator: "concept-story" });
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("No reasoning model is chosen. Choose one in Admin, Models.");
  });

  it("drafts parts from the rows and the sources' passages, cites the sources, and saves nothing before approval", async () => {
    await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "stand-in-drafter" });
    const src = await addSource(P, "Origin note", "The idea came at a baggage carousel. Every bag went round and the owner wanted his to complain: Wheeee! Again! Again!");
    const sid = src.body.item.id;
    script["concept-story"] = {
      rows: [
        { part: "origin", text: "It began at a carousel.", basedOn: [sid] },
        { part: "voice", text: "Chaotic bag.", examples: [{ text: "Wheeee! Again! Again!", context: "The carousel" }], basedOn: [sid, 999999] },
        { part: "why", text: "Shared misery.", claims: [{ text: "Everyone knows the carousel.", basis: "assumption", sourceIds: [sid, 424242] }], basedOn: [sid] },
        { part: "pitch", text: "A new pitch.", basedOn: [] },
        { part: "origin", text: "A second origin in the same run.", basedOn: [sid] },
      ],
    };
    const r = await run({ projectId: P, generator: "concept-story", params: { focus: "all" } });
    expect(r.status).toBe(201);
    // the prompt carried the passage, headed by the source's id
    const body = JSON.stringify(s.requests.at(-1)?.body);
    expect(body).toContain(`#${sid} Origin note, passage 1`);
    expect(body).toContain("Wheeee! Again! Again!");
    expect(r.body.dropped.map((d) => d.reason)).toEqual(['the part "Where the idea came from" was already drafted in this run']);
    const byPart = new Map(r.body.drafts.map((d) => [String(d.data.part), d]));
    expect(byPart.get("origin")!.sources).toEqual([{ kind: "item", id: sid, title: "Origin note", section: "concept/files" }]);
    expect(byPart.get("origin")!.data.sourceIds).toEqual([sid]);
    expect(byPart.get("voice")!.data.examples).toEqual([{ text: "Wheeee! Again! Again!", context: "The carousel" }]);
    expect((byPart.get("why")!.data.claims as { sourceIds: number[] }[])[0].sourceIds).toEqual([sid]);
    // the existing pitch is proposed as a replacement, not a second pitch
    expect(byPart.get("pitch")!.op).toEqual({ op: "replace", reason: "A new version of this part of the story." });
    expect(await q("SELECT 1 FROM items WHERE project_id=$1 AND section='concept/story' AND data->>'part'='origin'", [P])).toHaveLength(0);

    const ok = await approve(byPart.get("origin")!.id);
    expect(ok.status).toBe(200);
    expect(ok.body.item).toMatchObject({ section: "concept/story", title: "Where the idea came from" });
    const pitch = await approve(byPart.get("pitch")!.id);
    expect(pitch.status).toBe(200);
    const rows = await q<{ body: string }>("SELECT body FROM items WHERE project_id=$1 AND section='concept/story' AND data->>'part'='pitch'", [P]);
    expect(rows).toEqual([{ body: "A new pitch." }]);
    const waiting = await list(P, "&status=draft");
    expect(waiting.body.drafts.filter((d) => d.generator === "concept-story")).toHaveLength(2);
  });

  it("drafts one part when asked for one, and drops the others", async () => {
    script["concept-story"] = { rows: [{ part: "gate", text: "Spend $750 first." }, { part: "who", text: "Flyers." }] };
    const r = await run({ projectId: P, generator: "concept-story", params: { part: "gate" }, supersede: true });
    expect(r.status).toBe(201);
    expect(r.body.drafts.map((d) => d.data.part)).toEqual(["gate"]);
    expect(r.body.dropped[0].reason).toContain("this run was for the part");
    const sys = JSON.stringify(s.requests.at(-1)?.body);
    expect(sys).toContain("Return exactly one row, for part gate.");
  });
});

describe("export, duplicate and delete", () => {
  it("carry the story and the sources with their text", async () => {
    const exp = await EXPORT(json("GET"), ctx(P));
    const doc = (await exp.json()) as { items: { section: string; data: Record<string, unknown> }[]; sourceChunks: { itemId: number; text: string }[]; counts: Record<string, number> };
    expect(doc.items.some((i) => i.section === "concept/story")).toBe(true);
    expect(doc.items.some((i) => i.section === "concept/files")).toBe(true);
    expect(doc.counts.sourceChunks).toBeGreaterThan(0);
    expect(doc.sourceChunks.some((c) => c.text.includes("baggage carousel"))).toBe(true);

    const d = await read<{ project: { id: string } }>(await DUPLICATE(json("POST", { name: `ZZ Story copy ${Date.now()}` }), ctx(P)));
    expect(d.status).toBe(201);
    const copy = d.body.project.id;
    const src = await q<{ id: string }>("SELECT id FROM items WHERE project_id=$1 AND section='concept/files' AND title='Origin note'", [copy]);
    expect(src).toHaveLength(1);
    const copiedText = await q<{ text: string }>("SELECT text FROM source_chunks WHERE item_id=$1", [src[0].id]);
    expect(copiedText[0].text).toContain("baggage carousel");
    const origin = await q<{ data: { sourceIds: number[] } }>("SELECT data FROM items WHERE project_id=$1 AND section='concept/story' AND data->>'part'='origin'", [copy]);
    expect(origin[0].data.sourceIds).toEqual([Number(src[0].id)]);

    const name = (await q<{ name: string }>("SELECT name FROM projects WHERE id=$1", [copy]))[0].name;
    const del = await DELETE_CONCEPT(json("DELETE", { confirm: name }), ctx(copy));
    expect(del.status).toBe(200);
    expect(await q("SELECT 1 FROM source_chunks WHERE project_id=$1", [copy])).toHaveLength(0);
    expect(await q("SELECT 1 FROM items WHERE project_id=$1", [copy])).toHaveLength(0);
  });
});
