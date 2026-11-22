// The voice-overs of the welcome film: one clip per spoken cue (and one for the introduction), kept in the files
// store (PostgreSQL, table files, kind "voiceover", folder "Voice-overs" in its meta) for the example concept.
//
// WHICH clips the public page plays is one settings row, "voice.overs", written only here: by the example's set-up
// (./seedVoiceovers.ts) and by the platform administrator's tool (Admin, Voice-overs). The files table alone is not
// trusted for that, because any signed-in account can upload a file of any kind to a concept; the public route
// serves a file only when this row names it and its sha256 is the one recorded at publication.
//
// A take is a clip the administrator has generated and not yet published: stored the same way, listed under `takes`
// (several per cue, so they can be heard side by side; one may be starred), never served to the public. Publishing
// one keeps the clip it replaces as an earlier version. Each take records how it was directed: the text sent, the
// direction and how the direction reached the model (./direction.ts), and its length and loudness.
import type { PoolClient } from "pg";
import { z } from "zod";
import { q } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { SEED_PROJECT } from "@/lib/seed";
import { VOICE_CUES, cueOf } from "@/components/welcome/scenes/voiceScript";
import type { VoiceManifest } from "@/components/welcome/scenes/voiceTrack";

export const VOICEOVERS_KEY = "voice.overs";
export const VOICEOVER_KIND = "voiceover";
const VOICEOVER_FOLDER = "Voice-overs";
const MAX_VERSIONS = 20;

const name = z.string().max(200);
const clipSchema = z.object({
  fileId: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  mime: z.enum(["audio/mpeg", "audio/wav"]),
  size: z.number().int().positive(),
  seconds: z.number().positive(),
  /** base64 of the loudness envelope, ENVELOPE_RATE values a second */
  envelope: z.string().max(20_000),
  speaker: z.string().max(40),
  /** the words as subtitled */
  text: z.string().max(4000),
  /** the text the model was asked to speak: the subtitle, with bracket cues for a model that reads them */
  say: z.string().max(4000),
  /** the performance direction sent beside the text, when the model takes one */
  direction: z.string().max(8000).optional(),
  /** how the direction reached the model */
  via: z.enum(["inline", "instructions", "provider-options", "none"]).optional(),
  /** integrated loudness (LUFS) and sample peak (dBFS) of the decoded take, for comparison */
  lufs: z.number().nullable().optional(),
  peak: z.number().nullable().optional(),
  /** a take's id within its cue, and whether the administrator starred it */
  id: z.string().regex(/^[a-z0-9]{4,40}$/).optional(),
  starred: z.boolean().optional(),
  provider: name,
  model: name,
  voice: name,
  speed: z.number(),
  at: z.string().max(40),
  by: name,
  /** set on a clip that came with the example's set-up, so a later set of seeded clips may replace it */
  seed: z.string().max(40).optional(),
});
export type VoiceClip = z.infer<typeof clipSchema>;
const versionSchema = z.object({ fileId: z.number(), sha256: z.string(), voice: name, replacedAt: z.string(), replacedBy: name });
const castSchema = z.object({
  model: name,
  voice: name,
  speed: z.number().min(0.25).max(4),
  /** the character note put in front of every direction of this speaker; absent: the script's (SPEAKER_NOTE) */
  prefix: z.string().max(4000).optional(),
});
export type CastChoice = z.infer<typeof castSchema>;
const docSchema = z.object({
  clips: z.record(z.string(), clipSchema).default({}),
  /** a cue's takes, oldest first; a document from before several takes holds one take, read as a list of one */
  takes: z.record(z.string(), z.preprocess((v) => (Array.isArray(v) ? v : v ? [v] : []), z.array(clipSchema))).default({}),
  versions: z.record(z.string(), z.array(versionSchema)).default({}),
  /** the administrator's choice of model, voice and speed per speaker, used when a cue names none */
  cast: z.record(z.string(), castSchema).default({}),
  /** the administrator's own direction of a cue, replacing the script's (voiceDirections.ts) */
  directions: z.record(z.string(), z.object({ direction: z.string().max(8000), inlineTags: z.string().max(4000), at: z.string().max(40), by: name })).default({}),
});
export type VoiceoverDoc = z.infer<typeof docSchema>;
const EMPTY: VoiceoverDoc = { clips: {}, takes: {}, versions: {}, cast: {}, directions: {} };

const parse = (raw: unknown): VoiceoverDoc => {
  const r = docSchema.safeParse(raw ?? {});
  if (!r.success) return structuredClone(EMPTY);
  // a take kept from before takes had ids is named by its sha256
  for (const list of Object.values(r.data.takes)) for (const t of list) t.id ??= t.sha256.slice(0, 16);
  return r.data;
};

/** The saved document. A missing or unreadable row is the empty one. */
export async function readVoiceovers(): Promise<VoiceoverDoc> {
  return parse(await getSetting<unknown>(VOICEOVERS_KEY, null));
}

/** Reads the document for a change, under a lock that makes the changes one at a time. */
export async function lockVoiceovers(c: PoolClient): Promise<VoiceoverDoc> {
  await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [VOICEOVERS_KEY]);
  return parse((await c.query<{ value: unknown }>("SELECT value FROM settings WHERE key=$1", [VOICEOVERS_KEY])).rows[0]?.value);
}

export async function writeVoiceovers(c: PoolClient, doc: VoiceoverDoc): Promise<void> {
  await c.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()", [VOICEOVERS_KEY, JSON.stringify(doc)]);
  cached = null;
}

/** Stores a clip's bytes in the files store and answers its file id. */
export async function storeVoiceFile(c: PoolClient, cue: string, bytes: Uint8Array, clip: Omit<VoiceClip, "fileId">, state: "published" | "take"): Promise<number> {
  const ext = clip.mime === "audio/wav" ? "wav" : "mp3";
  const meta = { folder: VOICEOVER_FOLDER, cue, state, speaker: clip.speaker, text: clip.text, voice: clip.voice, model: clip.model, speed: clip.speed, seconds: clip.seconds, envelope: clip.envelope, ...(clip.seed ? { seed: clip.seed } : {}) };
  const r = await c.query<{ id: string }>(
    "INSERT INTO files (project_id, name, mime, kind, size, sha256, bytes, meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
    [SEED_PROJECT.id, `${cue}.${ext}`, clip.mime, VOICEOVER_KIND, bytes.length, clip.sha256, Buffer.from(bytes), JSON.stringify(meta)]
  );
  return Number(r.rows[0]!.id);
}

/** Publishes `clip` for `cue` in `doc`: the clip it replaces is kept as an earlier version (its file stays stored). */
export function publish(doc: VoiceoverDoc, cue: string, clip: VoiceClip): void {
  const was = doc.clips[cue];
  if (was) doc.versions[cue] = [{ fileId: was.fileId, sha256: was.sha256, voice: was.voice, replacedAt: clip.at, replacedBy: clip.by }, ...(doc.versions[cue] ?? [])].slice(0, MAX_VERSIONS);
  doc.clips[cue] = clip;
}

// --- The public page ---------------------------------------------------------------------------------------

/** The address of a published clip: its sha256 is in it, so the answer can be kept by browsers for good. */
export const clipUrl = (cue: string, c: VoiceClip) => `/api/voiceovers/${cue}?v=${c.sha256.slice(0, 16)}`;

const PUBLIC_MS = 60_000;
let cached: { at: number; value: VoiceManifest } | null = null;

/**
 * What the welcome film needs to play its voice-overs: for each cue that has a published clip, where to fetch it, how
 * long it is and its loudness envelope. Never throws: with nothing published, or the database unreachable, it is
 * empty and the film plays with subtitles only. Kept for a minute per server process; a change here clears it.
 */
export async function publicVoiceovers(): Promise<VoiceManifest> {
  if (cached && Date.now() - cached.at < PUBLIC_MS) return cached.value;
  let value: VoiceManifest = {};
  try {
    const doc = await readVoiceovers();
    for (const cue of VOICE_CUES) {
      const c = doc.clips[cue.key];
      if (c) value[cue.key] = { url: clipUrl(cue.key, c), seconds: c.seconds, envelope: c.envelope };
    }
  } catch {
    value = {};
  }
  cached = { at: Date.now(), value };
  return value;
}

/** The bytes of the published clip of a cue, or null: only a file the document names, unchanged since it was published. */
export async function publishedAudio(cue: string): Promise<{ bytes: Buffer; mime: string; sha256: string } | null> {
  if (!cueOf(cue)) return null;
  const clip = (await readVoiceovers()).clips[cue];
  if (!clip) return null;
  return audioOf(clip);
}

export async function audioOf(clip: VoiceClip) {
  const rows = await q<{ bytes: Buffer; sha256: string }>("SELECT bytes, sha256 FROM files WHERE id=$1 AND project_id=$2 AND kind=$3", [clip.fileId, SEED_PROJECT.id, VOICEOVER_KIND]);
  const f = rows[0];
  if (!f || f.sha256 !== clip.sha256) return null;
  return { bytes: f.bytes, mime: clip.mime, sha256: clip.sha256 };
}
