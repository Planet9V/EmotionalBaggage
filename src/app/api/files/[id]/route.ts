import { NextResponse } from "next/server";
import { logEvent, q } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const rows = await q<{ name: string; mime: string; bytes: Buffer; sha256: string }>(
    "SELECT name, mime, bytes, sha256 FROM files WHERE id=$1",
    [id]
  );
  if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  const f = rows[0];
  return new NextResponse(new Uint8Array(f.bytes), {
    headers: {
      "Content-Type": f.mime,
      "Content-Disposition": `attachment; filename="${f.name.replace(/[^\w.\- ]/g, "_")}"`,
      ETag: `"${f.sha256}"`,
    },
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const rows = await q<{ project_id: string; name: string }>("DELETE FROM files WHERE id=$1 RETURNING project_id, name", [id]);
  if (rows.length) await logEvent(rows[0].project_id, "file.removed", `Removed file ${rows[0].name}`);
  return NextResponse.json({ ok: true });
}
