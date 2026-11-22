import { NextResponse } from "next/server";
import { z } from "zod";
import { body, sessionOf } from "@/lib/api/route";
import { adminRoute, isPlatformAdmin } from "@/lib/admin/guard";
import { getVoiceSettings } from "@/lib/voice/speech";
import { acceptTake, discardTake, generateTake, listVoiceovers, saveCast } from "@/lib/voice/voiceovers";

const cue = z.string().regex(/^[a-z]{1,20}(-[a-z]{1,20})?$/, "is not a cue of the film");
const name = z.string().trim().min(1).max(200);
const speed = z.number().min(0.25, "must be 0.25 to 4").max(4, "must be 0.25 to 4");
const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), cue, say: z.string().trim().min(1).max(4000).optional(), model: name.optional(), voice: name.optional(), speed: speed.optional() }).strict(),
  z.object({ action: z.literal("accept"), cue }).strict(),
  z.object({ action: z.literal("discard"), cue }).strict(),
  z.object({ action: z.literal("cast"), speaker: z.enum(["bag", "agent", "host", "stranger", "narrator"]), model: name, voice: name, speed }).strict(),
]);

/**
 * GET: every cue of the welcome film with its words, speaker and published clip, and whether a voice is set up.
 * Any signed-in account reads it (what is published is on the public page anyway); takes, which are not published,
 * are shown to the platform administrator only.
 */
export const GET = adminRoute(async (req: Request) => {
  const [list, voice, admin] = await Promise.all([listVoiceovers(), getVoiceSettings(), isPlatformAdmin(req)]);
  return NextResponse.json(
    {
      rows: admin ? list.rows : list.rows.map((r) => ({ ...r, take: null })),
      cast: list.cast,
      voice: voice.configured ? { configured: true, provider: voice.provider, ...(admin ? { model: voice.model, voice: voice.voice, speed: "speed" in voice ? voice.speed : 1 } : {}) } : { configured: false, reason: voice.reason },
      canWrite: admin,
    },
    { headers: { "cache-control": "no-store" } }
  );
});

/**
 * POST { action }: the voice-overs tool. A new power, so the platform administrator's only.
 *  - generate { cue, say?, model?, voice?, speed? }: one take from the configured voice service, stored unpublished;
 *  - accept { cue }: the take becomes the published clip (the public page plays it), the earlier clip kept as a version;
 *  - discard { cue }: the take is thrown away;
 *  - cast { speaker, model, voice, speed }: the voice used for that speaker's cues from now on.
 * Each is recorded in the audit log with before and after (src/lib/voice/voiceovers.ts).
 */
export const POST = adminRoute(
  async (req: Request) => {
    const b = await body(req, action);
    if (b.action === "generate") {
      const take = await generateTake({ cue: b.cue, say: b.say, model: b.model, voice: b.voice, speed: b.speed, actor: sessionOf(req).username });
      return NextResponse.json({ ok: true, seconds: take.seconds, voice: take.voice });
    }
    if (b.action === "accept") {
      const clip = await acceptTake(b.cue);
      return NextResponse.json({ ok: true, seconds: clip.seconds });
    }
    if (b.action === "discard") return NextResponse.json({ ok: await discardTake(b.cue) });
    await saveCast(b.speaker, { model: b.model, voice: b.voice, speed: b.speed });
    return NextResponse.json({ ok: true });
  },
  { platformAdmin: true, maxBodyBytes: 32 * 1024 }
);
