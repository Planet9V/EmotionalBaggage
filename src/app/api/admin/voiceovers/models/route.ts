import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/admin/guard";
import { speechCatalog } from "@/lib/voice/catalog";

/**
 * GET: the speech models of the configured voice service, live, each with its voices, supported parameters, price
 * per character (when listed) and how a performance direction reaches it. Platform administrator only: it calls the
 * service with the saved key.
 */
export const GET = adminRoute(async () => NextResponse.json(await speechCatalog(), { headers: { "cache-control": "no-store" } }), { platformAdmin: true });
