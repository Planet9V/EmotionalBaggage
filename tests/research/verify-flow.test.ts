// F5: research on the example concept. "Verify this" attaches the cited answer to the row it came from; a claim
// cannot be marked verified without a source the user judged; an unsourced competitor price is not saved as a
// figure; Chat finds a saved research answer by meaning (stand-in embedding model at a small width, with
// vectors that put texts about the same thing together although they share no word).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { parseJsonEventStream, readUIMessageStream, uiMessageChunkSchema } from "ai";
import { pool, q } from "@/lib/db";
import { POST as ASK } from "@/app/api/research/route";
import { POST as EVIDENCE } from "@/app/api/research/evidence/route";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import { POST as generate } from "@/app/api/projects/[id]/market/generate/route";
import { POST as approveRun } from "@/app/api/drafts/approve-run/route";
import { POST as createChat } from "@/app/api/projects/[id]/chats/route";
import { POST as chatAsk } from "@/app/api/chats/[id]/messages/route";
import { POST as reindex } from "@/app/api/index/route";
import { competitorRange } from "@/lib/market/pricing";
import type { ChatMetadata, ChatUIMessage } from "@/lib/chat/shared";
import * as perplexity from "../standins/perplexity";
import { start, type OpenAIOptions } from "../standins/openai";
import type { StandIn } from "../standins/core";
import { ctx, json, read, SEEDED } from "../api/helpers";
import { chooseEmbedding, chooseReasoning, clearModelRows } from "../ai/setup";

const KEY = "pplx-verify-flow-key-4321";
const hasVector = (await q("SELECT 1 FROM pg_extension WHERE extname='vector'")).length > 0;
let pp: StandIn<perplexity.PerplexityOptions>;
let oa: StandIn<OpenAIOptions>;
let modelReply = "";

/** Toy "meaning": each topic is one direction, so texts on the same topic land together whatever their words. */
const TOPICS: RegExp[] = [/\b(weigh|weight|heavy|kg|kilos?|luggage|baggage|suitcase|allowance|allow)\w*/i, /\b(battery|batteries|lithium|charge|power)\w*/i, /\b(price|cost|sells?|cheap)\w*/i];
const toyEmbed = (text: string, dims: number) => {
  const v: number[] = Array.from({ length: dims }, (_, i) => (i < TOPICS.length && TOPICS[i].test(text) ? 1 : 0));
  v[dims - 1] += 0.05; // never all zero
  const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
  return v.map((x) => x / n);
};

const claims: number[] = [];

beforeAll(async () => {
  pp = await perplexity.start({ apiKey: KEY, reply: "Rival Scale sells for $24.99 [1]. Some forums mention a $99 premium scale [2].", citations: ["https://cite.example/rival", "https://cite.example/forum"], costUsd: 0.001 });
  process.env.PERPLEXITY_BASE_URL = pp.url;
  await q("DELETE FROM credentials WHERE provider='perplexity' AND field='apiKey'");
  await q("INSERT INTO credentials (provider, field, value) VALUES ('perplexity','apiKey',$1)", [KEY]);
  oa = await start({ prefix: "/v1", dimensions: 4, embed: toyEmbed, reply: () => modelReply });
  for (const t of ["zz verify: rival scales cost about 25 dollars", "zz verify: second claim"]) {
    const r = await read<{ item: { id: number } }>(await addItem(json("POST", { section: "research/claims", title: t, status: "unverified" }), ctx(SEEDED)));
    claims.push(r.body.item.id);
  }
});

afterAll(async () => {
  delete process.env.PERPLEXITY_BASE_URL;
  await q("DELETE FROM credentials WHERE provider='perplexity' AND value=$1", [KEY]);
  await q("DELETE FROM items WHERE project_id=$1 AND (title LIKE 'zz verify%' OR title IN ('Rival Scale','Premium scale'))", [SEEDED]);
  await q("DELETE FROM research WHERE project_id=$1 AND query LIKE 'zz verify%'", [SEEDED]);
  await q("DELETE FROM projects WHERE id='zz-verify-chat'");
  await clearModelRows();
  await pp.close();
  await oa.close();
  await pool().end();
});

beforeEach(async () => {
  await chooseReasoning({ provider: "ollama", baseUrl: `${oa.url}/v1`, model: "verify-reasoner" });
});

const claim = async (id: number) => (await q<{ status: string; data: Record<string, unknown> }>("SELECT status, data FROM items WHERE id=$1", [id]))[0];

describe("Verify this on the example concept", () => {
  let researchId = 0;

  it("attaches the cited answer to the row it came from, recorded, and leaves the claim unverified", async () => {
    const r = await read<{ entry: { id: number; citations: string[] }; attached: { id: number; section: string; data: { research: unknown[] } } }>(
      await ASK(json("POST", { projectId: SEEDED, query: "zz verify: what do rival scales cost?", itemId: claims[0] }))
    );
    expect(r.status).toBe(201);
    researchId = r.body.entry.id;
    expect(r.body.attached).toMatchObject({ id: claims[0], section: "research/claims" });
    const c = await claim(claims[0]);
    expect(c.status).toBe("unverified");
    expect(c.data.research).toEqual([{ researchId, question: "zz verify: what do rival scales cost?", sources: 2, askedAt: expect.any(String) }]);
    const ev = await q<{ summary: string; data: { before: unknown; after: unknown } }>("SELECT summary, data FROM events WHERE project_id=$1 AND kind='item.edited' AND data->>'itemId'=$2 ORDER BY id DESC LIMIT 1", [SEEDED, String(claims[0])]);
    expect(ev[0].summary).toContain("research answer attached (2 sources)");
    expect(ev[0].data.before).toEqual({ "data.research": [] });
  });

  it("refuses a row of another concept before Perplexity is asked (and billed)", async () => {
    const n = pp.requests.length;
    await q("INSERT INTO projects (id, name) VALUES ('zz-verify-chat', 'ZZ Verify chat') ON CONFLICT DO NOTHING");
    const other = (await q<{ id: string }>("INSERT INTO items (project_id, section, title, status) VALUES ('zz-verify-chat','research/claims','zz other','unverified') RETURNING id"))[0].id;
    const r = await read<{ error: string }>(await ASK(json("POST", { projectId: SEEDED, query: "zz verify: x", itemId: Number(other) })));
    expect(r.status).toBe(404);
    expect(pp.requests.length).toBe(n);
  });

  it("a claim cannot be marked verified by hand, nor through the row's data; a judged source verifies it", async () => {
    const hand = await read<{ error: string }>(await patchItem(json("PATCH", { status: "verified" }), ctx(String(claims[0]))));
    expect(hand.status).toBe(400);
    expect(hand.body.error).toContain("no source supports it yet");
    const forged = await read<{ error: string }>(await patchItem(json("PATCH", { data: { evidence: [{ url: "https://x", verdict: "supports" }] } }), ctx(String(claims[0]))));
    expect(forged.status).toBe(400);
    expect((await claim(claims[0])).status).toBe("unverified");

    const ev = await read<{ status: string }>(await EVIDENCE(json("POST", { claimId: claims[0], url: "https://cite.example/rival", researchId, quote: "The rival sells at 24.99.", verdict: "supports" })));
    expect(ev.status).toBe(201);
    expect(ev.body.status).toBe("verified");
    expect((await claim(claims[0])).status).toBe("verified");
  });

  it("an evidence source must be one the saved answer cited", async () => {
    const r = await read<{ error: string }>(await EVIDENCE(json("POST", { claimId: claims[1], url: "https://not-cited.example/x", researchId, verdict: "supports" })));
    expect(r.status).toBe(400);
    expect((await claim(claims[1])).status).toBe("unverified");
  });

  it("an unsourced competitor price is kept as words and never saved as a figure; the sourced one is", async () => {
    // the drafting engine asks for { rows: [ <the generator's own output> ] }
    modelReply = JSON.stringify({ rows: [{
      rows: [
        { name: "Rival Scale", kind: "product", what: "A luggage scale", priceText: "$24.99", claim: "", weakness: "", sourceUrl: "https://cite.example/rival" },
        { name: "Premium scale", kind: "product", what: "A premium scale", priceText: "$99", claim: "", weakness: "", sourceUrl: "https://made-up.example/premium" },
      ],
    }] });
    const r = await read<{ runId: string; notes: string[] }>(await generate(json("POST", { generator: "competitors", researchId, supersede: true }), ctx(SEEDED)));
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.notes.join(" ")).toContain('"Premium scale": the price "$99" has no source, so it is kept as words, not as a figure.');
    const a = await read<{ approved: { item: { title: string; data: Record<string, unknown> } }[] }>(await approveRun(json("POST", { projectId: SEEDED, runId: r.body.runId, confirm: true })));
    const by = Object.fromEntries(a.body.approved.map((x) => [x.item.title, x.item.data]));
    expect(by["Rival Scale"]).toMatchObject({ basis: "research", priceMinor: 2499, currency: "USD" });
    expect(by["Premium scale"]).toMatchObject({ basis: "unsourced", priceText: "$99" });
    expect(by["Premium scale"].priceMinor).toBeUndefined();
    // the comparison pricing makes reads figures only, so the unsourced price cannot move it
    const range = competitorRange([{ name: "Rival Scale", priceMinor: 2499, currency: "USD", sourced: true }], "USD");
    expect(range).toEqual({ count: 1, low: 2499, median: 2499, high: 2499 });
  });
});

describe("a long research question (the Competitors page's own default is over 300 characters)", () => {
  it("does not drop every drafted competitor: the source title is clipped to what the record keeps", async () => {
    const long = `zz verify long: ${"What do buyers use today instead of this product? ".repeat(8)}`;
    expect(long.length).toBeGreaterThan(300);
    const rid = Number((await q<{ id: string }>("INSERT INTO research (project_id, query, answer, citations, sources) VALUES ($1,$2,'Rival Scale sells for $24.99 [1].','[\"https://cite.example/rival\"]','[{\"url\":\"https://cite.example/rival\",\"title\":\"\"}]') RETURNING id", [SEEDED, long]))[0].id);
    modelReply = JSON.stringify({ rows: [{ rows: [{ name: "Long Rival", kind: "product", what: "x", priceText: "$24.99", claim: "", weakness: "", sourceUrl: "https://cite.example/rival" }] }] });
    const r = await read<{ drafts: { data: { generatedFrom: { sources: { title: string }[] } } }[]; dropped: unknown[] }>(await generate(json("POST", { generator: "competitors", researchId: rid, supersede: true }), ctx(SEEDED)));
    expect(r.status).toBe(201);
    expect(r.body.dropped).toEqual([]);
    expect(r.body.drafts).toHaveLength(1);
    expect(r.body.drafts[0].data.generatedFrom.sources[0].title.length).toBeLessThanOrEqual(300);
    await q("DELETE FROM drafts WHERE project_id=$1 AND title='Long Rival'", [SEEDED]);
  });
});

describe.runIf(hasVector)("Chat finds a saved research answer by meaning", () => {
  it("a question that shares no word with the answer finds it by meaning alone, at width 4", async () => {
    const P = "zz-verify-chat";
    await q("DELETE FROM items WHERE project_id=$1", [P]);
    await q("INSERT INTO items (project_id, section, title, body) VALUES ($1,'design/bom','Battery pack','Two lithium cells')", [P]);
    const rid = Number((await q<{ id: string }>("INSERT INTO research (project_id, query, answer, citations) VALUES ($1,'zz verify: airline baggage allowance','Most budget airlines allow 23 kg per checked bag [1].','[\"https://cite.example/air\"]') RETURNING id", [P]))[0].id);
    await chooseEmbedding({ provider: "ollama", baseUrl: `${oa.url}/v1`, model: "verify-embed", dims: 4 });
    const idx = await read<{ research: { indexed: number } }>(await reindex(json("POST", { projectId: P })));
    expect(idx.status).toBe(200);
    expect(idx.body.research.indexed).toBe(1);
    const chat = await read<{ chat: { id: number } }>(await createChat(json("POST", {}), ctx(P)));
    modelReply = "Most budget airlines allow 23 kg [1].";
    const res = await chatAsk(json("POST", { message: "How heavy may my suitcase be?" }), ctx(String(chat.body.chat.id)));
    const parsed = parseJsonEventStream({ stream: res.body!, schema: uiMessageChunkSchema }).pipeThrough(
      new TransformStream({ transform(part, c) { if (part.success) c.enqueue(part.value); } })
    );
    let message: ChatUIMessage | undefined;
    for await (const m of readUIMessageStream<ChatUIMessage>({ stream: parsed as never })) message = m;
    const meta = (message?.metadata ?? {}) as ChatMetadata;
    expect(meta.retrieval).toBe("meaning");
    expect(meta.sources?.[0]).toMatchObject({ kind: "research", id: rid });
    await chooseEmbedding(null);
  });
});
