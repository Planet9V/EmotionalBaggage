import { NextResponse } from "next/server";
import { logEvent, q } from "@/lib/db";
import { notFound, recordId, route } from "@/lib/api/route";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That file");
  const rows = await q<{ name: string; mime: string; bytes: Buffer; sha256: string }>(
    "SELECT name, mime, bytes, sha256 FROM files WHERE id=$1",
    [id]
  );
  if (!rows.length) throw notFound("That file");
  const f = rows[0];
  return new NextResponse(new Uint8Array(f.bytes), {
    headers: {
      "Content-Type": f.mime,
      "Content-Disposition": `attachment; filename="${f.name.replace(/[^\w.\- ]/g, "_")}"`,
      ETag: `"${f.sha256}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That file");
  const rows = await q<{ project_id: string; name: string }>("DELETE FROM files WHERE id=$1 RETURNING project_id, name", [id]);
  if (!rows.length) throw notFound("That file");
  await logEvent(rows[0].project_id, "file.removed", `Removed file ${rows[0].name}`);
  return NextResponse.json({ ok: true });
});
