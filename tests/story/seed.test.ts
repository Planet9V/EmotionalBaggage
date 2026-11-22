// The example concept's story and source list: present on a fresh database, and added to a database seeded before
// they existed (the Railway install), once, without touching the example's other rows. The 21 documents of the
// owner's Drive folder come first; the files he added later (manifest entries with addedOn) follow them.
import { afterAll, describe, expect, it } from "vitest";
import { pool, q, ready } from "@/lib/db";
import { SEED_SOURCES, seedStory } from "@/lib/story/seed";
import { addSeedFiles, readManifest, seedFiles, upgradeSeedFiles } from "@/lib/story/seedFiles";
import { STORY_PARTS } from "@/lib/story/parts";

afterAll(async () => {
  await pool().end();
});

const story = () => q<{ id: string; data: { part: string; sourceIds: number[] } }>("SELECT id, data FROM items WHERE project_id='baggage-claims' AND section='concept/story'");
const sources = () => q<{ id: string; title: string; status: string }>("SELECT id, title, status FROM items WHERE project_id='baggage-claims' AND section='concept/files' ORDER BY sort");
/** the 21 of the Drive folder and the files added since */
const ALL = 30;
const LATER = ["pip_clamshell_gen.py", "Part-Material-Why-Cost.csv", "_B.npy", "_T.npy", "BaggageClaims_PiP_Clamshell_RevA_reduced.stl"];
/** the Rev B firmware written for the 2 x AA design (its own batch, 2026-11-22-firmware): not the owner's files */
const FIRMWARE = ["BaggageClaims_MK1_RevB.ino", "bc_detect.h", "bc_detect.cpp", "BaggageClaims_MK1_RevB.partitions.csv"];
const others = async () => (await q<{ n: number }>("SELECT count(*)::int AS n FROM items WHERE project_id='baggage-claims' AND section NOT IN ('concept/story','concept/files')"))[0].n;

describe("the example concept's story", () => {
  it("has every part, the 21 documents and the files added since, each part citing listed sources", async () => {
    await ready();
    const parts = await story();
    expect(parts.map((r) => r.data.part).sort()).toEqual(STORY_PARTS.map((p) => p.key).sort());
    const list = await sources();
    expect(SEED_SOURCES).toHaveLength(21);
    expect(list.map((s) => s.title)).toEqual([...SEED_SOURCES.map((s) => s.title), ...LATER, ...FIRMWARE]);
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
    expect(await sources()).toHaveLength(ALL);
    await seedStory(pool());
    expect(await story()).toHaveLength(STORY_PARTS.length);
    expect(await sources()).toHaveLength(ALL);
    expect(await others()).toBe(before);
    expect((await sources()).every((x) => x.status === "stored")).toBe(true);
    const ev = await q<{ summary: string }>("SELECT summary FROM events WHERE project_id='baggage-claims' AND kind='seed.story'");
    expect(ev).toHaveLength(1);
    expect(ev[0].summary).toContain("9 parts");
  });

  it("stores every listed document as a file, checked against the manifest, in folders, with their text searchable", async () => {
    const manifest = (await readManifest())!;
    expect(manifest).toHaveLength(ALL);
    expect(manifest.filter((m) => m.addedOn).map((m) => m.title)).toEqual([...LATER, ...FIRMWARE]);
    // nothing listed is over what the file store takes
    expect(manifest.every((m) => m.size <= 25 * 1024 * 1024)).toBe(true);
    const rows = await q<{ title: string; data: { fileId: number; folder: string; chunks: number }; sha256: string; size: number }>(
      "SELECT i.title, i.data, f.sha256, f.size FROM items i JOIN files f ON f.id = (i.data->>'fileId')::bigint WHERE i.project_id='baggage-claims' AND i.section='concept/files'"
    );
    expect(rows).toHaveLength(ALL);
    for (const m of manifest) {
      const r = rows.find((x) => x.title === m.title)!;
      expect(r, m.title).toBeTruthy();
      expect(r.sha256).toBe(m.sha256);
      expect(r.size).toBe(m.size);
      expect(r.data.folder).toBe(m.folder);
    }
    expect(rows.filter((r) => r.data.chunks > 0)).toHaveLength(26); // no text: the schematic (an image), the two voxel arrays and the STL
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
    expect((await q("SELECT 1 FROM files WHERE project_id='baggage-claims' AND kind='source'")).length).toBe(ALL);
    expect(await q("SELECT 1 FROM events WHERE project_id='baggage-claims' AND kind='seed.files'")).toHaveLength(1);
    // the story still cites the same rows
    const pitch = await q<{ data: { sourceIds: number[] } }>("SELECT data FROM items WHERE id=$1", [story[0].id]);
    expect(pitch[0].data.sourceIds.every((id) => ids.includes(String(id)))).toBe(true);
  });
  it("brings an install seeded with the preview copies up to the originals, once, keeping each copy as an earlier version", async () => {
    await ready();
    const manifest = (await readManifest())!;
    const swapped = manifest.filter((m) => m.replacedCopySha256);
    expect(swapped).toHaveLength(16);
    // as an install seeded with the copies: every swapped file holds other bytes under the copy's sha256, and one was replaced by hand
    await q("DELETE FROM events WHERE project_id='baggage-claims' AND kind='seed.files.originals'");
    for (const m of swapped) {
      await q("UPDATE files f SET sha256=$2, bytes=convert_to('a preview copy','UTF8'), size=14, name=$3 FROM items i WHERE f.id=(i.data->>'fileId')::bigint AND i.project_id='baggage-claims' AND i.section='concept/files' AND i.title=$1", [m.title, m.replacedCopySha256, `${m.title}.txt`]);
    }
    const byHand = swapped[0];
    await q("UPDATE files f SET meta='{\"source\":true}' FROM items i WHERE f.id=(i.data->>'fileId')::bigint AND i.project_id='baggage-claims' AND i.section='concept/files' AND i.title=$1", [byHand.title]);
    await upgradeSeedFiles(pool());
    await upgradeSeedFiles(pool());
    const rows = await q<{ title: string; data: { fileName: string; versions?: { sha256?: string }[]; extract: { method: string } }; sha256: string; mime: string }>(
      "SELECT i.title, i.data, f.sha256, f.mime FROM items i JOIN files f ON f.id = (i.data->>'fileId')::bigint WHERE i.project_id='baggage-claims' AND i.section='concept/files'"
    );
    expect(rows).toHaveLength(ALL);
    for (const m of swapped.slice(1)) {
      const r = rows.find((x) => x.title === m.title)!;
      expect(r.sha256, m.title).toBe(m.sha256);
      expect(r.data.fileName).toBe(m.file);
      expect(r.data.versions?.[0]?.sha256).toBe(m.replacedCopySha256);
    }
    expect(rows.find((x) => x.title === byHand.title)!.sha256).toBe(byHand.replacedCopySha256);
    const pdfs = rows.filter((r) => r.title.endsWith(".pdf") && r.title !== byHand.title);
    expect(pdfs.length).toBeGreaterThan(0);
    expect(pdfs.every((r) => r.mime === "application/pdf" && r.data.extract.method === "pdf")).toBe(true);
    const ev = await q<{ summary: string }>("SELECT summary FROM events WHERE project_id='baggage-claims' AND kind='seed.files.originals'");
    expect(ev).toHaveLength(1);
    expect(ev[0].summary).toContain("15 preview copies");
  });

  it("adds the files the owner supplied later to an install seeded before them, once, and stores nothing twice", async () => {
    await ready();
    const manifest = (await readManifest())!;
    const later = manifest.filter((m) => m.addedOn === "2026-11-22");
    const added = () => q<{ summary: string; data: { batch: string; added: number } }>("SELECT summary, data FROM events WHERE project_id='baggage-claims' AND kind='seed.files.added' ORDER BY id");
    const remove = async (titles: string[]) => {
      await q("DELETE FROM files f USING items i WHERE f.id=(i.data->>'fileId')::bigint AND i.project_id='baggage-claims' AND i.section='concept/files' AND i.title = ANY($1)", [titles]);
      await q("DELETE FROM items WHERE project_id='baggage-claims' AND section='concept/files' AND title = ANY($1)", [titles]);
    };
    // every start marks the batch, whether the files came with the first set-up or were added afterwards
    expect((await added()).some((e) => e.data.batch === "2026-11-22")).toBe(true);
    const before = await others();
    const first21 = (await sources()).filter((s) => !LATER.includes(s.title)).map((s) => s.id);

    // as an install seeded with the 21 documents only
    await remove(LATER);
    await q("DELETE FROM events WHERE project_id='baggage-claims' AND kind='seed.files.added'");
    expect(await sources()).toHaveLength(21 + FIRMWARE.length);
    await addSeedFiles(pool());
    await addSeedFiles(pool());
    // one marker per batch: the owner's five files, and the firmware (already there, so nothing added)
    expect(await added()).toHaveLength(2);
    expect((await added())[1]).toMatchObject({ data: { batch: "2026-11-22-firmware", added: 0 } });
    expect((await added())[0]).toMatchObject({ data: { batch: "2026-11-22", added: 5 } });
    const rows = await q<{ title: string; status: string; data: { folder: string; chunks: number; mime: string; origin: string; extract: { method: string } }; sha256: string; size: number; meta: { seed?: boolean; addedOn?: string } }>(
      "SELECT i.title, i.status, i.data, f.sha256, f.size, f.meta FROM items i JOIN files f ON f.id = (i.data->>'fileId')::bigint WHERE i.project_id='baggage-claims' AND i.section='concept/files' AND i.title = ANY($1)",
      [LATER]
    );
    expect(rows).toHaveLength(5);
    for (const m of later) {
      const r = rows.find((x) => x.title === m.title)!;
      expect(r.sha256, m.title).toBe(m.sha256);
      expect(r.size).toBe(m.size);
      expect(r.status).toBe("stored");
      expect(r.data.folder).toBe("Design and build");
      expect(r.data.origin).toBe(m.origin);
      expect(r.meta).toMatchObject({ seed: true, addedOn: "2026-11-22" });
    }
    const by = (t: string) => rows.find((r) => r.title === t)!;
    expect(by("pip_clamshell_gen.py").data.extract.method).toBe("text");
    expect(by("Part-Material-Why-Cost.csv").data.mime).toBe("text/csv");
    for (const t of ["_B.npy", "_T.npy"]) expect(by(t).data).toMatchObject({ chunks: 0, mime: "application/octet-stream", extract: { method: "binary" } });
    expect(by("BaggageClaims_PiP_Clamshell_RevA_reduced.stl").data).toMatchObject({ chunks: 0, mime: "model/stl", extract: { method: "binary" } });
    expect((await q("SELECT 1 FROM source_chunks WHERE project_id='baggage-claims' AND text LIKE '%marching_cubes%'")).length).toBeGreaterThan(0);
    // the 21 and the example's other rows are as they were
    expect((await sources()).filter((s) => !LATER.includes(s.title)).map((s) => s.id)).toEqual(first21);
    expect(await others()).toBe(before);

    // one of them was already uploaded by hand before the batch arrived: it is left alone and the rest are added
    await remove(LATER.slice(1));
    await q("DELETE FROM events WHERE project_id='baggage-claims' AND kind='seed.files.added'");
    const kept = (await sources()).find((s) => s.title === LATER[0])!.id;
    await addSeedFiles(pool());
    expect((await added())[0].data.added).toBe(4);
    const titles = (await sources()).map((s) => s.title);
    expect(titles).toHaveLength(ALL);
    expect(new Set(titles).size).toBe(ALL);
    expect((await sources()).find((s) => s.title === LATER[0])!.id).toBe(kept);
    expect((await q("SELECT 1 FROM files WHERE project_id='baggage-claims' AND kind='source' AND name = ANY($1)", [LATER])).length).toBe(5);

    // a file someone removes afterwards does not come back at the next start
    await remove([LATER[1]]);
    await addSeedFiles(pool());
    expect(await sources()).toHaveLength(ALL - 1);
    // put it back for the tests that follow
    await q("DELETE FROM events WHERE project_id='baggage-claims' AND kind='seed.files.added'");
    await addSeedFiles(pool());
    expect(await sources()).toHaveLength(ALL);
  });

  it("names the STL as a reduced copy and records the original it was made from", async () => {
    const manifest = JSON.parse(await (await import("node:fs/promises")).readFile("seed/concepts/baggage-claims/manifest.json", "utf8")) as { note: string; files: { file: string; size: number; what: string; origin?: string; reducedFrom?: { file: string; size: number; sha256: string } }[] };
    const stl = manifest.files.filter((f) => f.file.toLowerCase().endsWith(".stl"));
    expect(stl.map((f) => f.file)).toEqual(["BaggageClaims_PiP_Clamshell_RevA_reduced.stl"]);
    expect(stl[0].size).toBeLessThan(25 * 1024 * 1024);
    expect(stl[0].what).toMatch(/reduced copy/);
    expect(stl[0].reducedFrom).toMatchObject({ file: "BaggageClaims_PiP_Clamshell_RevA.stl", size: 121253284, sha256: "0a97e63db654dccbca84a77c20b9a9989fafbf39255bc449fca2364f5901ecec" });
    for (const text of [manifest.note, stl[0].origin ?? ""]) {
      expect(text).toContain("121,253,284 bytes");
      expect(text).toContain("0a97e63db654dccbca84a77c20b9a9989fafbf39255bc449fca2364f5901ecec");
    }
    // a binary STL of the length its header states
    const bytes = await (await import("node:fs/promises")).readFile(`seed/concepts/baggage-claims/files/${stl[0].file}`);
    expect(bytes.length).toBe(84 + 50 * bytes.readUInt32LE(80));
    expect(bytes.subarray(0, 80).toString("latin1")).toMatch(/REDUCED COPY/);
  });
});
