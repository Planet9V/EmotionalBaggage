import { NextResponse } from "next/server";
import { logEvent, q } from "@/lib/db";
import { recordId, route } from "@/lib/api/route";
import { chatMessages, requireChat } from "@/lib/chat/server";

type Ctx = { params: Promise<{ id: string }> };

/** One chat with its messages, oldest first; assistant messages carry their numbered sources. */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const chat = await requireChat(recordId((await params).id, "That chat"));
  return NextResponse.json({ chat, messages: await chatMessages(chat.id) });
});

/** Deletes a chat and its messages. The concept's history and the audit log keep the record. */
export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const chat = await requireChat(recordId((await params).id, "That chat"));
  await q("DELETE FROM chats WHERE id = $1", [chat.id]);
  await logEvent(chat.projectId, "chat.deleted", chat.title ? `Deleted the chat "${chat.title.slice(0, 120)}"` : "Deleted a chat", { chatId: chat.id });
  return NextResponse.json({ ok: true });
});
