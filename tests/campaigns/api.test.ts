// The campaign routes end to end against a real PostgreSQL: results saved by upsert, tracked links, the
// short redirect (only to saved destinations, nothing about the visitor kept, rate limited), the launch
// route, the explanation route and the campaign-plan generator against the scripted stand-in model.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { GET as getResults, POST as postResults, DELETE as delResults } from "@/app/api/projects/[id]/campaigns/results/route";
import { GET as getLinks, POST as postLink } from "@/app/api/projects/[id]/campaigns/links/route";
import { PATCH as patchLink, DELETE as delLink } from "@/app/api/projects/[id]/campaigns/links/[linkId]/route";
import { GET as getSummary } from "@/app/api/projects/[id]/campaigns/summary/route";
import { GET as getMapping, PUT as putMapping } from "@/app/api/projects/[id]/campaigns/csv-mapping/route";
import { POST as postLaunch } from "@/app/api/projects/[id]/campaigns/launch/route";
import { POST as postExplain } from "@/app/api/projects/[id]/campaigns/explain/route";
import { GET as redirect } from "@/app/l/[code]/route";
import { limiter, LIMITS } from "@/lib/campaigns/rateLimit";
import { CAMPAIGN_STORE, LAUNCH_STORE } from "@/lib/campaigns/schemas";
import { ctx, json, read } from "../api/helpers";
import { chooseReasoning, clearModelRows } from "../ai/setup";
import { addItem, approve, itemsOf, makeConcept, run, scriptedModel, type Script } from "../drafts/helpers";
import type { StandIn } from "../standins/core";
import type { OpenAIOptions } from "../standins/openai";

const P = "zz-campaigns-api";
const U = `http://test.local/api/projects/${P}/campaigns`;
let s: StandIn<OpenAIOptions>;
const script: Script = {};
let camp = 0;
let adA = 0;

const call = <T>(h: (r: Request, c: ReturnType<typeof ctx>) => Promise<Response>, method: string, path: string, body?: unknown) => h(json(method, body, `${U}/${path}`), ctx(P)).then((r) => read<T>(r));
const withLink = (linkId: number) => ({ params: Promise.resolve({ id: P, linkId: String(linkId) }) });
const open = (code: string) => redirect(new Request(`http://test.local/l/${code}`, { headers: { "user-agent": "secret-agent", "x-forwarded-for": "203.0.113.9", referer: "http://elsewhere.test/page", cookie: "a=b" } }), { params: Promise.resolve({ code }) });

beforeAll(async () => {
  s = await scriptedModel(script);
  await makeConcept(P, "ZZ Campaigns", "electronics", "A lamp");
  camp = await addItem(P, CAMPAIGN_STORE, "Spring ads", { kind: "campaign", objective: "conversion", rule: { stopAboveMinor: 1000, scaleBelowMinor: 500, scaleByPercent: 25 }, budgetDailyMinor: 2000 }, "", "running");
  adA = await addItem(P, "marketing/ads", "Ad A");
  await addItem(P, "marketing/ads", "Ad B");
});

afterAll(async () => {
  await clearModelRows();
  await q("DELETE FROM projects WHERE id=$1", [P]);
  await q("DELETE FROM settings WHERE key LIKE $1", [`campaigns.csv.${P}.%`]);
  await s.close();
  await pool().end();
});

beforeEach(async () => {
  for (const k of Object.keys(script)) delete script[k];
  s.requests.length = 0;
  limiter().reset();
});

describe("results", () => {
  it("saves rows, replaces a day entered again and never doubles it", async () => {
    const row = { day: "2026-12-01", spend: 1000, impressions: 5000, clicks: 100, orders: 2, revenue: 4000 };
    const a = await call<{ added: number; replaced: number }>(postResults, "POST", "results", { campaignId: camp, rows: [row] });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ added: 1, replaced: 0 });
    const b = await call<{ added: number; replaced: number; rows: { spend: number }[] }>(postResults, "POST", "results", { campaignId: camp, rows: [{ ...row, spend: 1500 }], source: "csv" });
    expect(b.body).toMatchObject({ added: 0, replaced: 1 });
    expect(b.body.rows).toHaveLength(1);
    expect(b.body.rows[0].spend).toBe(1500);
  });

  it("keeps a whole-campaign day and a creative's day apart", async () => {
    const r = await call<{ rows: unknown[] }>(postResults, "POST", "results", { campaignId: camp, rows: [{ day: "2026-12-01", creativeId: adA, spend: 100, clicks: 5 }] });
    expect(r.status).toBe(201);
    expect(r.body.rows.length).toBeGreaterThanOrEqual(2);
  });

  it("refuses a bad day, a negative number, a duplicate in one request, a stranger's creative and an unknown campaign, saving nothing", async () => {
    const before = (await call<{ rows: unknown[] }>(getResults, "GET", "results")).body.rows.length;
    expect((await call(postResults, "POST", "results", { campaignId: camp, rows: [{ day: "2026-02-30", spend: 1 }] })).status).toBe(400);
    expect((await call(postResults, "POST", "results", { campaignId: camp, rows: [{ day: "2026-12-02", spend: -1 }] })).status).toBe(400);
    expect((await call(postResults, "POST", "results", { campaignId: camp, rows: [{ day: "2026-12-02", spend: 1.5 }] })).status).toBe(400);
    expect((await call(postResults, "POST", "results", { campaignId: camp, rows: [{ day: "2026-12-02" }, { day: "2026-12-02" }] })).status).toBe(400);
    expect((await call(postResults, "POST", "results", { campaignId: camp, rows: [{ day: "2026-12-02" }, { day: "2026-12-03", creativeId: camp }] })).status).toBe(400);
    expect((await call(postResults, "POST", "results", { campaignId: 999999999, rows: [{ day: "2026-12-02" }] })).status).toBe(404);
    expect((await call<{ rows: unknown[] }>(getResults, "GET", "results")).body.rows).toHaveLength(before);
  });

  it("removes rows by id and writes to the history", async () => {
    const all = (await call<{ rows: { id: number }[] }>(getResults, "GET", `results?campaign=${camp}`)).body.rows;
    const r = await call<{ removed: number }>(delResults, "DELETE", "results", { campaignId: camp, ids: [all[0].id] });
    expect(r.body.removed).toBe(1);
    const ev = await q<{ kind: string }>("SELECT kind FROM events WHERE project_id=$1 AND kind LIKE 'campaign.results%'", [P]);
    expect(ev.length).toBeGreaterThanOrEqual(2);
  });
});

describe("csv mapping", () => {
  it("remembers the mapping for a channel and refuses a bad channel name", async () => {
    const saved = { layout: "meta-ads", dateOrder: "dmy", mapping: { day: "Day", spend: "Amount spent (USD)" } };
    const put = await call<{ error: string }>(putMapping, "PUT", "csv-mapping", { channel: "meta-ads", saved });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    const g = await read<{ saved: typeof saved }>(await getMapping(json("GET", undefined, `${U}/csv-mapping?channel=meta-ads`), ctx(P)));
    expect(g.body.saved).toEqual(saved);
    const other = await read<{ saved: unknown }>(await getMapping(json("GET", undefined, `${U}/csv-mapping?channel=google-ads`), ctx(P)));
    expect(other.body.saved).toBeNull();
    expect((await getMapping(json("GET", undefined, `${U}/csv-mapping?channel=Bad%20Name`), ctx(P))).status).toBe(400);
  });
});

describe("tracked links and the short redirect", () => {
  let code = "";
  let linkId = 0;
  let planRow = 0;
  // destinations must be on the concept's allow-list (Marketing budget and rules), robustness review S5
  beforeAll(async () => {
    planRow = await addItem(P, CAMPAIGN_STORE, "Marketing plan", { kind: "plan", linkHosts: ["shop.example", "169.254.169.254"] }, "", "planned");
  });
  afterAll(async () => {
    await q("DELETE FROM items WHERE id=$1", [planRow]);
  });
  const make = (extra: Record<string, unknown> = {}) => call<{ link: { id: number; code: string | null; destination: string; shortPath: string | null } }>(postLink, "POST", "links", { campaignId: camp, baseUrl: "https://shop.example/lamp", source: "meta", medium: "paid-social", ...extra });

  it("builds the UTM address and a short code", async () => {
    const r = await make({ creativeId: adA });
    expect(r.status).toBe(201);
    const u = new URL(r.body.link.destination);
    expect(u.origin + u.pathname).toBe("https://shop.example/lamp");
    expect(u.searchParams.get("utm_source")).toBe("meta");
    expect(u.searchParams.get("utm_medium")).toBe("paid-social");
    expect(u.searchParams.get("utm_content")).toBe("ad-a");
    code = r.body.link.code as string;
    linkId = r.body.link.id;
    expect(r.body.link.shortPath).toBe(`/l/${code}`);
  });

  it("refuses a destination that is not http(s), has a login in it, or a creative that is not an ad", async () => {
    expect((await make({ baseUrl: "javascript:alert(1)" })).status).toBe(400);
    expect((await make({ baseUrl: "https://user:pw@shop.example/" })).status).toBe(400);
    expect((await make({ baseUrl: "ftp://shop.example/" })).status).toBe(400);
    expect((await make({ creativeId: camp })).status).toBe(400);
  });

  it("the reviewer's repro: refuses http, a host that is not on the list, and a metadata address even when listed", async () => {
    const http = await make({ baseUrl: "http://shop.example/lamp" });
    expect(http.status).toBe(400);
    const phish = await make({ baseUrl: "https://evil.example/login" });
    expect(phish.status).toBe(400);
    expect((phish.body as unknown as { error: string }).error).toMatch(/not on this concept's list/);
    const meta = await make({ baseUrl: "https://169.254.169.254/latest/meta-data/" });
    expect(meta.status).toBe(400);
    expect((meta.body as unknown as { error: string }).error).toMatch(/link-local/);
    // a sub-domain of a listed host is allowed
    expect((await make({ baseUrl: "https://www.shop.example/lamp", short: false })).status).toBe(201);
  });

  it("does not follow a destination the rules no longer allow, and shows nothing but a 404", async () => {
    for (const destination of ["http://shop.example/old", "https://evil.example/", "https://169.254.169.254/"]) {
      const c = `zz${Math.random().toString(36).slice(2, 8)}`.replace(/[^a-z0-9]/g, "a").slice(0, 8);
      await q(
        "INSERT INTO tracked_links (project_id, campaign_id, base_url, destination, utm_source, utm_medium, utm_campaign, code) VALUES ($1,$2,$3,$3,'x','cpc','c',$4)",
        [P, camp, destination, c]
      );
      const r = await open(c);
      expect({ destination, status: r.status, location: r.headers.get("location") }).toEqual({ destination, status: 404, location: null });
      expect(await r.text()).toBe("This link does not exist.");
    }
  });

  it("redirects to the saved destination only, and counts the click by day with nothing about the visitor", async () => {
    const res = await open(code);
    expect(res.status).toBe(302);
    const dest = (await q<{ destination: string }>("SELECT destination FROM tracked_links WHERE id=$1", [linkId]))[0].destination;
    expect(res.headers.get("location")).toBe(dest);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    await open(code);
    const clicks = await q<Record<string, unknown>>("SELECT * FROM link_clicks WHERE link_id=$1", [linkId]);
    expect(clicks).toHaveLength(1);
    expect(Number(clicks[0].clicks)).toBe(2);
    // the only columns are the link, the day and the count: no address, agent, referrer or time
    expect(Object.keys(clicks[0]).sort()).toEqual(["clicks", "day", "link_id"]);
    expect(JSON.stringify(clicks)).not.toMatch(/203\.0\.113|secret-agent|elsewhere/);
  });

  it("feeds the click count to the results and the link list", async () => {
    const l = await call<{ links: { id: number; clicks: number }[] }>(getLinks, "GET", "links");
    expect(l.body.links.find((x) => x.id === linkId)?.clicks).toBe(2);
    const r = await call<{ linkClicks: { campaignId: number; clicks: number }[] }>(getResults, "GET", `results?campaign=${camp}`);
    expect(r.body.linkClicks.reduce((a, x) => a + x.clicks, 0)).toBe(2);
  });

  it("answers 404 and nothing else for an unknown, a malformed and a disabled code, and counts nothing for them", async () => {
    for (const bad of ["zzzzzzzz", "../etc", "A", ""]) {
      const r = await open(bad);
      expect(r.status).toBe(404);
      expect(r.headers.get("location")).toBeNull();
    }
    await read(await patchLink(json("PATCH", { disabled: true }, `${U}/links/${linkId}`), withLink(linkId)));
    expect((await open(code)).status).toBe(404);
    await read(await patchLink(json("PATCH", { disabled: false }, `${U}/links/${linkId}`), withLink(linkId)));
    expect((await open(code)).status).toBe(302);
    expect(Number((await q<{ clicks: string }>("SELECT clicks FROM link_clicks WHERE link_id=$1", [linkId]))[0].clicks)).toBe(3);
  });

  it("is rate limited by code, and an unknown code cannot be probed without limit", async () => {
    for (let i = 0; i < LIMITS.perCode; i++) await open(code);
    expect((await open(code)).status).toBe(429);
    limiter().reset();
    let seen429 = false;
    for (let i = 0; i < LIMITS.unknown + 5; i++) if ((await open("zzzzzzzz")).status === 429) seen429 = true;
    expect(seen429).toBe(true);
  });

  it("deleting a link ends its short address", async () => {
    limiter().reset();
    expect((await delLink(json("DELETE", undefined, `${U}/links/${linkId}`), withLink(linkId))).status).toBe(200);
    expect((await open(code)).status).toBe(404);
    expect(await q("SELECT 1 FROM link_clicks WHERE link_id=$1", [linkId])).toHaveLength(0);
  });

  it("makes a UTM-only link with no short code", async () => {
    const r = await make({ short: false });
    expect(r.body.link.code).toBeNull();
    expect(r.body.link.shortPath).toBeNull();
  });
});

describe("summary", () => {
  it("answers the currency and a margin list", async () => {
    const r = await read<{ currency: string; margins: unknown[] }>(await getSummary(json("GET", undefined, `${U}/summary`), ctx(P)));
    expect(r.status).toBe(200);
    expect(r.body.currency).toBe("USD");
    expect(Array.isArray(r.body.margins)).toBe(true);
  });
});

describe("launch", () => {
  it("makes the launch row and its steps in one go, with unique keys, and a second launch of the same template gets its own key", async () => {
    const a = await call<{ launchKey: string; steps: number }>(postLaunch, "POST", "launch", { template: "soft", launchDate: "2027-03-01" });
    expect(a.status).toBe(201);
    expect(a.body.steps).toBe(10);
    const b = await call<{ launchKey: string }>(postLaunch, "POST", "launch", { template: "soft", launchDate: "2027-06-01" });
    expect(b.body.launchKey).not.toBe(a.body.launchKey);
    const rows = await q<{ key: string | null; kind: string }>("SELECT data->>'key' AS key, data->>'kind' AS kind FROM items WHERE project_id=$1 AND section=$2", [P, LAUNCH_STORE]);
    expect(rows.filter((r) => r.kind === "launch")).toHaveLength(2);
    const keys = rows.filter((r) => r.key).map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(rows.filter((r) => r.kind === "launch").every((r) => r.key === null)).toBe(true);
  });

  it("refuses an unknown template and a date that is not a date", async () => {
    expect((await call(postLaunch, "POST", "launch", { template: "nope", launchDate: "2027-03-01" })).status).toBe(400);
    expect((await call(postLaunch, "POST", "launch", { template: "soft", launchDate: "2027-13-01" })).status).toBe(400);
  });
});

describe("explanation", () => {
  it("returns the rule's verdict with the model's labelled text, and the model cannot change the verdict", async () => {
    await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "explainer" });
    script.explain = { explanation: "You should definitely scale this.", suggestion: "Raise the budget." };
    const r = await call<{ verdict: string; headline: string; modelText: { explanation: string }; label: string }>(postExplain, "POST", "explain", { campaignId: camp });
    expect(r.status).toBe(200);
    // 1 order's worth of spend at 15.00 over 2 orders from the first test rows: verdict comes from the rule in code
    expect(["stop", "hold", "scale", "not_enough_data"]).toContain(r.body.verdict);
    expect(r.body.modelText.explanation).toContain("scale");
    expect(r.body.label).toContain("rule's");
    const sent = JSON.stringify(s.requests);
    expect(sent).toContain("must not change it");
  });

  it("answers 503 without a model", async () => {
    await clearModelRows();
    const r = await call<{ error: string }>(postExplain, "POST", "explain", { campaignId: camp });
    expect(r.status).toBe(503);
    expect(r.body.error).toContain("Admin");
  });
});

describe("the campaign plan generator", () => {
  let persona = 0;
  let channel = 0;
  const MSG = "Never pay overweight fees again";
  beforeAll(async () => {
    await chooseReasoning({ provider: "ollama", baseUrl: `${s.url}/v1`, model: "planner" });
  });

  it("is blocked, with the reason, until the budget and share are set", async () => {
    const r = await run({ projectId: P, generator: "campaigns" });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain("marketing budget");
  });

  it("drafts a campaign whose numbers come from the budget and the margin, never from the model", async () => {
    await q("INSERT INTO items (project_id, section, title, status, data) VALUES ($1,$2,'Marketing plan','planned',$3)", [P, CAMPAIGN_STORE, JSON.stringify({ kind: "plan", planTotalMinor: 100000, allowableSharePercent: 40, judgeAfterOrders: 3, scaleBelowPercent: 50, scaleByPercent: 20 })]);
    persona = await addItem(P, "marketing/personas", "Frequent flyer");
    await addItem(P, "marketing/positioning", "Core", { messages: [{ text: MSG }] });
    channel = await addItem(P, "sales/channels", "Own shop", { price: 50, platformPercent: 0 });
    script.campaigns = { rows: [{ title: "Shop ads", objective: "conversion", channelId: channel, adChannel: "Meta feed", personaId: persona, message: MSG, creativeIds: [adA, 999999], budgetSharePercent: 60, startOffsetDays: 0, durationDays: 10, reasoning: "Flyers buy at home.", basedOn: [] }, { title: "Too greedy", objective: "awareness", channelId: channel, adChannel: "Meta", personaId: persona, message: MSG, creativeIds: [], budgetSharePercent: 60, startOffsetDays: 0, durationDays: 5, reasoning: "x", basedOn: [] }, { title: "Invented persona", objective: "awareness", channelId: channel, adChannel: "Meta", personaId: 424242, message: MSG, budgetSharePercent: 5, durationDays: 5, reasoning: "x", basedOn: [] }] };
    const r = await run({ projectId: P, generator: "campaigns" });
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    const drafts = (await import("../drafts/helpers")).list;
    const list = (await drafts(P)).body.drafts.filter((d) => d.generator === "campaigns");
    expect(list).toHaveLength(1);
    const d = list[0].data as Record<string, unknown>;
    expect(d.budgetTotalMinor).toBe(60000);
    expect(JSON.stringify(d.arithmetic)).toContain("60% of");
    expect(JSON.stringify(r.body)).toMatch(/Too greedy|more than 100|Invented persona|persona #424242/);
    // nothing reached the items until approval
    expect((await itemsOf(P, CAMPAIGN_STORE)).filter((i) => i.title === "Shop ads")).toHaveLength(0);
    const a = await approve(list[0].id);
    expect(a.status).toBe(200);
    expect(a.body.item?.section).toBe(CAMPAIGN_STORE);
  });
});
