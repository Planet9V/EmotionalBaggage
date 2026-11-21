import { NextResponse } from "next/server";
import { z } from "zod";
import { ITEM_COLS, logEventIn, q, tx, type ItemRow } from "@/lib/db";
import { body as readBody, HttpError, requireProject, route } from "@/lib/api/route";
import { changedDetail } from "@/lib/trace/changes";
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

/** "Verify this" names the row being checked: the answer is attached to that row (data.research), recorded. */
const askBody = researchAsk.extend({ itemId: z.number().int().positive().optional() });

/** Rows "Verify this" is offered on (src/components/drafts/RowAssist.tsx). */
const VERIFIABLE = new Set(["research/claims", "design/requirements", "marketing/competitors", "marketing/positioning"]);

export type AttachedResearch = { researchId: number; question: string; sources: number; askedAt: string };

export const GET = route(async (req: Request) => {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  await requireProject(projectId);
  const rows = await q<Row>(`SELECT ${COLS} FROM research WHERE project_id=$1 ORDER BY id DESC`, [projectId]);
  const configured = !!(await getSecretFor("perplexity", "apiKey", perplexityBaseUrl()));
  return NextResponse.json({ configured, model: await currentEffort(), entries: rows.map((r) => shape(r)) });
});

export const POST = route(async (req: Request) => {
  const b = await readBody(req, askBody);
  await requireProject(b.projectId);
  const key = await getSecretFor("perplexity", "apiKey", perplexityBaseUrl());
  if (!key) return NextResponse.json({ error: NOT_CONNECTED }, { status: 503 });
  // The row is checked before Perplexity is asked (and billed), so a wrong id costs nothing.
  if (b.itemId !== undefined) {
    const found = await q<{ section: string }>("SELECT section FROM items WHERE id=$1 AND project_id=$2", [b.itemId, b.projectId]);
    if (!found[0]) throw new HttpError(404, "The row to attach this answer to is not in this concept.");
    if (!VERIFIABLE.has(found[0].section)) throw new HttpError(400, "An answer can be attached to a claim, a requirement, a competitor or a positioning row.");
  }

  const r = await ask({ question: b.query, apiKey: key, signal: req.signal });
  if (!r.ok) {
    const status = r.kind === "timeout" ? 504 : r.kind === "rate_limited" ? 429 : r.kind === "not_configured" ? 503 : 502;
    return NextResponse.json({ error: r.message }, { status });
  }

  const citations = r.sources.map((s) => s.url);
  const sources = r.sources.map(toStoredSource);
  const out = await tx(async (c) => {
    const rows = await c.query<Row>(
      `INSERT INTO research (project_id, query, answer, citations, sources, model) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${COLS}`,
      [b.projectId, b.query, r.answer, JSON.stringify(citations), JSON.stringify(sources), r.model]
    );
    const researchId = Number(rows.rows[0].id);
    await logEventIn(c, b.projectId, "research.asked", `Researched: ${b.query.slice(0, 120)}`, {
      researchId,
      effort: r.effort ?? null,
      costUsd: r.costUsd ?? null,
      after: { query: b.query, model: r.model, sources: citations.length },
    });
    let attached: ReturnType<typeof toItemShape> | null = null;
    if (b.itemId !== undefined) {
      // Attaching is a link to the answer, never a verdict: a claim's status still changes only through evidence the user judged.
      const was = (await c.query<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 AND project_id=$2 FOR UPDATE`, [b.itemId, b.projectId])).rows[0];
      if (!was) throw new HttpError(404, "The row to attach this answer to is not in this concept.");
      const old = Array.isArray(was.data.research) ? (was.data.research as AttachedResearch[]) : [];
      const next: AttachedResearch[] = [...old, { researchId, question: b.query.slice(0, 600), sources: citations.length, askedAt: new Date(rows.rows[0].created_at).toISOString() }];
      const upd = await c.query<ItemRow>(`UPDATE items SET data = data || jsonb_build_object('research', $2::jsonb), updated_at=now() WHERE id=$1 RETURNING ${ITEM_COLS}`, [b.itemId, JSON.stringify(next)]);
      await logEventIn(c, b.projectId, "item.edited", `"${was.title}": research answer attached (${citations.length} ${citations.length === 1 ? "source" : "sources"})`, changedDetail(upd.rows[0], { before: { "data.research": old }, after: { "data.research": next } }));
      attached = toItemShape(upd.rows[0]);
    }
    return { entry: shape(rows.rows[0]), attached };
  });
  return NextResponse.json({ entry: out.entry, attached: out.attached, effort: r.effort ?? null, costUsd: r.costUsd ?? null }, { status: 201 });
});

const toItemShape = (r: ItemRow) => ({ id: Number(r.id), section: r.section, title: r.title, data: r.data });
