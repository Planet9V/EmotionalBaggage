import { NextResponse } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { logEventIn, tx } from "@/lib/db";
import { body as readBody, recordId, requireProject, route } from "@/lib/api/route";
import { completeStream, getReasoning, PROVIDER_LABEL, type ChatMessage } from "@/lib/ai/models";
import { buildSystemPrompt, recentMessages, requireChat, retrieve, stored } from "@/lib/chat/server";
import { chatAsk, cut, HISTORY_MESSAGES, type ChatMetadata, type ChatUIMessage } from "@/lib/chat/shared";

type Ctx = { params: Promise<{ id: string }> };

/** Text part id of the one text block an answer has. */
const TEXT_ID = "answer";

/**
 * Asks a question in a chat.
 *
 * 1. Finds the top sources: by meaning in pgvector when it is set up for this concept, otherwise by
 *    text (the reply's metadata says which, and why).
 * 2. Starts the reasoning model chosen in Admin with the numbered sources in its instructions and
 *    the chat so far. A model that is not chosen is a 503, one that cannot be reached a 502 or 504,
 *    each with the model layer's sentence, and nothing is saved.
 * 3. Saves the question and records it in the concept's history and the audit log (the question
 *    cut to 120 characters, never the answer), then streams the answer as an AI SDK UI message
 *    stream (what `useChat` reads): a `start` chunk whose metadata holds the sources, the model and
 *    how retrieval ran, the text, and a `finish` chunk whose metadata holds the saved answer's id.
 * 4. Saves the answer with its sources, and how they were found, once the stream has been read to the end.
 *    If the stream breaks first, the question stays as the last message with no answer; asking the same
 *    question again answers it without saving it twice.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const chatId = recordId((await params).id, "That chat");
  const b = await readBody(req, chatAsk);
  const chat = await requireChat(chatId);
  const project = await requireProject(chat.projectId);
  const reasoning = await getReasoning();
  if (!reasoning.ok) return NextResponse.json({ error: reasoning.reason, missing: reasoning.missing }, { status: 503 });

  const found = await retrieve(chat.projectId, b.message, { signal: req.signal });
  const recent = await recentMessages(chatId, HISTORY_MESSAGES);
  // A question whose answer never arrived (the stream broke) is the last message of the chat. Asking the
  // same thing again answers that question; it is not saved a second time and not sent to the model twice.
  const last = recent.at(-1);
  const retry = last?.role === "user" && last.content === b.message;
  const history: ChatMessage[] = (retry ? recent.slice(0, -1) : recent).map((m) => ({ role: m.role, content: m.content }));

  const answer = await completeStream({
    use: reasoning,
    system: buildSystemPrompt({ name: project.name, oneLiner: project.one_liner }, found.sources),
    messages: [...history, { role: "user", content: b.message }],
    maxOutputTokens: 1500,
    signal: req.signal,
  });

  const sources = found.sources.map(stored);
  if (!retry) {
    await tx(async (c) => {
      await c.query("INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, 'user', $2)", [chatId, b.message]);
      await c.query("UPDATE chats SET updated_at = now(), title = CASE WHEN title = '' THEN $2 ELSE title END WHERE id = $1", [chatId, cut(b.message, 80)]);
      await logEventIn(c, chat.projectId, "chat.asked", `Asked: ${b.message.slice(0, 120)}`, {
        chatId,
        retrieval: found.retrieval,
        sources: sources.length,
        model: reasoning.info.model,
      });
    });
  }

  const meta: ChatMetadata = {
    sources,
    retrieval: found.retrieval,
    ...(found.note ? { note: found.note } : {}),
    ...(found.search ? { search: found.search } : {}),
    model: reasoning.info.model,
    provider: PROVIDER_LABEL[reasoning.info.provider],
  };

  const stream = createUIMessageStream<ChatUIMessage>({
    async execute({ writer }) {
      writer.write({ type: "start", messageMetadata: meta });
      writer.write({ type: "text-start", id: TEXT_ID });
      const reader = answer.textStream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        writer.write({ type: "text-delta", id: TEXT_ID, delta: value });
      }
      writer.write({ type: "text-end", id: TEXT_ID });
      const end = await answer.done;
      const saved = await tx(async (c) => {
        const r = await c.query<{ id: string }>(
          "INSERT INTO chat_messages (chat_id, role, content, sources, model, retrieval, retrieval_note, search) VALUES ($1, 'assistant', $2, $3, $4, $5, $6, $7) RETURNING id",
          [chatId, end.text, JSON.stringify(sources), reasoning.info.model, found.retrieval, found.note ?? "", found.search ?? ""]
        );
        await c.query("UPDATE chats SET updated_at = now() WHERE id = $1", [chatId]);
        return Number(r.rows[0].id);
      });
      writer.write({ type: "finish", messageMetadata: { savedId: saved } });
    },
    // Model-layer errors are plain sentences without keys (ModelError); anything else is not shown.
    onError: (e) => (e instanceof Error && e.name === "ModelError" ? e.message : "The answer stopped before it finished, and it was not saved."),
  });

  return createUIMessageStreamResponse({ stream });
});
