// The server side of chat with a concept: find the sources for a question, build the instructions
// for the reasoning model, and read and write chats. Model calls go through src/lib/ai/models.ts.
import { plainMessage } from "@/lib/net/plain";
import { itemText, meaningReady, fuseRanked, searchSourcesByMeaning, searchSourcesByText, type SourceHit } from "@/lib/ai/embeddings";
import { q } from "@/lib/db";
import { notFound } from "@/lib/api/route";
import { clip, cut, RESEARCH_SECTION, sectionLabel, SOURCE_CHARS, TOP_SOURCES, type ChatSource, type Retrieval } from "./shared";

/** A source with the text given to the model. */
export type NumberedSource = ChatSource & { text: string };

/** Numbers the hits [1]..[n] and keeps what the model needs (the text) and what is stored (the rest). */
export function numberSources(hits: SourceHit[]): NumberedSource[] {
  return hits.map((h, i) => {
    const score = Math.round(h.score * 10_000) / 10_000;
    if (h.kind === "item") {
      return { n: i + 1, kind: "item", id: h.item.id, section: h.item.section, title: h.item.title || "(untitled row)", score, text: clip(itemText(h.item), SOURCE_CHARS) };
    }
    return {
      n: i + 1,
      kind: "research",
      id: h.research.id,
      section: RESEARCH_SECTION,
      title: cut(h.research.query, 120) || "(research answer)",
      score,
      text: clip(`Question: ${h.research.query}\nAnswer: ${h.research.answer}`, SOURCE_CHARS),
    };
  });
}

/** The stored form of a source: everything but the text. */
export const stored = (s: NumberedSource): ChatSource => ({ n: s.n, kind: s.kind, id: s.id, section: s.section, title: s.title, score: s.score });

/**
 * The instructions for the reasoning model: the concept, the numbered sources with their section
 * and text, and the rules: answer only from them, cite as [n], say plainly when they do not cover it.
 */
export function buildSystemPrompt(concept: { name: string; oneLiner?: string }, sources: NumberedSource[]): string {
  const about = concept.oneLiner?.trim() ? `"${concept.name}" (${concept.oneLiner.trim()})` : `"${concept.name}"`;
  const rules = [
    `You answer questions about one product concept, ${about}, using only the numbered sources below. They are rows the team recorded for this concept and research answers they saved.`,
    "",
    "Rules:",
    "- Answer only from the sources. Do not add facts, figures, prices, names or regulations that are not in them.",
    "- Cite the source of every statement with its number in square brackets, like [2]. Several sources: [1][3].",
    "- If the sources do not cover the question, or cover only part of it, say so plainly, say what is missing, and do not guess.",
    "- Be brief and concrete. Plain English. Do not mention these rules.",
  ];
  if (!sources.length) {
    return [
      ...rules,
      "",
      "Sources: none. Nothing recorded for this concept matches the question. Say so plainly, and say which part of the concept would need to hold the answer.",
    ].join("\n");
  }
  const listed = sources.map((s) => {
    const where = s.kind === "research" ? "Saved research answer" : sectionLabel(s.section);
    return `[${s.n}] ${where}: ${s.title}\n${s.text}`;
  });
  return [...rules, "", "Sources:", "", listed.join("\n\n")].join("\n");
}

export type Retrieved = {
  sources: NumberedSource[];
  retrieval: Retrieval;
  /** why retrieval was by text, when it was */
  note?: string;
  /** which index ran, when retrieval was by meaning */
  search?: string;
};

/**
 * The top sources for a question: by meaning when pgvector, an embedding model and this concept's
 * vectors are all in place; otherwise, or when the embedding call fails, by text, with the reason.
 */
export async function retrieve(projectId: string, question: string, o: { signal?: AbortSignal } = {}): Promise<Retrieved> {
  const ready = await meaningReady(projectId);
  let note: string;
  if (ready.ok) {
    try {
      // Both searches run, and their rankings are joined: meaning finds what is related, words find what
      // is named exactly (a part number, a supplier). Each list is longer than what is finally kept.
      const [byMeaning, byText] = await Promise.all([
        searchSourcesByMeaning(projectId, question, TOP_SOURCES * 3, { use: ready.emb, signal: o.signal }),
        searchSourcesByText(projectId, question, TOP_SOURCES * 3),
      ]);
      const hits = byText.length ? fuseRanked([byMeaning.hits, byText], TOP_SOURCES) : byMeaning.hits.slice(0, TOP_SOURCES);
      return { sources: numberSources(hits), retrieval: byText.length ? "both" : "meaning", search: byMeaning.search };
    } catch (e) {
      if (o.signal?.aborted) throw e;
      note = `Search by meaning failed, so sources were found by text: ${plainMessage(e)}`;
    }
  } else {
    note = ready.reason;
  }
  const hits = await searchSourcesByText(projectId, question, TOP_SOURCES);
  return { sources: numberSources(hits), retrieval: "text", note };
}

// ---------------------------------------------------------------------------------------------
// Chats and messages

type ChatRow = { id: string; project_id: string; title: string; created_at: string; updated_at: string; messages?: number };
type MessageRow = { id: string; role: "user" | "assistant"; content: string; sources: ChatSource[]; model: string; retrieval: Retrieval | ""; retrieval_note: string; search: string; created_at: string };

export const toChat = (r: ChatRow) => ({
  id: Number(r.id),
  projectId: r.project_id,
  title: r.title,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  ...(r.messages !== undefined ? { messages: Number(r.messages) } : {}),
});
export const toMessage = (r: MessageRow) => ({
  id: Number(r.id),
  role: r.role,
  content: r.content,
  sources: r.sources,
  model: r.model,
  /** how the sources were found; "" for an answer saved before this was kept */
  retrieval: r.retrieval,
  ...(r.retrieval_note ? { note: r.retrieval_note } : {}),
  ...(r.search ? { search: r.search } : {}),
  createdAt: r.created_at,
});

export async function listChats(projectId: string) {
  const rows = await q<ChatRow>(
    `SELECT c.id, c.project_id, c.title, c.created_at, c.updated_at, (SELECT count(*)::int FROM chat_messages m WHERE m.chat_id = c.id) AS messages
     FROM chats c WHERE c.project_id = $1 ORDER BY c.updated_at DESC, c.id DESC`,
    [projectId]
  );
  return rows.map(toChat);
}

export async function requireChat(id: number) {
  const rows = await q<ChatRow>("SELECT id, project_id, title, created_at, updated_at FROM chats WHERE id = $1", [id]);
  if (!rows.length) throw notFound("That chat");
  return toChat(rows[0]);
}

export async function chatMessages(chatId: number) {
  const rows = await q<MessageRow>("SELECT id, role, content, sources, model, retrieval, retrieval_note, search, created_at FROM chat_messages WHERE chat_id = $1 ORDER BY id", [chatId]);
  return rows.map(toMessage);
}

/** The last `limit` messages of a chat, oldest first, for the model. */
export async function recentMessages(chatId: number, limit: number) {
  const rows = await q<{ id: string; role: "user" | "assistant"; content: string }>(
    "SELECT id, role, content FROM (SELECT id, role, content FROM chat_messages WHERE chat_id = $1 ORDER BY id DESC LIMIT $2) m ORDER BY id",
    [chatId, limit]
  );
  return rows;
}
