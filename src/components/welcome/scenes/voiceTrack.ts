// The film's sound: one audio element for the whole page, so two voices can never overlap, and the rules of what
// plays when. The page is given a manifest (cue -> where its clip is, how long it is, its loudness envelope) by the
// server; a cue that is not in it has no clip, and its scene plays with subtitles only. Nothing here starts sound by
// itself: the element is made, and first played, inside the visitor's own click on the sound control.
//
// For the animation (the tag's speaker grille): speechLevelAt(cue, seconds) is the stored loudness of a cue at a
// moment of its clip, 0 to 1, whether or not sound is on; currentSpeech() is what is audible right now.
import { decodeEnvelope, levelAt } from "@/lib/voice/envelope";
import { cueName, type Scene } from "./scenes";

/** One published clip, as the page is given it. */
type VoiceClipInfo = { url: string; seconds: number; envelope: string };
export type VoiceManifest = Record<string, VoiceClipInfo>;

// --- Rules (pure) ------------------------------------------------------------------------------------------

/** A clip joined later than this plays from the matching moment, to stay with its subtitle. */
const LATE_S = 0.12;

/**
 * Where in its clip a cue starts when its subtitle began `lateSeconds` ago: from the top when on time, from the
 * matching moment when late, and not at all (null) when the clip would already be over.
 */
export function startOffset(clipSeconds: number, lateSeconds: number): number | null {
  if (!(lateSeconds > LATE_S)) return 0;
  return lateSeconds >= clipSeconds - 0.05 ? null : lateSeconds;
}

/** The cues to have ready while scene `idx` plays: its own and the next scene's (the film loops), those with a clip. */
export function preloadList(manifest: VoiceManifest, scenes: Scene[], idx: number): string[] {
  const of = (s: Scene | undefined) => (s ? s.lines.map((l) => cueName(s, l)) : []);
  return [...new Set([...of(scenes[idx]), ...of(scenes[(idx + 1) % scenes.length])])].filter((c) => !!manifest[c]);
}

/**
 * A scene's cues for a held picture (reduced motion, the drawn frames), where no clock runs: one after another, each
 * `waitMs` after the one before it began, as the subtitles space them, and never before the one before it has ended.
 */
export function heldQueue(manifest: VoiceManifest, scene: Scene): { cue: string; waitMs: number }[] {
  const out: { cue: string; waitMs: number }[] = [];
  let lastAt = 0;
  let lastSeconds = 0;
  for (const l of scene.lines) {
    const cue = cueName(scene, l);
    const clip = manifest[cue];
    if (!clip) continue;
    const at = l.parts[0]!.at;
    out.push({ cue, waitMs: out.length ? Math.max(at - lastAt, Math.ceil(lastSeconds * 1000) + 150) : 0 });
    lastAt = at;
    lastSeconds = clip.seconds;
  }
  return out;
}

const envelopes = new WeakMap<VoiceClipInfo, Uint8Array>();
/** The loudness (0 to 1) of a cue `seconds` into its clip; 0 when the cue has no clip. */
export function speechLevel(manifest: VoiceManifest, cue: string, seconds: number): number {
  const clip = manifest[cue];
  if (!clip) return 0;
  let e = envelopes.get(clip);
  if (!e) envelopes.set(clip, (e = decodeEnvelope(clip.envelope)));
  return levelAt(e, seconds);
}

// --- The one audio element ---------------------------------------------------------------------------------

/** A silent tenth of a second: played inside the click when no cue is due, so later cues are allowed to start. */
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

type Player = Pick<HTMLAudioElement, "play" | "pause" | "currentTime" | "paused" | "ended"> & { src: string; onended: ((e: Event) => void) | null; preload: string };

/** The film's sound track. One per page (`voiceTrack`); tests make their own with a stand-in player. */
export class VoiceTrack {
  private manifest: VoiceManifest = {};
  private player: Player | null = null;
  private cue = "";
  private blobs = new Map<string, string>();
  private wanted = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** raised whenever a queue is replaced, so a finished clip of an old queue starts nothing */
  private turn = 0;

  constructor(
    private make: () => Player = () => new Audio(),
    private load: (url: string) => Promise<string | null> = async (url) => {
      const r = await fetch(url);
      return r.ok ? URL.createObjectURL(await r.blob()) : null;
    }
  ) {}

  setManifest(m: VoiceManifest) {
    this.manifest = m;
  }
  has(cue: string) {
    return !!this.manifest[cue];
  }
  /** True when no cue at all has a clip. */
  get empty() {
    return Object.keys(this.manifest).length === 0;
  }

  /** Call inside the visitor's click: makes the element and, when nothing is due this instant, plays silence through it. */
  unlock() {
    if (this.player) return;
    this.player = this.make();
    this.player.preload = "auto";
    this.player.src = SILENCE;
    void this.player.play().catch(() => undefined);
  }

  /** Fetches clips ahead of their cues, once each. A clip that is not ready in time is streamed instead. */
  preload(cues: string[]) {
    for (const cue of cues) {
      const clip = this.manifest[cue];
      if (!clip || this.wanted.has(clip.url)) continue;
      this.wanted.add(clip.url);
      void this.load(clip.url).then((blob) => blob && this.blobs.set(clip.url, blob), () => this.wanted.delete(clip.url));
    }
  }

  /**
   * Plays a cue's clip from `offset` seconds, in place of whatever was playing. False when there is no clip, no
   * unlocked element, or the offset says the clip is over: the scene then carries on with its subtitle only.
   */
  play(cue: string, offset: number | null = 0, onEnd?: () => void): boolean {
    this.clear();
    return this.start(cue, offset, onEnd);
  }

  private start(cue: string, offset: number | null, onEnd?: () => void): boolean {
    const clip = this.manifest[cue];
    const p = this.player;
    if (!p) return false;
    p.pause();
    p.onended = null;
    this.cue = "";
    if (!clip || offset === null) return false;
    p.src = this.blobs.get(clip.url) ?? clip.url;
    if (offset > 0) p.currentTime = offset;
    this.cue = cue;
    const turn = this.turn;
    p.onended = () => {
      if (this.cue === cue) this.cue = "";
      if (turn === this.turn) onEnd?.();
    };
    void p.play().catch(() => {
      if (this.cue === cue) this.cue = "";
    });
    return true;
  }

  /** Plays cues one after another (see heldQueue); `onCue` hears which is speaking, and "" when the last has ended. */
  playQueue(queue: { cue: string; waitMs: number }[], onCue: (cue: string) => void) {
    this.clear();
    const turn = this.turn;
    const step = (i: number, began: number) => {
      const item = queue[i];
      if (turn !== this.turn) return;
      if (!item) return onCue("");
      const go = () => {
        if (turn !== this.turn) return;
        const now = Date.now();
        onCue(item.cue);
        if (!this.start(item.cue, 0, () => step(i + 1, now))) step(i + 1, now);
      };
      const wait = began ? Math.max(0, item.waitMs - (Date.now() - began)) : 0;
      if (wait > 0) this.timer = setTimeout(go, wait);
      else go();
    };
    step(0, 0);
  }

  private clear() {
    this.turn += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Silence, now: on a change of scene, on leaving the section, on switching the sound off. */
  stop() {
    this.clear();
    if (!this.player) return;
    this.player.pause();
    this.player.onended = null;
    this.cue = "";
  }

  /** The cue being heard and how far into its clip it is; cue "" when nothing is. */
  now(): { cue: string; seconds: number } {
    const p = this.player;
    if (!p || !this.cue || p.paused || p.ended) return { cue: "", seconds: 0 };
    return { cue: this.cue, seconds: p.currentTime };
  }

  /** The speech level of a cue at a moment of its clip (0 to 1), from the stored envelope. */
  levelAt(cue: string, seconds: number) {
    return speechLevel(this.manifest, cue, seconds);
  }
}

/** The page's sound track. */
export const voiceTrack = new VoiceTrack();

/**
 * For the animation: how loud the voice of `cue` is `seconds` into its clip, 0 to 1 (0 for a cue with no clip). A
 * clip starts with its subtitle, so `seconds` is the scene clock less the line's first `at`, and the answer is the
 * same with the sound off.
 */
export const speechLevelAt = (cue: string, seconds: number) => voiceTrack.levelAt(cue, seconds);

/** For the animation: the cue audible this instant and its level, read from the audio element's own clock. */
export function currentSpeech(): { cue: string; level: number } {
  const { cue, seconds } = voiceTrack.now();
  return { cue, level: cue ? voiceTrack.levelAt(cue, seconds) : 0 };
}
