import { NextResponse } from "next/server";
import { logEventIn, tx } from "@/lib/db";
import { currentActor } from "@/lib/actor";
import { body, notFound, route } from "@/lib/api/route";
import { duplicateBody, insertConcept, loadConceptIn } from "@/lib/api/concepts";
import { copiedRow, printRunFileIds } from "@/lib/concepts/copy";
import { makeCode } from "@/lib/campaigns/links";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Creates a new concept named `name` with a copy of the source: its product type, stage, currency and
 * sales regions; every item; every file except what a print run produced; the pins of every part;
 * tracked links with new short codes and no clicks. Rows that name other rows (a campaign's creatives
 * and sales channel, proof links, a landing page's price) or files are pointed at the copies
 * (src/lib/concepts/copy.ts). Print jobs arrive queued, without slice results or printer links.
 * Not copied: drafts, campaign results, link clicks, events, messages, research, gates and audit lines.
 * Keys and part references are per concept, so they copy unchanged. One event on the new concept names the source.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id: sourceId } = await params;
  const b = await body(req, duplicateBody);
  const project = await tx(async (c) => {
    // FOR SHARE: the source cannot be deleted or renamed while it is copied.
    const src = await c.query<{ name: string; one_liner: string; product_type: string; stage: string; currency: string; sales_regions: string[] }>(
      "SELECT name, one_liner, product_type, stage, currency, sales_regions FROM projects WHERE id=$1 FOR SHARE",
      [sourceId]
    );
    if (!src.rows.length) throw notFound("That concept");
    const s = src.rows[0];
    const newId = await insertConcept(c, { name: b.name, oneLiner: s.one_liner, productType: s.product_type, stage: s.stage });
    await c.query("UPDATE projects SET currency=$2, sales_regions=$3::jsonb WHERE id=$1", [newId, s.currency, JSON.stringify(s.sales_regions ?? [])]);

    const rows = (await c.query<{ id: string; section: string; title: string; body: string; data: Record<string, unknown>; status: string; sort: number }>(
      "SELECT id, section, title, body, data, status, sort FROM items WHERE project_id=$1 ORDER BY sort, id",
      [sourceId]
    )).rows;
    const runFiles = printRunFileIds(rows);

    const fileMap = new Map<number, number>();
    const fileIds = await c.query<{ id: string }>("SELECT id FROM files WHERE project_id=$1 ORDER BY id", [sourceId]);
    for (const f of fileIds.rows) {
      if (runFiles.has(Number(f.id))) continue;
      const made = await c.query<{ id: string }>(
        `INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta)
         SELECT $1, name, mime, kind, size, sha256, bytes, meta FROM files WHERE id=$2 RETURNING id`,
        [newId, f.id]
      );
      fileMap.set(Number(f.id), Number(made.rows[0].id));
    }

    // Rows first as they are, to learn each copy's id; then the references between rows are pointed at the copies.
    const idMap = new Map<number, number>();
    for (const r of rows) {
      const made = await c.query<{ id: string }>(
        "INSERT INTO items (project_id, section, title, body, data, status, sort) VALUES ($1,$2,$3,$4,'{}'::jsonb,$5,$6) RETURNING id",
        [newId, r.section, r.title, r.body, r.status, r.sort]
      );
      idMap.set(Number(r.id), Number(made.rows[0].id));
    }
    for (const r of rows) {
      const next = copiedRow({ section: r.section, status: r.status, data: r.data ?? {} }, idMap, fileMap);
      await c.query("UPDATE items SET data=$2, status=$3 WHERE id=$1", [idMap.get(Number(r.id)), JSON.stringify(next.data), next.status]);
    }
    const items = { rowCount: rows.length };

    // Pins belong to part rows; parts are matched by their reference, which is unique per concept.
    // Pins of a part with no reference are not copied (nothing can be wired to such a part).
    await c.query(
      `INSERT INTO pins (project_id, item_id, name, kind, side, position, voltage, data, sort)
       SELECT $1, dst.id, p.name, p.kind, p.side, p.position, p.voltage, p.data, p.sort
         FROM pins p
         JOIN items src ON src.id = p.item_id
         JOIN items dst ON dst.project_id = $1 AND dst.section = 'design/bom' AND dst.data->>'ref' = src.data->>'ref'
        WHERE p.project_id = $2 AND COALESCE(src.data->>'ref', '') <> ''`,
      [newId, sourceId]
    );

    // Tracked links: the same destination and UTM parameters for the copied campaign and creative, a new short code, no clicks.
    const links = await c.query<{ campaign_id: string; creative_id: string | null; creative_label: string; base_url: string; destination: string; utm_source: string; utm_medium: string; utm_campaign: string; utm_content: string; utm_term: string; code: string | null; disabled: boolean }>(
      "SELECT campaign_id, creative_id, creative_label, base_url, destination, utm_source, utm_medium, utm_campaign, utm_content, utm_term, code, disabled FROM tracked_links WHERE project_id=$1 ORDER BY id",
      [sourceId]
    );
    let linkCount = 0;
    for (const l of links.rows) {
      const campaign = idMap.get(Number(l.campaign_id));
      if (!campaign) continue;
      const creative = l.creative_id === null ? null : (idMap.get(Number(l.creative_id)) ?? null);
      await c.query(
        `INSERT INTO tracked_links (project_id, campaign_id, creative_id, creative_label, base_url, destination, utm_source, utm_medium, utm_campaign, utm_content, utm_term, code, disabled, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [newId, campaign, creative, l.creative_label, l.base_url, l.destination, l.utm_source, l.utm_medium, l.utm_campaign, l.utm_content, l.utm_term, l.code ? makeCode() : null, l.disabled, currentActor()]
      );
      linkCount++;
    }

    const copied = { items: items.rowCount ?? 0, files: fileMap.size, links: linkCount };
    await logEventIn(
      c,
      newId,
      "project.duplicated",
      `Duplicated from "${s.name}" (${sourceId}): ${copied.items} rows, ${copied.files} files and ${copied.links} tracked links`,
      { sourceId, sourceName: s.name, ...copied }
    );
    return loadConceptIn(c, newId);
  });
  return NextResponse.json({ project, source: sourceId }, { status: 201 });
});
