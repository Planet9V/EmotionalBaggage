// The voice-overs of the welcome film: one clip per spoken cue (and one for the introduction), kept in the files
// store (PostgreSQL, table files, kind "voiceover", folder "Voice-overs" in its meta) for the example concept.
//
// WHICH clips the public page plays is one settings row, "voice.overs", written only here: by the example's set-up
// (./seedVoiceovers.ts) and by the platform administrator's tool (Admin, Voice-overs). The files table alone is not
// trusted for that, because any signed-in account can upload a file of any kind to a concept; the public route
// serves a file only when this row names it and its sha256 is the one recorded at publication.
//
// A take is a clip the administrator has generated and not yet accepted: stored the same way, named under `takes`,
// never served to the public. Accepting it publishes it and keeps the clip it replaces as an earlier version.
import type { PoolClient } from "pg";
import { z } from "zod";
import { auditIn, q, tx } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { sha256 } from "@/lib/hash";
import { SEED_PROJECT } from "@/lib/seed";
import { HttpError } from "@/lib/api/route";
import { VOICE_CUES, cueOf, type Speaker } from "@/components/welcome/scenes/voiceScript";
import type { VoiceManifest } from "@/components/welcome/scenes/voiceTrack";
import { decodeAudio, AudioDecodeError } from "./decode";
import { encodeEnvelope, envelopeOf } from "./envelope";
import { getSpeechSynthesizer, SpeechError } from "./speech";

export const VOICEOVERS_KEY = "voice.overs";
export const VOICEOVER_KIND = "voiceover";
export const VOICEOVER_FOLDER = "Voice-overs";
/** The longest clip kept: the introduction is about twenty seconds; anything much longer is not a cue of this film. */
const MAX_SECONDS = 45;
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
  /** the words as sent to the voice (punctuation and spelling shaped for delivery) */
  say: z.string().max(4000),
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
const castSchema = z.object({ model: name, voice: name, speed: z.number().min(0.25).max(4) });
export type CastChoice = z.infer<typeof castSchema>;
const docSchema = z.object({
  clips: z.record(z.string(), clipSchema).default({}),
  takes: z.record(z.string(), clipSchema).default({}),
  versions: z.record(z.string(), z.array(versionSchema)).default({}),
  /** the administrator's choice of model, voice and speed per speaker, used when a cue names none */
  cast: z.record(z.string(), castSchema).default({}),
});
export type VoiceoverDoc = z.infer<typeof docSchema>;
const EMPTY: VoiceoverDoc = { clips: {}, takes: {}, versions: {}, cast: {} };

const parse = (raw: unknown): VoiceoverDoc => {
  const r = docSchema.safeParse(raw ?? {});
  return r.success ? r.data : { ...EMPTY };
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
const clipUrl = (cue: string, c: VoiceClip) => `/api/voiceovers/${cue}?v=${c.sha256.slice(0, 16)}`;

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

async function audioOf(clip: VoiceClip) {
  const rows = await q<{ bytes: Buffer; sha256: string }>("SELECT bytes, sha256 FROM files WHERE id=$1 AND project_id=$2 AND kind=$3", [clip.fileId, SEED_PROJECT.id, VOICEOVER_KIND]);
  const f = rows[0];
  if (!f || f.sha256 !== clip.sha256) return null;
  return { bytes: f.bytes, mime: clip.mime, sha256: clip.sha256 };
}

// --- The administrator's tool ------------------------------------------------------------------------------

/** The unaccepted take of a cue, for the administrator's preview. */
export async function takeAudio(cue: string) {
  const take = (await readVoiceovers()).takes[cue];
  return take ? audioOf(take) : null;
}

const summaryOf = (c: VoiceClip | undefined) => (c ? { fileId: c.fileId, sha256: c.sha256, voice: c.voice, model: c.model, speed: c.speed, seconds: c.seconds, say: c.say } : null);

export type VoiceoverRow = {
  cue: string;
  speaker: Speaker;
  text: string;
  say: string;
  /** the time the subtitle gives the line, in seconds; null for the introduction */
  window: number | null;
  clip: (Pick<VoiceClip, "seconds" | "voice" | "model" | "speed" | "say" | "at" | "by" | "provider"> & { url: string; seeded: boolean }) | null;
  take: (Pick<VoiceClip, "seconds" | "voice" | "model" | "speed" | "say" | "at"> & { url: string }) | null;
  versions: number;
};

/** Every cue with its published clip and its take, for Admin, Voice-overs. */
export async function listVoiceovers(): Promise<{ rows: VoiceoverRow[]; cast: Record<string, CastChoice> }> {
  const doc = await readVoiceovers();
  const rows = VOICE_CUES.map((cue): VoiceoverRow => {
    const c = doc.clips[cue.key];
    const t = doc.takes[cue.key];
    return {
      cue: cue.key,
      speaker: cue.who,
      text: cue.text,
      say: cue.say,
      window: cue.window,
      clip: c ? { seconds: c.seconds, voice: c.voice, model: c.model, speed: c.speed, say: c.say, at: c.at, by: c.by, provider: c.provider, url: clipUrl(cue.key, c), seeded: !!c.seed } : null,
      take: t ? { seconds: t.seconds, voice: t.voice, model: t.model, speed: t.speed, say: t.say, at: t.at, url: `/api/admin/voiceovers/take/${cue.key}?v=${t.sha256.slice(0, 16)}` } : null,
      versions: doc.versions[cue.key]?.length ?? 0,
    };
  });
  return { rows, cast: doc.cast };
}

const NOT_CONFIGURED = "Voice is not configured. Set it in Admin, Voice.";

export type TakeRequest = { cue: string; say?: string; model?: string; voice?: string; speed?: number; actor: string };

/**
 * Generates one take of a cue with the configured voice service and stores it, unpublished. The model, voice and
 * speed are the ones asked for, else the administrator's choice for the cue's speaker, else the saved Voice settings.
 * The clip is measured here (length and loudness envelope) from its decoded samples.
 */
export async function generateTake(r: TakeRequest): Promise<VoiceClip> {
  const cue = cueOf(r.cue);
  if (!cue) throw new HttpError(404, "That cue is not in the film.");
  const cast = (await readVoiceovers()).cast[cue.who];
  const choice = { model: r.model ?? cast?.model, voice: r.voice ?? cast?.voice, speed: r.speed ?? cast?.speed };
  const s = await getSpeechSynthesizer(choice);
  if (!s.configured) throw new HttpError(409, s.reason === "" ? NOT_CONFIGURED : `${NOT_CONFIGURED} ${s.reason}`);
  const say = (r.say ?? cue.say).trim();
  let bytes: Uint8Array;
  let measured: Awaited<ReturnType<typeof decodeAudio>>;
  try {
    bytes = (await s.synth.synthesize(say, { timeoutMs: 60_000 })).audio;
    measured = await decodeAudio(bytes);
  } catch (e) {
    if (e instanceof SpeechError || e instanceof AudioDecodeError) throw new HttpError(502, e.message);
    throw e;
  }
  if (measured.seconds > MAX_SECONDS) throw new HttpError(502, `The voice service answered ${Math.round(measured.seconds)} seconds of audio; a clip may be at most ${MAX_SECONDS}.`);
  const clip: Omit<VoiceClip, "fileId"> = {
    sha256: sha256(bytes),
    mime: measured.mime,
    size: bytes.length,
    seconds: Math.round(measured.seconds * 1000) / 1000,
    envelope: encodeEnvelope(envelopeOf(measured.samples, measured.sampleRate)),
    speaker: cue.who,
    text: cue.text,
    say,
    provider: s.settings.provider,
    model: s.settings.model,
    voice: s.settings.voice,
    speed: "speed" in s.settings ? s.settings.speed : 1,
    at: new Date().toISOString(),
    by: r.actor,
  };
  return tx(async (c) => {
    const doc = await lockVoiceovers(c);
    const old = doc.takes[cue.key];
    if (old) await c.query("DELETE FROM files WHERE id=$1 AND kind=$2", [old.fileId, VOICEOVER_KIND]);
    const stored: VoiceClip = { ...clip, fileId: await storeVoiceFile(c, cue.key, bytes, clip, "take") };
    doc.takes[cue.key] = stored;
    await writeVoiceovers(c, doc);
    await auditIn(c, { action: "voiceover.take", summary: `Voice-over take generated for ${cue.key} (${stored.voice}, ${stored.seconds} s)`, detail: { cue: cue.key, before: summaryOf(old), after: summaryOf(stored) } });
    return stored;
  });
}

/** Publishes the take of a cue: the public page plays it from now on; the clip it replaces is kept as a version. */
export async function acceptTake(cueKey: string): Promise<VoiceClip> {
  return tx(async (c) => {
    const doc = await lockVoiceovers(c);
    const take = doc.takes[cueKey];
    if (!take || !cueOf(cueKey)) throw new HttpError(404, "There is no take of that cue to accept.");
    const before = doc.clips[cueKey];
    publish(doc, cueKey, take);
    delete doc.takes[cueKey];
    await c.query("UPDATE files SET meta = meta || '{\"state\":\"published\"}'::jsonb WHERE id=$1 AND kind=$2", [take.fileId, VOICEOVER_KIND]);
    if (before) await c.query("UPDATE files SET meta = meta || '{\"state\":\"version\"}'::jsonb WHERE id=$1 AND kind=$2", [before.fileId, VOICEOVER_KIND]);
    await writeVoiceovers(c, doc);
    await auditIn(c, { action: "voiceover.published", summary: `Voice-over published for ${cueKey} (${take.voice}, ${take.seconds} s)${before ? "; the earlier clip is kept as a version" : ""}`, detail: { cue: cueKey, before: summaryOf(before), after: summaryOf(take) } });
    return take;
  });
}

/** Throws the take of a cue away; the published clip is untouched. */
export async function discardTake(cueKey: string): Promise<boolean> {
  return tx(async (c) => {
    const doc = await lockVoiceovers(c);
    const take = doc.takes[cueKey];
    if (!take) return false;
    delete doc.takes[cueKey];
    await c.query("DELETE FROM files WHERE id=$1 AND kind=$2", [take.fileId, VOICEOVER_KIND]);
    await writeVoiceovers(c, doc);
    await auditIn(c, { action: "voiceover.discarded", summary: `Voice-over take discarded for ${cueKey}`, detail: { cue: cueKey, before: summaryOf(take), after: null } });
    return true;
  });
}

/** Saves the model, voice and speed used for one speaker's cues from now on. */
export async function saveCast(speaker: Speaker, choice: CastChoice): Promise<void> {
  await tx(async (c) => {
    const doc = await lockVoiceovers(c);
    const before = doc.cast[speaker] ?? null;
    doc.cast[speaker] = choice;
    await writeVoiceovers(c, doc);
    await auditIn(c, { action: "voiceover.cast", summary: `Voice chosen for the ${speaker}: ${choice.voice} (${choice.model}, speed ${choice.speed})`, detail: { speaker, before, after: choice } });
  });
}
