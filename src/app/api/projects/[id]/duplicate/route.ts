import { NextResponse } from "next/server";
import { logEventIn, tx } from "@/lib/db";
import { body, notFound, route } from "@/lib/api/route";
import { duplicateBody, insertConcept, loadConceptIn } from "@/lib/api/concepts";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Creates a new concept named `name` with a copy of every item and every file of the source.
 * Events, messages, research and gates are not copied; one event on the new concept names the source.
 * Keys and part references are per concept, so they copy unchanged. A row whose data.fileId points
 * at one of the source's files (a print job) is pointed at the copy of that file instead.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id: sourceId } = await params;
  const b = await body(req, duplicateBody);
  const project = await tx(async (c) => {
    // FOR SHARE: the source cannot be deleted or renamed while it is copied.
    const src = await c.query<{ name: string; one_liner: string; product_type: string; stage: string }>(
      "SELECT name, one_liner, product_type, stage FROM projects WHERE id=$1 FOR SHARE",
      [sourceId]
    );
    if (!src.rows.length) throw notFound("That concept");
    const s = src.rows[0];
    const newId = await insertConcept(c, { name: b.name, oneLiner: s.one_liner, productType: s.product_type, stage: s.stage });

    const fileMap: Record<string, number> = {};
    const fileIds = await c.query<{ id: string }>("SELECT id FROM files WHERE project_id=$1 ORDER BY id", [sourceId]);
    for (const f of fileIds.rows) {
      const made = await c.query<{ id: string }>(
        `INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta)
         SELECT $1, name, mime, kind, size, sha256, bytes, meta FROM files WHERE id=$2 RETURNING id`,
        [newId, f.id]
      );
      fileMap[f.id] = Number(made.rows[0].id);
    }

    const items = await c.query(
      `INSERT INTO items (project_id, section, title, body, data, status, sort)
       SELECT $1, section, title, body,
              CASE WHEN data ? 'fileId' AND $3::jsonb ? (data->>'fileId')
                   THEN jsonb_set(data, '{fileId}', $3::jsonb -> (data->>'fileId'))
                   ELSE data END,
              status, sort
         FROM items WHERE project_id=$2 ORDER BY sort, id`,
      [newId, sourceId, JSON.stringify(fileMap)]
    );

    const copied = { items: items.rowCount ?? 0, files: fileIds.rows.length };
    await logEventIn(
      c,
      newId,
      "project.duplicated",
      `Duplicated from "${s.name}" (${sourceId}): ${copied.items} rows and ${copied.files} files`,
      { sourceId, sourceName: s.name, ...copied }
    );
    return loadConceptIn(c, newId);
  });
  return NextResponse.json({ project, source: sourceId }, { status: 201 });
});
