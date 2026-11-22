// The voice-over clips that come with the example: seed/concepts/baggage-claims/voiceovers, with manifest.json
// naming each clip's cue, speaker, words, voice, length, loudness envelope and sha256. They are stored in the files
// store and published once per database and per batch (the manifest's `batch`), like the example's other seeded
// files (src/lib/story/seedFiles.ts): on a fresh install and on an install seeded before they existed, marked by
// the event "seed.voiceovers" that names the batch, under an advisory lock. A cue whose published clip an
// administrator has replaced is left alone; a clip that itself came from an earlier batch is replaced and kept as a
// version. A clip an administrator later removes does not come back.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";
import { z } from "zod";
import { sha256 } from "@/lib/hash";
import { SEED_PROJECT } from "@/lib/seed";
import { cueOf } from "@/components/welcome/scenes/voiceScript";
import { lockVoiceovers, publish, storeVoiceFile, writeVoiceovers, type VoiceClip } from "./voiceovers";

export const SEED_VOICEOVERS_DIR = join("seed", "concepts", "baggage-claims", "voiceovers");
const EVENT = "seed.voiceovers";

const manifestSchema = z.object({
  batch: z.string().min(1).max(40),
  provider: z.string(),
  model: z.string(),
  clips: z.array(
    z.object({
      cue: z.string(),
      file: z.string().regex(/^[a-z-]+\.mp3$/),
      speaker: z.string(),
      text: z.string(),
      say: z.string(),
      voice: z.string(),
      speed: z.number(),
      seconds: z.number().positive(),
      envelope: z.string(),
      size: z.number().int().positive(),
      sha256: z.string(),
    })
  ),
});
export type VoiceoverManifest = z.infer<typeof manifestSchema>;

export async function readVoiceoverManifest(root = process.cwd()): Promise<VoiceoverManifest | null> {
  try {
    return manifestSchema.parse(JSON.parse(await readFile(join(root, SEED_VOICEOVERS_DIR, "manifest.json"), "utf8")));
  } catch {
    return null;
  }
}

export async function seedVoiceovers(db: Pool, root = process.cwd()) {
  const id = SEED_PROJECT.id;
  if (!(await db.query("SELECT 1 FROM projects WHERE id=$1", [id])).rowCount) return;
  const m = await readVoiceoverManifest(root);
  if (!m) return;
  const done = "SELECT 1 FROM events WHERE project_id=$1 AND kind=$2 AND data->>'batch'=$3";
  if ((await db.query(done, [id, EVENT, m.batch])).rowCount) return;
  // every clip is read and checked before anything is written
  const loaded: { clip: VoiceoverManifest["clips"][number]; bytes: Buffer }[] = [];
  for (const clip of m.clips) {
    if (!cueOf(clip.cue)) throw new Error(`[seed] the voice-over ${clip.file} names a cue the film does not have: ${clip.cue}`);
    const bytes = await readFile(join(root, SEED_VOICEOVERS_DIR, clip.file));
    if (sha256(bytes) !== clip.sha256) throw new Error(`[seed] ${clip.file} does not match the sha256 in the voice-over manifest`);
    loaded.push({ clip, bytes });
  }
  const { logEventIn } = await import("@/lib/db");
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    const doc = await lockVoiceovers(c);
    if ((await c.query(done, [id, EVENT, m.batch])).rowCount) {
      await c.query("ROLLBACK");
      return;
    }
    let stored = 0;
    for (const { clip, bytes } of loaded) {
      const now = doc.clips[clip.cue];
      // an administrator's clip stays; so does the very same seeded clip
      if (now && (!now.seed || now.sha256 === clip.sha256)) continue;
      const next: Omit<VoiceClip, "fileId"> = {
        sha256: clip.sha256,
        mime: "audio/mpeg",
        size: bytes.length,
        seconds: clip.seconds,
        envelope: clip.envelope,
        speaker: clip.speaker,
        text: clip.text,
        say: clip.say,
        provider: m.provider,
        model: m.model,
        voice: clip.voice,
        speed: clip.speed,
        at: new Date().toISOString(),
        by: "the example's set-up",
        seed: m.batch,
      };
      const fileId = await storeVoiceFile(c, clip.cue, bytes, next, "published");
      if (now) await c.query("UPDATE files SET meta = meta || '{\"state\":\"version\"}'::jsonb WHERE id=$1", [now.fileId]);
      publish(doc, clip.cue, { ...next, fileId });
      stored++;
    }
    await writeVoiceovers(c, doc);
    await logEventIn(c, id, EVENT, `Stored ${stored} of the ${loaded.length} voice-over clips of the welcome film in the files store, folder Voice-overs (batch ${m.batch})`, { batch: m.batch, stored, clips: loaded.length, seeded: true });
    await c.query("COMMIT");
  } catch (err) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    c.release();
  }
}
