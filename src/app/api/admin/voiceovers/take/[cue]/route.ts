import { NextResponse } from "next/server";
import { notFound } from "@/lib/api/route";
import { adminRoute } from "@/lib/admin/guard";
import { takeAudio } from "@/lib/voice/voiceovers";

type Ctx = { params: Promise<{ cue: string }> };

/** GET: the audio of a cue's unaccepted take, for the platform administrator to hear before accepting it. Never cached. */
export const GET = adminRoute(
  async (_req: Request, { params }: Ctx) => {
    const take = await takeAudio((await params).cue);
    if (!take) throw notFound("That take");
    return new NextResponse(new Uint8Array(take.bytes), { headers: { "Content-Type": take.mime, "Content-Disposition": "inline", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  },
  { platformAdmin: true }
);
