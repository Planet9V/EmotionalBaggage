// The voice script of "It started as a joke": every spoken cue of the six scenes, word for word as subtitled (they
// are the owner's lines, from scenes.ts), and who says it. Before scene 1 comes a short narrated introduction. How
// each line is performed (a voice director's note, and the same as bracket cues) is in ./voiceDirections.ts, which
// the public film does not load. The cast names a voice of the open Kokoro model for each speaker. The reasoning, the alternatives
// and what the owner still has to confirm are in docs/design/baggage-claims-voice-script.md.
// Pure data: read by the film (subtitles and timing of the introduction), by the server (which cues exist) and by
// Admin, Voice-overs (what to generate).
import { SCENES, cueName, lineText, type SceneId, type Who } from "./scenes";

export type Speaker = Who | "narrator";
export const SPEAKER_NAME: Record<Speaker, string> = { bag: "The bag", agent: "Agent", host: "Host", stranger: "Stranger", narrator: "Narrator" };

export type VoiceCue = {
  key: string;
  who: Speaker;
  /** the words as subtitled */
  text: string;
  /** the scene the cue is in; null for the introduction */
  scene: SceneId | null;
  /** seconds the subtitle gives the line before the next line or the end of the scene; null for the introduction */
  window: number | null;
};

/** The key of the introduction's clip. */
export const INTRO_CUE = "intro";

/**
 * The introduction: a narrator, over the scenes' own drawn frames, before scene 1. It plays once, when the visitor
 * first turns the sound on. `at` and `end` are seconds into its clip (measured from the generated take); `shot` is
 * the scene whose drawn frame is on screen from that line on. The words are the owner's except the first sentence,
 * which is this page's own title for the section (see the design document for which line comes from where).
 */
export const INTRO = {
  title: "Introduction",
  lines: [
    { at: 0, end: 1.84, shot: "handle", text: "It started as a joke." },
    { at: 2.39, end: 10.23, shot: "handle", text: "A quick gag: a device that goes on luggage that is the comedic relief of all the airport luggage moments of absurdity." },
    { at: 10.73, end: 12.64, shot: "scale", text: "It knows when it's being weighed." },
    { at: 12.94, end: 14.35, shot: "toss", text: "When it's being thrown." },
    { at: 14.65, end: 18.0, shot: "hold", text: "When it's been upside down in the dark for four hours." },
    { at: 18.8, end: 20.77, shot: "scale", text: "And it is NOT happy about it." },
  ] as { at: number; end: number; shot: SceneId; text: string }[],
};
export const introText = () => INTRO.lines.map((l) => l.text).join(" ");

/** The introduction's line on screen `seconds` into its clip: the latest that has started. */
export function introLineAt(seconds: number) {
  let found = INTRO.lines[0]!;
  for (const l of INTRO.lines) if (seconds >= l.at) found = l;
  return found;
}

/** Every cue that can have a clip: the introduction, then each scene's lines in film order. */
export const VOICE_CUES: VoiceCue[] = [
  { key: INTRO_CUE, who: "narrator", text: introText(), scene: null, window: null },
  ...SCENES.flatMap((s) =>
    s.lines.map((l, i): VoiceCue => {
      const key = cueName(s, l);
      const until = s.lines[i + 1]?.parts[0]!.at ?? s.duration;
      return { key, who: l.who, text: lineText(l), scene: s.id, window: (until - l.parts[0]!.at) / 1000 };
    })
  ),
];
export const cueOf = (key: string) => VOICE_CUES.find((c) => c.key === key);

/**
 * The cast: one voice of the Kokoro model (v1.0, 82 million parameters, Apache-2.0) per speaker. These are the
 * voices of the clips that come with the example, and what Admin, Voice-overs offers first for each speaker.
 */
export const CAST: Record<Speaker, { model: string; voice: string; speed: number; why: string }> = {
  bag: { model: "kokoro", voice: "af_heart", speed: 1, why: "The widest pitch movement of the five voices tried (8.6 semitones on average), so outrage and delight read; every one of her phrases has a take both recognisers heard right." },
  agent: { model: "kokoro", voice: "af_sarah", speed: 1.1, why: "Level and businesslike; a touch fast, as someone who has said it all day." },
  host: { model: "kokoro", voice: "am_michael", speed: 0.95, why: "A low, tired American voice, slowed a little for the resigned lines." },
  stranger: { model: "kokoro", voice: "am_puck", speed: 1, why: "Bright and quick: a passer-by who has to sound unprompted." },
  narrator: { model: "kokoro", voice: "bm_george", speed: 1, why: "A grave British documentary voice, which makes the owner's words sound like natural history." },
};

/** The words of the sound control and the lines beside it. */
export const SOUND = {
  /** the first frame's invitation, in the bag's voice (the owner picks one of three; see the design document) */
  invite: "Turn me up. I have things to say.",
  on: "Sound on",
  off: "Sound off",
  none: "No voice-overs yet: subtitles only",
  synthetic: "The voices are synthetic: made with Kokoro, an open speech model (Apache-2.0). No person was recorded.",
  transcript: "Introduction: transcript",
  skip: "Skip the introduction",
};
