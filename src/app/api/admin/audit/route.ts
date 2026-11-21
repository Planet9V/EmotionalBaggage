import { NextResponse } from "next/server";
import { route } from "@/lib/api/route";
import { auditConcepts, auditQuery, readAuditLog } from "@/lib/auditLog";

/** The install-wide audit log, newest first. Lines for deleted concepts are still here. */
export const GET = route(async (req: Request) => {
  const f = auditQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const [page, concepts] = await Promise.all([readAuditLog(f), auditConcepts()]);
  return NextResponse.json({ ...page, concepts }, { headers: { "cache-control": "no-store" } });
});
