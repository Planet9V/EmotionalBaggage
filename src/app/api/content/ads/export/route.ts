import { HttpError, route } from "@/lib/api/route";
import { logEvent, q } from "@/lib/db";
import { adChannel } from "@/lib/content/channels";
import { adsCsv } from "@/lib/content/exports";
import { attachment, fileSafe, param, projectOf } from "@/lib/content/http";
import { rowsOf } from "@/lib/content/load";
import { CONTENT } from "@/lib/content/schemas";

/** The approved, running and paused ads of one channel as CSV (Google Ads Editor layout for Google, plain otherwise). */
export const GET = route(async (req: Request) => {
  const p = await projectOf(req);
  const spec = adChannel(param(req, "channel"));
  if (!spec) throw new HttpError(400, "channel must be the id of an ad channel.");
  const ads = (await rowsOf(p.id, CONTENT.ads)).filter((a) => a.data.channel === spec.id && ["approved", "running", "paused"].includes(a.status));
  if (!ads.length) throw new HttpError(409, `There are no approved ${spec.label} ads to export.`);
  logEvent(p.id, "content.exported", `Exported ${ads.length} ${spec.label} ads as CSV`, { kind: "ads", channel: spec.id, count: ads.length });
  const campaigns = await rowsOf(p.id, CONTENT.campaigns);
  const currency = (await q<{ currency: string }>("SELECT currency FROM projects WHERE id=$1", [p.id]))[0]?.currency || "USD";
  return attachment(adsCsv(spec, ads, p.name, campaigns, currency), "text/csv; charset=utf-8", `${fileSafe(p.name)}-${spec.id}.csv`);
});
