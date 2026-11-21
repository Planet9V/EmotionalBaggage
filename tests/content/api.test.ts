// The content routes and rules against a real database: the no-proof gate on every way a row reaches a
// released status, the hard refusal over a sourced limit, the exports, the landing page preview and
// zip, the queue the posting code reads, and the generators through the drafting engine.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { pool, q } from "@/lib/db";
import { PATCH as patchItem } from "@/app/api/items/[id]/route";
import { POST as addItem } from "@/app/api/projects/[id]/items/route";
import { GET as adsExport } from "@/app/api/content/ads/export/route";
import { GET as landingPreview } from "@/app/api/content/landing/preview/route";
import { GET as landingExport } from "@/app/api/content/landing/export/route";
import { GET as listingExport } from "@/app/api/content/listing/export/route";
import { GET as launchExport } from "@/app/api/content/launch/export/route";
import { GET as socialQueue } from "@/app/api/content/social/queue/route";
import { GET as GENERATORS } from "@/app/api/drafts/generators/route";
import { anonymous, ctx, json, read } from "../api/helpers";
import { chooseReasoning, clearModelRows } from "../ai/setup";
import { start } from "../standins/openai";
import type { StandIn } from "../standins/core";
import type { OpenAIOptions } from "../standins/openai";
import { addItem as insert, approve, edit, itemsOf, makeConcept, run } from "../drafts/helpers";
import { CONTENT_GENERATORS } from "@/lib/content/generators";

const P = "zz-content";
const url = (path: string, extra = "") => `http://test.local${path}?projectId=${P}${extra}`;
const get = (h: (r: Request) => Promise<Response>, path: string, extra = "") => h(json("GET", undefined, url(path, extra)));
const add = async (section: string, title: string, data: Record<string, unknown>, status = "draft", body = "") =>
  read<{ item: { id: number; status: string; data: Record<string, any> } ; error?: string }>(await addItem(json("POST", { section, title, status, body, data }), ctx(P))); // eslint-disable-line @typescript-eslint/no-explicit-any
const patch = async (id: number, change: Record<string, unknown>) => read<{ item: { id: number; status: string; data: Record<string, any> }; error?: string }>(await patchItem(json("PATCH", change), ctx(String(id)))); // eslint-disable-line @typescript-eslint/no-explicit-any

let claim = 0;
let message: { positioningId: number; index: number; text: string };
let s: StandIn<OpenAIOptions>;
let reply = "{}";

beforeAll(async () => {
  await makeConcept(P, "Bag2Go", "physical", "A bag that weighs itself");
  claim = await insert(P, "research/claims", "Battery lasts 7 days", {}, "Measured over three trips.", "verified");
  const pos = await insert(P, "marketing/positioning", "Main", { messages: [{ text: "Know the weight before the airport", proof: [] }] }, "", "approved");
  message = { positioningId: pos, index: 0, text: "Know the weight before the airport" };
  s = await start({ prefix: "/v1", reply: () => reply });
  await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "content-model" });
});

afterAll(async () => {
  await clearModelRows();
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await s.close();
  await pool().end();
});

const rsa = (over: Record<string, unknown> = {}) => ({
  channel: "google-search-rsa",
  message,
  fields: { headlines: ["Weigh it at home", "Know before you fly", "Pack with confidence"], descriptions: ["A bag that tells you its weight.", "Skip the overweight fee."], finalUrl: "https://example.com" },
  stopRule: "Stop when cost per order stays above the ceiling after the minimum spend.",
  costPerOrderCeilingMinor: 1500,
  minSpendBeforeJudgingMinor: 5000,
  currency: "USD",
  ...over,
});

describe("ads", () => {
  it("lets a clean variant be approved only with its stop rule and two numbers", async () => {
    const a = await add("marketing/ads", "RSA one", rsa({ stopRule: "", costPerOrderCeilingMinor: undefined }));
    expect(a.status).toBe(201);
    const refused = await patch(a.body.item.id, { status: "approved" });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatch(/stop and scale rule/i);
    const ok = await patch(a.body.item.id, { data: { stopRule: "Stop above the ceiling.", costPerOrderCeilingMinor: 1500, minSpendBeforeJudgingMinor: 5000 }, status: "approved" });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.item.status).toBe("approved");
  });

  it("refuses to approve a headline over a limit that comes from the platform's page, and says which", async () => {
    const a = await add("marketing/ads", "RSA long", rsa({ fields: { headlines: ["x".repeat(31), "b", "c"], descriptions: ["d", "e"], finalUrl: "https://example.com" } }));
    const r = await patch(a.body.item.id, { status: "approved" });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/31/);
  });

  it("flags a number with no proof and refuses to approve it, then accepts it with a verified claim linked", async () => {
    const a = await add("marketing/ads", "RSA number", rsa({ fields: { headlines: ["Lasts 7 days", "b", "c"], descriptions: ["d", "e"], finalUrl: "https://example.com" } }));
    expect(a.body.item.data.noProof).toBe(true);
    const no = await patch(a.body.item.id, { status: "approved" });
    expect(no.status).toBe(409);
    expect(no.body.error).toMatch(/^No proof/);
    const yes = await patch(a.body.item.id, { data: { proof: [{ itemId: claim, section: "research/claims" }] }, status: "approved" });
    expect(yes.status, JSON.stringify(yes.body)).toBe(200);
    expect(yes.body.item.data.noProof).toBe(false);
  });

  it("does not trust a stored flag: a client cannot write noProof false and get through", async () => {
    const a = await add("marketing/ads", "RSA lie", rsa({ fields: { headlines: ["Best bag ever", "b", "c"], descriptions: ["d", "e"], finalUrl: "https://example.com" }, noProof: false, flags: [] }));
    expect(a.body.item.data.noProof).toBe(true);
    const r = await patch(a.body.item.id, { data: { noProof: false, flags: [] }, status: "approved" });
    expect(r.status).toBe(409);
  });

  it("a created row that skips the draft status is checked too", async () => {
    const a = await add("marketing/ads", "RSA born approved", rsa({ fields: { headlines: ["Lasts 99 days", "b", "c"], descriptions: ["d", "e"], finalUrl: "https://example.com" } }), "approved");
    expect(a.status).toBe(409);
  });

  it("exports an approved channel as CSV and refuses when none is approved", async () => {
    const res = await get(adsExport, "/api/content/ads/export", "&channel=google-search-rsa");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.split("\r\n")[0]).toContain("Headline 1");
    expect(text).toContain("Weigh it at home");
    const none = await get(adsExport, "/api/content/ads/export", "&channel=reddit-ads");
    expect(none.status).toBe(409);
  });

  it("needs a signed-in session", async () => {
    const res = await adsExport(anonymous("GET", undefined, url("/api/content/ads/export", "&channel=google-search-rsa")));
    expect(res.status).toBe(401);
  });
});

describe("landing page", () => {
  const ids: number[] = [];
  it("renders a preview from section rows and refuses the export while a section is a draft", async () => {
    const hero = await add("marketing/landing", "Hero", { kind: "hero", order: 0, message, content: { headline: "Know before the airport", subhead: "A bag that tells you.", ctaLabel: "Order", ctaHref: "https://example.com/buy" } });
    const faq = await add("marketing/landing", "FAQ", { kind: "faq", order: 1, message, content: { heading: "Questions", items: [{ q: "Is it waterproof?", a: "Not yet." }] } });
    const foot = await add("marketing/landing", "Footer", { kind: "footer", order: 2, message, content: { text: "Bag2Go" } });
    ids.push(hero.body.item.id, faq.body.item.id, foot.body.item.id);
    const pv = await read<{ html: string; sections: number; unapproved: number[] }>(await get(landingPreview, "/api/content/landing/preview", "&scheme=dark"));
    expect(pv.status).toBe(200);
    expect(pv.body.sections).toBe(3);
    expect(pv.body.unapproved.length).toBe(3);
    expect(pv.body.html).toContain("Know before the airport");
    expect(pv.body.html).not.toMatch(/<script/i);
    const ex = await get(landingExport, "/api/content/landing/export");
    expect(ex.status).toBe(409);
  });

  it("exports a zip with index.html once every section is approved", async () => {
    for (const id of ids) expect((await patch(id, { status: "approved" })).status).toBe(200);
    const ex = await get(landingExport, "/api/content/landing/export");
    expect(ex.status).toBe(200);
    expect(ex.headers.get("content-type")).toBe("application/zip");
    const files = unzipSync(new Uint8Array(await ex.arrayBuffer()));
    expect(Object.keys(files)).toContain("index.html");
    expect(strFromU8(files["index.html"])).toContain("Know before the airport");
  });

  it("order is editable: the preview follows the order field", async () => {
    expect((await patch(ids[0], { data: { order: 4 } })).status).toBe(200);
    const pv = await read<{ html: string }>(await get(landingPreview, "/api/content/landing/preview"));
    expect(pv.body.html.indexOf("Is it waterproof?")).toBeLessThan(pv.body.html.indexOf("<h1"));
  });

  it("a section with a number and no proof cannot be approved", async () => {
    const r = await add("marketing/landing", "Problem", { kind: "problem", order: 9, message, content: { heading: "Fees cost 50 dollars", points: ["a"] } });
    expect(r.body.item.data.noProof).toBe(true);
    expect((await patch(r.body.item.id, { status: "approved" })).status).toBe(409);
  });
});

describe("listing", () => {
  it("refuses a title over 200 characters on approval and exports a ready listing as text and as a flat file", async () => {
    const l = await add("sales/listing", "Listing", { category: "default", message, fields: { title: "x".repeat(201), bullets: ["b"], description: "d", searchTerms: "a" } });
    expect((await patch(l.body.item.id, { status: "ready" })).status).toBe(400);
    expect((await get(listingExport, "/api/content/listing/export", `&id=${l.body.item.id}`)).status).toBe(409);
    const ok = await patch(l.body.item.id, { data: { fields: { title: "A bag", bullets: ["Weighs itself"], description: "Desc", searchTerms: "bag scale" } }, status: "ready" });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const t = await (await get(listingExport, "/api/content/listing/export", `&id=${l.body.item.id}&format=text`)).text();
    expect(t).toContain("Weighs itself");
    const flat = await get(listingExport, "/api/content/listing/export", `&id=${l.body.item.id}&format=flat`);
    expect(flat.headers.get("content-type")).toContain("tab-separated");
  });
});

describe("social queue", () => {
  it("lists approved and scheduled posts with their date and leaves drafts and posted ones out", async () => {
    await add("marketing/social", "d", { channel: "X", message }, "draft", "draft post");
    await add("marketing/social", "a", { channel: "X", message }, "approved", "approved post");
    await add("marketing/social", "s", { channel: "Instagram", message, scheduledAt: "2026-12-01T09:00" }, "scheduled", "scheduled post");
    await insert(P, "marketing/social", "p", { channel: "X" }, "posted post", "posted");
    const r = await read<{ posts: { text: string; status: string; scheduledAt: string | null; channelLabel: string }[] }>(await get(socialQueue, "/api/content/social/queue"));
    const texts = r.body.posts.map((p) => p.text);
    expect(texts).toContain("approved post");
    expect(texts).toContain("scheduled post");
    expect(texts).not.toContain("draft post");
    expect(texts).not.toContain("posted post");
    expect(r.body.posts.find((p) => p.text === "scheduled post")).toMatchObject({ scheduledAt: "2026-12-01T09:00", channelLabel: "Instagram" });
  });

  it("refuses a date that is not a date", async () => {
    const a = await add("marketing/social", "bad", { channel: "X", message, scheduledAt: "next tuesday" }, "draft", "x");
    expect(a.status).toBe(400);
  });
});

describe("launch", () => {
  it("exports an approved piece as text and HTML and refuses a draft", async () => {
    const l = await add("marketing/announce", "Launch email", { kind: "email", message, subjects: ["Meet Bag2Go"], previewText: "A bag that tells you" }, "draft", "Hello.\n\nIt is here.");
    expect((await get(launchExport, "/api/content/launch/export", `&id=${l.body.item.id}`)).status).toBe(409);
    expect((await patch(l.body.item.id, { status: "approved" })).status).toBe(200);
    expect(await (await get(launchExport, "/api/content/launch/export", `&id=${l.body.item.id}&format=text`)).text()).toContain("Meet Bag2Go");
    expect(await (await get(launchExport, "/api/content/launch/export", `&id=${l.body.item.id}&format=html`)).text()).toContain("<html");
  });
});

describe("generators in the drafting engine", () => {
  it("are all registered, and the engine lists the channel generators for the ads store", async () => {
    const ids = CONTENT_GENERATORS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const want of ["ads-google-search-rsa", "landing-page", "listing-default", "social-x", "launch-email", "press-note", "launch-sequence"]) expect(ids, want).toContain(want);
    const r = await read<{ generators: { id: string }[] }>(await GENERATORS(json("GET", undefined, `http://t/x?projectId=${P}&store=marketing/ads`)));
    expect(r.body.generators.map((g) => g.id)).toContain("ads-google-search-rsa");
  });

  it("drops a variant over a platform limit with the reason, keeps one with a number flagged, and the flagged draft cannot be approved", async () => {
    reply = JSON.stringify({
      rows: [
        { messageId: `${message.positioningId}:${message.index}`, proofIds: [], fields: { headlines: ["x".repeat(40), "b", "c"], descriptions: ["d", "e"] }, stopRule: "Stop above the ceiling." },
        { messageId: `${message.positioningId}:${message.index}`, proofIds: [], fields: { headlines: ["Lasts 12 days", "Know before you fly", "Pack right"], descriptions: ["A bag that tells you its weight.", "Skip the fee."] }, stopRule: "Stop above the ceiling." },
        { messageId: "999:0", proofIds: [], fields: { headlines: ["a", "b", "c"], descriptions: ["d", "e"] } },
      ],
    });
    const r = await run({ projectId: P, generator: "ads-google-search-rsa" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.drafts).toHaveLength(1);
    expect(r.body.dropped.length).toBe(2);
    expect(r.body.dropped.some((d) => /limit/i.test(d.reason))).toBe(true);
    const d = r.body.drafts[0];
    expect(d.data.noProof).toBe(true);
    expect(d.data.message).toMatchObject({ text: message.text });
    // nothing reached the rows before approval
    expect((await itemsOf(P, "marketing/ads")).some((i) => i.title.includes("Lasts 12 days"))).toBe(false);
    const a = await approve(d.id);
    expect(a.status).toBe(409);
    expect(String(a.body.error)).toMatch(/No proof/);
    // Editing the draft to take the number out clears the flag and it can be approved after the writer adds a rule and numbers.
    const e = await edit(d.id, { data: { ...d.data, fields: { headlines: ["Know before you fly", "Pack right", "Weigh it at home"], descriptions: ["A bag that tells you its weight.", "Skip the fee."] }, costPerOrderCeilingMinor: 1000, minSpendBeforeJudgingMinor: 3000 } });
    expect(e.status, JSON.stringify(e.body)).toBe(200);
    expect(e.body.draft.data.noProof).toBe(false);
    const ok = await approve(d.id);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.item?.section).toBe("marketing/ads");
  });

  it("is blocked, with a sentence, until a positioning message is approved", async () => {
    const Q = "zz-content-nomsg";
    await makeConcept(Q, "Empty", "physical", "x");
    try {
      const r = await run({ projectId: Q, generator: "launch-email" });
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(r.body)).toMatch(/positioning/i);
    } finally {
      await q("DELETE FROM projects WHERE id=$1", [Q]);
    }
  });
});
