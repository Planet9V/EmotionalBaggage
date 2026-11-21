import { HttpError, recordId, route } from "@/lib/api/route";
import { logEvent } from "@/lib/db";
import { launchHtml, launchText } from "@/lib/content/exports";
import { attachment, fileSafe, param, projectOf } from "@/lib/content/http";
import { rowsOf } from "@/lib/content/load";
import { CONTENT } from "@/lib/content/schemas";

/** One approved launch piece as HTML or text. Nothing is sent. */
export const GET = route(async (req: Request) => {
  const p = await projectOf(req);
  const id = recordId(param(req, "id"), "That launch piece");
  const row = (await rowsOf(p.id, CONTENT.launch)).find((r) => r.id === id);
  if (!row) throw new HttpError(404, "That launch piece was not found in this concept.");
  if (row.status !== "approved") throw new HttpError(409, "Approve this piece before exporting it.");
  const format = param(req, "format") === "html" ? "html" : "text";
  logEvent(p.id, "content.exported", `Exported "${row.title}" as ${format}`, { kind: "launch", itemId: id, format });
  const name = `${fileSafe(p.name)}-${fileSafe(row.title)}`;
  return format === "html" ? attachment(launchHtml(row), "text/html; charset=utf-8", `${name}.html`) : attachment(launchText(row), "text/plain; charset=utf-8", `${name}.txt`);
});
