import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireProject, route } from "@/lib/api/route";

export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await requireProject(id);
  const rows = await q<{ id: string; kind: string; summary: string; created_at: string }>(
    "SELECT id, kind, summary, created_at FROM events WHERE project_id=$1 ORDER BY id DESC LIMIT 500",
    [id]
  );
  return NextResponse.json({ events: rows.map((r) => ({ id: Number(r.id), kind: r.kind, summary: r.summary, createdAt: r.created_at })) });
});
