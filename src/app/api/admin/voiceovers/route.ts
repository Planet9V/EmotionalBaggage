import { NextResponse } from "next/server";
import { z } from "zod";
import { body, sessionOf } from "@/lib/api/route";
import { adminRoute, isPlatformAdmin } from "@/lib/admin/guard";
import { getVoiceSettings } from "@/lib/voice/speech";
import { DIRECTION_MODES } from "@/lib/voice/direction";
import { MAX_TAKES_AT_ONCE, discardTake, estimateTakes, generateTakes, listVoiceovers, publishTake, saveCast, saveDirection, starTake } from "@/lib/voice/takes";

const cue = z.string().regex(/^[a-z]{1,20}(-[a-z]{1,20})?$/, "is not a cue of the film");
const take = z.string().regex(/^[a-z0-9]{4,40}$/, "is not a take");
const name = z.string().trim().min(1).max(200);
const speed = z.number().min(0.25, "must be 0.25 to 4").max(4, "must be 0.25 to 4");
const count = z.number().int().min(1, `must be 1 to ${MAX_TAKES_AT_ONCE}`).max(MAX_TAKES_AT_ONCE, `must be 1 to ${MAX_TAKES_AT_ONCE}`);
const direction = z.string().trim().min(1).max(8000);
const inlineTags = z.string().trim().min(1).max(4000);
const speaker = z.enum(["bag", "agent", "host", "stranger", "narrator"]);
const action = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("generate"), cue, count: count.optional(), model: name.optional(), voice: name.optional(), speed: speed.optional(), direction: direction.optional(), inlineTags: inlineTags.optional(), mode: z.enum(["auto", ...DIRECTION_MODES]).optional() })
    .strict(),
  z.object({ action: z.literal("star"), cue, take }).strict(),
  z.object({ action: z.literal("publish"), cue, take: take.optional() }).strict(),
  // "accept" is the earlier name of publish: the starred take, or the only one
  z.object({ action: z.literal("accept"), cue }).strict(),
  z.object({ action: z.literal("discard"), cue, take: take.optional() }).strict(),
  z.object({ action: z.literal("direct"), cue, direction, inlineTags }).strict(),
  z.object({ action: z.literal("reset-direction"), cue }).strict(),
  z.object({ action: z.literal("cast"), speaker, model: name, voice: name, speed, prefix: z.string().trim().max(4000).optional() }).strict(),
  z.object({ action: z.literal("estimate"), count: count.optional(), cues: z.array(cue).max(50).optional() }).strict(),
]);

/**
 * GET: every cue of the welcome film with its words, speaker, direction and published clip, and whether a voice is
 * set up. Any signed-in account reads it (what is published is on the public page anyway); takes, which are not
 * published, are shown to the platform administrator only.
 */
export const GET = adminRoute(async (req: Request) => {
  const [list, voice, admin] = await Promise.all([listVoiceovers(), getVoiceSettings(), isPlatformAdmin(req)]);
  return NextResponse.json(
    {
      rows: admin ? list.rows : list.rows.map((r) => ({ ...r, takes: [] })),
      cast: list.cast,
      notes: list.notes,
      voice: voice.configured ? { configured: true, provider: voice.provider, ...(admin ? { model: voice.model, voice: voice.voice, speed: "speed" in voice ? voice.speed : 1 } : {}) } : { configured: false, reason: voice.reason },
      canWrite: admin,
    },
    { headers: { "cache-control": "no-store" } }
  );
});

/**
 * POST { action }: the voice-overs tool. A new power, so the platform administrator's only.
 *  - generate { cue, count?, model?, voice?, speed?, direction?, inlineTags?, mode? }: takes (3 by default), the
 *    direction sent the way the model takes it, stored unpublished;
 *  - star { cue, take }, publish { cue, take? } (the earlier clip kept as a version), discard { cue, take? };
 *  - direct { cue, direction, inlineTags } and reset-direction { cue }: a cue's own direction, or the script's;
 *  - cast { speaker, model, voice, speed, prefix? }: the voice and character note of that speaker's cues;
 *  - estimate { count?, cues? }: what generating takes would cost; nothing is generated.
 * Each change is recorded in the audit log with before and after (src/lib/voice/takes.ts).
 */
export const POST = adminRoute(
  async (req: Request) => {
    const b = await body(req, action);
    const actor = sessionOf(req).username;
    switch (b.action) {
      case "generate": {
        const r = await generateTakes({ cue: b.cue, count: b.count, model: b.model, voice: b.voice, speed: b.speed, direction: b.direction, inlineTags: b.inlineTags, mode: b.mode, actor });
        return NextResponse.json({ ok: true, via: r.via, failed: r.failed, takes: r.takes.map((t) => ({ id: t.id, seconds: t.seconds, voice: t.voice, lufs: t.lufs ?? null })) });
      }
      case "star":
        return NextResponse.json({ ok: true, starred: await starTake(b.cue, b.take) });
      case "publish":
      case "accept": {
        const clip = await publishTake(b.cue, "take" in b ? b.take : undefined);
        return NextResponse.json({ ok: true, seconds: clip.seconds });
      }
      case "discard": {
        const n = await discardTake(b.cue, b.take);
        return NextResponse.json({ ok: n > 0, discarded: n });
      }
      case "direct":
        await saveDirection(b.cue, { direction: b.direction, inlineTags: b.inlineTags }, actor);
        return NextResponse.json({ ok: true });
      case "reset-direction":
        await saveDirection(b.cue, null, actor);
        return NextResponse.json({ ok: true });
      case "cast":
        await saveCast(b.speaker, { model: b.model, voice: b.voice, speed: b.speed, ...(b.prefix ? { prefix: b.prefix } : {}) });
        return NextResponse.json({ ok: true });
      case "estimate":
        return NextResponse.json({ ok: true, ...(await estimateTakes(b.count, b.cues)) });
    }
  },
  { platformAdmin: true, maxBodyBytes: 32 * 1024 }
);
