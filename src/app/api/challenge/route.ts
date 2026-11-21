import { NextResponse } from "next/server";
import { ITEM_COLS, logEventIn, q, toItem, tx, type ItemRow } from "@/lib/db";
import { body as readBody, HttpError, requireProject, route } from "@/lib/api/route";
import { reviewerSystem } from "@/lib/ai/reviewer";
import { challengeTurn } from "@/lib/api/schemas";
import { complete, getReasoning, type ChatMessage } from "@/lib/ai/models";

/** Turns of earlier conversation sent with each new message. */
const HISTORY = 40;

type Msg = { id: string; role: string; content: string; created_at: string; item_id: string | null };

export const GET = route(async (req: Request) => {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? "";
  await requireProject(projectId);
  const rows = await q<Msg>("SELECT id, role, content, created_at, item_id FROM messages WHERE project_id=$1 ORDER BY id", [projectId]);
  // Configured: a reasoning model is chosen in Admin and its required key is present.
  const reasoning = await getReasoning();
  return NextResponse.json({
    configured: reasoning.ok,
    model: reasoning.ok ? reasoning.info.model : "",
    messages: rows.map((m) => ({ id: Number(m.id), role: m.role, content: m.content, createdAt: m.created_at, itemId: m.item_id === null ? null : Number(m.item_id) })),
  });
});

export const POST = route(async (req: Request) => {
  const b = await readBody(req, challengeTurn);
  const proj = [await requireProject(b.projectId)];
  const reasoning = await getReasoning();
  if (!reasoning.ok) return NextResponse.json({ error: reasoning.reason }, { status: 503 });
  // "Challenge this": the row must belong to this concept; the exchange keeps a link back to it.
  let focus: ReturnType<typeof toItem> | null = null;
  if (b.itemId !== undefined) {
    const r = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 AND project_id=$2`, [b.itemId, b.projectId]);
    if (!r.length) throw new HttpError(404, "That row was not found in this concept.");
    focus = toItem(r[0]);
  }
  const history = (
    await q<Msg>("SELECT id, role, content, created_at, item_id FROM messages WHERE project_id=$1 ORDER BY id DESC LIMIT $2", [b.projectId, HISTORY])
  ).reverse();
  const messages: ChatMessage[] = [
    ...history.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role as ChatMessage["role"], content: m.content })),
    { role: "user", content: b.message },
  ];

  // Provider failures leave as plain sentences with a status (502, 504) through the route wrapper.
  const { text: reply } = await complete({
    use: reasoning,
    system: await reviewerSystem(proj[0], focus),
    messages,
    maxOutputTokens: 1200,
    signal: req.signal,
  });
  await tx(async (c) => {
    await c.query("INSERT INTO messages (project_id, role, content, item_id) VALUES ($1,'user',$2,$4), ($1,'assistant',$3,$4)", [b.projectId, b.message, reply, focus?.id ?? null]);
    if (focus) {
      await logEventIn(c, b.projectId, "challenge.row", `The AI reviewer argued against "${focus.title}"`, { itemId: focus.id, section: focus.section });
    } else {
      await logEventIn(c, b.projectId, "challenge.turn", "The proposition was challenged by the AI reviewer");
    }
  });
  return NextResponse.json(focus ? { reply, itemId: focus.id } : { reply });
});
