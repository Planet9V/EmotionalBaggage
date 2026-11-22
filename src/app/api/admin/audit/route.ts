import { adminRoute, isPlatformAdmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";
import { auditConcepts, auditQuery, readAuditLog } from "@/lib/auditLog";

/** The install-wide audit log, newest first. Lines for deleted concepts are still here. */
export const GET = adminRoute(async (req: Request) => {
  const f = auditQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const [page, concepts] = await Promise.all([readAuditLog(f, { platformAdmin: await isPlatformAdmin(req) }), auditConcepts()]);
  return NextResponse.json({ ...page, concepts }, { headers: { "cache-control": "no-store" } });
});
