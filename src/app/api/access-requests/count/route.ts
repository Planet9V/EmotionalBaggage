import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api/route";
import { clientAddress } from "@/lib/auth";
import { cachedPlaces, countReadWait } from "@/lib/accessRequests/publicCount";

/**
 * Open: how many early-access places are left, for the count lines on /welcome to refresh when the tab comes back
 * into view or after one of its forms has claimed a place (src/components/welcome/early/places.ts). Answers only
 * { left, limit, full }: never who holds a place or how long the waiting list is. One database read serves every
 * visitor for a few seconds (src/lib/accessRequests/publicCount.ts), and each network address may ask 120 times in
 * ten minutes; past that it gets 429 with Retry-After.
 */
export const GET = route.open(async (req: Request) => {
  const wait = countReadWait(clientAddress(req));
  if (wait) throw new HttpError(429, `Too many requests from here. Try again in ${wait} seconds.`, undefined, { "retry-after": String(wait), "cache-control": "no-store" });
  let places;
  try {
    places = await cachedPlaces();
  } catch {
    return NextResponse.json({ error: "The count cannot be read right now." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json({ left: places.left, limit: places.limit, full: places.full }, { headers: { "cache-control": "public, max-age=5" } });
});
