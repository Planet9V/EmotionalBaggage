import { route } from "@/lib/api/route";
import { conceptExportStream } from "@/lib/api/conceptExport";

type Ctx = { params: Promise<{ id: string }> };

/**
 * One JSON document with everything the concept owns, sent as a download: the concept with its
 * product type, currency and sales regions, items (print jobs included), files, pins, tracked links
 * (their set-up, not their clicks), the passages of each source, events, research, messages and gates.
 * Not in it: AI drafts, campaign results and link clicks, audit lines and credentials.
 * Read in one REPEATABLE READ transaction, so the parts agree with each other. The document is streamed: the bytes
 * of the files are read and written a slice at a time, never all held at once (src/lib/api/conceptExport.ts).
 */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return new Response(await conceptExportStream(id), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${id}-export.json"`,
      "cache-control": "no-store",
    },
  });
});
