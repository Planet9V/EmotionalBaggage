// Admin, Voice-overs: the platform administrator's tool for directing and recording the film's voice-overs.
//  - generateTakes: N takes of a cue at once (default 3), with the cue's direction sent the way the chosen model takes
//    it (./direction.ts: instructions beside the text, OpenAI provider options, bracket cues in the line, or nothing
//    for Kokoro), each measured (length, loudness envelope, integrated loudness, peak) and stored unpublished;
//  - starTake, publishTake (the published clip it replaces is kept as a version), discardTake;
//  - saveDirection (a cue's own direction and bracket cues), saveCast (a speaker's model, voice, speed and the
//    character note put in front of each of their directions);
//  - estimateTakes: what generating takes would cost, from the price per character the service lists, or unknown.
// Every change is one transaction under the document's lock and goes to the audit log with before and after.
import { randomBytes } from "node:crypto";
import { auditIn, tx } from "@/lib/db";
import { sha256 } from "@/lib/hash";
import { HttpError } from "@/lib/api/route";
import { VOICE_CUES, cueOf, type Speaker, type VoiceCue } from "@/components/welcome/scenes/voiceScript";
import { CUE_DIRECTIONS, SPEAKER_NOTE } from "@/components/welcome/scenes/voiceDirections";
import { decodeAudio, AudioDecodeError } from "./decode";
import { encodeEnvelope, envelopeOf } from "./envelope";
import { integratedLoudness, samplePeak } from "./loudness";
import { getSpeechSynthesizer, readVoiceSettings, SpeechError } from "./speech";
import { factsOf, speechCatalog, type Catalog } from "./catalog";
import { billedCharacters, costOf, deliveryOf, resolveMode, tagProblem, tagsMatchSubtitle, type DirectionMode } from "./direction";
import { VOICEOVER_KIND, audioOf, clipUrl, lockVoiceovers, publish, readVoiceovers, storeVoiceFile, writeVoiceovers, type CastChoice, type VoiceClip, type VoiceoverDoc } from "./voiceovers";

/** The longest clip kept: the introduction is about twenty seconds; anything much longer is not a cue of this film. */
const MAX_SECONDS = 45;
/** Takes kept per cue; past this the oldest unstarred one goes. */
const MAX_TAKES = 9;
export const MAX_TAKES_AT_ONCE = 6;
const DEFAULT_TAKES = 3;

// --- The direction of a cue ----------------------------------------------------------------------------------

/** The direction in force for a cue: the administrator's, else the script's. */
function directionOf(doc: VoiceoverDoc, cue: VoiceCue) {
  const own = doc.directions[cue.key];
  const script = CUE_DIRECTIONS[cue.key] ?? { direction: "", inlineTags: cue.text };
  return { direction: own?.direction ?? script.direction, inlineTags: own?.inlineTags ?? script.inlineTags, edited: !!own };
}
const prefixOf = (doc: VoiceoverDoc, who: Speaker) => doc.cast[who]?.prefix ?? SPEAKER_NOTE[who];

/** Refuses bracket cues that change the subtitle's words or hold a whole direction. */
function checkTags(cue: VoiceCue, inlineTags: string) {
  if (!tagsMatchSubtitle(inlineTags, cue.text)) throw new HttpError(400, "With the bracket cues taken out, the line must be the subtitle word for word. Only cues in square brackets may be added.");
  const problem = tagProblem(inlineTags);
  if (problem) throw new HttpError(400, problem);
}

// --- What the tool lists ----------------------------------------------------------------------------------------

const takeUrl = (cue: string, t: VoiceClip) => `/api/admin/voiceovers/take/${cue}?id=${t.id}`;
const summaryOf = (c: VoiceClip | undefined) => (c ? { id: c.id, fileId: c.fileId, sha256: c.sha256, voice: c.voice, model: c.model, speed: c.speed, seconds: c.seconds, say: c.say, via: c.via } : null);

type TakeView = Pick<VoiceClip, "seconds" | "voice" | "model" | "speed" | "say" | "at" | "provider"> & { id: string; url: string; starred: boolean; via: DirectionMode | null; direction: string | null; lufs: number | null; peak: number | null };

export type VoiceoverRow = {
  cue: string;
  speaker: Speaker;
  text: string;
  /** the time the subtitle gives the line, in seconds; null for the introduction */
  window: number | null;
  direction: string;
  inlineTags: string;
  /** whether the direction is the administrator's own rather than the script's */
  directionEdited: boolean;
  clip: (Pick<VoiceClip, "seconds" | "voice" | "model" | "speed" | "say" | "at" | "by" | "provider"> & { url: string; seeded: boolean; lufs: number | null }) | null;
  takes: TakeView[];
  versions: number;
};

const takeView = (cue: string, t: VoiceClip): TakeView => ({ id: t.id!, url: takeUrl(cue, t), starred: !!t.starred, seconds: t.seconds, voice: t.voice, model: t.model, provider: t.provider, speed: t.speed, say: t.say, at: t.at, via: t.via ?? null, direction: t.direction ?? null, lufs: t.lufs ?? null, peak: t.peak ?? null });

/** Every cue with its direction, published clip and takes, and each speaker's cast and character note. */
export async function listVoiceovers(): Promise<{ rows: VoiceoverRow[]; cast: Record<string, CastChoice>; notes: Record<Speaker, string> }> {
  const doc = await readVoiceovers();
  const rows = VOICE_CUES.map((cue): VoiceoverRow => {
    const c = doc.clips[cue.key];
    const d = directionOf(doc, cue);
    return {
      cue: cue.key,
      speaker: cue.who,
      text: cue.text,
      window: cue.window,
      direction: d.direction,
      inlineTags: d.inlineTags,
      directionEdited: d.edited,
      clip: c ? { seconds: c.seconds, voice: c.voice, model: c.model, speed: c.speed, say: c.say, at: c.at, by: c.by, provider: c.provider, url: clipUrl(cue.key, c), seeded: !!c.seed, lufs: c.lufs ?? null } : null,
      takes: (doc.takes[cue.key] ?? []).map((t) => takeView(cue.key, t)),
      versions: doc.versions[cue.key]?.length ?? 0,
    };
  });
  const notes = Object.fromEntries((Object.keys(SPEAKER_NOTE) as Speaker[]).map((s) => [s, prefixOf(doc, s)])) as Record<Speaker, string>;
  return { rows, cast: doc.cast, notes };
}

/** The audio of one take, for the administrator's preview. */
export async function takeAudio(cue: string, id: string | null) {
  const list = (await readVoiceovers()).takes[cue] ?? [];
  const take = id ? list.find((t) => t.id === id) : list.at(-1);
  return take ? audioOf(take) : null;
}

// --- Generating takes -------------------------------------------------------------------------------------------

const NOT_CONFIGURED = "Voice is not configured. Set it in Admin, Voice.";

export type TakeRequest = {
  cue: string;
  count?: number;
  model?: string;
  voice?: string;
  speed?: number;
  /** this run's direction and bracket cues, in place of the saved ones (not saved) */
  direction?: string;
  inlineTags?: string;
  /** how the direction is sent: "auto" (detected from the model), or one mode; a model that reads brackets aloud always gets none */
  mode?: DirectionMode | "auto";
  actor: string;
};

/** What one cue would be sent with: model, voice, mode and the text and instructions. */
function planOf(doc: VoiceoverDoc, cue: VoiceCue, r: Omit<TakeRequest, "cue" | "actor" | "count">, provider: "kokoro" | "openrouter", savedModel: string, catalog: Catalog) {
  const cast = doc.cast[cue.who];
  const model = r.model?.trim() || cast?.model || savedModel;
  const d = directionOf(doc, cue);
  const direction = r.direction?.trim() || d.direction;
  const inlineTags = r.inlineTags?.trim() || d.inlineTags;
  checkTags(cue, inlineTags);
  const facts = factsOf(catalog, provider, model);
  const mode = resolveMode(facts, r.mode);
  const delivery = deliveryOf(mode, { subtitle: cue.text, inlineTags, direction, prefix: prefixOf(doc, cue.who) });
  return { model, voice: r.voice?.trim() || cast?.voice, speed: r.speed ?? cast?.speed, facts, delivery, direction };
}

async function catalogFor(provider: "kokoro" | "openrouter"): Promise<Catalog> {
  // Kokoro's mode does not depend on its list, so it is not asked for one on every take
  return provider === "openrouter" ? speechCatalog() : { provider, ok: true, models: [] };
}

type Measured = Omit<VoiceClip, "fileId">;

/**
 * Generates `count` takes of a cue (default 3) and stores them unpublished. The model, voice and speed are the ones
 * asked for, else the speaker's cast, else the saved Voice settings. If a take fails after others succeeded, those
 * are kept and the failure is answered as `failed`.
 */
export async function generateTakes(r: TakeRequest): Promise<{ takes: VoiceClip[]; failed: string | null; via: DirectionMode }> {
  const cue = cueOf(r.cue);
  if (!cue) throw new HttpError(404, "That cue is not in the film.");
  const count = Math.min(MAX_TAKES_AT_ONCE, Math.max(1, Math.round(r.count ?? DEFAULT_TAKES)));
  const saved = await readVoiceSettings();
  if (saved.provider === "none") throw new HttpError(409, NOT_CONFIGURED);
  const doc = await readVoiceovers();
  const plan = planOf(doc, cue, r, saved.provider, saved.model, await catalogFor(saved.provider));
  const s = await getSpeechSynthesizer({ model: plan.model, voice: plan.voice, speed: plan.speed });
  if (!s.configured) throw new HttpError(409, `${NOT_CONFIGURED} ${s.reason}`);
  const { input, instructions, via } = plan.delivery;
  // OpenRouter is sent a speed only when the model lists it; Kokoro's speed is part of its settings
  const speed = s.settings.provider === "openrouter" && plan.speed !== undefined && plan.facts.parameters.includes("speed") ? plan.speed : undefined;
  const made: { bytes: Uint8Array; clip: Measured }[] = [];
  let failed: string | null = null;
  for (let i = 0; i < count; i++) {
    try {
      const bytes = (await s.synth.synthesize(input, { timeoutMs: 60_000, ...(instructions && (via === "instructions" || via === "provider-options") ? { instructions, via } : {}), ...(speed !== undefined ? { speed } : {}) })).audio;
      const m = await decodeAudio(bytes);
      if (m.seconds > MAX_SECONDS) throw new HttpError(502, `The voice service answered ${Math.round(m.seconds)} seconds of audio; a clip may be at most ${MAX_SECONDS}.`);
      made.push({
        bytes,
        clip: {
          id: randomBytes(6).toString("hex"),
          sha256: sha256(bytes),
          mime: m.mime,
          size: bytes.length,
          seconds: Math.round(m.seconds * 1000) / 1000,
          envelope: encodeEnvelope(envelopeOf(m.samples, m.sampleRate)),
          lufs: integratedLoudness(m.samples, m.sampleRate),
          peak: samplePeak(m.samples),
          speaker: cue.who,
          text: cue.text,
          say: input,
          ...(instructions ? { direction: instructions } : {}),
          via,
          provider: s.settings.provider,
          model: s.settings.model,
          voice: s.settings.voice,
          speed: speed ?? ("speed" in s.settings ? s.settings.speed : 1),
          at: new Date().toISOString(),
          by: r.actor,
        },
      });
    } catch (e) {
      const message = e instanceof SpeechError || e instanceof AudioDecodeError || e instanceof HttpError ? e.message : null;
      if (!message) throw e;
      if (!made.length) throw e instanceof HttpError ? e : new HttpError(502, message);
      failed = message;
      break;
    }
  }
  const takes = await tx(async (c) => {
    const d = await lockVoiceovers(c);
    const list = d.takes[cue.key] ?? [];
    const stored: VoiceClip[] = [];
    for (const { bytes, clip } of made) stored.push({ ...clip, fileId: await storeVoiceFile(c, cue.key, bytes, clip, "take") });
    list.push(...stored);
    // past the limit the oldest unstarred takes go, with their files
    while (list.length > MAX_TAKES) {
      const i = list.findIndex((t) => !t.starred);
      const [gone] = list.splice(i < 0 ? 0 : i, 1);
      await c.query("DELETE FROM files WHERE id=$1 AND kind=$2", [gone!.fileId, VOICEOVER_KIND]);
    }
    d.takes[cue.key] = list;
    await writeVoiceovers(c, d);
    await auditIn(c, { action: "voiceover.take", summary: `${stored.length} voice-over take${stored.length === 1 ? "" : "s"} generated for ${cue.key} (${stored[0]!.model}, ${stored[0]!.voice}, direction ${via})`, detail: { cue: cue.key, before: null, after: stored.map(summaryOf), failed } });
    return stored;
  });
  return { takes, failed, via };
}

// --- Choosing --------------------------------------------------------------------------------------------------

/** Stars one take of a cue (the one to publish); starring it again takes the star off. */
export async function starTake(cueKey: string, id: string): Promise<boolean> {
  return tx(async (c) => {
    const doc = await lockVoiceovers(c);
    const list = doc.takes[cueKey] ?? [];
    const take = list.find((t) => t.id === id);
    if (!take) throw new HttpError(404, "That take was not found.");
    const on = !take.starred;
    for (const t of list) delete t.starred;
    if (on) take.starred = true;
    await writeVoiceovers(c, doc);
    await auditIn(c, { action: "voiceover.starred", summary: `Voice-over take ${id} of ${cueKey} ${on ? "starred" : "unstarred"}`, detail: { cue: cueKey, before: null, after: { id, starred: on } } });
    return on;
  });
}

/**
 * Publishes a take of a cue: the one named, else the starred one, else the only one. The public page plays it from
 * now on; the clip it replaces is kept as a version; the cue's other takes stay to be compared or discarded.
 */
export async function publishTake(cueKey: string, id?: string): Promise<VoiceClip> {
  return tx(async (c) => {
    const doc = await lockVoiceovers(c);
    const list = doc.takes[cueKey] ?? [];
    const take = id ? list.find((t) => t.id === id) : (list.find((t) => t.starred) ?? (list.length === 1 ? list[0] : undefined));
    if (!take || !cueOf(cueKey)) throw new HttpError(404, id || !list.length ? "There is no such take of that cue to publish." : "Star the take to publish first, or name it.");
    const before = doc.clips[cueKey];
    const clip: VoiceClip = { ...take };
    delete clip.starred;
    publish(doc, cueKey, clip);
    doc.takes[cueKey] = list.filter((t) => t !== take);
    await c.query("UPDATE files SET meta = meta || '{\"state\":\"published\"}'::jsonb WHERE id=$1 AND kind=$2", [take.fileId, VOICEOVER_KIND]);
    if (before) await c.query("UPDATE files SET meta = meta || '{\"state\":\"version\"}'::jsonb WHERE id=$1 AND kind=$2", [before.fileId, VOICEOVER_KIND]);
    await writeVoiceovers(c, doc);
    await auditIn(c, { action: "voiceover.published", summary: `Voice-over published for ${cueKey} (${take.voice}, ${take.seconds} s)${before ? "; the earlier clip is kept as a version" : ""}`, detail: { cue: cueKey, before: summaryOf(before), after: summaryOf(take) } });
    return clip;
  });
}

/** Throws away one take of a cue, or all of them when no take is named; the published clip is untouched. */
export async function discardTake(cueKey: string, id?: string): Promise<number> {
  return tx(async (c) => {
    const doc = await lockVoiceovers(c);
    const list = doc.takes[cueKey] ?? [];
    const gone = id ? list.filter((t) => t.id === id) : list;
    if (!gone.length) return 0;
    doc.takes[cueKey] = list.filter((t) => !gone.includes(t));
    for (const t of gone) await c.query("DELETE FROM files WHERE id=$1 AND kind=$2", [t.fileId, VOICEOVER_KIND]);
    await writeVoiceovers(c, doc);
    await auditIn(c, { action: "voiceover.discarded", summary: `${gone.length} voice-over take${gone.length === 1 ? "" : "s"} discarded for ${cueKey}`, detail: { cue: cueKey, before: gone.map(summaryOf), after: null } });
    return gone.length;
  });
}

// --- Directing --------------------------------------------------------------------------------------------------

/** Saves a cue's own direction and bracket cues; null goes back to the script's. */
export async function saveDirection(cueKey: string, own: { direction: string; inlineTags: string } | null, actor: string): Promise<void> {
  const cue = cueOf(cueKey);
  if (!cue) throw new HttpError(404, "That cue is not in the film.");
  if (own) checkTags(cue, own.inlineTags);
  await tx(async (c) => {
    const doc = await lockVoiceovers(c);
    const before = doc.directions[cueKey] ?? null;
    if (own) doc.directions[cueKey] = { direction: own.direction.trim(), inlineTags: own.inlineTags.trim(), at: new Date().toISOString(), by: actor };
    else delete doc.directions[cueKey];
    await writeVoiceovers(c, doc);
    await auditIn(c, { action: "voiceover.direction", summary: own ? `Direction of ${cueKey} changed` : `Direction of ${cueKey} back to the script's`, detail: { cue: cueKey, before, after: doc.directions[cueKey] ?? null } });
  });
}

/** Saves the model, voice, speed and character note used for one speaker's cues from now on. */
export async function saveCast(speaker: Speaker, choice: CastChoice): Promise<void> {
  await tx(async (c) => {
    const doc = await lockVoiceovers(c);
    const before = doc.cast[speaker] ?? null;
    doc.cast[speaker] = choice;
    await writeVoiceovers(c, doc);
    await auditIn(c, { action: "voiceover.cast", summary: `Voice chosen for the ${speaker}: ${choice.voice} (${choice.model}, speed ${choice.speed})`, detail: { speaker, before, after: choice } });
  });
}

// --- Cost -------------------------------------------------------------------------------------------------------

export type Estimate = {
  takes: number;
  characters: number;
  /** US dollars; null when any model's price per character is not listed */
  cost: number | null;
  lines: { cue: string; model: string; via: DirectionMode; characters: number; pricePerChar: number | null; cost: number | null }[];
};

/** What generating `count` takes of each cue (every cue when none are named) would send, and cost. Generates nothing. */
export async function estimateTakes(count = DEFAULT_TAKES, cues?: string[]): Promise<Estimate> {
  const saved = await readVoiceSettings();
  if (saved.provider === "none") throw new HttpError(409, NOT_CONFIGURED);
  const n = Math.min(MAX_TAKES_AT_ONCE, Math.max(1, Math.round(count)));
  const doc = await readVoiceovers();
  const catalog = await speechCatalog();
  const chosen = cues?.length ? VOICE_CUES.filter((c) => cues.includes(c.key)) : VOICE_CUES;
  const lines = chosen.map((cue) => {
    const p = planOf(doc, cue, {}, saved.provider, saved.model, catalog);
    const characters = billedCharacters(p.delivery) * n;
    return { cue: cue.key, model: p.model, via: p.delivery.via, characters, pricePerChar: p.facts.pricePerChar, cost: costOf(characters, p.facts.pricePerChar) };
  });
  const characters = lines.reduce((a, l) => a + l.characters, 0);
  const cost = lines.some((l) => l.cost === null) ? null : lines.reduce((a, l) => a + l.cost!, 0);
  return { takes: n * lines.length, characters, cost, lines };
}
