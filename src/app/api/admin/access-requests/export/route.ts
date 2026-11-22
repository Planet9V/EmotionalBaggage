import { adminRoute, guardAccessRequests } from "@/lib/admin/guard";
import { accessRequestsCsv } from "@/lib/accessRequests/store";

/** The access requests as a CSV file, newest first. Taking a copy is recorded in the audit log. */
export const GET = adminRoute(async (req: Request) => {
  await guardAccessRequests(req);
  const { text } = await accessRequestsCsv();
  return new Response(text, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="access-requests-${new Date().toISOString().slice(0, 10)}.csv"`,
      "x-content-type-options": "nosniff",
      "cache-control": "no-store",
    },
  });
});
