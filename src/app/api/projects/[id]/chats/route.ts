import { NextResponse } from "next/server";
import { z } from "zod";
import { logEvent, q } from "@/lib/db";
import { body as readBody, requireProject, route } from "@/lib/api/route";
import { getEmbedding, getReasoning, PROVIDER_LABEL } from "@/lib/ai/models";
import { meaningReady } from "@/lib/ai/embeddings";
import { listChats, toChat } from "@/lib/chat/server";

type Ctx = { params: Promise<{ id: string }> };

const createChat = z.object({ title: z.string().trim().max(200).optional() });

/**
 * The chats of a concept, newest first, and whether chat is set up: a reasoning model chosen in
 * Admin (without one there is no chat), and search by meaning ready for this concept (without it
 * the chat finds its sources by text, and `meaning.reason` says why).
 */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const [chats, reasoning, embedding, meaning] = await Promise.all([listChats(id), getReasoning(), getEmbedding(), meaningReady(id)]);
  return NextResponse.json({
    chats,
    setup: {
      reasoning: reasoning.ok
        ? { ok: true, model: reasoning.info.model, provider: PROVIDER_LABEL[reasoning.info.provider] }
        : { ok: false, missing: reasoning.missing, reason: reasoning.reason },
      meaning: meaning.ok
        ? { ok: true, model: meaning.emb.info.model, dims: meaning.emb.info.dims }
        : {
            ok: false,
            missing: meaning.missing,
            reason: meaning.reason,
            ...(embedding.ok ? { model: embedding.info.model, dims: embedding.info.dims } : {}),
          },
    },
  });
});

/** Starts an empty chat. Its title becomes the first question unless one is given. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await readBody(req, createChat);
  await requireProject(id);
  const rows = await q<{ id: string; project_id: string; title: string; created_at: string; updated_at: string }>(
    "INSERT INTO chats (project_id, title) VALUES ($1, $2) RETURNING id, project_id, title, created_at, updated_at",
    [id, b.title ?? ""]
  );
  const chat = toChat(rows[0]);
  await logEvent(id, "chat.started", b.title ? `Started a chat: ${b.title.slice(0, 120)}` : "Started a chat", { chatId: chat.id });
  return NextResponse.json({ chat: { ...chat, messages: 0 } }, { status: 201 });
});
