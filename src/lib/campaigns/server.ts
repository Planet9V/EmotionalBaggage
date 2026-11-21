// Database access for the campaign routes. Reads and writes the two result tables; campaigns and
// launch steps are ordinary rows read with the item helpers.
import type { PoolClient } from "pg";
import { ITEM_COLS, q, toItem, type ItemRow } from "@/lib/db";
import { HttpError, notFound } from "@/lib/api/route";
import type { EconomicsRows } from "@/lib/economics/read";
import type { Item } from "@/lib/types";
import type { LinkClickRow } from "./analyze";
import type { ResultRow } from "./metrics";
import { CAMPAIGN_STORE } from "./schemas";

type ResultDb = {
  id: string;
  campaign_id: string;
  creative_id: string | null;
  creative_label: string;
  day: string;
  spend_minor: string;
  impressions: string;
  clicks: string;
  orders: string;
  revenue_minor: string;
  source: string;
};

export const RESULT_COLS = "id, campaign_id, creative_id, creative_label, to_char(day, 'YYYY-MM-DD') AS day, spend_minor, impressions, clicks, orders, revenue_minor, source";

export const toResult = (r: ResultDb): ResultRow => ({
  id: Number(r.id),
  campaignId: Number(r.campaign_id),
  creativeId: r.creative_id === null ? null : Number(r.creative_id),
  creativeLabel: r.creative_label,
  day: r.day,
  spend: Number(r.spend_minor),
  impressions: Number(r.impressions),
  clicks: Number(r.clicks),
  orders: Number(r.orders),
  revenue: Number(r.revenue_minor),
  source: r.source,
});

export async function loadResults(projectId: string, campaignId?: number): Promise<ResultRow[]> {
  const rows = await q<ResultDb>(
    `SELECT ${RESULT_COLS} FROM campaign_results WHERE project_id=$1 ${campaignId ? "AND campaign_id=$2" : ""} ORDER BY day, id`,
    campaignId ? [projectId, campaignId] : [projectId]
  );
  return rows.map(toResult);
}

/** Clicks the app's own short links counted, by campaign, creative and day. */
export async function loadLinkClicks(projectId: string, campaignId?: number): Promise<LinkClickRow[]> {
  const rows = await q<{ campaign_id: string; creative_id: string | null; day: string; clicks: string }>(
    `SELECT l.campaign_id, l.creative_id, to_char(c.day, 'YYYY-MM-DD') AS day, sum(c.clicks) AS clicks
       FROM link_clicks c JOIN tracked_links l ON l.id = c.link_id
      WHERE l.project_id=$1 ${campaignId ? "AND l.campaign_id=$2" : ""}
      GROUP BY l.campaign_id, l.creative_id, c.day ORDER BY c.day`,
    campaignId ? [projectId, campaignId] : [projectId]
  );
  return rows.map((r) => ({ campaignId: Number(r.campaign_id), creativeId: r.creative_id === null ? null : Number(r.creative_id), day: r.day, clicks: Number(r.clicks) }));
}

/** A campaign row of this concept, or a 404. The plan row is not a campaign. */
export async function requireCampaign(projectId: string, campaignId: number): Promise<Item> {
  const rows = await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE id=$1 AND project_id=$2 AND section=$3`, [campaignId, projectId, CAMPAIGN_STORE]);
  if (!rows.length || rows[0].data?.kind === "plan") throw notFound("That campaign");
  return toItem(rows[0]);
}

/** An ad or post of this concept, as a creative: its id and name. A 400 for anything else. */
export async function requireCreative(c: Pick<PoolClient, "query"> | null, projectId: string, id: number): Promise<{ id: number; title: string }> {
  const sql = "SELECT id, title FROM items WHERE id=$1 AND project_id=$2 AND section IN ('marketing/ads','marketing/social')";
  const rows = c ? (await c.query<{ id: string; title: string }>(sql, [id, projectId])).rows : await q<{ id: string; title: string }>(sql, [id, projectId]);
  if (!rows.length) throw new HttpError(400, `Creative #${id} is not an ad or a post in this concept.`);
  return { id: Number(rows[0].id), title: rows[0].title };
}

export async function currencyOf(projectId: string): Promise<string> {
  const r = await q<{ currency: string }>("SELECT currency FROM projects WHERE id=$1", [projectId]);
  return r[0]?.currency || "USD";
}

/** The rows the unit economics are worked from. */
export async function economicsRowsOf(projectId: string): Promise<EconomicsRows> {
  const rows = (await q<ItemRow>(`SELECT ${ITEM_COLS} FROM items WHERE project_id=$1 AND section = ANY($2) ORDER BY sort, id`, [projectId, ["design/bom", "production/economics", "sales/channels", "production/methods", "production/batches"]])).map(toItem);
  const of = (s: string) => rows.filter((i) => i.section === s);
  return { parts: of("design/bom"), economics: of("production/economics"), channels: of("sales/channels"), methods: of("production/methods"), batches: of("production/batches") };
}
