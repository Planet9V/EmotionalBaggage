import { NextResponse } from "next/server";
import { logEvent, q } from "@/lib/db";
import { body as readBody, requireProject, route } from "@/lib/api/route";
import { researchAsk } from "@/lib/api/schemas";
import { getCredential } from "@/lib/settings";
import { ask, currentEffort, type Source } from "@/lib/research/perplexity";

type Row = { id: string; query: string; answer: string; citations: string[]; model: string; created_at: string };

/**
 * `citations` stays an array of URL strings (what the browser and the report read).
 * `sources` repeats them as objects; titles are known only in the answer to the POST,
 * because the research table has no column for them.
 */
const shape = (r: Row, sources?: Source[]) => ({
  id: Number(r.id),
  query: r.query,
  answer: r.answer,
  citations: r.citations,
  sources: sources ?? r.citations.map((url) => ({ url })),
  model: r.model,
  createdAt: r.created_at,
});

const NOT_CONNECTED = "Perplexity is not connected. Add a key in Admin, Credentials.";

export const GET = route(async (req: Request) => {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  await requireProject(projectId);
  const rows = await q<Row>("SELECT id, query, answer, citations, model, created_at FROM research WHERE project_id=$1 ORDER BY id DESC", [projectId]);
  const configured = !!(await getCredential("perplexity", "apiKey"));
  return NextResponse.json({ configured, model: await currentEffort(), entries: rows.map((r) => shape(r)) });
});

export const POST = route(async (req: Request) => {
  const b = await readBody(req, researchAsk);
  await requireProject(b.projectId);
  const key = await getCredential("perplexity", "apiKey");
  if (!key) return NextResponse.json({ error: NOT_CONNECTED }, { status: 503 });

  const r = await ask({ question: b.query, apiKey: key, signal: req.signal });
  if (!r.ok) {
    const status = r.kind === "timeout" ? 504 : r.kind === "rate_limited" ? 429 : r.kind === "not_configured" ? 503 : 502;
    return NextResponse.json({ error: r.message }, { status });
  }

  const citations = r.sources.map((s) => s.url);
  const rows = await q<Row>(
    "INSERT INTO research (project_id, query, answer, citations, model) VALUES ($1,$2,$3,$4,$5) RETURNING id, query, answer, citations, model, created_at",
    [b.projectId, b.query, r.answer, JSON.stringify(citations), r.model]
  );
  await logEvent(b.projectId, "research.asked", `Researched: ${b.query.slice(0, 120)}`, {
    researchId: Number(rows[0].id),
    effort: r.effort ?? null,
    costUsd: r.costUsd ?? null,
  });
  return NextResponse.json(
    { entry: shape(rows[0], r.sources.map(({ url, title }) => (title ? { url, title } : { url }))), effort: r.effort ?? null, costUsd: r.costUsd ?? null },
    { status: 201 }
  );
});
