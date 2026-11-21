// Find alternates and Check prices on real PostgreSQL. Perplexity is a stand-in (`ask` is mocked): what is proved is what the app does with
// an answer, not what Perplexity says.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const answer = vi.hoisted(() => ({ text: "", sources: [] as { url: string }[], ok: true, calls: 0 }));
vi.mock("@/lib/research/perplexity", async (orig) => {
  const real = await orig<typeof import("@/lib/research/perplexity")>();
  return {
    ...real,
    ask: vi.fn(async () => {
      answer.calls++;
      return answer.ok ? { ok: true, answer: answer.text, sources: answer.sources, model: "stub/model", costUsd: 0.01, raw: {} } : { ok: false, kind: "rate_limited", message: "Perplexity is busy." };
    }),
  };
});

import { pool, q } from "@/lib/db";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import { POST as researchRoute } from "@/app/api/projects/[id]/sourcing/research/route";
import { POST as approveRoute } from "@/app/api/drafts/[id]/approve/route";
import { ctx, json, read, SEEDED } from "../api/helpers";

// Row data read back from the database: shape checked by the assertions, not by the type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

type Item = { id: number; status: string; data: Loose };
let seq = 0;
const PAGE = "https://www.mouser.com/ProductDetail/ABC-1/";

async function makePart(data: Record<string, unknown> = {}) {
  const r = await read<{ item: Item }>(await addItem(json("POST", { section: "design/bom", title: "test: buck converter", data: { ref: `TU${++seq}`, qty: 2, ...data } }), ctx(SEEDED)));
  if (!r.body.item) throw new Error(JSON.stringify(r.body));
  return r.body.item;
}
const ask = (partId: number, kind: "prices" | "alternates", confirm = true) => researchRoute(json("POST", { partId, kind, confirm }), ctx(SEEDED));
const sourcingOf = async (id: number) => (await q<{ data: Loose }>("SELECT data FROM items WHERE id=$1", [id]))[0].data.sourcing;
/** Undecided engine drafts on this part. */
const draftsOf = async (id: number) => q<Loose>("SELECT id, generator, title, data, sources, status FROM drafts WHERE item_id=$1 AND status='draft' ORDER BY id", [id]);
type EngineDraft = { id: number; generator: string; title: string; data: Loose; op: { op: string; field?: string }; sources: { kind: string; id: number; title: string }[]; itemId: number };

beforeEach(() => {
  process.env.PERPLEXITY_API_KEY = "test-key";
  answer.ok = true; answer.calls = 0; answer.sources = [{ url: PAGE }];
  answer.text = `Mouser | 1.25 | USD | 10 | in stock | ${PAGE}\nGhost | 0.10 | USD | 1 | | https://ghost.example/x`;
});
afterAll(async () => {
  delete process.env.PERPLEXITY_API_KEY;
  await q("DELETE FROM items WHERE title LIKE 'test:%'");
  await q("DELETE FROM research WHERE query LIKE '%test: buck%'");
  await pool().end();
});

describe("Check prices and Find alternates", () => {
  it("does not ask Perplexity, which is billed, without a confirm", async () => {
    const p = await makePart();
    const r = await ask(p.id, "prices", false);
    expect(r.status).toBe(400);
    expect(answer.calls).toBe(0);
  });

  it("saves a cited price as an engine draft with its page, saves the answer as research, and drops the uncited line", async () => {
    const p = await makePart();
    const r = await read<{ drafts: EngineDraft[]; dropped: string[]; researchId: number }>(await ask(p.id, "prices"));
    expect(r.status).toBe(201);
    expect(r.body.drafts).toHaveLength(1);
    expect(r.body.drafts[0]).toMatchObject({ generator: "sourcing.prices", itemId: p.id, op: { op: "append", field: "sourcing.offers" }, data: { value: { supplier: "Mouser", price: 1.25, citation: PAGE, source: "research" } } });
    expect(r.body.drafts[0].sources).toEqual([{ kind: "research", id: r.body.researchId, title: PAGE }]);
    expect(r.body.dropped.join()).toMatch(/Ghost: no cited page/);
    const s = await sourcingOf(p.id);
    expect(s?.offers ?? []).toEqual([]);
    const rows = await q("SELECT 1 FROM research WHERE query = 'Prices for test: buck converter'");
    expect(rows).toHaveLength(1);
    const run = await q<{ data: Loose }>("SELECT data FROM events WHERE kind='draft.run' AND data->>'generator'='sourcing.prices' ORDER BY id DESC LIMIT 1");
    expect(run[0].data).toMatchObject({ itemId: p.id, drafts: 1 });
  });

  it("never puts a draft among the offers or the unit price by itself; approving it adds the offer to the part as it is then", async () => {
    const p = await makePart();
    const r = await read<{ drafts: EngineDraft[] }>(await ask(p.id, "prices"));
    const row = (await q<{ data: Loose }>("SELECT data FROM items WHERE id=$1", [p.id]))[0].data;
    expect(row.unit).toBeUndefined();
    expect(row.sourcing?.chosen).toBeUndefined();
    // the user edits the part after the draft was made: approval must not overwrite that
    expect((await patchItem(json("PATCH", { data: { qty: 7 } }), ctx(String(p.id)))).status).toBe(200);
    const a = await approveRoute(json("POST"), ctx(String(r.body.drafts[0].id)));
    expect(a.status).toBe(200);
    const after = (await q<{ data: Loose }>("SELECT data FROM items WHERE id=$1", [p.id]))[0].data;
    expect(after.qty).toBe(7);
    expect(after.sourcing.offers).toHaveLength(1);
    expect(after.sourcing.offers[0]).toMatchObject({ supplier: "Mouser", citation: PAGE });
    expect(after.unit).toBeUndefined();
    const ev = await q<{ data: Loose }>("SELECT data FROM events WHERE kind='draft.approved' AND (data->>'itemId')::bigint=$1 ORDER BY id DESC LIMIT 1", [p.id]);
    expect(ev[0].data).toMatchObject({ op: "append", field: "sourcing.offers", before: { "data.sourcing": null } });
    expect(ev[0].data.after["data.sourcing"].offers).toHaveLength(1);
  });

  it("saves nothing when the answer cites no page", async () => {
    answer.sources = [];
    const p = await makePart();
    const r = await read<{ drafts: unknown[] }>(await ask(p.id, "prices"));
    expect(r.body.drafts).toEqual([]);
    expect(await draftsOf(p.id)).toEqual([]);
  });

  it("saves alternates as drafts too", async () => {
    answer.text = `LM2596 module | LM2596 | pins differ, 3 A | ${PAGE}`;
    const p = await makePart();
    const r = await read<{ drafts: EngineDraft[] }>(await ask(p.id, "alternates"));
    expect(r.body.drafts[0]).toMatchObject({ generator: "sourcing.alternates", op: { field: "sourcing.alternates" }, data: { value: { name: "LM2596 module" } } });
  });

  it("adds to the drafts already waiting instead of replacing them", async () => {
    const p = await makePart();
    await ask(p.id, "prices");
    await ask(p.id, "prices");
    expect(await draftsOf(p.id)).toHaveLength(2);
  });

  it("passes Perplexity's trouble on in plain words and saves nothing", async () => {
    answer.ok = false;
    const p = await makePart();
    const r = await read<{ error: string }>(await ask(p.id, "prices"));
    expect(r.status).toBe(429);
    expect(r.body.error).toMatch(/busy/);
  });

  it("says Perplexity is not connected when there is no key, before it asks", async () => {
    delete process.env.PERPLEXITY_API_KEY;
    await q("DELETE FROM credentials WHERE provider='perplexity' AND field='apiKey'");
    const p = await makePart();
    const r = await ask(p.id, "prices");
    expect(r.status).toBe(503);
    expect(answer.calls).toBe(0);
  });

  it("does not research a part of another section or a part that is not there", async () => {
    expect((await ask(999999999, "prices")).status).toBe(404);
  });
});

describe("what the part route lets into data.sourcing", () => {
  it("refuses a researched price with no citation, and a negative price", async () => {
    const p = await makePart();
    const bad = { sourcing: { offers: [{ id: "o1", supplier: "X", price: 1, packSize: 1, checkedAt: "2026-11-21", source: "research" }] } };
    expect((await patchItem(json("PATCH", { data: bad }), ctx(String(p.id)))).status).toBe(400);
    const neg = { sourcing: { offers: [{ id: "o1", supplier: "X", price: -1, packSize: 1, checkedAt: "2026-11-21", source: "entered" }] } };
    expect((await patchItem(json("PATCH", { data: neg }), ctx(String(p.id)))).status).toBe(400);
  });

  it("keeps a good offer, the chosen id and the order together with the part's unit price", async () => {
    const p = await makePart();
    const good = { unit: 0.125, sourcing: { offers: [{ id: "o1", supplier: "Mouser", price: 1.25, packSize: 10, checkedAt: "2026-11-21", source: "entered" }], chosen: "o1", order: { status: "ordered", qtyOrdered: 10 } } };
    const r = await read<{ item: Item }>(await patchItem(json("PATCH", { status: "ordered", data: good }), ctx(String(p.id))));
    expect(r.status).toBe(200);
    expect(r.body.item.data.unit).toBe(0.125);
    expect(r.body.item.status).toBe("ordered");
  });
});
