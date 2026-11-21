// The concept's Sources, through the routes on a real PostgreSQL: upload (Markdown, PDF, pasted text), what is
// refused, the passages and their word search, chat citing a source by title, search by meaning with the stand-in
// embedding model, reading again, citations, filling in a listed source, and removal with its history.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q, ready } from "@/lib/db";
import { GET as LIST, POST as ADD } from "@/app/api/projects/[id]/sources/route";
import { GET as ONE, DELETE as REMOVE } from "@/app/api/projects/[id]/sources/[sourceId]/route";
import { POST as REINDEX } from "@/app/api/projects/[id]/sources/[sourceId]/reindex/route";
import { POST as VERSION } from "@/app/api/projects/[id]/sources/[sourceId]/version/route";
import { GET as FILE } from "@/app/api/files/[id]/route";
import { GET as SEARCH } from "@/app/api/search/route";
import { searchSourcesByMeaning, searchSourcesByText, meaningReady } from "@/lib/ai/embeddings";
import { numberSources, retrieve } from "@/lib/chat/server";
import { chunkText, MAX_CHARS } from "@/lib/sources/chunk";
import { relevantPassages } from "@/lib/sources/store";
import { form, json, read } from "../api/helpers";
import { start, type OpenAIOptions } from "../standins/openai";
import type { StandIn } from "../standins/core";
import { chooseEmbedding, clearModelRows } from "../ai/setup";
import type { Item } from "@/lib/types";

const P = "zz-sources";
type Change = { item: Item; chunks: number; index: { ok: boolean; reason?: string; indexed?: number }; error?: string };
const pctx = (sourceId?: number) => ({ params: Promise.resolve({ id: P, sourceId: String(sourceId ?? "") }) });
const url = `http://test.local/api/projects/${P}/sources`;

function upload(name: string, type: string, content: string | Uint8Array<ArrayBuffer>, fields: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append("file", new Blob([content], { type }), name);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return ADD(form("POST", fd, url), pctx()).then((r) => read<Change>(r));
}

/** A one-page PDF with a real text layer, offsets worked out so the cross-reference table is right. */
function tinyPdf(line: string): Uint8Array<ArrayBuffer> {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 18 Tf 72 720 Td (${line}) Tj ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

const MD = `# Origin story

The idea came from a carousel at a small airport, where every bag went round and nobody laughed.

## The quokka gate

Before any money is spent, a short film must reach fifty thousand views. That is the quokka gate.`;

let s: StandIn<OpenAIOptions>;

beforeAll(async () => {
  await ready();
  await clearModelRows();
  s = await start({ prefix: "/v1" });
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await q("INSERT INTO projects (id, name, one_liner) VALUES ($1, 'ZZ Sources', 'A suitcase that talks')", [P]);
});

afterAll(async () => {
  await clearModelRows();
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await s.close();
  await pool().end();
});

describe("chunking", () => {
  it("keeps every word once, in order, and no passage passes the limit", () => {
    const para = (n: number) => Array.from({ length: n }, (_, i) => `Sentence ${i} of a long paragraph.`).join(" ");
    const text = [para(10), para(200), "short", para(3)].join("\n\n");
    const parts = chunkText(text);
    expect(parts.every((p) => p.length <= MAX_CHARS)).toBe(true);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " "));
    expect(chunkText("  \n\n ")).toEqual([]);
  });
});

describe("adding sources", () => {
  let mdId = 0;

  it("stores a Markdown file: its row, its file, its passages, and the change in the history", async () => {
    const r = await upload("origin.md", "text/markdown", MD, { what: "Where the idea came from", origin: "A notebook" });
    expect(r.status).toBe(201);
    mdId = r.body.item.id;
    expect(r.body.item).toMatchObject({ section: "concept/files", title: "origin.md", status: "stored", body: "Where the idea came from" });
    expect(r.body.item.data).toMatchObject({ kind: "document", origin: "A notebook", fileName: "origin.md", mime: "text/markdown", addedBy: "demo", chunks: r.body.chunks });
    expect(r.body.chunks).toBeGreaterThan(0);
    // no embedding model chosen: the answer says so, and words still find it
    expect(r.body.index.ok).toBe(false);
    const ev = await q<{ kind: string; summary: string; data: Record<string, unknown> }>("SELECT kind, summary, data FROM events WHERE project_id=$1 ORDER BY id DESC LIMIT 1", [P]);
    expect(ev[0].kind).toBe("item.added");
    expect(ev[0].summary).toContain('Added the source "origin.md"');
    expect((ev[0].data.after as Record<string, unknown>).title).toBe("origin.md");
    const audit = await q("SELECT 1 FROM audit_log WHERE project_id=$1 AND action='item.added' AND summary LIKE '%origin.md%' AND at > now() - interval '1 minute'", [P]);
    expect(audit.length).toBeGreaterThanOrEqual(1);
    const file = await q<{ name: string; kind: string }>("SELECT name, kind FROM files WHERE id=$1", [r.body.item.data.fileId]);
    expect(file[0]).toEqual({ name: "origin.md", kind: "source" });
  });

  it("reads the text layer of a PDF", async () => {
    const r = await upload("plan.pdf", "application/pdf", tinyPdf("Proof of funny before Kickstarter"));
    expect(r.status).toBe(201);
    expect(r.body.item.data).toMatchObject({ mime: "application/pdf", extract: { method: "pdf" } });
    const one = await read<{ text: string }>(await ONE(json("GET"), pctx(r.body.item.id)));
    expect(one.body.text).toContain("Proof of funny before Kickstarter");
    expect(one.body.text).toContain("[Page 1 of 1]");
  });

  it("stores pasted text as a source with a .txt file", async () => {
    const r = await read<Change>(await ADD(json("POST", { title: "Chat with the naming assistant", text: "Sass Case edges out Baggage Claims for retail.", kind: "chat", origin: "A chat" }, url), pctx()));
    expect(r.status).toBe(201);
    expect(r.body.item.data).toMatchObject({ kind: "chat", fileName: "Chat with the naming assistant.txt", extract: { method: "pasted" } });
  });

  it("refuses Word files and empty pastes with a sentence, and keeps an image with no text", async () => {
    const w = await upload("brief.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "PK");
    expect(w.status).toBe(415);
    expect(w.body.error).toContain("Save it as PDF");
    const e = await read<Change>(await ADD(json("POST", { title: "Empty", text: " " }, url), pctx()));
    expect(e.status).toBe(400);
    const img = await upload("schematic.png", "image/png", new Uint8Array([137, 80, 78, 71]));
    expect(img.status).toBe(201);
    expect(img.body.item.status).toBe("stored");
    expect(img.body.chunks).toBe(0);
    expect(String(img.body.item.data.extract && (img.body.item.data.extract as { note?: string }).note)).toContain("no text");
  });

  it("finds a source's passages by words, and chat cites it by its title (no embedding model: text search)", async () => {
    const hits = await searchSourcesByText(P, "What is the quokka gate?", 8);
    const hit = hits.find((h) => h.kind === "source");
    expect(hit && hit.kind === "source" && hit.item.title).toBe("origin.md");
    const numbered = numberSources(hits);
    expect(numbered.find((n) => n.title.startsWith("origin.md, passage"))).toMatchObject({ kind: "item", section: "concept/files" });
    const r = await retrieve(P, "What is the quokka gate?");
    expect(r.retrieval).toBe("text");
    expect(r.sources.some((x) => x.title.startsWith("origin.md") && x.text.includes("quokka"))).toBe(true);
    const search = await read<{ items: Item[] }>(await SEARCH(json("GET", undefined, `http://t/api/search?projectId=${P}&q=quokka`)));
    expect(search.body.items.map((i) => i.title)).toContain("origin.md");
  });

  it("gives drafting the relevant passages only, within the size cap", async () => {
    const ps = await relevantPassages(P, "the quokka gate views", { limit: 2, maxChars: 300 });
    expect(ps.length).toBeGreaterThan(0);
    expect(ps.length).toBeLessThanOrEqual(2);
    expect(ps.reduce((a, p) => a + p.text.length, 0)).toBeLessThanOrEqual(300);
    expect(ps[0].title).toBe("origin.md");
  });

  it("indexes passages for search by meaning when an embedding model is chosen", async () => {
    if (!(await q("SELECT 1 FROM pg_extension WHERE extname='vector'")).length) return;
    await chooseEmbedding({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "stand-in-embed", dims: 8 });
    const r = await read<Change>(await REINDEX(json("POST"), pctx(mdId)));
    expect(r.status).toBe(200);
    expect(r.body.index).toMatchObject({ ok: true });
    const n = await q<{ n: number }>("SELECT count(*)::int AS n FROM embeddings e JOIN source_chunks c ON c.id = e.chunk_id WHERE c.item_id=$1", [mdId]);
    expect(n[0].n).toBe(r.body.chunks);
    const ready2 = await meaningReady(P);
    expect(ready2.ok).toBe(true);
    if (!ready2.ok) return;
    const m = await searchSourcesByMeaning(P, MD.split("\n\n")[1], 5, { use: ready2.emb });
    expect(m.hits.some((h) => h.kind === "source" && h.item.id === mdId)).toBe(true);
    const ev = await q<{ summary: string }>("SELECT summary FROM events WHERE project_id=$1 AND kind='item.edited' ORDER BY id DESC LIMIT 1", [P]);
    expect(ev[0].summary).toContain("Read the source \"origin.md\" again");
    await chooseEmbedding(null);
  });
});

describe("the file manager", () => {
  it("files into folders, finds files by name and by content, keeps earlier versions, and previews PDFs inline", async () => {
    const a = await upload("notes-v1.txt", "text/plain", "The carousel ride is the best part.", { folder: "Marketing and launch" });
    expect(a.body.item.data.folder).toBe("Marketing and launch");
    const byName = await read<{ sources: { item: Item }[] }>(await LIST(json("GET", undefined, `${url}?q=notes-v1`), pctx()));
    expect(byName.body.sources.map((x) => x.item.id)).toEqual([a.body.item.id]);
    const byText = await read<{ sources: { item: Item }[] }>(await LIST(json("GET", undefined, `${url}?q=carousels`), pctx()));
    expect(byText.body.sources.map((x) => x.item.id)).toContain(a.body.item.id);

    const fd = new FormData();
    fd.append("file", new Blob(["The tarmac cart is the best part now."], { type: "text/plain" }), "notes-v2.txt");
    const v = await read<Change>(await VERSION(form("POST", fd, `${url}/${a.body.item.id}/version`), pctx(a.body.item.id)));
    expect(v.status).toBe(200);
    expect(v.body.item.id).toBe(a.body.item.id);
    expect(v.body.item.data).toMatchObject({ fileName: "notes-v2.txt", folder: "Marketing and launch" });
    const versions = v.body.item.data.versions as { fileId: number; fileName: string; replacedBy: string }[];
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ fileId: a.body.item.data.fileId, fileName: "notes-v1.txt", replacedBy: "demo" });
    expect(await q("SELECT 1 FROM files WHERE id=$1", [versions[0].fileId])).toHaveLength(1);
    const text = await read<{ text: string }>(await ONE(json("GET"), pctx(a.body.item.id)));
    expect(text.body.text).toBe("The tarmac cart is the best part now.");
    const ev = await q<{ summary: string }>("SELECT summary FROM events WHERE project_id=$1 ORDER BY id DESC LIMIT 1", [P]);
    expect(ev[0].summary).toContain("with a new version (notes-v2.txt); the earlier one is kept");

    // removing the file removes every version
    await REMOVE(json("DELETE", {}), pctx(a.body.item.id));
    expect(await q("SELECT 1 FROM files WHERE id = ANY($1)", [[versions[0].fileId, v.body.item.data.fileId]])).toHaveLength(0);

    const pdf = await upload("inline.pdf", "application/pdf", tinyPdf("Inline"));
    const fid = pdf.body.item.data.fileId as number;
    const inline = await FILE(json("GET", undefined, `http://t/api/files/${fid}?inline=1`), { params: Promise.resolve({ id: String(fid) }) });
    expect(inline.headers.get("content-disposition")).toMatch(/^inline;/);
    const txt = await upload("x.md", "text/markdown", "# x");
    const tid = txt.body.item.data.fileId as number;
    const asked = await FILE(json("GET", undefined, `http://t/api/files/${tid}?inline=1`), { params: Promise.resolve({ id: String(tid) }) });
    expect(asked.headers.get("content-disposition")).toMatch(/^attachment;/);
  });
});

describe("citations, filling in and removal", () => {
  it("lists what cites a source, fills in a listed source by file name, and removes a source with its history", async () => {
    // a source named but not stored (as the example lists its documents)
    const listed = await q<{ id: string }>(
      "INSERT INTO items (project_id, section, title, body, data, status) VALUES ($1,'concept/files','Plan.pdf','The plan','{\"kind\":\"document\",\"fileName\":\"Plan.pdf\",\"fileId\":null}','not uploaded') RETURNING id",
      [P]
    );
    const listedId = Number(listed[0].id);
    const story = await q<{ id: string }>(
      "INSERT INTO items (project_id, section, title, body, data, status) VALUES ($1,'concept/story','The pitch','x',$2,'written') RETURNING id",
      [P, JSON.stringify({ part: "pitch", sourceIds: [listedId] })]
    );
    const storyId = Number(story[0].id);

    let l = await read<{ sources: { item: Item; citedBy: { itemId: number; how: string }[] }[] }>(await LIST(json("GET"), pctx()));
    expect(l.body.sources.find((x) => x.item.id === listedId)?.citedBy).toEqual([{ itemId: storyId, title: "The pitch", section: "concept/story", how: "cites" }]);

    // a text copy named "Plan.pdf.txt" fills in "Plan.pdf": same row, so the pitch still cites it
    const filled = await upload("Plan.pdf.txt", "text/plain", "The plan, as text.");
    expect(filled.status).toBe(201);
    expect(filled.body.item.id).toBe(listedId);
    expect(filled.body.item).toMatchObject({ title: "Plan.pdf", status: "stored", body: "The plan" });
    const ev = await q<{ kind: string; summary: string }>("SELECT kind, summary FROM events WHERE project_id=$1 ORDER BY id DESC LIMIT 1", [P]);
    expect(ev[0]).toMatchObject({ kind: "item.edited" });
    expect(ev[0].summary).toContain("Stored the file for the source");

    const fileId = filled.body.item.data.fileId as number;
    const gone = await read<{ ok: boolean; uncited: number; fileRemoved: boolean }>(await REMOVE(json("DELETE", { why: "Superseded by Rev B" }), pctx(listedId)));
    expect(gone.body).toEqual({ ok: true, uncited: 1, fileRemoved: true });
    expect(await q("SELECT 1 FROM items WHERE id=$1", [listedId])).toHaveLength(0);
    expect(await q("SELECT 1 FROM source_chunks WHERE item_id=$1", [listedId])).toHaveLength(0);
    expect(await q("SELECT 1 FROM files WHERE id=$1", [fileId])).toHaveLength(0);
    const pitch = await q<{ data: { sourceIds: number[] } }>("SELECT data FROM items WHERE id=$1", [storyId]);
    expect(pitch[0].data.sourceIds).toEqual([]);
    const removed = await q<{ summary: string; data: { reason?: string; before?: Record<string, unknown> } }>("SELECT summary, data FROM events WHERE project_id=$1 AND kind='item.removed' ORDER BY id DESC LIMIT 1", [P]);
    expect(removed[0].summary).toBe('Removed the source "Plan.pdf" and its file');
    expect(removed[0].data.reason).toBe("Superseded by Rev B");
    expect(removed[0].data.before?.title).toBe("Plan.pdf");
    const uncited = await q("SELECT 1 FROM events WHERE project_id=$1 AND kind='item.edited' AND summary LIKE '%no longer cites%'", [P]);
    expect(uncited).toHaveLength(1);

    const missing = await read(await REMOVE(json("DELETE"), pctx(listedId)));
    expect(missing.status).toBe(404);
    l = await read(await LIST(json("GET"), pctx()));
    expect(l.body.sources.some((x) => x.item.id === listedId)).toBe(false);
  });
});
