import { NextResponse } from "next/server";
import { logEvent, q } from "@/lib/db";

const MODEL = process.env.PERPLEXITY_MODEL ?? "sonar-pro";
const URL_ = process.env.PERPLEXITY_URL ?? "https://api.perplexity.ai/v1/sonar";

type Row = { id: string; query: string; answer: string; citations: string[]; model: string; created_at: string };
const shape = (r: Row) => ({ id: Number(r.id), query: r.query, answer: r.answer, citations: r.citations, model: r.model, createdAt: r.created_at });

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  const rows = await q<Row>("SELECT id, query, answer, citations, model, created_at FROM research WHERE project_id=$1 ORDER BY id DESC", [projectId]);
  return NextResponse.json({ configured: !!process.env.PERPLEXITY_API_KEY, model: MODEL, entries: rows.map(shape) });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { projectId?: string; query?: string };
  if (!b.projectId || !b.query?.trim()) return NextResponse.json({ error: "projectId and query are required" }, { status: 400 });
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return NextResponse.json({ error: "Perplexity is not connected. Set PERPLEXITY_API_KEY and restart." }, { status: 503 });
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "Answer with specifics, dates and figures. Say plainly when sources disagree or when nothing reliable was found." },
        { role: "user", content: b.query.trim() },
      ],
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
    citations?: string[];
    search_results?: { url?: string }[];
    error?: { message?: string };
  };
  if (!res.ok) return NextResponse.json({ error: `Perplexity answered ${res.status}: ${body.error?.message ?? "no detail"}` }, { status: 502 });
  const answer = body.choices?.[0]?.message?.content ?? "";
  const citations = body.citations ?? (body.search_results ?? []).map((s) => s.url).filter(Boolean);
  const rows = await q<Row>(
    "INSERT INTO research (project_id, query, answer, citations, model) VALUES ($1,$2,$3,$4,$5) RETURNING id, query, answer, citations, model, created_at",
    [b.projectId, b.query.trim(), answer, JSON.stringify(citations), MODEL]
  );
  await logEvent(b.projectId, "research.asked", `Researched: ${b.query.trim().slice(0, 120)}`);
  return NextResponse.json({ entry: shape(rows[0]) }, { status: 201 });
}
