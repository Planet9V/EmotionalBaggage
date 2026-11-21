import { NextResponse } from "next/server";
import { logEvent, q } from "@/lib/db";
import { body as readBody, requireProject, route } from "@/lib/api/route";
import { challengeTurn } from "@/lib/api/schemas";
import { complete, getReasoning, type ChatMessage } from "@/lib/ai/models";
import { REVIEWER_SYSTEM, reviewerContext } from "@/lib/ai/reviewer";

/** Turns of earlier conversation sent with each new message. */
const HISTORY = 40;

type Msg = { id: string; role: string; content: string; created_at: string };

export const GET = route(async (req: Request) => {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  await requireProject(projectId);
  const rows = await q<Msg>("SELECT id, role, content, created_at FROM messages WHERE project_id=$1 ORDER BY id", [projectId]);
  // Configured: a reasoning model is chosen in Admin and its required key is present.
  const reasoning = await getReasoning();
  return NextResponse.json({
    configured: reasoning.ok,
    model: reasoning.ok ? reasoning.info.model : "",
    messages: rows.map((m) => ({ id: Number(m.id), role: m.role, content: m.content, createdAt: m.created_at })),
  });
});

export const POST = route(async (req: Request) => {
  const b = await readBody(req, challengeTurn);
  const proj = [await requireProject(b.projectId)];
  const reasoning = await getReasoning();
  if (!reasoning.ok) return NextResponse.json({ error: reasoning.reason }, { status: 503 });
  const context = await reviewerContext(proj[0]);
  const history = (
    await q<Msg>("SELECT id, role, content, created_at FROM messages WHERE project_id=$1 ORDER BY id DESC LIMIT $2", [b.projectId, HISTORY])
  ).reverse();
  const messages: ChatMessage[] = [
    ...history.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role as ChatMessage["role"], content: m.content })),
    { role: "user", content: b.message },
  ];

  // Provider failures leave as plain sentences with a status (502, 504) through the route wrapper.
  const { text: reply } = await complete({
    use: reasoning,
    system: `${REVIEWER_SYSTEM}\n\nWhat is on record for this concept:\n${context}`,
    messages,
    maxOutputTokens: 1200,
    signal: req.signal,
  });
  await q("INSERT INTO messages (project_id, role, content) VALUES ($1,'user',$2), ($1,'assistant',$3)", [b.projectId, b.message, reply]);
  await logEvent(b.projectId, "challenge.turn", "The proposition was challenged by the AI reviewer");
  return NextResponse.json({ reply });
});
