import { NextResponse } from "next/server";
import { logEventIn, q, tx } from "@/lib/db";
import { notFound, recordId, route } from "@/lib/api/route";

type Ctx = { params: Promise<{ id: string }> };

/** Kinds a browser may show in the page (the Files preview) rather than save; never HTML or SVG, which could run script. */
const INLINE = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"]);

export const GET = route(async (req: Request, { params }: Ctx) => {
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
      "Content-Disposition": `${new URL(req.url).searchParams.get("inline") === "1" && INLINE.has(f.mime) ? "inline" : "attachment"}; filename="${f.name.replace(/[^\w.\- ]/g, "_")}"`,
      ETag: `"${f.sha256}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const id = recordId((await params).id, "That file");
  await tx(async (c) => {
    const res = await c.query<{ project_id: string; name: string; kind: string; size: number; sha256: string }>(
      "DELETE FROM files WHERE id=$1 RETURNING project_id, name, kind, size, sha256",
      [id]
    );
    const f = res.rows[0];
    if (!f) throw notFound("That file");
    await logEventIn(c, f.project_id, "file.removed", `Removed file ${f.name}`, {
      fileId: id,
      before: { name: f.name, kind: f.kind, size: f.size, sha256: f.sha256 },
    });
  });
  return NextResponse.json({ ok: true });
});
