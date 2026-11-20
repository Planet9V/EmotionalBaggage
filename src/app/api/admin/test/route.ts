import { NextResponse } from "next/server";
import { body, route } from "@/lib/api/route";
import { runConnectionTest } from "@/lib/admin/connection";
import { connectionTest } from "@/lib/admin/schemas";

/** One cheap read-only call. A failed test is still 200, with ok false and the reason in plain words. */
export const POST = route(async (req: Request) => {
  const t = await body(req, connectionTest);
  return NextResponse.json(await runConnectionTest(t));
});
