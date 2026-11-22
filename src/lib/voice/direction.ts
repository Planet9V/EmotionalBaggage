// How a performance direction reaches a speech model, and the text the model is asked to speak. Pure.
//
// Four ways, decided from what the model says it accepts (its supported parameters, read at run time from
// OpenRouter's GET /audio/speech/models) and from its family:
//  - "inline": the subtitle with short delivery cues in square brackets ("[sharp gasp] FAT?"), for a model that reads
//    bracket cues as directions and does not speak them (Fish Audio S2; OpenRouter's documentation says
//    instructions are added to the text this way for Fish models, so the cues are placed by us instead).
//  - "instructions": the subtitle as written, and the direction in the request's top-level `instructions`, for a
//    model whose supported parameters list it (OpenAI's mini TTS and others).
//  - "provider-options": the same, sent as provider.options.openai.instructions, for an OpenAI model whose
//    parameters are not listed (the form on OpenRouter's openrouter-tts skill page).
//  - "none": the subtitle only, for a model that takes no direction and would read brackets aloud (Kokoro).
// A model that is none of these falls back to "inline". The natural-language direction is never put into the spoken
// text, whatever the mode: only the short bracket cues are, and only for a model that is not known to read them.

/** Kokoro's label in Admin, Voice-overs. */
export const KOKORO_NOTE = "No emotion control: for drafts.";

export type DirectionMode = "inline" | "instructions" | "provider-options" | "none";
export const DIRECTION_MODES: DirectionMode[] = ["inline", "instructions", "provider-options", "none"];

/** What is known of a speech model: its provider, id, supported parameters, and its description if listed. */
export type ModelFacts = { provider: "kokoro" | "openrouter"; id: string; parameters: string[]; description?: string };

/** A model family that reads square-bracket cues as delivery directions. */
const INLINE_FAMILY = /(^|[/\s_-])fish|fish[-_ ]?audio|\bs2(\.\d+)?[-_ ]?pro\b/i;
const MENTIONS_BRACKETS = /square[- ]bracket|\[(whisper|laugh|sigh)[a-z]*\]/i;

/** The mode a model takes, and a sentence saying why (shown in Admin, Voice-overs). */
export function directionModeOf(m: ModelFacts): { mode: DirectionMode; why: string } {
  if (m.provider === "kokoro") return { mode: "none", why: "Kokoro takes no direction and would read bracket cues aloud: the plain subtitle is sent." };
  const params = new Set(m.parameters.map((p) => p.toLowerCase()));
  if (INLINE_FAMILY.test(m.id) || MENTIONS_BRACKETS.test(m.description ?? "")) return { mode: "inline", why: "This model reads cues in square brackets as directions, so they are placed inside the line." };
  if (params.has("instructions")) return { mode: "instructions", why: "This model lists an instructions parameter: the direction is sent beside the text, which is the subtitle as written." };
  if (/^openai\//i.test(m.id)) return { mode: "provider-options", why: "An OpenAI model whose parameters were not listed: the direction is sent as OpenAI's instructions through OpenRouter's provider options." };
  return { mode: "inline", why: "This model does not list an instructions parameter, so bracket cues are tried in the line. Listen for a cue being read aloud; if it is, choose Not at all." };
}

/** The mode to use: the one the administrator chose, except that a model known to read brackets aloud gets none. */
export function resolveMode(m: ModelFacts, chosen?: DirectionMode | "auto"): DirectionMode {
  const detected = directionModeOf(m).mode;
  if (detected === "none") return "none";
  return chosen && chosen !== "auto" ? chosen : detected;
}

/** The words of a line with its bracket cues taken out, spaced as the subtitle is. */
export function stripTags(s: string): string {
  return s
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const words = (s: string) => s.replace(/\s+/g, " ").trim();

/** Whether a line with bracket cues says exactly the subtitle's words. */
export const tagsMatchSubtitle = (inlineTags: string, subtitle: string) => stripTags(inlineTags) === words(subtitle);

/** Bracket cues hold short directions only: no nested bracket, nothing longer than a short phrase. */
export function tagProblem(inlineTags: string): string | null {
  for (const m of inlineTags.matchAll(/\[([^\]]*)\]/g)) {
    const t = m[1]!.trim();
    if (!t) return "A bracket cue is empty.";
    if (t.includes("[")) return "A bracket cue is not closed.";
    if (t.length > 60) return `The cue "[${t.slice(0, 30)}…]" is too long: a cue is a few words; the full direction goes in the direction.`;
  }
  if (/[[\]]/.test(inlineTags.replace(/\[[^\]]*\]/g, ""))) return "A square bracket is not matched.";
  return null;
}

/**
 * What a draft model with no direction is sent: the subtitle, with words in capitals written as ordinary words,
 * because Kokoro spells capitals out letter by letter ("F-A-T"). That is a reading fix for drafts, not a performance:
 * a model that takes directions is sent the capitals as written.
 */
export const draftReading = (subtitle: string) => words(subtitle).replace(/\b[A-Z]{2,}\b/g, (w) => (w === "OK" ? w : w.toLowerCase()));

/** The full direction: the speaker's character, then the cue's own note. */
const fullDirection = (prefix: string | undefined, direction: string) => [prefix?.trim(), direction.trim()].filter(Boolean).join("\n\n");

export type Delivery = { input: string; instructions?: string; via: DirectionMode };

/** The text to speak and the instructions to send beside it, for one mode. */
export function deliveryOf(mode: DirectionMode, line: { subtitle: string; inlineTags: string; direction: string; prefix?: string }): Delivery {
  if (mode === "inline") return { input: tagsMatchSubtitle(line.inlineTags, line.subtitle) ? words(line.inlineTags) : words(line.subtitle), via: mode };
  if (mode === "none") return { input: draftReading(line.subtitle), via: mode };
  return { input: words(line.subtitle), instructions: fullDirection(line.prefix, line.direction), via: mode };
}

/** Characters billed for one take: the text, and the instructions when they are sent. */
export const billedCharacters = (d: Delivery) => d.input.length + (d.instructions?.length ?? 0);

/** The cost of `characters` at a price per character, or null when the price is unknown. */
export const costOf = (characters: number, pricePerChar: number | null) => (pricePerChar === null ? null : characters * pricePerChar);
