// The example concept's story and source list: present on a fresh database, and added to a database seeded before
// they existed (the Railway install), once, without touching the example's other rows.
import { afterAll, describe, expect, it } from "vitest";
import { pool, q, ready } from "@/lib/db";
import { SEED_SOURCES, seedStory } from "@/lib/story/seed";
import { readManifest, seedFiles } from "@/lib/story/seedFiles";
import { STORY_PARTS } from "@/lib/story/parts";

afterAll(async () => {
  await pool().end();
});

const story = () => q<{ id: string; data: { part: string; sourceIds: number[] } }>("SELECT id, data FROM items WHERE project_id='baggage-claims' AND section='concept/story'");
const sources = () => q<{ id: string; title: string; status: string }>("SELECT id, title, status FROM items WHERE project_id='baggage-claims' AND section='concept/files' ORDER BY sort");
const others = async () => (await q<{ n: number }>("SELECT count(*)::int AS n FROM items WHERE project_id='baggage-claims' AND section NOT IN ('concept/story','concept/files')"))[0].n;

describe("the example concept's story", () => {
  it("has every part and the 21 documents, each part citing listed sources", async () => {
    await ready();
    const parts = await story();
    expect(parts.map((r) => r.data.part).sort()).toEqual(STORY_PARTS.map((p) => p.key).sort());
    const list = await sources();
    expect(list.map((s) => s.title)).toEqual(SEED_SOURCES.map((s) => s.title));
    expect(list.every((s) => s.status === "stored")).toBe(true);
    const ids = new Set(list.map((s) => Number(s.id)));
    for (const r of parts) expect(r.data.sourceIds.length > 0 && r.data.sourceIds.every((id) => ids.has(id))).toBe(true);
  });

  it("is added to a database seeded before it existed, once, and leaves the other rows alone", async () => {
    await ready();
    const before = await others();
    // the state of an install seeded before this change: no story, no sources, no marker
    await q("DELETE FROM items WHERE project_id='baggage-claims' AND section IN ('concept/story','concept/files')");
    await q("DELETE FROM events WHERE project_id='baggage-claims' AND kind IN ('seed.story','seed.files')");
    await q("DELETE FROM files WHERE project_id='baggage-claims' AND kind='source'");
    expect(await story()).toHaveLength(0);
    await seedStory(pool());
    await seedFiles(pool());
    expect(await story()).toHaveLength(STORY_PARTS.length);
    expect(await sources()).toHaveLength(21);
    await seedStory(pool());
    expect(await story()).toHaveLength(STORY_PARTS.length);
    expect(await sources()).toHaveLength(21);
    expect(await others()).toBe(before);
    expect((await sources()).every((x) => x.status === "stored")).toBe(true);
    const ev = await q<{ summary: string }>("SELECT summary FROM events WHERE project_id='baggage-claims' AND kind='seed.story'");
    expect(ev).toHaveLength(1);
    expect(ev[0].summary).toContain("9 parts");
  });

  it("stores all 21 documents as files, checked against the manifest, in folders, with their text searchable", async () => {
    const manifest = (await readManifest())!;
    expect(manifest).toHaveLength(21);
    const rows = await q<{ title: string; data: { fileId: number; folder: string; chunks: number }; sha256: string; size: number }>(
      "SELECT i.title, i.data, f.sha256, f.size FROM items i JOIN files f ON f.id = (i.data->>'fileId')::bigint WHERE i.project_id='baggage-claims' AND i.section='concept/files'"
    );
    expect(rows).toHaveLength(21);
    for (const m of manifest) {
      const r = rows.find((x) => x.title === m.title)!;
      expect(r, m.title).toBeTruthy();
      expect(r.sha256).toBe(m.sha256);
      expect(r.size).toBe(m.size);
      expect(r.data.folder).toBe(m.folder);
    }
    expect(rows.filter((r) => r.data.chunks > 0)).toHaveLength(20); // the schematic is an image: no text
    const hits = await q("SELECT 1 FROM source_chunks WHERE project_id='baggage-claims' AND search @@ to_tsquery('english', 'gxDump')");
    expect(hits.length).toBeGreaterThan(0);
  });

  it("loads the files into a database seeded before they existed, once", async () => {
    await ready();
    const story = await q<{ id: string }>("SELECT id FROM items WHERE project_id='baggage-claims' AND section='concept/story' AND data->>'part'='pitch'");
    const ids = (await q<{ id: string }>("SELECT id FROM items WHERE project_id='baggage-claims' AND section='concept/files'")).map((r) => r.id);
    // as an install that had the story and the list but no files
    await q("DELETE FROM files WHERE project_id='baggage-claims' AND kind='source'");
    await q("UPDATE items SET data = data - 'fileId' - 'chunks' - 'folder', status='not uploaded' WHERE project_id='baggage-claims' AND section='concept/files'");
    await q("DELETE FROM source_chunks WHERE project_id='baggage-claims'");
    await q("DELETE FROM events WHERE project_id='baggage-claims' AND kind='seed.files'");
    await seedFiles(pool());
    await seedFiles(pool());
    const after = await q<{ id: string; status: string }>("SELECT id, status FROM items WHERE project_id='baggage-claims' AND section='concept/files'");
    expect(after.map((r) => r.id).sort()).toEqual(ids.sort());
    expect(after.every((r) => r.status === "stored")).toBe(true);
    expect((await q("SELECT 1 FROM files WHERE project_id='baggage-claims' AND kind='source'")).length).toBe(21);
    expect(await q("SELECT 1 FROM events WHERE project_id='baggage-claims' AND kind='seed.files'")).toHaveLength(1);
    // the story still cites the same rows
    const pitch = await q<{ data: { sourceIds: number[] } }>("SELECT data FROM items WHERE id=$1", [story[0].id]);
    expect(pitch[0].data.sourceIds.every((id) => ids.includes(String(id)))).toBe(true);
  });
});
