// Chat with a concept: the routes, called directly against a real PostgreSQL, with the model
// stand-in (tests/standins/openai.ts) as the reasoning model. Locally there is no pgvector, so
// sources are found by text; the tests that need search by meaning run only where pgvector exists
// (GitHub Actions).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { parseJsonEventStream, readUIMessageStream, uiMessageChunkSchema, type UIMessageChunk } from "ai";
import { pool, q, ready } from "@/lib/db";
import { GET as listChats, POST as createChat } from "@/app/api/projects/[id]/chats/route";
import { GET as getChat, DELETE as deleteChat } from "@/app/api/chats/[id]/route";
import { POST as ask } from "@/app/api/chats/[id]/messages/route";
import { POST as reindex } from "@/app/api/index/route";
import { NO_PGVECTOR } from "@/lib/ai/embeddings";
import type { ChatMetadata, ChatSource, ChatUIMessage } from "@/lib/chat/shared";
import { start, type OpenAIOptions } from "../standins/openai";
import type { StandIn } from "../standins/core";
import { anonymous, ctx, json, read } from "./helpers";
import { chooseEmbedding, chooseReasoning, clearModelRows } from "../ai/setup";

await ready();
const hasVector = (await q("SELECT 1 FROM pg_extension WHERE extname='vector'")).length > 0;

const PROJECT = "zz-chat";
const REPLY = "The load cell under the handle weighs the bag [1]. Nothing recorded says what the battery costs.";
let s: StandIn<OpenAIOptions>;
let itemIds: number[] = [];
let researchId = 0;

const url = (path: string) => `http://test.local${path}`;
const newChat = async () => {
  const r = await read<{ chat: { id: number } }>(await createChat(json("POST", {}, url(`/api/projects/${PROJECT}/chats`)), ctx(PROJECT)));
  expect(r.status).toBe(201);
  return r.body.chat.id;
};

/** Reads a UI message stream response the way useChat does: SSE parsed into chunks, chunks into a message. */
async function readAnswer(res: Response) {
  expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
  const chunks: UIMessageChunk[] = [];
  const parsed = parseJsonEventStream({ stream: res.body!, schema: uiMessageChunkSchema }).pipeThrough(
    new TransformStream({
      transform(part, c) {
        if (!part.success) throw part.error;
        chunks.push(part.value as UIMessageChunk);
        c.enqueue(part.value as UIMessageChunk);
      },
    })
  );
  let message: ChatUIMessage | undefined;
  for await (const m of readUIMessageStream<ChatUIMessage>({ stream: parsed })) message = m;
  const text = message?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";
  return { chunks, message, text, meta: (message?.metadata ?? {}) as ChatMetadata };
}

beforeAll(async () => {
  s = await start({ prefix: "/v1", reply: REPLY });
  await clearModelRows();
  await q("DELETE FROM projects WHERE id=$1", [PROJECT]);
  await q("INSERT INTO projects (id, name, one_liner) VALUES ($1, 'ZZ Chat', 'A bag that weighs itself')", [PROJECT]);
  itemIds = [];
  for (const [n, [section, title, body]] of [
    ["design/bom", "Load cell under the handle", "Weighs the bag when lifted, 50 kg max"],
    ["design/bom", "Battery pack", "Two 18650 cells"],
    ["concept/brief", "Who it is for", "Travellers who fly budget airlines"],
  ].entries()) {
    const r = await q<{ id: string }>("INSERT INTO items (project_id, section, title, body, sort) VALUES ($1,$2,$3,$4,$5) RETURNING id", [PROJECT, section, title, body, n]);
    itemIds.push(Number(r[0].id));
  }
  const r = await q<{ id: string }>(
    "INSERT INTO research (project_id, query, answer) VALUES ($1, 'Airline weight limits for checked bags', 'Most budget airlines allow 20 to 23 kg per checked bag.') RETURNING id",
    [PROJECT]
  );
  researchId = Number(r[0].id);
});

afterAll(async () => {
  await s.close();
  await q("DELETE FROM projects WHERE id=$1", [PROJECT]);
  await q("DELETE FROM audit_log WHERE project_id=$1", [PROJECT]);
  await clearModelRows();
  await pool().end();
});

beforeEach(async () => {
  s.requests.length = 0;
  s.set({ reply: REPLY, failWith: undefined, failPath: undefined });
  await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "chat-reasoner" });
  await chooseEmbedding(null);
});

describe("signed out", () => {
  it("every chat route answers 401", async () => {
    expect((await listChats(anonymous("GET", undefined, url(`/api/projects/${PROJECT}/chats`)), ctx(PROJECT))).status).toBe(401);
    expect((await createChat(anonymous("POST", {}, url(`/api/projects/${PROJECT}/chats`)), ctx(PROJECT))).status).toBe(401);
    expect((await getChat(anonymous("GET", undefined, url("/api/chats/1")), ctx("1"))).status).toBe(401);
    expect((await deleteChat(anonymous("DELETE", undefined, url("/api/chats/1")), ctx("1"))).status).toBe(401);
    expect((await ask(anonymous("POST", { message: "hi" }, url("/api/chats/1/messages")), ctx("1"))).status).toBe(401);
  });
});

describe("chats", () => {
  it("creates, lists (with the set-up state) and deletes a chat, and records each in the history", async () => {
    const id = await newChat();
    const list = await read<{ chats: { id: number; title: string; messages: number }[]; setup: { reasoning: { ok: boolean; model?: string }; meaning: { ok: boolean; missing?: string; reason?: string } } }>(
      await listChats(json("GET", undefined, url(`/api/projects/${PROJECT}/chats`)), ctx(PROJECT))
    );
    expect(list.status).toBe(200);
    expect(list.body.chats.find((c) => c.id === id)).toMatchObject({ title: "", messages: 0 });
    expect(list.body.setup.reasoning).toMatchObject({ ok: true, model: "chat-reasoner" });
    expect(list.body.setup.meaning.ok).toBe(false);
    expect(list.body.setup.meaning.reason).toBe(hasVector ? "No embedding model is chosen. Choose one in Admin, Models." : NO_PGVECTOR);

    const one = await read<{ chat: { id: number }; messages: unknown[] }>(await getChat(json("GET", undefined, url(`/api/chats/${id}`)), ctx(String(id))));
    expect(one.status).toBe(200);
    expect(one.body.messages).toEqual([]);

    expect((await deleteChat(json("DELETE", undefined, url(`/api/chats/${id}`)), ctx(String(id)))).status).toBe(200);
    expect((await getChat(json("GET", undefined, url(`/api/chats/${id}`)), ctx(String(id)))).status).toBe(404);
    const events = await q<{ kind: string }>("SELECT kind FROM events WHERE project_id=$1 AND data->>'chatId' = $2 ORDER BY id", [PROJECT, String(id)]);
    expect(events.map((e) => e.kind)).toEqual(["chat.started", "chat.deleted"]);
  });

  it("answers 404 for an unknown concept or chat, and 400 for a bad body", async () => {
    expect((await listChats(json("GET", undefined, url("/api/projects/nope/chats")), ctx("nope"))).status).toBe(404);
    expect((await createChat(json("POST", {}, url("/api/projects/nope/chats")), ctx("nope"))).status).toBe(404);
    expect((await getChat(json("GET", undefined, url("/api/chats/999999999")), ctx("999999999"))).status).toBe(404);
    expect((await getChat(json("GET", undefined, url("/api/chats/abc")), ctx("abc"))).status).toBe(404);
    const id = await newChat();
    expect((await ask(json("POST", { message: "  " }, url(`/api/chats/${id}/messages`)), ctx(String(id)))).status).toBe(400);
    expect((await ask(json("POST", "not json", url(`/api/chats/${id}/messages`)), ctx(String(id)))).status).toBe(400);
    expect((await ask(json("POST", { message: "x".repeat(4001) }, url(`/api/chats/${id}/messages`)), ctx(String(id)))).status).toBe(400);
  });
});

describe("asking a question", () => {
  it("answers 503 with the model layer's sentence when no reasoning model is chosen, and saves nothing", async () => {
    await chooseReasoning(null);
    const id = await newChat();
    const r = await read<{ error: string }>(await ask(json("POST", { message: "How heavy can the bag be?" }, url(`/api/chats/${id}/messages`)), ctx(String(id))));
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("No reasoning model is chosen. Choose one in Admin, Models.");
    expect(await q("SELECT 1 FROM chat_messages WHERE chat_id=$1", [id])).toHaveLength(0);
    const list = await read<{ setup: { reasoning: { ok: boolean; reason: string } } }>(await listChats(json("GET", undefined, url(`/api/projects/${PROJECT}/chats`)), ctx(PROJECT)));
    expect(list.body.setup.reasoning).toMatchObject({ ok: false, reason: "No reasoning model is chosen. Choose one in Admin, Models." });
  });

  it("answers 502 when the model cannot answer, and saves nothing", async () => {
    s.set({ failWith: 500 });
    const id = await newChat();
    const r = await read<{ error: string }>(await ask(json("POST", { message: "How heavy can the bag be?" }, url(`/api/chats/${id}/messages`)), ctx(String(id))));
    expect(r.status).toBe(502);
    expect(r.body.error).toMatch(/Ollama answered HTTP 500/);
    expect(await q("SELECT 1 FROM chat_messages WHERE chat_id=$1", [id])).toHaveLength(0);
  });

  it("streams the answer, falls back to text search with the reason, and saves both messages with the sources", async () => {
    const id = await newChat();
    const question = "What does the load cell under the handle weigh, and what do airlines allow?";
    const res = await ask(json("POST", { message: question }, url(`/api/chats/${id}/messages`)), ctx(String(id)));
    expect(res.status).toBe(200);
    const { chunks, text, meta } = await readAnswer(res);

    // the stream: start with metadata, text, finish with the saved id
    expect(chunks[0].type).toBe("start");
    expect(chunks.filter((c) => c.type === "text-delta").length).toBeGreaterThan(1);
    expect(chunks.at(-1)?.type).toBe("finish");
    expect(text).toBe(REPLY);

    // retrieval fell back to text, and says why
    expect(meta.retrieval).toBe("text");
    expect(meta.note).toBe(hasVector ? "No embedding model is chosen. Choose one in Admin, Models." : NO_PGVECTOR);
    expect(meta.model).toBe("chat-reasoner");
    expect(meta.provider).toBe("Ollama");
    const sources = meta.sources as ChatSource[];
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.map((x) => x.n)).toEqual(sources.map((_, i) => i + 1));
    // the load cell row matches most words; the research answer matches "airlines"
    expect(sources[0]).toMatchObject({ n: 1, kind: "item", id: itemIds[0], section: "design/bom", title: "Load cell under the handle" });
    expect(sources.find((x) => x.kind === "research")).toMatchObject({ id: researchId, section: "research/ask", title: "Airline weight limits for checked bags" });
    expect(typeof meta.savedId).toBe("number");

    // the model was given the sources, numbered, with the rules, and the question
    const sent = s.requests.find((r) => r.path === "/v1/chat/completions")!.body as { messages: { role: string; content: string }[]; stream: boolean };
    expect(sent.stream).toBe(true);
    const system = sent.messages.find((m) => m.role === "system")!.content;
    expect(system).toContain('"ZZ Chat" (A bag that weighs itself)');
    expect(system).toContain("[1] Bill of materials: Load cell under the handle\nLoad cell under the handle\nWeighs the bag when lifted, 50 kg max");
    expect(system).toContain("Weighs the bag when lifted, 50 kg max");
    expect(system).toMatch(/Answer only from the sources/);
    expect(system).toContain("[2] Saved research answer: Airline weight limits for checked bags\nQuestion: Airline weight limits");
    expect(sent.messages.at(-1)).toEqual({ role: "user", content: question });

    // both messages saved; the answer with its sources and model; the chat titled
    const saved = await read<{ chat: { title: string }; messages: { id: number; role: string; content: string; sources: ChatSource[]; model: string }[] }>(
      await getChat(json("GET", undefined, url(`/api/chats/${id}`)), ctx(String(id)))
    );
    expect(saved.body.chat.title).toBe(question); // under 80 characters, so kept whole
    expect(saved.body.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(saved.body.messages[0].content).toBe(question);
    expect(saved.body.messages[1]).toMatchObject({ id: meta.savedId, content: REPLY, model: "chat-reasoner", sources });

    // recorded in the history and the audit log, with the question cut to 120 characters and never the answer
    const audit = await q<{ summary: string; detail: Record<string, unknown> }>("SELECT summary, detail FROM audit_log WHERE project_id=$1 AND action='chat.asked' ORDER BY id DESC LIMIT 1", [PROJECT]);
    expect(audit[0].summary).toBe(`Asked: ${question}`);
    expect(JSON.stringify(audit[0])).not.toContain("Nothing recorded says");
    expect(audit[0].detail).toMatchObject({ chatId: id, retrieval: "text", model: "chat-reasoner" });
  });

  it("sends the chat so far with the next question, and cuts the recorded question to 120 characters", async () => {
    const id = await newChat();
    await readAnswer(await ask(json("POST", { message: "Who is it for?" }, url(`/api/chats/${id}/messages`)), ctx(String(id))));
    s.requests.length = 0;
    const long = `Battery ${"and more ".repeat(30)}`.trim();
    await readAnswer(await ask(json("POST", { message: long }, url(`/api/chats/${id}/messages`)), ctx(String(id))));
    const sent = s.requests.find((r) => r.path === "/v1/chat/completions")!.body as { messages: { role: string; content: string }[] };
    expect(sent.messages.filter((m) => m.role !== "system")).toEqual([
      { role: "user", content: "Who is it for?" },
      { role: "assistant", content: REPLY },
      { role: "user", content: long },
    ]);
    const ev = await q<{ summary: string }>("SELECT summary FROM events WHERE project_id=$1 AND kind='chat.asked' ORDER BY id DESC LIMIT 1", [PROJECT]);
    expect(ev[0].summary).toBe(`Asked: ${long.slice(0, 120)}`);
  });

  it("keeps how the sources were found with the saved answer", async () => {
    const id = await newChat();
    const { meta } = await readAnswer(await ask(json("POST", { message: "What does the load cell weigh?" }, url(`/api/chats/${id}/messages`)), ctx(String(id))));
    const row = await q<{ retrieval: string; retrieval_note: string }>("SELECT retrieval, retrieval_note FROM chat_messages WHERE chat_id=$1 AND role='assistant'", [id]);
    expect(row[0].retrieval).toBe(meta.retrieval);
    expect(row[0].retrieval_note).toBe(meta.note);
    const saved = await read<{ messages: { role: string; retrieval: string; note?: string }[] }>(await getChat(json("GET", undefined, url(`/api/chats/${id}`)), ctx(String(id))));
    expect(saved.body.messages[1]).toMatchObject({ retrieval: "text", note: meta.note });
    // an answer saved before the column existed reads as not recorded, never as a guess
    await q("UPDATE chat_messages SET retrieval='', retrieval_note='' WHERE chat_id=$1", [id]);
    const old = await read<{ messages: { retrieval: string; note?: string }[] }>(await getChat(json("GET", undefined, url(`/api/chats/${id}`)), ctx(String(id))));
    expect(old.body.messages[1]).toMatchObject({ retrieval: "" });
    expect(old.body.messages[1].note).toBeUndefined();
  });

  it("answers a question whose answer never arrived without saving the question twice or sending it twice", async () => {
    const id = await newChat();
    const question = "What does the load cell weigh?";
    // the state a broken stream leaves: the question saved, no answer
    await q("INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, 'user', $2)", [id, question]);
    s.requests.length = 0;
    const { text } = await readAnswer(await ask(json("POST", { message: question }, url(`/api/chats/${id}/messages`)), ctx(String(id))));
    expect(text).toBe(REPLY);
    const saved = await read<{ messages: { role: string }[] }>(await getChat(json("GET", undefined, url(`/api/chats/${id}`)), ctx(String(id))));
    expect(saved.body.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    const sent = s.requests.find((r) => r.path === "/v1/chat/completions")!.body as { messages: { role: string; content: string }[] };
    expect(sent.messages.filter((m) => m.role === "user")).toHaveLength(1);
    // the same words asked again after an answer are a new question
    await readAnswer(await ask(json("POST", { message: question }, url(`/api/chats/${id}/messages`)), ctx(String(id))));
    const again = await read<{ messages: { role: string }[] }>(await getChat(json("GET", undefined, url(`/api/chats/${id}`)), ctx(String(id))));
    expect(again.body.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
  });

  it("tells the model there are no sources when nothing matches", async () => {
    const id = await newChat();
    const { meta } = await readAnswer(await ask(json("POST", { message: "zzqx yyvv?" }, url(`/api/chats/${id}/messages`)), ctx(String(id))));
    expect(meta.sources).toEqual([]);
    const system = (s.requests.find((r) => r.path === "/v1/chat/completions")!.body as { messages: { role: string; content: string }[] }).messages[0].content;
    expect(system).toContain("Sources: none.");
  });
});

describe.runIf(hasVector)("asking with pgvector", () => {
  beforeEach(async () => {
    s.set({ dimensions: 8 });
    await chooseEmbedding({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "chat-embed", dims: 8 });
  });

  it("indexes rows and research answers, then finds sources by meaning", async () => {
    const idx = await read<{ indexed: number; research: { indexed: number } }>(await reindex(json("POST", { projectId: PROJECT })));
    expect(idx.status).toBe(200);
    expect(idx.body.indexed).toBe(4);
    expect(idx.body.research.indexed).toBe(1);
    const id = await newChat();
    // the stand-in embeds the same text to the same vector, so asking the research text finds it first
    const { meta } = await readAnswer(
      await ask(json("POST", { message: "Airline weight limits for checked bags\nMost budget airlines allow 20 to 23 kg per checked bag." }, url(`/api/chats/${id}/messages`)), ctx(String(id)))
    );
    // the question's words also occur in the sources, so both searches found them and the rankings were joined
    expect(meta.retrieval).toBe("both");
    expect(meta.note).toBeUndefined();
    expect(meta.search).toBe("exact"); // four vectors: far under the exact-search threshold
    expect(meta.sources?.[0]).toMatchObject({ n: 1, kind: "research", id: researchId });
    expect(meta.sources).toHaveLength(4);
  });

  it("uses meaning alone when no word of the question occurs in any source", async () => {
    await reindex(json("POST", { projectId: PROJECT }));
    const id = await newChat();
    const { meta } = await readAnswer(await ask(json("POST", { message: "zzqx yyvv?" }, url(`/api/chats/${id}/messages`)), ctx(String(id))));
    expect(meta.retrieval).toBe("meaning");
    expect(meta.sources?.length).toBeGreaterThan(0);
  });

  it("falls back to text, and says why, when the embedding call fails", async () => {
    await read(await reindex(json("POST", { projectId: PROJECT })));
    s.set({ failWith: 500, failPath: "/v1/embeddings" });
    const id = await newChat();
    const { meta, text } = await readAnswer(await ask(json("POST", { message: "load cell" }, url(`/api/chats/${id}/messages`)), ctx(String(id))));
    expect(text).toBe(REPLY);
    expect(meta.retrieval).toBe("text");
    expect(meta.note).toMatch(/^Search by meaning failed, so sources were found by text: Ollama answered HTTP 500/);
  });
});
