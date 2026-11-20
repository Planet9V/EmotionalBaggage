import { NextResponse } from "next/server";
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import { requireProject, route } from "@/lib/api/route";
import { meaningReady, searchByMeaning } from "@/lib/ai/embeddings";
import { searchMode } from "@/lib/ai/schemas";

// Search across a concept.
//   mode=text (default): words in the title, body or data.
//   mode=meaning: nearest rows by embedding (needs pgvector, an embedding model chosen in Admin,
//     and the concept indexed through POST /api/index); 503 with the reason otherwise.
//   mode=auto: meaning when all of that is in place, otherwise text.
// Every answer names the mode that ran; meaning results carry a cosine similarity `score`.
export const GET = route(async (req: Request) => {
  const u = new URL(req.url);
  const projectId = u.searchParams.get("projectId") ?? "";
  const term = (u.searchParams.get("q") ?? "").trim().slice(0, 200);
  const asked = searchMode.parse(u.searchParams.get("mode") ?? "text");
  await requireProject(projectId);

  let mode: "text" | "meaning" = "text";
  let note: string | undefined;
  let ready: Awaited<ReturnType<typeof meaningReady>> | undefined;
  if (asked !== "text") {
    ready = await meaningReady(projectId);
    if (ready.ok) mode = "meaning";
    else if (asked === "meaning") return NextResponse.json({ error: ready.reason, missing: ready.missing }, { status: 503 });
    else note = ready.reason;
  }

  if (!term) return NextResponse.json({ mode, items: [], ...(note ? { note } : {}) });

  if (mode === "meaning" && ready?.ok) {
    const r = await searchByMeaning(projectId, term, 50, { use: ready.emb, signal: req.signal });
    if (!r.ok) return NextResponse.json({ error: r.reason, missing: r.missing }, { status: 503 });
    return NextResponse.json({ mode, items: r.items });
  }

  const rows = await q<ItemRow>(
    `SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND (title ILIKE $2 OR body ILIKE $2 OR data::text ILIKE $2) ORDER BY sort, id LIMIT 50`,
    [projectId, `%${term.replace(/[\\%_]/g, "\\$&")}%`]
  );
  return NextResponse.json({ mode, items: rows.map(toItem), ...(note ? { note } : {}) });
});
