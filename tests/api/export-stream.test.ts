// The concept export streams: the document is the same as the one built whole in memory, byte for byte, and the
// bytes of the files are read a slice at a time, so several large files are never all held at once.
import { Client } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { pool, q, tx } from "@/lib/db";
import { EXPORT_FORMAT, loadConceptIn } from "@/lib/api/concepts";
import { EXPORT_SLICE_BYTES } from "@/lib/api/conceptExport";
import { GET as exportProject } from "@/app/api/projects/[id]/export/route";
import { POST as addProject } from "@/app/api/projects/route";
import { ctx, json, read, SEEDED } from "./helpers";

/** The export as it was written before it streamed: everything read whole, then one JSON.stringify. The reference for "identical". */
async function wholeDocument(id: string) {
  return tx(async (c) => {
    await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    const concept = await loadConceptIn(c, id);
    const settings = (await c.query<{ currency: string; sales_regions: string[] }>("SELECT currency, sales_regions FROM projects WHERE id=$1", [id])).rows[0];
    const all = async <T,>(sql: string) => (await c.query<T & Record<string, unknown>>(sql, [id])).rows;
    const items = await all<Record<string, unknown>>(`SELECT id::int AS id, section, title, body, data, status, sort, created_at AS "createdAt", updated_at AS "updatedAt" FROM items WHERE project_id=$1 ORDER BY sort, id`);
    const events = await all<Record<string, unknown>>(`SELECT id::int AS id, kind, summary, data, created_at AS "createdAt" FROM events WHERE project_id=$1 ORDER BY id`);
    const research = await all<Record<string, unknown>>(`SELECT id::int AS id, query, answer, citations, sources, model, created_at AS "createdAt" FROM research WHERE project_id=$1 ORDER BY id`);
    const messages = await all<Record<string, unknown>>(`SELECT id::int AS id, role, content, created_at AS "createdAt" FROM messages WHERE project_id=$1 ORDER BY id`);
    const gates = await all<Record<string, unknown>>(`SELECT stage, status, overridden, note, decided_at AS "decidedAt" FROM gates WHERE project_id=$1 ORDER BY stage`);
    const files = await all<Record<string, unknown>>(`SELECT id::int AS id, name, mime, kind, size, sha256, meta, created_at AS "createdAt", encode(bytes, 'base64') AS "bytesBase64" FROM files WHERE project_id=$1 ORDER BY id`);
    const pins = await all<Record<string, unknown>>(`SELECT id::int AS id, item_id::int AS "itemId", name, kind, side, position, voltage, data, sort FROM pins WHERE project_id=$1 ORDER BY item_id, sort, id`);
    const trackedLinks = await all<Record<string, unknown>>(
      `SELECT id::int AS id, campaign_id::int AS "campaignId", creative_id::int AS "creativeId", creative_label AS "creativeLabel", base_url AS "baseUrl", destination, utm_source AS "utmSource", utm_medium AS "utmMedium", utm_campaign AS "utmCampaign", utm_content AS "utmContent", utm_term AS "utmTerm", code, disabled FROM tracked_links WHERE project_id=$1 ORDER BY id`
    );
    const sourceChunks = await all<Record<string, unknown>>(`SELECT id::int AS id, item_id::int AS "itemId", n, text FROM source_chunks WHERE project_id=$1 ORDER BY item_id, n`);
    for (const f of files) f.bytesBase64 = String(f.bytesBase64).replace(/\n/g, "");
    return JSON.stringify(
      {
        format: EXPORT_FORMAT,
        exportedAt: "T",
        concept: { ...concept, currency: settings.currency, salesRegions: settings.sales_regions },
        counts: { items: items.length, events: events.length, research: research.length, messages: messages.length, gates: gates.length, files: files.length, pins: pins.length, trackedLinks: trackedLinks.length, sourceChunks: sourceChunks.length },
        items, events, research, messages, gates, files, pins, trackedLinks, sourceChunks,
      },
      null,
      2
    );
  });
}

const sameClock = (text: string) => text.replace(/"exportedAt": "[^"]*"/, '"exportedAt": "T"');

async function newConcept(name: string) {
  const r = await read<{ project: { id: string } }>(await addProject(json("POST", { name })));
  return r.body.project.id;
}
const addFile = (project: string, name: string, bytes: Buffer) =>
  q("INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta) VALUES ($1,$2,'application/octet-stream','other',$3,'x',$4,'{}')", [project, name, bytes.length, bytes]);

const made: string[] = [];
afterAll(async () => {
  for (const id of made) await q("DELETE FROM projects WHERE id=$1", [id]);
  await pool().end();
});

describe("the streamed export", () => {
  it("is the same document as the one built whole, for the seeded concept (many files, items, events)", async () => {
    const streamed = sameClock(await (await exportProject(json("GET"), ctx(SEEDED))).text());
    expect(streamed).toBe(await wholeDocument(SEEDED));
  });

  it("is the same document for files at the edges of a slice: empty, one byte, exactly one slice, one over, two and a bit", async () => {
    const id = await newConcept("ZZ Export Stream Edges");
    made.push(id);
    for (const [n, size] of [["empty", 0], ["one", 1], ["slice", EXPORT_SLICE_BYTES], ["slice+1", EXPORT_SLICE_BYTES + 1], ["two+", EXPORT_SLICE_BYTES * 2 + 17]] as const) await addFile(id, `${n}.bin`, randomBytes(size));
    const text = await (await exportProject(json("GET"), ctx(id))).text();
    expect(sameClock(text)).toBe(await wholeDocument(id));
    const doc = JSON.parse(text) as { files: { name: string; size: number; bytesBase64: string }[] };
    expect(doc.files.map((f) => Buffer.from(f.bytesBase64, "base64").length)).toEqual(doc.files.map((f) => f.size));
  });

  it("is the same document for a concept with no files", async () => {
    const id = await newConcept("ZZ Export Stream None");
    made.push(id);
    expect(sameClock(await (await exportProject(json("GET"), ctx(id))).text())).toBe(await wholeDocument(id));
  });

  it("answers 404 before sending anything for an unknown concept", async () => {
    const res = await exportProject(json("GET"), ctx("nope-not-here"));
    expect(res.status).toBe(404);
    expect(res.headers.get("content-disposition")).toBeNull();
  });
});

describe("the files are read a slice at a time", () => {
  const FILES = 6;
  const SIZE = 6 * 1024 * 1024;

  it("never reads a whole file, or all the files, in one statement", async () => {
    const id = await newConcept("ZZ Export Stream Slices");
    made.push(id);
    for (let i = 0; i < FILES; i++) await addFile(id, `big-${i}.bin`, randomBytes(SIZE));
    const seen: { text: string; values: unknown[] }[] = [];
    const real = Client.prototype.query as (...a: unknown[]) => unknown;
    const spy = vi.spyOn(Client.prototype, "query").mockImplementation(function (this: Client, ...args: unknown[]) {
      const a = args[0];
      const text = typeof a === "string" ? a : (a as { text?: string })?.text ?? "";
      if (/\bbytes\b/.test(text)) seen.push({ text, values: (args[1] as unknown[]) ?? [] });
      return real.apply(this, args);
    } as never);
    try {
      const res = await exportProject(json("GET"), ctx(id));
      const reader = res.body!.getReader();
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
      }
      expect(total).toBeGreaterThan(FILES * SIZE * 1.33);
    } finally {
      spy.mockRestore();
    }
    const reads = seen.filter((s) => /FROM files/.test(s.text));
    expect(reads.length).toBeGreaterThanOrEqual(FILES * Math.ceil(SIZE / EXPORT_SLICE_BYTES));
    for (const r of reads) {
      expect(r.text).toMatch(/substring\(bytes FROM \$2 FOR \$3\)/);
      expect(r.text).toMatch(/WHERE id=\$1/);
      expect(r.values[2]).toBe(EXPORT_SLICE_BYTES);
    }
    expect(seen.some((s) => /encode\(bytes/.test(s.text))).toBe(false);
  }, 120_000);

  it("stops reading files when nobody is reading the response (the producer waits, it does not buffer the files)", async () => {
    const id = made[made.length - 1]!; // the six 6 MB files above: 36 MB, 48 slices
    let slices = 0;
    const real = Client.prototype.query as (...a: unknown[]) => unknown;
    const spy = vi.spyOn(Client.prototype, "query").mockImplementation(function (this: Client, ...args: unknown[]) {
      const a = args[0];
      const text = typeof a === "string" ? a : (a as { text?: string })?.text ?? "";
      if (/substring\(bytes/.test(text)) slices++;
      return real.apply(this, args);
    } as never);
    try {
      const res = await exportProject(json("GET"), ctx(id));
      await new Promise((r) => setTimeout(r, 1500)); // nothing is reading the body
      const stalled = slices;
      const total = FILES * Math.ceil(SIZE / EXPORT_SLICE_BYTES);
      // Built whole, or buffered without limit, every slice would have been read by now.
      expect(stalled).toBeLessThan(total / 2);
      await res.body!.cancel();
    } finally {
      spy.mockRestore();
    }
  }, 120_000);
});
