import { route, sessionOf } from "@/lib/api/route";
import { accessRequestsCsv, refuseWhileDefaultPassword } from "@/lib/accessRequests/store";

/** The access requests as a CSV file, newest first. Taking a copy is recorded in the audit log. */
export const GET = route(async (req: Request) => {
  refuseWhileDefaultPassword(sessionOf(req).usingDefaultPassword);
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
