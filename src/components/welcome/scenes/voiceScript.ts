// The voice script of "It started as a joke": every spoken cue of the six scenes, word for word as subtitled (they
// are the owner's lines, from scenes.ts), with who says it, how it is to be performed, and the text as it is sent to
// a voice (punctuation and spelling shaped for timing, never a different word). Before scene 1 comes a short narrated
// introduction. The cast names a voice of the open Kokoro model for each speaker. The reasoning, the alternatives
// and what the owner still has to confirm are in docs/design/baggage-claims-voice-script.md.
// Pure data: read by the film (subtitles and timing of the introduction), by the server (which cues exist) and by
// Admin, Voice-overs (what to generate).
import { SCENES, cueName, lineText, type SceneId, type Who } from "./scenes";

export type Speaker = Who | "narrator";
export const SPEAKER_NAME: Record<Speaker, string> = { bag: "The bag", agent: "Agent", host: "Host", stranger: "Stranger", narrator: "Narrator" };

/** How a line is to be performed. */
type Direction = {
  /** the attitude and the voice */
  delivery: string;
  pace: string;
  /** where the pause lands */
  pause: string;
  /** what makes it funny */
  funny: string;
};

/** The text sent to the voice for a cue, and its direction. The key is "<scene>-<line>", as cueName() gives it. */
const PERFORMANCE: Record<string, { say: string; direction: Direction }> = {
  "handle-dinner": {
    say: "Whoa whoa whoa! Are you gonna buy me dinner, first?",
    direction: {
      delivery: "Startled, then affronted: someone has just been picked up without being asked. The three whoas climb.",
      pace: "The whoas quick and even, about a third of a second each; the question slower and pointed.",
      pause: "Half a second after the third whoa, as she collects herself, before \"are you gonna\".",
      funny: "The bag has the manners of a first date and the host has none. Lean on \"dinner\", not on \"first\".",
    },
  },
  "scale-fat": {
    say: "Are you... calling me, fat?!",
    direction: {
      delivery: "Quiet disbelief turning to outrage. She has seen the number on the scale before anyone else has.",
      pace: "\"Are you\" slow and level; \"calling me\" clipped; \"FAT\" full volume, one syllable held.",
      pause: "A full second of silence after \"Are you...\": the stillness of the weigh-in. Then a short beat, a breath, before \"FAT?\".",
      funny: "The long pause lets the visitor get there first. The word lands as the scale's display does.",
    },
  },
  "scale-limit": {
    say: "Sir, the bag is over the limit.",
    direction: {
      delivery: "Professional and entirely straight: the agent has said this four hundred times today and did not hear a suitcase speak.",
      pace: "Brisk and flat, no rise at the end.",
      pause: "None. She answers the bag's outburst as if it were paperwork.",
      funny: "The straight face. Any hint of amusement kills it.",
    },
  },
  "scale-host": {
    say: "Take it up with her.",
    direction: {
      delivery: "Weary and dry. He has had this argument with the bag at home and lost.",
      pace: "Slow, falling; a small sigh on the way in.",
      pause: "A beat before the line, as he does not look up.",
      funny: "\"Her\": he treats the bag as a person, and as the one in charge.",
    },
  },
  "toss-ow": {
    say: "Ow! ...I felt that, in my flip-flops.",
    direction: {
      delivery: "A sharp yelp on impact, then small, wounded dignity from the belt.",
      pace: "\"OW\" instant, on the thud. The second half slow and flat.",
      pause: "Nearly a second after \"OW!\", while the dust settles.",
      funny: "The injury is to what she is carrying. Deadpan on \"flip-flops\"; do not sell it.",
    },
  },
  "hold-hello": {
    say: "Hello? ...Anyone? ...Cool, cool. I'll just be here.",
    direction: {
      delivery: "Sleepy and small in a large dark room; then brittle, pretending not to mind.",
      pace: "Each piece slower and quieter than the last. \"Cool, cool\" too casual, too quick.",
      pause: "A second after \"Hello?\" for the answer that does not come; another after \"Anyone?\"; a short one before \"I'll just be here\".",
      funny: "The pauses are the joke: nobody answers. \"Cool, cool\" is someone who is not cool about it.",
    },
  },
  "hold-dark": {
    say: "In. The. Dark.",
    direction: {
      delivery: "Flat, aimed at whoever left her there. The lowest pitch she has in the film.",
      pace: "Slow, three even words.",
      pause: "It comes after its own silence: nearly half a second after \"I'll just be here\", as an afterthought.",
      funny: "The afterthought that is the whole complaint. Underplay it.",
    },
  },
  "carousel-whee": {
    say: "Whee! Again!! Again!",
    direction: {
      delivery: "Pure delight, a child on a fairground ride; all the dignity of the earlier scenes gone.",
      pace: "\"Wheeee\" long and rising through the bend; the two \"Again\"s fast, the second higher.",
      pause: "A breath after \"Wheeee!\" as she comes round; almost none between the \"Again\"s.",
      funny: "The one thing in the whole trip she likes is the one part everybody else hates.",
    },
  },
  "carousel-stranger": {
    say: "Where did you get that?!",
    direction: {
      delivery: "Delighted and a little envious: a stranger who wants one. The only line in the film that sells the product, so it must sound unprompted.",
      pace: "Quick, rising, stress on \"GET\".",
      pause: "None inside the line; it comes two seconds after the bag stops, once the stranger has worked out what spoke.",
      funny: "It is not a joke: it is the audience's own question, said out loud.",
    },
  },
  "button-souvenirs": {
    say: "Sixty-two pounds?! That's mostly... souvenirs!",
    direction: {
      delivery: "Reading the display in disbelief, then a prepared defence, indignant.",
      pace: "The number slow, each word weighed; the defence quick, with \"SOUVENIRS\" hit hard.",
      pause: "A second after \"pounds?\" while she thinks of an excuse; a short lift before \"SOUVENIRS\".",
      funny: "She disputes the number she objected to in scene 2, and the excuse is worse than the charge.",
    },
  },
  "button-host": {
    say: "...She's not wrong.",
    direction: {
      delivery: "Resigned agreement, to nobody in particular. He has stopped fighting.",
      pace: "Slow and level.",
      pause: "A long beat before it: the nod comes first, then the line.",
      funny: "He sides with the bag. The last word of the film is the host giving in.",
    },
  },
};

export type VoiceCue = {
  key: string;
  who: Speaker;
  /** the words as subtitled */
  text: string;
  /** the words as sent to the voice in one piece */
  say: string;
  /** the scene the cue is in; null for the introduction */
  scene: SceneId | null;
  /** seconds the subtitle gives the line before the next line or the end of the scene; null for the introduction */
  window: number | null;
  direction: Direction;
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
  direction: {
    delivery: "A documentary narrator who takes the subject entirely seriously: warm, unhurried, British. He is describing wildlife.",
    pace: "Measured. The three \"when\" lines shorten and quicken; the last line slows right down.",
    pause: "A beat after \"It started as a joke.\" A longer one before the last line, which hands over to the bag.",
    funny: "The gravity. The owner's own sentence about \"airport luggage moments of absurdity\" read as if it were natural history, and \"NOT\" given its capitals.",
  } satisfies Direction,
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
  { key: INTRO_CUE, who: "narrator", text: introText(), say: introText(), scene: null, window: null, direction: INTRO.direction },
  ...SCENES.flatMap((s) =>
    s.lines.map((l, i): VoiceCue => {
      const key = cueName(s, l);
      const until = s.lines[i + 1]?.parts[0]!.at ?? s.duration;
      return { key, who: l.who, text: lineText(l), say: PERFORMANCE[key]?.say ?? lineText(l), scene: s.id, window: (until - l.parts[0]!.at) / 1000, direction: PERFORMANCE[key]!.direction };
    })
  ),
];
export const cueOf = (key: string) => VOICE_CUES.find((c) => c.key === key);

/**
 * "say" above is what Admin, Voice-overs sends when it generates a line in one piece: the spellings that the seeded
 * clips showed Kokoro reads right ("Whee", not "Wheeee", which it reads as two syllables; "fat", not "FAT", which it
 * spells out). The seeded clips themselves were assembled phrase by phrase (see the design document).
 *
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
