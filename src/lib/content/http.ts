import { HttpError, requireProject } from "@/lib/api/route";

/** The concept named by ?projectId=, or a 400 or 404. */
export async function projectOf(req: Request) {
  const id = new URL(req.url).searchParams.get("projectId") ?? "";
  if (!id) throw new HttpError(400, "projectId is required.");
  return requireProject(id);
}

export const param = (req: Request, k: string) => new URL(req.url).searchParams.get(k) ?? "";

/** A file name safe for a Content-Disposition header. */
export const fileSafe = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "export";

export const attachment = (body: BodyInit, type: string, name: string) =>
  new Response(body, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
