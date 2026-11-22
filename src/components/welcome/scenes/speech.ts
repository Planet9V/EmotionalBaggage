// How loud a line is at a moment, 0 to 1, from the same timing the subtitles are typed with: each syllable is a
// pulse that rises and falls while its letters are typed, spaces and punctuation are silence, and a word in capitals
// is shouted. The tag's grille and lamp and the people's mouths are all driven from this one function, so a
// recorded voice can later drive them instead (replace `speechLevel` with the recording's envelope).
import type { Line, Scene, Who } from "./scenes";

/** Letters per second a person speaks at, for the people's lines (their subtitles appear whole, not typed). */
export const PEOPLE_MS = 62;
const BAG_MS = 42;

type Syllable = { from: number; to: number; loud: number };

const VOWEL = /[aeiouyAEIOUY]/;

/** The syllables of a text as letter spans: [from, to) in letters, with how loud each is. */
export function syllables(text: string): Syllable[] {
  const out: Syllable[] = [];
  const words = text.matchAll(/[A-Za-z']+/g);
  for (const m of words) {
    const w = m[0];
    const start = m.index ?? 0;
    const shout = w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w);
    const loud = shout ? 1 : 0.8;
    // the start of each vowel group after the first begins a new syllable, taking one consonant before it
    const cuts: number[] = [];
    let inVowel = false;
    let groups = 0;
    for (let i = 0; i < w.length; i++) {
      const v = VOWEL.test(w[i]!);
      if (v && !inVowel) {
        groups += 1;
        if (groups > 1) cuts.push(i > 0 && !VOWEL.test(w[i - 1]!) ? i - 1 : i);
      }
      inVowel = v;
    }
    // a silent final "e" does not make a syllable of its own ("take", "here")
    if (cuts.length && /[eE]$/.test(w) && w.length > 2 && !VOWEL.test(w[w.length - 2]!) && cuts[cuts.length - 1]! >= w.length - 2) cuts.pop();
    let from = 0;
    for (const c of [...cuts, w.length]) {
      if (c > from) out.push({ from: start + from, to: start + c, loud });
      from = c;
    }
  }
  return out;
}

const cache = new Map<string, Syllable[]>();
function syllablesOf(text: string) {
  let s = cache.get(text);
  if (!s) {
    s = syllables(text);
    cache.set(text, s);
  }
  return s;
}

/** The time per letter of a part, as the subtitles type it (or as a person would say it). */
function msOf(line: Line, ms: number | undefined) {
  if (ms) return ms;
  return line.who === "bag" ? BAG_MS : PEOPLE_MS;
}

/** How loud `line` is at `t` (ms from the start of the scene), 0 to 1. */
export function speechLevel(line: Line, t: number): number {
  for (const p of line.parts) {
    const ms = msOf(line, p.ms);
    const k = (t - p.at) / ms;
    if (k < 0 || k >= p.text.length) continue;
    for (const s of syllablesOf(p.text)) {
      if (k >= s.from && k < s.to) return s.loud * Math.sin((Math.PI * (k - s.from)) / (s.to - s.from)) ** 0.6;
    }
    return 0;
  }
  return 0;
}

/** How loud `who` is at `t`, across every line of theirs in the scene. */
export function voiceOf(scene: Scene, who: Who, t: number): number {
  let v = 0;
  for (const l of scene.lines) if (l.who === who) v = Math.max(v, speechLevel(l, t));
  return v;
}
