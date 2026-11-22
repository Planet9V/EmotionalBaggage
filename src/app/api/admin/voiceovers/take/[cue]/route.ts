import { NextResponse } from "next/server";
import { notFound } from "@/lib/api/route";
import { adminRoute } from "@/lib/admin/guard";
import { takeAudio } from "@/lib/voice/takes";

type Ctx = { params: Promise<{ cue: string }> };

/** GET ?id=: the audio of one unpublished take of a cue (the latest without an id), for the platform administrator to hear. Never cached. */
export const GET = adminRoute(
  async (req: Request, { params }: Ctx) => {
    const take = await takeAudio((await params).cue, new URL(req.url).searchParams.get("id"));
    if (!take) throw notFound("That take");
    return new NextResponse(new Uint8Array(take.bytes), { headers: { "Content-Type": take.mime, "Content-Disposition": "inline", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  },
  { platformAdmin: true }
);
