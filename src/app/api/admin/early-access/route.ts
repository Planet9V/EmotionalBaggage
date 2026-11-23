import { NextResponse } from "next/server";
import { z } from "zod";
import { body } from "@/lib/api/route";
import { adminRoute } from "@/lib/admin/guard";
import { earlyAccessCount, MAX_EARLY_ACCESS_LIMIT, setEarlyAccessLimit } from "@/lib/accessRequests/places";

const LimitChange = z.object({ limit: z.number().int("must be a whole number").min(0, "cannot be negative").max(MAX_EARLY_ACCESS_LIMIT, `is at most ${MAX_EARLY_ACCESS_LIMIT}`) }).strict();

/** The early-access places (Admin, Pricing and tiers): the limit, places held and left, the waiting list. The platform administrator's. */
export const GET = adminRoute(async () => NextResponse.json(await earlyAccessCount(), { headers: { "cache-control": "no-store" } }), { platformAdmin: true });

/** Sets the number of places. A higher number gives free places to the waiting list at once; a lower one takes no place back. */
export const PUT = adminRoute(async (req: Request) => {
  const { limit } = await body(req, LimitChange);
  return NextResponse.json(await setEarlyAccessLimit(limit));
}, { platformAdmin: true });
