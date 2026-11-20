import { NextResponse } from "next/server";
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import { requireProject, route } from "@/lib/api/route";

// Text search across a concept. The items table carries a vector(1024) column when
// pgvector is present; nothing fills it yet (no embedding provider is wired), so this
// endpoint always reports mode "text".
export const GET = route(async (req: Request) => {
  const u = new URL(req.url);
  const projectId = u.searchParams.get("projectId") ?? "";
  const term = (u.searchParams.get("q") ?? "").trim().slice(0, 200);
  await requireProject(projectId);
  if (!term) return NextResponse.json({ mode: "text", items: [] });
  const rows = await q<ItemRow>(
    `SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND (title ILIKE $2 OR body ILIKE $2 OR data::text ILIKE $2) ORDER BY sort, id LIMIT 50`,
    [projectId, `%${term.replace(/[\\%_]/g, "\\$&")}%`]
  );
  return NextResponse.json({ mode: "text", items: rows.map(toItem) });
});
