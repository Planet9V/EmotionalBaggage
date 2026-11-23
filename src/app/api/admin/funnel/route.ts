import { NextResponse } from "next/server";
import { z } from "zod";
import { body } from "@/lib/api/route";
import { adminRoute } from "@/lib/admin/guard";
import { funnelReport, MAX_RETENTION_DAYS, setRetentionDays } from "@/lib/events/store";

const day = (d: Date) => d.toISOString().slice(0, 10);

/** The funnel for a range of UTC days (?from=YYYY-MM-DD&to=YYYY-MM-DD; the last 30 days by default). The platform administrator's. */
export const GET = adminRoute(async (req: Request) => {
  const u = new URL(req.url);
  const to = u.searchParams.get("to") ?? day(new Date());
  const from = u.searchParams.get("from") ?? day(new Date(Date.parse(to) - 29 * 86_400_000));
  return NextResponse.json(await funnelReport(from, to), { headers: { "cache-control": "no-store" } });
}, { platformAdmin: true });

const Retention = z.object({ retentionDays: z.number().int("must be a whole number").min(1, "is at least 1").max(MAX_RETENTION_DAYS, `is at most ${MAX_RETENTION_DAYS}`) }).strict();

/** How many days funnel events are kept; older ones are deleted at once. */
export const PUT = adminRoute(async (req: Request) => {
  const { retentionDays } = await body(req, Retention);
  return NextResponse.json({ retentionDays: await setRetentionDays(retentionDays) });
}, { platformAdmin: true });
