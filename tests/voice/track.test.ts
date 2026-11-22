// The film's sound track: one audio element, so two voices never overlap; a cue's clip starts with its subtitle; a
// missing clip leaves the scene to its subtitles; a change of scene silences what was playing. No browser: the audio
// element is a stand-in.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCENES, cueName, sceneOf } from "@/components/welcome/scenes/scenes";
import { INTRO, INTRO_CUE, VOICE_CUES, cueOf, introLineAt } from "@/components/welcome/scenes/voiceScript";
import { CUE_DIRECTIONS } from "@/components/welcome/scenes/voiceDirections";
import { stripTags, tagProblem } from "@/lib/voice/direction";
import { VoiceTrack, heldQueue, preloadList, startOffset, type VoiceManifest } from "@/components/welcome/scenes/voiceTrack";

class FakePlayer {
  static made: FakePlayer[] = [];
  src = "";
  preload = "";
  currentTime = 0;
  paused = true;
  ended = false;
  onended: ((e: Event) => void) | null = null;
  played: string[] = [];
  constructor() {
    FakePlayer.made.push(this);
  }
  play() {
    this.paused = false;
    this.ended = false;
    this.played.push(this.src);
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  finish() {
    this.paused = true;
    this.ended = true;
    this.onended?.(new Event("ended"));
  }
}

const clip = (cue: string, seconds = 1) => ({ url: `/api/voiceovers/${cue}?v=abc`, seconds, envelope: "" });
const ALL: VoiceManifest = Object.fromEntries(VOICE_CUES.map((c) => [c.key, clip(c.key, c.key === INTRO_CUE ? 20 : 1.2)]));
const track = (manifest: VoiceManifest, loaded: string[] = []) => {
  const t = new VoiceTrack(
    () => new FakePlayer() as unknown as HTMLAudioElement,
    async (url) => {
      loaded.push(url);
      return `blob:${url}`;
    }
  );
  t.setManifest(manifest);
  return t;
};
const player = () => FakePlayer.made.at(-1)!;

beforeEach(() => {
  FakePlayer.made = [];
});

describe("the cues of the film", () => {
  it("are the introduction and every subtitled line, word for word, each with a direction and bracket cues that leave the words alone", () => {
    const lines = SCENES.flatMap((s) => s.lines.map((l) => ({ key: cueName(s, l), who: l.who, text: l.parts.map((p) => p.text).join("") })));
    expect(VOICE_CUES.map((c) => c.key)).toEqual([INTRO_CUE, ...lines.map((l) => l.key)]);
    for (const l of lines) {
      const cue = cueOf(l.key)!;
      expect(cue.text).toBe(l.text);
      expect(cue.who).toBe(l.who);
      expect(cue.window).toBeGreaterThan(1);
    }
    for (const cue of VOICE_CUES) {
      const d = CUE_DIRECTIONS[cue.key]!;
      expect(d.direction.length, cue.key).toBeGreaterThan(200);
      // every direction says what must not happen
      expect(d.direction, cue.key).toMatch(/\bDo not\b/);
      expect(stripTags(d.inlineTags), cue.key).toBe(cue.text.replace(/\s+/g, " ").trim());
      expect(tagProblem(d.inlineTags), cue.key).toBeNull();
      expect(d.inlineTags, cue.key).toMatch(/\[[^\]]+\]/);
    }
    expect(new Set(VOICE_CUES.map((c) => c.key)).size).toBe(VOICE_CUES.length);
  });

  it("time the introduction's lines in order, inside fifteen to twenty-five seconds, each over a scene's own frame", () => {
    const last = INTRO.lines.at(-1)!;
    expect(last.end).toBeGreaterThanOrEqual(15);
    expect(last.end).toBeLessThanOrEqual(25);
    INTRO.lines.forEach((l, i) => {
      expect(l.end).toBeGreaterThan(l.at);
      if (i) expect(l.at).toBeGreaterThanOrEqual(INTRO.lines[i - 1]!.end);
      expect(SCENES.some((s) => s.id === l.shot)).toBe(true);
    });
    expect(introLineAt(0)).toBe(INTRO.lines[0]);
    expect(introLineAt(INTRO.lines[2]!.at + 0.01)).toBe(INTRO.lines[2]);
    expect(introLineAt(999)).toBe(last);
  });
});

describe("when a clip starts", () => {
  it("is with its subtitle: from the top on time, from the matching moment when joined late, not at all once over", () => {
    expect(startOffset(2, 0)).toBe(0);
    expect(startOffset(2, 0.05)).toBe(0);
    expect(startOffset(2, 0.8)).toBe(0.8);
    expect(startOffset(2, 1.99)).toBeNull();
    expect(startOffset(2, 5)).toBeNull();
    expect(startOffset(0, 0.5)).toBeNull();
  });

  it("has the scene's clips and the next scene's ready, wrapping at the end of the film, and only those that exist", () => {
    expect(preloadList(ALL, SCENES, 0)).toEqual(["handle-dinner", "scale-fat", "scale-limit", "scale-host"]);
    expect(preloadList(ALL, SCENES, SCENES.length - 1)).toEqual(["button-souvenirs", "button-host", "handle-dinner"]);
    expect(preloadList({ "scale-fat": clip("scale-fat") }, SCENES, 0)).toEqual(["scale-fat"]);
    expect(preloadList({}, SCENES, 3)).toEqual([]);
  });

  it("over a held picture speaks a scene's lines in order, spaced as the subtitles are and never on top of each other", () => {
    const scale = sceneOf("scale");
    expect(heldQueue(ALL, scale)).toEqual([
      { cue: "scale-fat", waitMs: 0 },
      { cue: "scale-limit", waitMs: 2800 },
      { cue: "scale-host", waitMs: 1600 },
    ]);
    // a long clip pushes the next line back; a line with no clip is left to its subtitle
    expect(heldQueue({ "scale-fat": clip("scale-fat", 4), "scale-host": clip("scale-host") }, scale)).toEqual([
      { cue: "scale-fat", waitMs: 0 },
      { cue: "scale-host", waitMs: 4400 },
    ]);
  });
});

describe("the sound track", () => {
  afterEach(() => vi.useRealTimers());

  it("makes no sound and no audio element until it is unlocked inside the visitor's click", () => {
    const t = track(ALL);
    expect(t.play("scale-fat")).toBe(false);
    expect(FakePlayer.made).toHaveLength(0);
    t.unlock();
    t.unlock();
    expect(FakePlayer.made).toHaveLength(1);
    expect(player().played[0]).toMatch(/^data:audio\/wav/);
    expect(t.now().cue).toBe("");
  });

  it("plays every cue through the same element, so a new cue replaces the one before it", () => {
    const t = track(ALL);
    t.unlock();
    const ended = vi.fn();
    expect(t.play("scale-fat", 0, ended)).toBe(true);
    expect(t.now()).toEqual({ cue: "scale-fat", seconds: 0 });
    expect(t.play("scale-limit", 0.4)).toBe(true);
    expect(FakePlayer.made).toHaveLength(1);
    expect(player().src).toBe(ALL["scale-limit"]!.url);
    expect(player().currentTime).toBe(0.4);
    expect(t.now().cue).toBe("scale-limit");
    player().finish();
    expect(ended).not.toHaveBeenCalled();
    expect(t.now().cue).toBe("");
  });

  it("leaves a scene to its subtitles when a cue has no clip or is already over, and stops what was playing", () => {
    const t = track({ "scale-fat": clip("scale-fat") });
    t.unlock();
    t.play("scale-fat");
    expect(t.play("scale-limit")).toBe(false);
    expect(player().paused).toBe(true);
    expect(t.now().cue).toBe("");
    expect(t.play("scale-fat", null)).toBe(false);
    expect(t.has("scale-fat")).toBe(true);
    expect(t.has("toss-ow")).toBe(false);
    expect(t.empty).toBe(false);
    expect(track({}).empty).toBe(true);
  });

  it("is silenced by a change of scene: stop() pauses, forgets the cue and calls nothing back", () => {
    const t = track(ALL);
    t.unlock();
    const ended = vi.fn();
    t.play(INTRO_CUE, 0, ended);
    t.stop();
    expect(player().paused).toBe(true);
    expect(t.now().cue).toBe("");
    player().finish();
    expect(ended).not.toHaveBeenCalled();
  });

  it("tells the caller when a clip is heard out", () => {
    const t = track(ALL);
    t.unlock();
    const ended = vi.fn();
    t.play(INTRO_CUE, 0, ended);
    player().finish();
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it("fetches each clip once, ahead of its cue, and plays the fetched copy", async () => {
    const loaded: string[] = [];
    const t = track(ALL, loaded);
    t.preload(["scale-fat", "scale-limit", "no-such-cue"]);
    t.preload(["scale-fat"]);
    expect(loaded).toEqual([ALL["scale-fat"]!.url, ALL["scale-limit"]!.url]);
    await Promise.resolve();
    await Promise.resolve();
    t.unlock();
    t.play("scale-fat");
    expect(player().src).toBe(`blob:${ALL["scale-fat"]!.url}`);
    t.play("toss-ow");
    expect(player().src).toBe(ALL["toss-ow"]!.url);
  });

  it("speaks a queue one clip at a time, and a new queue or a stop ends the old one", () => {
    vi.useFakeTimers();
    const t = track(ALL);
    t.unlock();
    const said: string[] = [];
    t.playQueue(heldQueue(ALL, sceneOf("scale")), (c) => said.push(c));
    expect(said).toEqual(["scale-fat"]);
    player().finish();
    // the agent answers 2.8 seconds after the bag began, as the subtitles have it
    vi.advanceTimersByTime(2700);
    expect(said).toEqual(["scale-fat"]);
    vi.advanceTimersByTime(200);
    expect(said).toEqual(["scale-fat", "scale-limit"]);
    // another scene is chosen: the first queue says nothing more
    const other: string[] = [];
    t.playQueue(heldQueue(ALL, sceneOf("hold")), (c) => other.push(c));
    vi.advanceTimersByTime(10_000);
    expect(said).toEqual(["scale-fat", "scale-limit"]);
    expect(other).toEqual(["hold-hello"]);
    player().finish();
    vi.advanceTimersByTime(5000);
    player().finish();
    expect(other).toEqual(["hold-hello", "hold-dark", ""]);
    t.playQueue(heldQueue(ALL, sceneOf("scale")), (c) => said.push(c));
    t.stop();
    player().finish();
    vi.advanceTimersByTime(10_000);
    expect(said.at(-1)).toBe("scale-fat");
  });
});
