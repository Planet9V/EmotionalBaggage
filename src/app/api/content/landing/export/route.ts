import { zipSync, strToU8 } from "fflate";
import { HttpError, route } from "@/lib/api/route";
import { logEvent, q } from "@/lib/db";
import { attachment, fileSafe, projectOf } from "@/lib/content/http";
import { renderLanding } from "@/lib/content/load";

/**
 * The page as one zip: index.html with its CSS inline, and the images as files beside it. Refused while any
 * section is a draft or the page has a problem (an image without alt text, a missing file).
 */
export const GET = route(async (req: Request) => {
  const p = await projectOf(req);
  const out = await renderLanding(p.id, p.name, "export", "auto");
  if (!out.sections.length) throw new HttpError(409, "The page has no sections yet. Draft or add them first.");
  if (out.unapproved.length) throw new HttpError(409, `${out.unapproved.length} ${out.unapproved.length === 1 ? "section is" : "sections are"} still a draft. Approve every section before exporting.`);
  const blocking = out.problems.filter((x) => /alt text|file is not/.test(x));
  if (blocking.length) throw new HttpError(409, blocking.join(" "));
  const files: Record<string, Uint8Array> = { "index.html": strToU8(out.html) };
  for (const img of out.images) {
    const r = await q<{ bytes: Buffer }>("SELECT bytes FROM files WHERE id=$1 AND project_id=$2", [img.fileId, p.id]);
    if (!r[0]) throw new HttpError(409, `An image file of the page (#${img.fileId}) is not in this concept.`);
    files[img.file] = new Uint8Array(r[0].bytes);
  }
  logEvent(p.id, "content.exported", `Exported the landing page as a zip (${out.sections.length} sections, ${out.images.length} images)`, { kind: "landing", images: out.images.length });
  return attachment(new Uint8Array(zipSync(files, { level: 6 })), "application/zip", `${fileSafe(p.name)}-landing-page.zip`);
});
