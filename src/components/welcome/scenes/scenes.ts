// The scenes of "It started as a joke": each circumstance from the owner's launch video script, with the line the
// bag says, the label the script supers on screen (what the gadget sensed), and the timing of every beat.
// Lines are the documents' own words, kept as written. Nothing here is invented: `source` names the place each
// scene's details came from. Times are milliseconds from the start of the scene.

/** Who is speaking. The bag is the star; the others are the script's deadpan people. */
export type Who = "bag" | "agent" | "host" | "stranger";
export const SPEAKER: Record<Exclude<Who, "bag">, string> = { agent: "Agent", host: "Host", stranger: "Stranger" };

/** A line arrives in parts, so a pause can sit inside it. `ms` is the time per letter; 0 shows the part at once. */
type Part = { at: number; text: string; ms?: number };
/** A subtitle cue. `id` names it, and names its recording: public/audio/scenes/<scene>-<id>.mp3. */
export type Line = { id: string; who: Who; parts: Part[] };
export type SceneId = "scale" | "toss" | "handle" | "hold" | "carousel" | "button";

export type Scene = {
  id: SceneId;
  /** the name in the chapter list and on the slate */
  title: string;
  /** the label the script supers on screen */
  sensed: string;
  /** how the gadget knows, from the gag catalogue in the first note */
  how: string;
  /** when the gadget recognises the moment */
  litAt: number;
  duration: number;
  /** the moment the still shows, under reduced motion */
  stillAt: number;
  lines: Line[];
  source: string;
};

const SCRIPT = "BaggageClaims_LaunchVideo_Script_RevA.txt";
const IDEA = "the gag catalogue in \"I have an idea for a quick gag and potential quick.md\"";

/** In the order the launch script cuts them: the curb, the scale, the toss, the hold, the carousel, the button. */
export const SCENES: Scene[] = [
  {
    id: "handle",
    title: "The handle",
    sensed: "HANDLE_GRAB",
    how: "lifted and carried by the handle after sitting idle",
    litAt: 3400,
    duration: 9600,
    stillAt: 8700,
    lines: [{ id: "dinner", who: "bag", parts: [{ at: 5100, text: "Whoa ", ms: 40 }, { at: 5400, text: "whoa ", ms: 40 }, { at: 5700, text: "whoa", ms: 40 }, { at: 6250, text: " — are you gonna buy me dinner first?", ms: 42 }] }],
    source: `${SCRIPT}, 0:36; ${IDEA}, rank 3`,
  },
  {
    id: "scale",
    title: "The check-in scale",
    sensed: "WEIGH_IN",
    how: "lifted, held perfectly still, set down",
    litAt: 4700,
    duration: 11800,
    stillAt: 8350,
    lines: [
      { id: "fat", who: "bag", parts: [{ at: 5900, text: "Are you...", ms: 55 }, { at: 6900, text: " calling me ", ms: 45 }, { at: 7450, text: "FAT?", ms: 70 }] },
      { id: "limit", who: "agent", parts: [{ at: 8700, text: "Sir, the bag is over the limit." }] },
      { id: "host", who: "host", parts: [{ at: 10300, text: "Take it up with her." }] },
    ],
    source: `${SCRIPT}, 0:45; ${IDEA}, rank 2`,
  },
  {
    id: "toss",
    title: "The handler's toss",
    sensed: "FREEFALL + IMPACT",
    how: "free-fall, then a hard impact",
    litAt: 3350,
    duration: 9800,
    stillAt: 5950,
    lines: [{ id: "ow", who: "bag", parts: [{ at: 3420, text: "OW!", ms: 25 }, { at: 4400, text: " ...I felt that in my flip-flops.", ms: 45 }] }],
    source: `${SCRIPT}, 0:58 and 0:02; ${IDEA}, ranks 1 and 7`,
  },
  {
    id: "hold",
    title: "The dark hold",
    sensed: "DARK_IDLE · 2 hrs",
    how: "no motion and no light for two hours",
    litAt: 4400,
    duration: 11800,
    stillAt: 9050,
    lines: [
      { id: "hello", who: "bag", parts: [{ at: 4700, text: "Hello?", ms: 70 }, { at: 5800, text: " ...Anyone?", ms: 70 }, { at: 7000, text: " ...Cool, cool.", ms: 60 }, { at: 7900, text: " I'll just be here.", ms: 55 }] },
      { id: "dark", who: "bag", parts: [{ at: 9300, text: "In the dark.", ms: 70 }] },
    ],
    source: `${SCRIPT}, 1:10; ${IDEA}, rank 8`,
  },
  {
    id: "carousel",
    title: "The carousel",
    sensed: "CAROUSEL",
    how: "circular, periodic motion",
    litAt: 3300,
    duration: 10800,
    stillAt: 5700,
    lines: [
      { id: "whee", who: "bag", parts: [{ at: 3700, text: "Wheeee!", ms: 90 }, { at: 4800, text: " Again!", ms: 40 }, { at: 5300, text: " Again!", ms: 40 }] },
      { id: "stranger", who: "stranger", parts: [{ at: 8300, text: "Where did you GET that?" }] },
    ],
    source: `${SCRIPT}, 1:20; ${IDEA}, rank 4`,
  },
  {
    id: "button",
    title: "Back at the scale",
    sensed: "WEIGH_IN",
    how: "lifted, held perfectly still, set down",
    litAt: 0,
    duration: 7800,
    stillAt: 4600,
    lines: [
      { id: "souvenirs", who: "bag", parts: [{ at: 900, text: "Sixty-two pounds?", ms: 45 }, { at: 3000, text: " That's mostly ", ms: 45 }, { at: 3800, text: "SOUVENIRS.", ms: 60 }] },
      { id: "host", who: "host", parts: [{ at: 5900, text: "...She's not wrong." }] },
    ],
    source: `${SCRIPT}, 2:10 (the post-tag button)`,
  },
];

/**
 * The cues that have a recording in public/audio/scenes, as "<scene>-<cue>". None has been recorded yet, so with
 * the sound switched on the subtitles still carry every scene. Add a name here when its file is in the folder.
 */
export const RECORDED: string[] = [];
export const cueName = (scene: Scene, line: Line) => `${scene.id}-${line.id}`;

export const sceneOf = (id: SceneId) => SCENES.find((s) => s.id === id)!;

/** The slate between scenes: a split-flap board that turns to the next scene's name and what the gadget will sense. */
export const SLATE_MS = 900;

/** The owner's first note, quoted exactly where it is quoted. */
export const ORIGIN = {
  eyebrow: "It started as a joke: the worked example, Baggage Claims MK1",
  title: "Where did the first idea come from?",
  body: [
    "The first note asked for “a quick gag and potential quick buck”: a device on the luggage that is “the comedic relief of all the airport luggage moments of absurdity”.",
    "The lines were already in it: when the bag is weighed and it is too heavy, “the luggage says ‘are you calling me fat’”.",
  ],
  bridge: "This is the idea the rest of this page carries from concept to market.",
  chapters: "The circumstances",
  stageLabel: "A short silent film in six scenes: what happens to the suitcase, and what it says back.",
  sensed: "SENSED",
  soundOn: "Sound on",
  soundOff: "Sound off",
  noSound: "No recordings yet: subtitles only",
};

export const lineText = (l: Line) => l.parts.map((p) => p.text).join("");

/** How much of a line has been said at `t`. */
export function saidAt(l: Line, t: number): string {
  let out = "";
  for (const p of l.parts) {
    if (t < p.at) break;
    const ms = p.ms ?? 0;
    out += ms ? p.text.slice(0, Math.floor((t - p.at) / ms) + 1) : p.text;
  }
  return out;
}

/** The line on screen at `t`: the latest one that has started. */
export function lineAt(scene: Scene, t: number): Line | null {
  let found: Line | null = null;
  for (const l of scene.lines) if (t >= l.parts[0]!.at) found = l;
  return found;
}
