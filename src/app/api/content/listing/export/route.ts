import { HttpError, recordId, route } from "@/lib/api/route";
import { logEvent } from "@/lib/db";
import { listingFlatFile, listingText } from "@/lib/content/exports";
import { attachment, fileSafe, param, projectOf } from "@/lib/content/http";
import { rowsOf } from "@/lib/content/load";
import { CONTENT } from "@/lib/content/schemas";

/** An approved listing as text or as a flat-file row (tab separated). */
export const GET = route(async (req: Request) => {
  const p = await projectOf(req);
  const id = recordId(param(req, "id"), "That listing");
  const row = (await rowsOf(p.id, CONTENT.listing)).find((r) => r.id === id);
  if (!row) throw new HttpError(404, "That listing was not found in this concept.");
  if (row.status === "draft") throw new HttpError(409, "Approve the listing (mark it ready) before exporting it.");
  const f = (row.data.fields ?? {}) as { title?: string; bullets?: string[]; description?: string; searchTerms?: string };
  const file = { title: f.title ?? "", bullets: f.bullets ?? [], description: f.description ?? "", searchTerms: f.searchTerms ?? "" };
  const format = param(req, "format") === "flat" ? "flat" : "text";
  logEvent(p.id, "content.exported", `Exported the Amazon listing as ${format === "flat" ? "a flat-file row" : "text"}`, { kind: "listing", itemId: id, format });
  return format === "flat"
    ? attachment(listingFlatFile(file, { brand: p.name }), "text/tab-separated-values; charset=utf-8", `${fileSafe(p.name)}-listing.tsv`)
    : attachment(listingText(file, String(row.data.category ?? "default")), "text/plain; charset=utf-8", `${fileSafe(p.name)}-listing.txt`);
});
