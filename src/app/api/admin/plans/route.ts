import { NextResponse } from "next/server";
import { body } from "@/lib/api/route";
import { adminRoute } from "@/lib/admin/guard";
import { getPlanCatalogue, LIMIT_KEYS, LIMIT_LABEL, planCatalogue, resetPlanCatalogue, savePlanCatalogue } from "@/lib/admin/plans";

const view = async () => ({ ...(await getPlanCatalogue()), limits: LIMIT_KEYS.map((k) => ({ key: k, label: LIMIT_LABEL[k] })) });

/** The catalogue in force (saved, or the built-in one) and the limit names. */
export const GET = adminRoute(async () => NextResponse.json(await view()));

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
