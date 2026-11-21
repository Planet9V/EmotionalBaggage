import { NextResponse } from "next/server";
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import { requireProject, route } from "@/lib/api/route";
import { meaningReady, searchByMeaning, searchSourcesByMeaning } from "@/lib/ai/embeddings";
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
    // A source whose text matches is found through its passages, and listed as the source row (with the passage's score).
    const passages = await searchSourcesByMeaning(projectId, term, 20, { use: ready.emb, signal: req.signal });
    const seen = new Set(r.items.map((i) => i.id));
    const sources = passages.hits.flatMap((h) => (h.kind === "source" && !seen.has(h.item.id) && seen.add(h.item.id) ? [{ ...h.item, score: h.score }] : []));
    return NextResponse.json({ mode, items: [...r.items, ...sources].sort((a, b) => b.score - a.score).slice(0, 50) });
  }

  const rows = await q<ItemRow>(
    `SELECT ${ITEM_COLS} FROM items i WHERE project_id=$1 AND (title ILIKE $2 OR body ILIKE $2 OR data::text ILIKE $2
       OR EXISTS (SELECT 1 FROM source_chunks c WHERE c.item_id = i.id AND c.text ILIKE $2)) ORDER BY sort, id LIMIT 50`,
    [projectId, `%${term.replace(/[\\%_]/g, "\\$&")}%`]
  );
  return NextResponse.json({ mode, items: rows.map(toItem), ...(note ? { note } : {}) });
});
