import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { logEvent, q } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };
type Row = { id: string; name: string; mime: string; kind: string; size: number; sha256: string; meta: Record<string, unknown>; created_at: string };
const META = "id, name, mime, kind, size, sha256, meta, created_at";
const shape = (r: Row) => ({ id: Number(r.id), name: r.name, mime: r.mime, kind: r.kind, size: r.size, sha256: r.sha256, meta: r.meta, createdAt: r.created_at });
const MAX = 25 * 1024 * 1024;

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const rows = await q<Row>(`SELECT ${META} FROM files WHERE project_id=$1 ORDER BY created_at DESC, id DESC`, [id]);
  return NextResponse.json({ files: rows.map(shape) });
}

/** multipart/form-data: file (required), kind (e.g. "stl", "upload", "report"), meta (JSON string). */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Files are limited to 25 MB." }, { status: 413 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const sha = createHash("sha256").update(bytes).digest("hex");
  const kind = String(form?.get("kind") ?? "upload");
  let meta: unknown = {};
  try {
    meta = JSON.parse(String(form?.get("meta") ?? "{}"));
  } catch {
    meta = {};
  }
  const rows = await q<Row>(
    `INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${META}`,
    [id, file.name, file.type || "application/octet-stream", kind, bytes.length, sha, bytes, JSON.stringify(meta)]
  );
  await logEvent(id, "file.stored", `Stored ${file.name} (${kind}, ${bytes.length} bytes)`, { fileId: rows[0].id, sha256: sha });
  return NextResponse.json({ file: shape(rows[0]) }, { status: 201 });
}
