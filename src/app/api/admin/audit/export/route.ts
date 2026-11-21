import { route } from "@/lib/api/route";
import { audit } from "@/lib/db";
import { auditLogFile, auditQuery } from "@/lib/auditLog";

/** The audit log as a file: one JSON object per line, oldest first. Taking a copy is itself recorded. */
export const GET = route(async (req: Request) => {
  const f = auditQuery.omit({ limit: true, before: true }).parse(Object.fromEntries(new URL(req.url).searchParams));
  const text = await auditLogFile(f);
  await audit({ action: "audit.exported", summary: "The audit log was downloaded as a file", detail: { lines: text ? text.split("\n").length - 1 : 0, filter: f } });
  return new Response(text, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "content-disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.ndjson"`,
      "x-content-type-options": "nosniff",
      "cache-control": "no-store",
    },
  });
});
