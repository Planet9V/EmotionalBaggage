import { NextResponse } from "next/server";
import { body } from "@/lib/api/route";
import { adminRoute, isPlatformAdmin } from "@/lib/admin/guard";
import type { PlanCatalogue } from "@/lib/admin/planSchema";
import { getPlanCatalogue, LIMIT_KEYS, LIMIT_LABEL, planCatalogue, resetPlanCatalogue, savePlanCatalogue } from "@/lib/admin/plans";

const view = async () => ({ ...(await getPlanCatalogue()), limits: LIMIT_KEYS.map((k) => ({ key: k, label: LIMIT_LABEL[k] })) });

/**
 * What anyone but the platform administrator may read (review S2): only what /welcome shows. Hidden tiers are left
 * out, prices only when the page shows them, and no Stripe price ids or limits.
 */
function publicOnly(c: PlanCatalogue): PlanCatalogue {
  return {
    showPrices: c.showPrices,
    tiers: c.tiers
      .filter((t) => t.shown)
      .map((t) => ({
        ...t,
        priceMonthly: c.showPrices ? t.priceMonthly : null,
        priceYearly: c.showPrices ? t.priceYearly : null,
        stripePriceMonthly: null,
        stripePriceYearly: null,
        limits: Object.fromEntries(Object.keys(t.limits).map((k) => [k, null])) as PlanCatalogue["tiers"][number]["limits"],
      })),
  };
}

/** The catalogue in force (saved, or the built-in one) and the limit names; for anyone else, only the public part. */
export const GET = adminRoute(async (req: Request) => {
  const v = await view();
  if (await isPlatformAdmin(req)) return NextResponse.json(v);
  return NextResponse.json({ ...v, catalogue: publicOnly(v.catalogue), publicOnly: true, problem: undefined });
});

/** Replaces the whole catalogue. Validated on the server: unique keys, no negative prices, at least one tier shown. */
export const PUT = adminRoute(async (req: Request) => {
  const next = await body(req, planCatalogue);
  await savePlanCatalogue(next);
  return NextResponse.json(await view());
}, { platformAdmin: true });

/** Back to the built-in catalogue (content.ts, prices hidden). */
export const DELETE = adminRoute(async () => {
  await resetPlanCatalogue();
  return NextResponse.json(await view());
}, { platformAdmin: true });
