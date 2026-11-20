import { NextResponse } from "next/server";
import { ITEM_COLS, logEvent, q, toItem, type ItemRow } from "@/lib/db";
import { body as readBody, outbound, requireProject, route } from "@/lib/api/route";
import { challengeTurn } from "@/lib/api/schemas";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

const SYSTEM = `You review product concepts before money is spent on them. Your job is to push back.
- Question the proposition: who buys it, why now, what it replaces, what would make it fail.
- Name the weakest assumption first and say what evidence would settle it.
- Point out conflicts between the brief, the open questions and the claims marked unverified.
- Ask at most three sharp questions per reply. No praise, no summaries of what you were told.
- When the person answers well, say so in one line and move to the next weakest point.
- Never invent market figures, regulations or prices. If a fact is needed, say it must be researched.`;

type Msg = { id: string; role: string; content: string; created_at: string };

export const GET = route(async (req: Request) => {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  await requireProject(projectId);
  const rows = await q<Msg>("SELECT id, role, content, created_at FROM messages WHERE project_id=$1 ORDER BY id", [projectId]);
  return NextResponse.json({
    configured: !!process.env.ANTHROPIC_API_KEY,
    model: MODEL,
    messages: rows.map((m) => ({ id: Number(m.id), role: m.role, content: m.content, createdAt: m.created_at })),
  });
});

export const POST = route(async (req: Request) => {
  const b = await readBody(req, challengeTurn);
  const proj = [await requireProject(b.projectId)];
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "The AI reviewer is not connected. Set ANTHROPIC_API_KEY and restart." }, { status: 503 });
  }
  const ctx = (await q<ItemRow>(
    `SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section IN ('concept/brief','concept/questions','research/claims') ORDER BY sort, id`,
    [b.projectId]
  )).map(toItem);
  const context = [
    `Concept: ${proj[0].name}. ${proj[0].one_liner}`,
    ...ctx.map((i) => `[${i.section} | ${i.status}] ${i.title}${i.body ? `: ${i.body}` : ""}`),
  ].join("\n");
  const history = (
    await q<Msg>("SELECT id, role, content, created_at FROM messages WHERE project_id=$1 ORDER BY id DESC LIMIT 40", [b.projectId])
  ).reverse();

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system: `${SYSTEM}\n\nWhat is on record for this concept:\n${context}`,
      messages: [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: b.message }],
    }),
    signal: outbound(),
  });
  const body = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; error?: { message?: string } };
  if (!res.ok) {
    return NextResponse.json({ error: `The AI service answered ${res.status}: ${body.error?.message ?? "no detail"}` }, { status: 502 });
  }
  const reply = (body.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
  await q("INSERT INTO messages (project_id, role, content) VALUES ($1,'user',$2), ($1,'assistant',$3)", [b.projectId, b.message, reply]);
  await logEvent(b.projectId, "challenge.turn", "The proposition was challenged by the AI reviewer");
  return NextResponse.json({ reply });
});
