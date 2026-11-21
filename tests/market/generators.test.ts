// Every marketing generator end to end through the route, against the OpenAI-compatible stand-in
// with scripted JSON: rows are saved as drafts with what they were generated from, references the
// model invents are dropped and reported, and an unsourced competitor is flagged.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as generate } from "@/app/api/projects/[id]/market/generate/route";
import { POST as critique } from "@/app/api/projects/[id]/market/critique/route";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import { POST as approveRun } from "@/app/api/drafts/approve-run/route";
import { STORE_STATUSES } from "@/lib/api/schemas";
import { brandContext, brandVariables } from "@/lib/market/brand";
import { start } from "../standins/openai";
import type { StandIn } from "../standins/core";
import type { OpenAIOptions } from "../standins/openai";
import { anonymous, ctx, json, read } from "../api/helpers";
import { chooseReasoning, clearModelRows } from "../ai/setup";

const P = "zz-market-gen";
let s: StandIn<OpenAIOptions>;
const ids: Record<string, number> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = { id: number; section: string; title: string; status: string; data: Record<string, any> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Run = { runId: string; generator: string; drafts: { id: number; title: string; data: Record<string, any>; sources: { kind: string; id: number; title: string; section?: string }[] }[]; dropped: { title: string; reason: string }[]; notes: string[]; model: string };
type Gen = Run & { items: Row[] };
const run = (body: unknown, project = P) => generate(json("POST", body), ctx(project));
/**
 * Runs a generator on the drafting engine (it saves drafts, never rows), checks that every draft has
 * sources, then approves the run, as a person would in Draft with AI, and returns the rows it made.
 */
const ok = async (body: unknown): Promise<Gen> => {
  const r = await read<Run>(await run({ supersede: true, ...(body as object) }));
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  for (const d of r.body.drafts) expect(d.sources.length, d.title).toBeGreaterThan(0);
  const before = await q("SELECT 1 FROM drafts WHERE run_id=$1::uuid AND status='draft'", [r.body.runId]);
  expect(before).toHaveLength(r.body.drafts.length);
  if (!r.body.drafts.length) return { ...r.body, items: [] };
  const a = await read<{ approved: { item: Row }[] }>(await approveRun(json("POST", { projectId: P, runId: r.body.runId, confirm: true })));
  expect(a.status, JSON.stringify(a.body)).toBe(200);
  return { ...r.body, items: a.body.approved.map((x) => x.item) };
};
/** The engine asks the model for {"rows": [...]}, each row in the market generator's own output shape. */
const say = (v: unknown) => s.set({ reply: JSON.stringify({ rows: [v] }) });
const insert = async (section: string, title: string, status = "open", data: Record<string, unknown> = {}, body = "") =>
  Number((await q<{ id: string }>("INSERT INTO items (project_id, section, title, body, status, data) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [P, section, title, body, status, JSON.stringify(data)]))[0].id);

const ANSWER = "Gadget One sells for $29.99 and claims to fix everything[1]. People complain it breaks in a month[1]. Gadget Two costs $45 to $60[2]. Customers say \"it just never works the way I need it to\" about both[2].";

beforeAll(async () => {
  s = await start({ prefix: "/v1" });
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await q("INSERT INTO projects (id, name, one_liner) VALUES ($1, 'ZZ Market', 'A bag that weighs itself')", [P]);
  ids.brief = await insert("concept/brief", "Travellers over 50 kg", "open", {}, "Frequent flyers who pay overweight fees");
  ids.verified = await insert("research/claims", "Overweight fees average high", "verified");
  ids.unverified = await insert("research/claims", "Nobody checks weight at home", "unverified");
  ids.test = await insert("prototype/tests", "Weighs within 100 g", "pass", { key: "t1" });
  ids.req = await insert("design/requirements", "Shows weight in kg", "open");
  ids.research = Number((await q<{ id: string }>(
    "INSERT INTO research (project_id, query, answer, citations, sources, model) VALUES ($1,'What do travellers use?',$2,$3,$4,'m') RETURNING id",
    [P, ANSWER, JSON.stringify(["https://cite.example/one", "https://cite.example/two"]), JSON.stringify([{ url: "https://cite.example/one", title: "One" }, { url: "https://cite.example/two", title: "Two" }])]
  ))[0].id);
});

afterAll(async () => {
  await clearModelRows();
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await s.close();
  await pool().end();
});

beforeEach(async () => {
  s.requests.length = 0;
  await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "market-model" });
});

describe("sections", () => {
  it("every section these tools touch starts with draft", () => {
    for (const store of ["marketing/personas", "marketing/competitors", "marketing/positioning", "marketing/brand", "marketing/imagery", "marketing/pricing", "concept/names"]) {
      expect(STORE_STATUSES[store][0], store).toBe("draft");
    }
    for (const store of ["marketing/personas", "marketing/competitors", "marketing/positioning", "marketing/brand", "marketing/imagery", "marketing/pricing"]) {
      expect(STORE_STATUSES[store], store).toContain("approved");
    }
  });
});

describe("the generate route", () => {
  it("answers 401 signed out, 400 for a bad body, 404 for an unknown concept", async () => {
    expect((await generate(anonymous("POST", { generator: "personas" }), ctx(P))).status).toBe(401);
    const bad = await read<{ error: string }>(await run({ generator: "nope" }));
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/generator/);
    expect((await run({ generator: "personas", count: 99 })).status).toBe(400);
    expect((await run({ generator: "voice-check", text: "x".repeat(7000) })).status).toBe(400);
    expect((await run({ generator: "personas" }, "zz-nothing")).status).toBe(404);
  });

  it("says no model is chosen with a 503 and the model layer's sentence, and saves nothing", async () => {
    await clearModelRows();
    const r = await read<{ error: string }>(await run({ generator: "personas" }));
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("No reasoning model is chosen. Choose one in Admin, Models.");
    expect(s.requests).toHaveLength(0);
    expect(await q("SELECT 1 FROM items WHERE project_id=$1 AND section='marketing/personas'", [P])).toHaveLength(0);
  });

  it("answers 400 with a reason when the concept lacks what the generator reads", async () => {
    await q("INSERT INTO projects (id, name) VALUES ('zz-market-empty','Empty') ON CONFLICT DO NOTHING");
    const r = await read<{ error: string }>(await run({ generator: "personas" }, "zz-market-empty"));
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/brief is empty/);
    expect((await read<{ error: string }>(await run({ generator: "positioning" }))).body.error).toMatch(/persona/);
    expect((await read<{ error: string }>(await run({ generator: "competitors" }))).body.error).toMatch(/research answer/);
    expect((await read<{ error: string }>(await run({ generator: "competitors", researchId: 999999 }))).status).toBe(400);
    expect((await read<{ error: string }>(await run({ generator: "voice-check", text: "hi" }))).body.error).toMatch(/brand voice/);
    await q("DELETE FROM projects WHERE id='zz-market-empty'");
  });

  it("a model answer of the wrong shape is a 502 and nothing is saved", async () => {
    s.set({ reply: JSON.stringify({ personas: "not a list" }) });
    const r = await run({ generator: "personas" });
    expect(r.status).toBe(502);
    expect(await q("SELECT 1 FROM items WHERE project_id=$1 AND section='marketing/personas'", [P])).toHaveLength(0);
  });
});

describe("personas (8.1)", () => {
  it("saves drafts with their sources, keeps a quotation only if the research holds it, and drops invented ids", async () => {
    say({
      personas: [
        {
          name: "The overweight flyer",
          who: "Flies twice a month",
          job: "Get to the gate without a fee",
          trigger: "A surprise fee at check-in",
          objection: "Another gadget to charge",
          whereTheyLook: "Amazon, travel forums",
          theirWords: [
            { quote: "it just never works the way I need it to", researchId: ids.research },
            { quote: "a line the research never said", researchId: ids.research },
            { quote: "anything", researchId: 424242 },
          ],
          drewOn: [{ kind: "brief", id: ids.brief }, { kind: "claim", id: ids.verified }, { kind: "claim", id: 777777 }],
        },
      ],
    });
    const r = await ok({ generator: "personas", count: 1 });
    expect(r.model).toBe("market-model");
    expect(r.items).toHaveLength(1);
    const p = r.items[0];
    expect(p.status).toBe("draft");
    expect(p.section).toBe("marketing/personas");
    expect(p.data.theirWords).toEqual([{ quote: "it just never works the way I need it to", researchId: ids.research }]);
    expect(p.data.generatedFrom.model).toBe("market-model");
    expect(typeof p.data.generatedFrom.at).toBe("string");
    expect(p.data.generatedFrom.sources.map((x: { kind: string; id: number }) => `${x.kind}:${x.id}`).sort()).toEqual([`brief:${ids.brief}`, `claim:${ids.verified}`, `research:${ids.research}`].sort());
    expect(r.notes.join(" ")).toMatch(/dropped a source \(claim 777777\)/);
    expect(r.notes.filter((n) => /quotation/.test(n))).toHaveLength(2);

    const row = (await q<{ status: string; data: Record<string, unknown> }>("SELECT status, data FROM items WHERE id=$1", [p.id]))[0];
    expect(row.status).toBe("draft");
    // the run is the drafting engine's, and the draft carried the same sources
    const ev = await q<{ data: { generator: string } }>("SELECT data FROM events WHERE project_id=$1 AND kind='draft.run' ORDER BY id DESC LIMIT 1", [P]);
    expect(ev[0].data.generator).toBe("market.personas");
    expect(r.drafts[0].sources.map((x) => `${x.kind}:${x.id}`).sort()).toEqual([`item:${ids.brief}`, `item:${ids.verified}`, `research:${ids.research}`].sort());
    expect(r.drafts[0].sources.find((x) => x.id === ids.brief)!.section).toBe("concept/brief");
  });

  it("gives the model only verified claims and the brand voice when a kit exists", async () => {
    const kit = await insert("marketing/brand", "Brand kit", "draft", { kind: "kit", voiceSummary: "Deadpan and dry.", rules: [{ rule: "First person.", doExample: "I weigh 12 kg.", dontExample: "It weighs 12 kg." }] });
    say({ personas: [{ name: "X", who: "", job: "", trigger: "", objection: "", whereTheyLook: "" }] });
    await ok({ generator: "personas", count: 1 });
    const sent = JSON.stringify(s.requests.at(-1)!.body);
    expect(sent).toContain("Overweight fees average high");
    expect(sent).not.toContain("Nobody checks weight at home"); // listed under claims, but only verified ones are offered as claims
    expect(sent).toContain("Deadpan and dry.");
    expect(sent).toContain("First person.");
    await q("DELETE FROM items WHERE id=$1", [kit]);
  });
});

describe("competitors (8.2)", () => {
  it("keeps the citation each row came from, strips a price the answer does not hold, and marks the rest unsourced", async () => {
    say({
      rows: [
        { name: "Gadget One", kind: "product", what: "A tag", priceText: "$29.99", claim: "fixes everything", weakness: "breaks in a month", sourceUrl: "https://cite.example/one/" },
        { name: "Gadget Two", kind: "product", what: "A scale", priceText: "$99", claim: "precise", weakness: "", sourceUrl: "https://cite.example/two" },
        { name: "Gadget Three", kind: "product", what: "From memory", priceText: "$10", claim: "", weakness: "", sourceUrl: "https://made-up.example/x" },
        { name: "Do nothing", kind: "alternative", what: "Pay the fee", priceText: "", claim: "", weakness: "Costs more over time", sourceUrl: "" },
        { name: "gadget one", kind: "product", what: "dup", priceText: "", claim: "", weakness: "", sourceUrl: "" },
      ],
    });
    const r = await ok({ generator: "competitors", researchId: ids.research });
    const by = Object.fromEntries(r.items.map((i) => [i.title, i]));
    expect(Object.keys(by).sort()).toEqual(["Do nothing", "Gadget One", "Gadget Three", "Gadget Two"]);
    expect(r.items.every((i) => i.status === "draft")).toBe(true);

    expect(by["Gadget One"].data).toMatchObject({ basis: "research", sourceUrl: "https://cite.example/one", priceText: "$29.99", priceMinor: 2999, currency: "USD", researchId: ids.research });
    expect(by["Gadget One"].data.generatedFrom.sources).toEqual([{ kind: "research", id: ids.research, title: "What do travellers use?" }]);
    // a price the answer does not contain is removed, the source stays
    expect(by["Gadget Two"].data.priceText).toBe("");
    expect(by["Gadget Two"].data.priceMinor).toBeUndefined();
    expect(by["Gadget Two"].data.basis).toBe("research");
    // an address that is not among the answer's sources: unsourced, price not in the answer either
    expect(by["Gadget Three"].data).toMatchObject({ basis: "unsourced", sourceUrl: "" });
    expect(by["Gadget Three"].data.priceText).toBe("");
    // a non-product alternative with no citation is unsourced too
    expect(by["Do nothing"].data).toMatchObject({ kind: "alternative", basis: "unsourced" });
    expect(r.notes.join(" ")).toMatch(/not in the answer/);
    expect(r.notes.join(" ")).toMatch(/not one of the answer's sources/);
    expect(r.notes.join(" ")).toMatch(/already in the table/);
    // every row without a source is unsourced, never research
    for (const i of r.items) expect(i.data.sourceUrl ? "research" : "unsourced").toBe(i.data.basis);
  });

  it("skips rows already in the table on a second run", async () => {
    say({ rows: [{ name: "Gadget One", kind: "product", what: "again", priceText: "", claim: "", weakness: "", sourceUrl: "" }] });
    const r = await ok({ generator: "competitors", researchId: ids.research });
    expect(r.items).toHaveLength(0);
    expect(r.notes.join(" ")).toMatch(/already in the table/);
  });

  it("sends the answer and its numbered sources and tells the model not to research", async () => {
    say({ rows: [] });
    await ok({ generator: "competitors", researchId: ids.research });
    const sent = JSON.stringify(s.requests.at(-1)!.body);
    expect(sent).toContain("Gadget One sells for $29.99");
    expect(sent).toContain("https://cite.example/two");
    expect(sent).toContain("Never add a fact, figure, price");
  });
});

describe("positioning (8.3)", () => {
  beforeAll(async () => {
    ids.persona = await insert("marketing/personas", "The overweight flyer", "approved", { job: "Avoid the fee", trigger: "x", objection: "y" });
    ids.comp = await insert("marketing/competitors", "A hand scale", "approved", { kind: "product", claim: "cheap", basis: "typed" });
  });

  it("links proof only to rows the concept holds, drops invented ids and keeps a message with none for the screen to flag", async () => {
    say({
      forWhom: "frequent flyers", need: "to stay under the limit", productIs: "weighing bag", thatDoes: "shows the weight", unlike: "a hand scale", difference: "weighs itself",
      messages: [
        { text: "It knows the weight.", proofIds: [ids.verified, ids.test, 31337] },
        { text: "It is easy.", proofIds: [ids.unverified] },
        { text: "It is loved.", proofIds: [] },
      ],
    });
    const r = await ok({ generator: "positioning" });
    expect(r.items).toHaveLength(1);
    const d = r.items[0].data;
    expect(r.items[0].status).toBe("draft");
    expect(d.kind).toBe("statement");
    expect(r.items[0].title).toBe("For frequent flyers, who need to stay under the limit, ZZ Market is a weighing bag that shows the weight. Unlike a hand scale, ZZ Market weighs itself.");
    expect(d.messages[0].proof.map((p: { itemId: number }) => p.itemId)).toEqual([ids.verified, ids.test]);
    expect(d.messages[0].proof[1]).toMatchObject({ section: "prototype/tests", key: "t1" });
    expect(d.messages[1].proof.map((p: { itemId: number }) => p.itemId)).toEqual([ids.unverified]);
    expect(d.messages[2].proof).toEqual([]);
    expect(r.notes.join(" ")).toMatch(/31337/);
    expect(r.notes.join(" ")).toMatch(/not verified or passing/);
    const kinds = d.generatedFrom.sources.map((x: { kind: string }) => x.kind);
    expect(kinds).toEqual(expect.arrayContaining(["persona", "competitor", "claim", "test"]));
    ids.positioning = r.items[0].id;
  });

  it("cannot be approved until the reviewer has attacked it, and only the critique route writes the critique", async () => {
    const approve = () => patchItem(json("PATCH", { status: "approved" }), ctx(String(ids.positioning)));
    const blocked = await read<{ error: string }>(await approve());
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatch(/attack this positioning once/);

    const forged = await patchItem(json("PATCH", { data: { critique: { text: "all fine", at: "x", model: "x" } } }), ctx(String(ids.positioning)));
    expect(forged.status).toBe(400);

    s.set({ reply: "- The weakest claim is the second message.\n- Nothing proves it." });
    s.requests.length = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = await read<{ item: { data: Record<string, any> } }>(await critique(json("POST", { itemId: ids.positioning }), ctx(P)));
    expect(c.status).toBe(200);
    expect(c.body.item.data.critique.text).toContain("weakest claim");
    expect(c.body.item.data.critique.model).toBe("market-model");
    expect(typeof c.body.item.data.critique.fingerprint).toBe("string");
    // the shared reviewer's instructions plus the positioning focus, and the proof states
    const sent = JSON.stringify(s.requests.at(-1)!.body);
    expect(sent).toContain("You review product concepts before money is spent on them");
    expect(sent).toContain("attack the positioning below once");
    expect(sent).toContain("NO PROOF");
    expect(sent).toContain("unverified claim");

    expect((await approve()).status).toBe(200);
    // the words change: the critique no longer matches
    const edit = await patchItem(json("PATCH", { data: { forWhom: "someone else" } }), ctx(String(ids.positioning)));
    expect(edit.status).toBe(409);
    const back = await patchItem(json("PATCH", { status: "draft", data: { forWhom: "someone else" } }), ctx(String(ids.positioning)));
    expect(back.status).toBe(200);
    expect((await approve()).status).toBe(409);
  });

  it("the critique route is 404 for another concept's row and 503 without a model", async () => {
    expect((await critique(json("POST", { itemId: ids.positioning }), ctx("baggage-claims"))).status).toBe(404);
    await clearModelRows();
    const r = await read<{ error: string }>(await critique(json("POST", { itemId: ids.positioning }), ctx(P)));
    expect(r.status).toBe(503);
  });

  it("a drafted positioning edited to carry a critique cannot be approved: only the reviewer writes one", async () => {
    say({ forWhom: "a", need: "b", productIs: "c", thatDoes: "d", unlike: "e", difference: "f", messages: [{ text: "x", proofIds: [] }] });
    const r = await read<Run>(await run({ generator: "positioning", supersede: true }));
    const d = r.body.drafts[0];
    await q("UPDATE drafts SET data = data || '{\"critique\": {\"text\": \"all fine\"}}'::jsonb WHERE id=$1", [d.id]);
    const a = await read<{ error: string }>(await approveRun(json("POST", { projectId: P, runId: r.body.runId, confirm: true })));
    expect(a.status).toBe(400);
    expect(a.body.error).toMatch(/critique/);
    await q("DELETE FROM drafts WHERE run_id=$1::uuid", [r.body.runId]);
  });

  it("a new positioning cannot start approved or carry a critique", async () => {
    const a = await addItem(json("POST", { section: "marketing/positioning", title: "By hand", status: "approved", data: { kind: "statement" } }), ctx(P));
    expect(a.status).toBe(409);
    const b = await addItem(json("POST", { section: "marketing/positioning", title: "By hand", data: { critique: { text: "x", at: "x", model: "x" } } }), ctx(P));
    expect(b.status).toBe(400);
    const okRow = await addItem(json("POST", { section: "marketing/positioning", title: "By hand", data: { kind: "statement", forWhom: "x" } }), ctx(P));
    expect(okRow.status).toBe(201);
  });
});

describe("names (8.5)", () => {
  it("saves a batch as drafts with a reason each, skipping what is already listed", async () => {
    await insert("concept/names", "Sass Case", "shortlist", { kind: "Name" });
    say({ candidates: [{ text: "Sass Case", kind: "Name", reason: "dup" }, { text: "Tare Bear", kind: "Name", reason: "Weighing, friendly" }, { text: "Light as a lie", kind: "Tagline", reason: "Plays on weight" }] });
    const r = await ok({ generator: "names", count: 3 });
    expect(r.items.map((i) => i.title).sort()).toEqual(["Light as a lie", "Tare Bear"]);
    const tare = r.items.find((i) => i.title === "Tare Bear")!;
    expect(tare).toMatchObject({ status: "draft", section: "concept/names" });
    expect(tare.data).toMatchObject({ kind: "Name", reason: "Weighing, friendly" });
    expect(tare.data.generatedFrom.sources[0].kind).toBe("brief");
    // the prompt says the model does not know availability
    expect(JSON.stringify(s.requests.at(-1)!.body)).toContain("must not say or imply that it is free");
  });
});

describe("brand kit and the voice check (8.6)", () => {
  let kitId = 0;
  it("validates the kit through the normal routes", async () => {
    const bad = await addItem(json("POST", { section: "marketing/brand", title: "Brand kit", data: { kind: "kit", colours: [{ role: "primary", name: "x", hex: "red" }] } }), ctx(P));
    expect(bad.status).toBe(400);
    const good = await read<{ item: { id: number } }>(await addItem(json("POST", { section: "marketing/brand", title: "Brand kit", data: { kind: "kit", voiceSummary: "Plain and warm.", rules: [{ rule: "Short sentences.", doExample: "We ship fast.", dontExample: "Shipping is performed rapidly." }], colours: [{ role: "primary", name: "Orange", hex: "#E05A10" }], headingFont: "Inter, sans-serif", tagline: "Weigh less, worry less." } }), ctx(P)));
    expect(good.status).toBe(201);
    kitId = good.body.item.id;
  });

  it("brandContext returns the kit as text and brandVariables the CSS variables", async () => {
    const t = await brandContext(P);
    expect(t).toContain("Voice: Plain and warm.");
    expect(t).toContain('Do not: "Shipping is performed rapidly."');
    expect(await brandVariables(P)).toContain("--brand-primary: #E05A10;");
    expect(await brandContext("zz-market-none")).toBe("");
  });

  it("checks text, keeps only suggestions whose before is in the text, and saves a draft", async () => {
    say({ verdict: "Mostly stiff.", suggestions: [{ before: "Shipping is performed rapidly.", after: "We ship fast.", why: "Short sentences." }, { before: "words that are not there", after: "x", why: "y" }] });
    const r = await ok({ generator: "voice-check", text: "Our policy: Shipping is performed rapidly. Thanks." });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].status).toBe("draft");
    expect(r.items[0].data.kind).toBe("voicecheck");
    expect(r.items[0].data.suggestions).toEqual([{ before: "Shipping is performed rapidly.", after: "We ship fast.", why: "Short sentences." }]);
    expect(r.items[0].data.generatedFrom.sources).toEqual([{ kind: "brand", id: kitId, title: "Brand kit" }]);
    expect(r.notes.join(" ")).toMatch(/not in your text/);
    // a voice check is not the kit
    expect((await brandContext(P))).toContain("Voice: Plain and warm.");
  });
});

describe("other sections' data shapes", () => {
  it("accepts and refuses data by schema", async () => {
    const put = (section: string, data: unknown) => addItem(json("POST", { section, title: "x", data }), ctx(P));
    expect((await put("marketing/pricing", { kind: "price", priceMinor: 2495, currency: "USD" })).status).toBe(201);
    expect((await put("marketing/pricing", { kind: "price", priceMinor: -5 })).status).toBe(400);
    // Pricing keeps no channel rows of its own any more (sales/channels holds the fees)
    expect((await put("marketing/pricing", { kind: "channel", feePercent: 15 })).status).toBe(400);
    expect((await put("marketing/imagery", { shotKey: "hero-white", usedIn: ["a"], fileId: null })).status).toBe(201);
    expect((await put("marketing/imagery", { usedIn: "not a list" })).status).toBe(400);
    expect((await put("marketing/competitors", { kind: "product", basis: "made up" })).status).toBe(400);
    expect((await put("marketing/personas", { theirWords: [{ quote: 3 }] })).status).toBe(400);
    expect((await put("concept/names", { kind: "Tagline", screening: { amazon: true } })).status).toBe(201);
    expect((await put("concept/names", { screening: { amazon: "yes" } })).status).toBe(400);
  });
});
