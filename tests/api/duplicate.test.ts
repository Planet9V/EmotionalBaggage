// Duplicate and export carry what the twelve features added (integration item 7): the seeded example
// is duplicated with a campaign, an ad, a print job that ran, a tracked link with clicks, a result and
// a draft added to it, and compared section by section.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, q } from "@/lib/db";
import { POST as duplicate } from "@/app/api/projects/[id]/duplicate/route";
import { GET as exportConcept } from "@/app/api/projects/[id]/export/route";
import { ctx, json, read, SEEDED } from "./helpers";

type Row = { id: string; section: string; title: string; body: string; data: Record<string, unknown>; status: string; sort: number };
const rows = (id: string) => q<Row>("SELECT id, section, title, body, data, status, sort FROM items WHERE project_id=$1 ORDER BY sort, id", [id]);
const COPY = "zz dup example copy";
let copyId = "";
let was = { currency: "", regions: [] as string[] };
const added: number[] = [];
const ins = async (section: string, title: string, data: Record<string, unknown>, status: string) => {
  const r = await q<{ id: string }>("INSERT INTO items (project_id, section, title, data, status, sort) VALUES ($1,$2,$3,$4,$5,9000) RETURNING id", [SEEDED, section, title, JSON.stringify(data), status]);
  added.push(Number(r[0].id));
  return Number(r[0].id);
};
let ad = 0, campaign = 0, job = 0, gcode = 0, channel = 0;

beforeAll(async () => {
  const p = (await q<{ currency: string; sales_regions: string[] }>("SELECT currency, sales_regions FROM projects WHERE id=$1", [SEEDED]))[0];
  was = { currency: p.currency, regions: p.sales_regions };
  await q("UPDATE projects SET currency='EUR', sales_regions='[\"eu\",\"uk\"]'::jsonb WHERE id=$1", [SEEDED]);
  gcode = Number((await q<{ id: string }>("INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta) VALUES ($1,'zz.gcode','text/plain','gcode',1,'x',$2,'{}') RETURNING id", [SEEDED, Buffer.from("G")]))[0].id);
  channel = await ins("sales/channels", "zz Direct", { price: 20 }, (await q<{ s: string }>("SELECT 'active' AS s"))[0].s);
  ad = await ins("marketing/ads", "zz Meta ad", { channel: "meta", fields: { primaryText: "A bag tag" } }, "draft");
  campaign = await ins("marketing/campaigns", "zz Launch", { kind: "campaign", creative: [{ section: "marketing/ads", itemId: ad, title: "zz Meta ad" }], salesChannel: { section: "sales/channels", itemId: channel } }, "planned");
  job = await ins("prototype/printing", "zz Print lid", { part: "ENC1", material: "PLA", buildKey: "b1", printerId: 7, printerName: "Shop X1", slice: { seconds: 60, filamentG: 3, filamentMm: 900, orcaVersion: "2", profile: { machine: "m", process: "p", filament: "f" }, warnings: [], slicedAt: "2026-11-21", gcodeFileId: gcode, gcodeSha256: "x" }, sentAt: "2026-11-21", result: { outcome: "success", photoFileIds: [] } }, "done");
  const link = await q<{ id: string }>(
    "INSERT INTO tracked_links (project_id, campaign_id, creative_id, creative_label, base_url, destination, utm_source, utm_medium, utm_campaign, utm_content, code) VALUES ($1,$2,$3,'zz Meta ad','https://example.com/','https://example.com/?utm_source=meta','meta','paid-social','launch','zz-meta-ad','zzcode01') RETURNING id",
    [SEEDED, campaign, ad]
  );
  await q("INSERT INTO link_clicks (link_id, day, clicks) VALUES ($1, '2026-11-20', 12)", [link[0].id]);
  await q("INSERT INTO campaign_results (project_id, campaign_id, creative_id, day, spend_minor, clicks) VALUES ($1,$2,$3,'2026-11-20',500,12)", [SEEDED, campaign, ad]);
  await q("INSERT INTO drafts (project_id, generator, target_store, title, body, data, sources, model, provider, run_id) VALUES ($1,'personas','marketing/personas','zz draft','','{}','[]','m','p', gen_random_uuid())", [SEEDED]);
  const r = await read<{ project: { id: string } }>(await duplicate(json("POST", { name: COPY }), ctx(SEEDED)));
  expect(r.status).toBe(201);
  copyId = r.body.project.id;
});

afterAll(async () => {
  if (copyId) await q("DELETE FROM projects WHERE id=$1", [copyId]);
  await q("DELETE FROM tracked_links WHERE project_id=$1 AND code='zzcode01'", [SEEDED]);
  await q("DELETE FROM drafts WHERE project_id=$1 AND title='zz draft'", [SEEDED]);
  await q("DELETE FROM items WHERE id = ANY($1)", [added]);
  await q("DELETE FROM files WHERE id=$1", [gcode]);
  await q("UPDATE projects SET currency=$2, sales_regions=$3::jsonb WHERE id=$1", [SEEDED, was.currency, JSON.stringify(was.regions)]);
  await pool().end();
});

describe("duplicating the example, section by section", () => {
  it("carries the product type, currency and sales regions", async () => {
    const [a, b] = await Promise.all([SEEDED, copyId].map(async (id) => (await q<{ product_type: string; currency: string; sales_regions: string[] }>("SELECT product_type, currency, sales_regions FROM projects WHERE id=$1", [id]))[0]));
    expect(b).toEqual(a);
    expect(b.currency).toBe("EUR");
  });

  it("copies every section with the same rows; references point at the copies", async () => {
    const [a, b] = [await rows(SEEDED), await rows(copyId)];
    const sections = [...new Set(a.map((r) => r.section))].sort();
    expect([...new Set(b.map((r) => r.section))].sort()).toEqual(sections);
    for (const s of sections) expect(b.filter((r) => r.section === s).map((r) => r.title), s).toEqual(a.filter((r) => r.section === s).map((r) => r.title));
    const copyAd = b.find((r) => r.title === "zz Meta ad")!;
    const copyChannel = b.find((r) => r.title === "zz Direct")!;
    const copyCampaign = b.find((r) => r.title === "zz Launch")!;
    expect(copyCampaign.data.creative).toEqual([{ section: "marketing/ads", itemId: Number(copyAd.id), title: "zz Meta ad" }]);
    expect((copyCampaign.data.salesChannel as { itemId: number }).itemId).toBe(Number(copyChannel.id));
    // the source is untouched
    expect((a.find((r) => r.title === "zz Launch")!.data.creative as { itemId: number }[])[0].itemId).toBe(ad);
  });

  it("a print job arrives queued, without its slice result, send, result or printer", async () => {
    const copyJob = (await rows(copyId)).find((r) => r.title === "zz Print lid")!;
    expect(copyJob.status).toBe("queued");
    expect(copyJob.data).toEqual({ part: "ENC1", material: "PLA", buildKey: "b1" });
    // the sliced G-code belonged to the run: not copied
    expect(await q("SELECT 1 FROM files WHERE project_id=$1 AND name='zz.gcode'", [copyId])).toHaveLength(0);
    expect((await q<{ status: string }>("SELECT status FROM items WHERE id=$1", [job]))[0].status).toBe("done");
  });

  it("tracked links get new codes and no clicks; results, drafts and pins of other parts follow the rules", async () => {
    const b = await rows(copyId);
    const links = await q<{ id: string; code: string; campaign_id: string; creative_id: string; utm_content: string }>("SELECT id, code, campaign_id, creative_id, utm_content FROM tracked_links WHERE project_id=$1", [copyId]);
    expect(links).toHaveLength(1);
    expect(links[0].code).toMatch(/^[a-z0-9]{8}$/);
    expect(links[0].code).not.toBe("zzcode01");
    expect(Number(links[0].campaign_id)).toBe(Number(b.find((r) => r.title === "zz Launch")!.id));
    expect(Number(links[0].creative_id)).toBe(Number(b.find((r) => r.title === "zz Meta ad")!.id));
    expect(links[0].utm_content).toBe("zz-meta-ad");
    expect(await q("SELECT 1 FROM link_clicks WHERE link_id=$1", [links[0].id])).toHaveLength(0);
    expect(await q("SELECT 1 FROM campaign_results WHERE project_id=$1", [copyId])).toHaveLength(0);
    expect(await q("SELECT 1 FROM drafts WHERE project_id=$1", [copyId])).toHaveLength(0);
    expect(await q("SELECT 1 FROM audit_log WHERE project_id=$1 AND action <> 'project.duplicated'", [copyId])).toHaveLength(0);
    const pa = await q<{ n: number }>("SELECT count(*)::int AS n FROM pins WHERE project_id=$1", [SEEDED]);
    const pb = await q<{ n: number }>("SELECT count(*)::int AS n FROM pins WHERE project_id=$1", [copyId]);
    expect(pb[0].n).toBe(pa[0].n);
  });
});

describe("export", () => {
  it("carries currency, regions and tracked links, and leaves out drafts, results and clicks", async () => {
    const res = await exportConcept(json("GET"), ctx(SEEDED));
    const doc = (await res.json()) as Record<string, unknown> & { concept: { currency: string; salesRegions: string[]; productType: string }; trackedLinks: { code: string; campaignId: number; creativeId: number }[] };
    expect(doc.concept).toMatchObject({ currency: "EUR", salesRegions: ["eu", "uk"], productType: "electronics" });
    const link = doc.trackedLinks.find((l) => l.code === "zzcode01")!;
    expect(link).toMatchObject({ campaignId: campaign, creativeId: ad });
    expect(link).not.toHaveProperty("clicks");
    for (const k of ["drafts", "campaignResults", "linkClicks", "audit", "credentials"]) expect(doc).not.toHaveProperty(k);
    expect((doc.items as { id: number }[]).some((i) => i.id === job)).toBe(true);
  });
});
