import { NextResponse } from "next/server";
import { z } from "zod";
import { logEventIn, q, tx } from "@/lib/db";
import { body, HttpError, recordId, requireProject, route } from "@/lib/api/route";
import { DAY_RE, isDay } from "@/lib/campaigns/days";
import { loadLinkClicks, loadResults, requireCampaign, requireCreative, RESULT_COLS, toResult } from "@/lib/campaigns/server";

type Ctx = { params: Promise<{ id: string }> };

const whole = (max: number) => z.number().int("must be a whole number").min(0, "cannot be negative").max(max, "is too large");

const resultRow = z.object({
  day: z.string().regex(DAY_RE, "must be a date like 2026-12-31").refine(isDay, "is not a real date"),
  /** an ad or post the numbers belong to; leave out for the whole campaign */
  creativeId: z.number().int().positive().nullable().optional(),
  /** minor units (cents) */
  spend: whole(1_000_000_000_000).default(0),
  impressions: whole(1_000_000_000_000).default(0),
  clicks: whole(1_000_000_000_000).default(0),
  orders: whole(1_000_000_000_000).default(0),
  revenue: whole(1_000_000_000_000).default(0),
});

const save = z.object({
  campaignId: z.number().int().positive(),
  source: z.enum(["manual", "paste", "csv"]).default("manual"),
  rows: z.array(resultRow).min(1, "has no rows").max(5000, "has more than 5,000 rows; import the file in parts"),
});

const remove = z.object({ campaignId: z.number().int().positive(), ids: z.array(z.number().int().positive()).min(1).max(5000) });

/** Results by day for one campaign (`?campaign=`) or every campaign, with the clicks the app's own links counted. */
export const GET = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const c = new URL(req.url).searchParams.get("campaign");
  const campaignId = c === null ? undefined : recordId(c, "That campaign");
  if (campaignId !== undefined) await requireCampaign(id, campaignId);
  const [rows, linkClicks] = await Promise.all([loadResults(id, campaignId), loadLinkClicks(id, campaignId)]);
  return NextResponse.json({ rows, linkClicks });
});

/**
 * Saves results for a campaign. A day for the same campaign and creative is replaced, so entering a day
 * again, or importing a file again, corrects it and never doubles it. One transaction: nothing is saved
 * if any row is refused.
 */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const b = await body(req, save);
  const campaign = await requireCampaign(id, b.campaignId);
  const seen = new Set<string>();
  for (const r of b.rows) {
    const k = `${r.creativeId ?? 0}|${r.day}`;
    if (seen.has(k)) throw new HttpError(400, `${r.day} appears twice for the same creative in this request. Add them together first.`);
    seen.add(k);
  }
  const result = await tx(async (c) => {
    const labels = new Map<number, string>();
    for (const cid of new Set(b.rows.flatMap((r) => (r.creativeId ? [r.creativeId] : [])))) labels.set(cid, (await requireCreative(c, id, cid)).title);
    let added = 0;
    let replaced = 0;
    // the figures each saved day had, and have now, for the record
    const before: Record<string, unknown>[] = [];
    const after: Record<string, unknown>[] = [];
    for (const r of b.rows) {
      const old = (await c.query<{ spend_minor: string; impressions: string; clicks: string; orders: string; revenue_minor: string }>(
        "SELECT spend_minor, impressions, clicks, orders, revenue_minor FROM campaign_results WHERE campaign_id=$1 AND COALESCE(creative_id, 0)=$2 AND day=$3",
        [b.campaignId, r.creativeId ?? 0, r.day]
      )).rows[0];
      const key = { day: r.day, creativeId: r.creativeId ?? null };
      if (old) before.push({ ...key, spend: Number(old.spend_minor), impressions: Number(old.impressions), clicks: Number(old.clicks), orders: Number(old.orders), revenue: Number(old.revenue_minor) });
      after.push({ ...key, spend: r.spend, impressions: r.impressions, clicks: r.clicks, orders: r.orders, revenue: r.revenue });
      const res = await c.query<{ inserted: boolean }>(
        `INSERT INTO campaign_results (project_id, campaign_id, creative_id, creative_label, day, spend_minor, impressions, clicks, orders, revenue_minor, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (campaign_id, (COALESCE(creative_id, 0)), day)
         DO UPDATE SET spend_minor=EXCLUDED.spend_minor, impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks, orders=EXCLUDED.orders,
                       revenue_minor=EXCLUDED.revenue_minor, source=EXCLUDED.source, creative_label=EXCLUDED.creative_label, updated_at=now()
         RETURNING (xmax = 0) AS inserted`,
        [id, b.campaignId, r.creativeId ?? null, r.creativeId ? (labels.get(r.creativeId) ?? "") : "", r.day, r.spend, r.impressions, r.clicks, r.orders, r.revenue, b.source]
      );
      if (res.rows[0].inserted) added++;
      else replaced++;
    }
    const days = b.rows.map((r) => r.day).sort();
    await logEventIn(c, id, "campaign.results", `Results for "${campaign.title}": ${added} added, ${replaced} replaced (${days[0]} to ${days[days.length - 1]}, ${b.source})`, {
      campaignId: b.campaignId,
      added,
      replaced,
      source: b.source,
      from: days[0],
      to: days[days.length - 1],
      before: { results: before },
      after: { results: after },
    });
    return { added, replaced };
  });
  const rows = await loadResults(id, b.campaignId);
  return NextResponse.json({ ...result, rows }, { status: 201 });
});

/** Removes result rows of one campaign by id. */
export const DELETE = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  await requireProject(id);
  const b = await body(req, remove);
  const campaign = await requireCampaign(id, b.campaignId);
  const removed = await tx(async (c) => {
    const r = await c.query<{ id: string; day: string; creative_id: string | null; spend_minor: string; clicks: string; orders: string }>(
      `DELETE FROM campaign_results WHERE project_id=$1 AND campaign_id=$2 AND id = ANY($3) RETURNING id, to_char(day, 'YYYY-MM-DD') AS day, creative_id, spend_minor, clicks, orders`,
      [id, b.campaignId, b.ids]
    );
    await logEventIn(c, id, "campaign.results.removed", `Removed ${r.rowCount ?? 0} result rows from "${campaign.title}"`, {
      campaignId: b.campaignId,
      ids: b.ids,
      before: { results: r.rows.map((x) => ({ id: Number(x.id), day: x.day, creativeId: x.creative_id === null ? null : Number(x.creative_id), spend: Number(x.spend_minor), clicks: Number(x.clicks), orders: Number(x.orders) })) },
      after: { results: [] },
    });
    return r.rowCount ?? 0;
  });
  const rows = await q(`SELECT ${RESULT_COLS} FROM campaign_results WHERE project_id=$1 AND campaign_id=$2 ORDER BY day, id`, [id, b.campaignId]);
  return NextResponse.json({ removed, rows: (rows as Parameters<typeof toResult>[0][]).map(toResult) });
});
