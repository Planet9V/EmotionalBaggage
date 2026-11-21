import { tx } from "@/lib/db";
import { route } from "@/lib/api/route";
import { EXPORT_FORMAT, loadConceptIn } from "@/lib/api/concepts";

type Ctx = { params: Promise<{ id: string }> };

/**
 * One JSON document with everything the concept owns, sent as a download.
 * Read in one REPEATABLE READ transaction, so the parts agree with each other.
 */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const doc = await tx(async (c) => {
    await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    const concept = await loadConceptIn(c, id);
    const all = async <T,>(sql: string) => (await c.query<T & Record<string, unknown>>(sql, [id])).rows;
    const items = await all<Record<string, unknown>>(
      `SELECT id::int AS id, section, title, body, data, status, sort, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM items WHERE project_id=$1 ORDER BY sort, id`
    );
    const events = await all<Record<string, unknown>>(
      `SELECT id::int AS id, kind, summary, data, created_at AS "createdAt" FROM events WHERE project_id=$1 ORDER BY id`
    );
    const research = await all<Record<string, unknown>>(
      `SELECT id::int AS id, query, answer, citations, sources, model, created_at AS "createdAt" FROM research WHERE project_id=$1 ORDER BY id`
    );
    const messages = await all<Record<string, unknown>>(
      `SELECT id::int AS id, role, content, created_at AS "createdAt" FROM messages WHERE project_id=$1 ORDER BY id`
    );
    const gates = await all<Record<string, unknown>>(
      `SELECT stage, status, overridden, note, decided_at AS "decidedAt" FROM gates WHERE project_id=$1 ORDER BY stage`
    );
    const files = await all<Record<string, unknown>>(
      `SELECT id::int AS id, name, mime, kind, size, sha256, meta, created_at AS "createdAt", encode(bytes, 'base64') AS "bytesBase64"
         FROM files WHERE project_id=$1 ORDER BY id`
    );
    // Pins belong to part rows (plan 5.1); `itemId` is the part's id in `items` above.
    const pins = await all<Record<string, unknown>>(
      `SELECT id::int AS id, item_id::int AS "itemId", name, kind, side, position, voltage, data, sort FROM pins WHERE project_id=$1 ORDER BY item_id, sort, id`
    );
    // PostgreSQL's base64 breaks lines every 76 characters; the document carries it unbroken.
    for (const f of files) f.bytesBase64 = String(f.bytesBase64).replace(/\n/g, "");
    return {
      format: EXPORT_FORMAT,
      exportedAt: new Date().toISOString(),
      concept,
      counts: { items: items.length, events: events.length, research: research.length, messages: messages.length, gates: gates.length, files: files.length },
      items,
      events,
      research,
      messages,
      gates,
      files,
      pins,
    };
  });
  return new Response(JSON.stringify(doc, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${id}-export.json"`,
      "cache-control": "no-store",
    },
  });
});
