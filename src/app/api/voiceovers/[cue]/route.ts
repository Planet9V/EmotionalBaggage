import { NextResponse } from "next/server";
import { notFound, route } from "@/lib/api/route";
import { publishedAudio } from "@/lib/voice/voiceovers";
import { byteRange } from "@/lib/voice/range";

type Ctx = { params: Promise<{ cue: string }> };

/** A year, for an address that carries the clip's own sha256 (?v=): another clip has another address. */
const FOREVER = "public, max-age=31536000, immutable";
/** Without it, browsers keep the clip briefly and ask again with its ETag. */
const BRIEFLY = "public, max-age=300, must-revalidate";

/**
 * GET /api/voiceovers/<cue>: the published voice-over clip of one cue of the welcome film (for example
 * "scale-fat", or "intro"), for the public page.
 *
 * Open: the welcome page is read signed out. It is a read route and serves nothing else: only a cue the film has,
 * only the clip the voice-over document names for it, and only while that file's sha256 is the one recorded when it
 * was published (src/lib/voice/voiceovers.ts). No file id, name or path is taken from the request. It answers with
 * an ETag (304 when the browser already has it), byte ranges (206; audio elements ask for them), and a year of
 * caching when the address carries the clip's sha256.
 */
export const GET = route.open(async (req: Request, { params }: Ctx) => {
  const cue = (await params).cue;
  const clip = /^[a-z]{1,20}(-[a-z]{1,20})?$/.test(cue) ? await publishedAudio(cue) : null;
  if (!clip) throw notFound("That voice-over");
  const etag = `"${clip.sha256}"`;
  const pinned = new URL(req.url).searchParams.get("v") === clip.sha256.slice(0, 16);
  const headers: Record<string, string> = {
    "Content-Type": clip.mime,
    "Content-Disposition": "inline",
    "Accept-Ranges": "bytes",
    "Cache-Control": pinned ? FOREVER : BRIEFLY,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  const seen = req.headers.get("if-none-match");
  if (seen && seen.split(",").some((t) => t.trim().replace(/^W\//, "") === etag)) return new NextResponse(null, { status: 304, headers });
  const size = clip.bytes.length;
  const range = byteRange(req.headers.get("range"), size);
  if (range === "unsatisfiable") return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  if (range) {
    return new NextResponse(new Uint8Array(clip.bytes.subarray(range.start, range.end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${range.start}-${range.end}/${size}`, "Content-Length": String(range.end - range.start + 1) },
    });
  }
  return new NextResponse(new Uint8Array(clip.bytes), { headers: { ...headers, "Content-Length": String(size) } });
});
