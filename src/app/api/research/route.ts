import { NextResponse } from "next/server";
import { logEvent, q } from "@/lib/db";
import { body as readBody, requireProject, route } from "@/lib/api/route";
import { researchAsk } from "@/lib/api/schemas";
import { getSecretFor, perplexityBaseUrl } from "@/lib/secretOrigin";
import { ask, currentEffort } from "@/lib/research/perplexity";
import { readSources, toStoredSource } from "@/lib/research/schemas";

type Row = { id: string; query: string; answer: string; citations: string[]; sources: unknown; model: string; created_at: string };
const COLS = "id, query, answer, citations, sources, model, created_at";

/**
 * `citations` stays an array of URL strings (what the report and the evidence check read).
 * `sources` holds the same sources in the same order with Perplexity's title ("" when it gave none),
 * and its snippet and date when it gave them. Both are stored (migrations/0006_research_sources.sql).
 */
const shape = (r: Row) => ({
  id: Number(r.id),
  query: r.query,
  answer: r.answer,
  citations: r.citations,
  sources: readSources(r.sources, r.citations),
  model: r.model,
  createdAt: r.created_at,
});

const NOT_CONNECTED = "Perplexity is not connected. Add a key in Admin, Credentials.";

export const GET = route(async (req: Request) => {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  await requireProject(projectId);
  const rows = await q<Row>(`SELECT ${COLS} FROM research WHERE project_id=$1 ORDER BY id DESC`, [projectId]);
  const configured = !!(await getSecretFor("perplexity", "apiKey", perplexityBaseUrl()));
  return NextResponse.json({ configured, model: await currentEffort(), entries: rows.map((r) => shape(r)) });
});

export const POST = route(async (req: Request) => {
  const b = await readBody(req, researchAsk);
  await requireProject(b.projectId);
  const key = await getSecretFor("perplexity", "apiKey", perplexityBaseUrl());
  if (!key) return NextResponse.json({ error: NOT_CONNECTED }, { status: 503 });

  const r = await ask({ question: b.query, apiKey: key, signal: req.signal });
  if (!r.ok) {
    const status = r.kind === "timeout" ? 504 : r.kind === "rate_limited" ? 429 : r.kind === "not_configured" ? 503 : 502;
    return NextResponse.json({ error: r.message }, { status });
  }

  const citations = r.sources.map((s) => s.url);
  const sources = r.sources.map(toStoredSource);
  const rows = await q<Row>(
    `INSERT INTO research (project_id, query, answer, citations, sources, model) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${COLS}`,
    [b.projectId, b.query, r.answer, JSON.stringify(citations), JSON.stringify(sources), r.model]
  );
  await logEvent(b.projectId, "research.asked", `Researched: ${b.query.slice(0, 120)}`, {
    researchId: Number(rows[0].id),
    effort: r.effort ?? null,
    costUsd: r.costUsd ?? null,
    after: { query: b.query, model: r.model, sources: citations.length },
  });
  return NextResponse.json(
    { entry: shape(rows[0]), effort: r.effort ?? null, costUsd: r.costUsd ?? null },
    { status: 201 }
  );
});
