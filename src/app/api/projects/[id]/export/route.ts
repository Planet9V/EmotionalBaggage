import { tx } from "@/lib/db";
import { route } from "@/lib/api/route";
import { EXPORT_FORMAT, loadConceptIn } from "@/lib/api/concepts";

type Ctx = { params: Promise<{ id: string }> };

/**
 * One JSON document with everything the concept owns, sent as a download: the concept with its
 * product type, currency and sales regions, items (print jobs included), files, pins, tracked links
 * (their set-up, not their clicks), the passages of each source, events, research, messages and gates.
 * Not in it: AI drafts, campaign results and link clicks, audit lines and credentials.
 * Read in one REPEATABLE READ transaction, so the parts agree with each other.
 */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const doc = await tx(async (c) => {
    await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    const concept = await loadConceptIn(c, id);
    const settings = (await c.query<{ currency: string; sales_regions: string[] }>("SELECT currency, sales_regions FROM projects WHERE id=$1", [id])).rows[0];
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
    // Tracked links as set up; `campaignId` and `creativeId` are ids in `items` above. Clicks are results and stay out.
    const trackedLinks = await all<Record<string, unknown>>(
      `SELECT id::int AS id, campaign_id::int AS "campaignId", creative_id::int AS "creativeId", creative_label AS "creativeLabel", base_url AS "baseUrl", destination,
              utm_source AS "utmSource", utm_medium AS "utmMedium", utm_campaign AS "utmCampaign", utm_content AS "utmContent", utm_term AS "utmTerm", code, disabled
         FROM tracked_links WHERE project_id=$1 ORDER BY id`
    );
    // The text of each source, cut into passages (migration 0029); `itemId` is the source's id in `items` above.
    const sourceChunks = await all<Record<string, unknown>>(
      `SELECT id::int AS id, item_id::int AS "itemId", n, text FROM source_chunks WHERE project_id=$1 ORDER BY item_id, n`
    );
    // PostgreSQL's base64 breaks lines every 76 characters; the document carries it unbroken.
    for (const f of files) f.bytesBase64 = String(f.bytesBase64).replace(/\n/g, "");
    return {
      format: EXPORT_FORMAT,
      exportedAt: new Date().toISOString(),
      concept: { ...concept, currency: settings.currency, salesRegions: settings.sales_regions },
      counts: { items: items.length, events: events.length, research: research.length, messages: messages.length, gates: gates.length, files: files.length, pins: pins.length, trackedLinks: trackedLinks.length, sourceChunks: sourceChunks.length },
      items,
      events,
      research,
      messages,
      gates,
      files,
      pins,
      trackedLinks,
      sourceChunks,
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
