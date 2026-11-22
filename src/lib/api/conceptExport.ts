// The concept export, written to a stream: the same JSON document as before, byte for byte, but the bytes of the
// Files store are read from PostgreSQL one slice at a time and written out as they are encoded, so a concept with
// many large files never holds them all in memory. Everything else in the document is small text and is read whole.
import type { PoolClient } from "pg";
import { tx } from "@/lib/db";
import { EXPORT_FORMAT, loadConceptIn } from "./concepts";

/**
 * How many bytes of a file are read and encoded at a time. A multiple of 3, so each slice encodes to base64 with no
 * padding and the slices join into exactly the text one encoding of the whole file would give.
 */
export const EXPORT_SLICE_BYTES = 3 * 256 * 1024;

const pretty = (v: unknown) => JSON.stringify(v, null, 2);
/** `JSON.stringify(v, null, 2)` for a value nested `depth` levels deep: every line after the first is indented. */
const nested = (v: unknown, depth: number) => pretty(v).split("\n").join("\n" + "  ".repeat(depth));

type Row = Record<string, unknown>;

/** Reads the concept in one repeatable-read transaction and hands the document to `write`, piece by piece. */
async function writeDocument(c: PoolClient, id: string, write: (s: string) => Promise<void>, ready: () => void) {
  await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
  const concept = await loadConceptIn(c, id);
  const settings = (await c.query<{ currency: string; sales_regions: string[] }>("SELECT currency, sales_regions FROM projects WHERE id=$1", [id])).rows[0];
  const all = async (sql: string) => (await c.query<Row>(sql, [id])).rows;
  const items = await all(
    `SELECT id::int AS id, section, title, body, data, status, sort, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM items WHERE project_id=$1 ORDER BY sort, id`
  );
  const events = await all(`SELECT id::int AS id, kind, summary, data, created_at AS "createdAt" FROM events WHERE project_id=$1 ORDER BY id`);
  const research = await all(`SELECT id::int AS id, query, answer, citations, sources, model, created_at AS "createdAt" FROM research WHERE project_id=$1 ORDER BY id`);
  const messages = await all(`SELECT id::int AS id, role, content, created_at AS "createdAt" FROM messages WHERE project_id=$1 ORDER BY id`);
  const gates = await all(`SELECT stage, status, overridden, note, decided_at AS "decidedAt" FROM gates WHERE project_id=$1 ORDER BY stage`);
  // The files' own fields only: their bytes are read below, one slice at a time.
  const files = await all(`SELECT id::int AS id, name, mime, kind, size, sha256, meta, created_at AS "createdAt" FROM files WHERE project_id=$1 ORDER BY id`);
  // Pins belong to part rows (plan 5.1); `itemId` is the part's id in `items` above.
  const pins = await all(`SELECT id::int AS id, item_id::int AS "itemId", name, kind, side, position, voltage, data, sort FROM pins WHERE project_id=$1 ORDER BY item_id, sort, id`);
  // Tracked links as set up; `campaignId` and `creativeId` are ids in `items` above. Clicks are results and stay out.
  const trackedLinks = await all(
    `SELECT id::int AS id, campaign_id::int AS "campaignId", creative_id::int AS "creativeId", creative_label AS "creativeLabel", base_url AS "baseUrl", destination,
            utm_source AS "utmSource", utm_medium AS "utmMedium", utm_campaign AS "utmCampaign", utm_content AS "utmContent", utm_term AS "utmTerm", code, disabled
       FROM tracked_links WHERE project_id=$1 ORDER BY id`
  );
  // The text of each source, cut into passages (migration 0029); `itemId` is the source's id in `items` above.
  const sourceChunks = await all(`SELECT id::int AS id, item_id::int AS "itemId", n, text FROM source_chunks WHERE project_id=$1 ORDER BY item_id, n`);
  // Everything that can refuse (an unknown concept) has been read: the response may start.
  ready();

  const head: [string, unknown][] = [
    ["format", EXPORT_FORMAT],
    ["exportedAt", new Date().toISOString()],
    ["concept", { ...concept, currency: settings.currency, salesRegions: settings.sales_regions }],
    ["counts", { items: items.length, events: events.length, research: research.length, messages: messages.length, gates: gates.length, files: files.length, pins: pins.length, trackedLinks: trackedLinks.length, sourceChunks: sourceChunks.length }],
    ["items", items],
    ["events", events],
    ["research", research],
    ["messages", messages],
    ["gates", gates],
  ];
  const tail: [string, unknown][] = [["pins", pins], ["trackedLinks", trackedLinks], ["sourceChunks", sourceChunks]];
  const entry = ([k, v]: [string, unknown]) => `  ${JSON.stringify(k)}: ${nested(v, 1)}`;

  await write(`{\n${head.map(entry).join(",\n")},\n  "files": `);
  if (files.length === 0) await write("[]");
  else {
    await write("[\n");
    for (const [n, f] of files.entries()) {
      // the file's fields as a JSON object nested two deep, opened again at its last brace to add `bytesBase64` after them
      const own = nested(f, 2);
      await write(`${n ? ",\n" : ""}    ${own.slice(0, own.lastIndexOf("\n"))},\n      "bytesBase64": "`);
      for (let at = 0; ; at += EXPORT_SLICE_BYTES) {
        const r = await c.query<{ b: string | null }>("SELECT encode(substring(bytes FROM $2 FOR $3), 'base64') AS b FROM files WHERE id=$1", [f.id, at + 1, EXPORT_SLICE_BYTES]);
        // PostgreSQL's base64 breaks lines every 76 characters; the document carries it unbroken.
        const part = (r.rows[0]?.b ?? "").replace(/\n/g, "");
        if (part === "") break;
        await write(part);
        // a short slice is the last one; the stored size column is not trusted to say where the bytes end
        if (part.length < (EXPORT_SLICE_BYTES / 3) * 4) break;
      }
      await write(`"\n    }`);
    }
    await write("\n  ]");
  }
  await write(`,\n${tail.map(entry).join(",\n")}\n}`);
}

/**
 * The export as a stream of text. Answers once the concept is known to exist (an unknown one throws the 404 here,
 * before any byte is sent); the rest is written as the reader takes it, in one transaction held until it is done.
 */
export async function conceptExportStream(id: string): Promise<ReadableStream<Uint8Array>> {
  const { readable, writable } = new TransformStream<string, Uint8Array>(
    { transform: (s, controller) => controller.enqueue(new TextEncoder().encode(s)) },
    { highWaterMark: 1 },
    { highWaterMark: 0 }
  );
  const writer = writable.getWriter();
  let ready!: () => void;
  let failed!: (e: unknown) => void;
  const started = new Promise<void>((res, rej) => {
    ready = res;
    failed = rej;
  });
  void tx(async (c) => {
    try {
      await writeDocument(c, id, (s) => writer.write(s), ready);
    } catch (e) {
      failed(e);
      throw e;
    }
  }).then(
    () => writer.close(),
    (e) => writer.abort(e).catch(() => undefined)
  );
  await started;
  return readable;
}
