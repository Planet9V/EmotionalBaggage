// How a performance direction reaches each kind of speech model (src/lib/voice/direction.ts), the loudness measure
// of a take (src/lib/voice/loudness.ts) and the reading of OpenRouter's model lists (src/lib/voice/catalog.ts). Pure:
// no database, no network.
import { describe, expect, it } from "vitest";
import { VOICE_CUES } from "@/components/welcome/scenes/voiceScript";
import { CUE_DIRECTIONS, PACK_DIRECTIONS, SPEAKER_NOTE } from "@/components/welcome/scenes/voiceDirections";
import { billedCharacters, costOf, deliveryOf, directionModeOf, draftReading, resolveMode, stripTags, tagProblem, tagsMatchSubtitle, type ModelFacts } from "@/lib/voice/direction";
import { integratedLoudness, samplePeak } from "@/lib/voice/loudness";
import { openRouterCatalog } from "@/lib/voice/catalog";

const or = (id: string, parameters: string[] = [], description?: string): ModelFacts => ({ provider: "openrouter", id, parameters, description });
const fat = VOICE_CUES.find((c) => c.key === "scale-fat")!;
const line = { subtitle: fat.text, inlineTags: CUE_DIRECTIONS["scale-fat"]!.inlineTags, direction: CUE_DIRECTIONS["scale-fat"]!.direction, prefix: SPEAKER_NOTE.bag };

describe("the direction of each model", () => {
  it("is detected from the model's supported parameters and family", () => {
    expect(directionModeOf({ provider: "kokoro", id: "kokoro", parameters: ["instructions"] }).mode).toBe("none");
    expect(directionModeOf(or("fishaudio/s2.1-pro", ["voice"])).mode).toBe("inline");
    expect(directionModeOf(or("fish-audio/s2-pro", ["instructions"])).mode).toBe("inline");
    expect(directionModeOf(or("acme/voice", [], "Delivery directions in square brackets inside the text.")).mode).toBe("inline");
    expect(directionModeOf(or("openai/gpt-4o-mini-tts-2025-12-15", ["voice", "instructions", "speed"])).mode).toBe("instructions");
    expect(directionModeOf(or("google/gemini-flash-tts", ["Instructions"])).mode).toBe("instructions");
    expect(directionModeOf(or("openai/gpt-4o-mini-tts-2025-12-15", [])).mode).toBe("provider-options");
    // anything else falls back to bracket cues, with a warning to listen for them
    const other = directionModeOf(or("microsoft/mai-voice-2", ["voice"]));
    expect(other.mode).toBe("inline");
    expect(other.why).toMatch(/Listen for a cue being read aloud/);
  });

  it("can be chosen by the administrator, except for a model that would read brackets aloud", () => {
    expect(resolveMode(or("microsoft/mai-voice-2"), "instructions")).toBe("instructions");
    expect(resolveMode(or("openai/x", ["instructions"]), "auto")).toBe("instructions");
    expect(resolveMode({ provider: "kokoro", id: "kokoro", parameters: [] }, "inline")).toBe("none");
  });

  it("never puts the natural-language direction into the spoken text", () => {
    for (const mode of ["inline", "instructions", "provider-options", "none"] as const) {
      const d = deliveryOf(mode, line);
      expect(d.input, mode).not.toContain("wounded shriek, voice cracking] FAT? Do not");
      expect(d.input, mode).not.toContain(line.direction.slice(0, 40));
      expect(d.input, mode).not.toContain(SPEAKER_NOTE.bag.slice(0, 40));
    }
    // instructions: the subtitle exactly, capitals kept; the speaker's note, then the cue's direction, beside it
    expect(deliveryOf("instructions", line)).toEqual({ input: "Are you... calling me FAT?", instructions: `${SPEAKER_NOTE.bag}\n\n${line.direction}`, via: "instructions" });
    expect(deliveryOf("provider-options", line).input).toBe("Are you... calling me FAT?");
    // bracket cues: only short cues in the line, and no instructions
    const inline = deliveryOf("inline", line);
    expect(inline).toEqual({ input: line.inlineTags, via: "inline" });
    expect(stripTags(inline.input)).toBe(fat.text);
    // none: no brackets at all (Kokoro would say "sharp gasp" aloud), capitals as a plain word
    expect(deliveryOf("none", line)).toEqual({ input: "Are you... calling me fat?", via: "none" });
    // bracket cues that change the words are not sent: the subtitle is
    expect(deliveryOf("inline", { ...line, inlineTags: "[gasp] Are you calling me fat?" }).input).toBe(fat.text);
  });

  it("bills the text and the instructions; a price per character gives a cost, no price gives none", () => {
    expect(billedCharacters(deliveryOf("instructions", line))).toBe(fat.text.length + `${SPEAKER_NOTE.bag}\n\n${line.direction}`.length);
    expect(billedCharacters(deliveryOf("inline", line))).toBe(line.inlineTags.length);
    expect(costOf(1_000_000, 0.000015)).toBeCloseTo(15);
    expect(costOf(1000, null)).toBeNull();
  });
});

describe("bracket cues", () => {
  it("leave the subtitle word for word, for every cue of the film and every pack line", () => {
    for (const c of VOICE_CUES) expect(tagsMatchSubtitle(CUE_DIRECTIONS[c.key]!.inlineTags, c.text), c.key).toBe(true);
    for (const p of PACK_DIRECTIONS) {
      expect(tagsMatchSubtitle(p.inlineTags, p.text), p.id).toBe(true);
      expect(tagProblem(p.inlineTags), p.id).toBeNull();
      expect(p.direction.length, p.id).toBeGreaterThan(60);
    }
    // the three recommended lines of each of the eight sensed moments
    expect(PACK_DIRECTIONS).toHaveLength(24);
  });

  it("are refused when empty, unclosed or holding a whole direction", () => {
    expect(tagProblem("[] In the dark.")).toMatch(/empty/);
    expect(tagProblem("[sigh In the dark.")).toMatch(/not matched|not closed/);
    expect(tagProblem("In the dark.]")).toMatch(/not matched/);
    expect(tagProblem(`[${"slowly ".repeat(10)}] In the dark.`)).toMatch(/too long/);
    expect(tagProblem("[sigh] In the dark.")).toBeNull();
  });

  it("the draft reading writes capitals as words for Kokoro, and nothing else", () => {
    expect(draftReading("Where did you GET that?")).toBe("Where did you get that?");
    expect(draftReading("Whoa whoa whoa — are you gonna buy me dinner first?")).toBe("Whoa whoa whoa — are you gonna buy me dinner first?");
  });
});

describe("loudness of a take", () => {
  const sine = (amp: number, hz: number, rate: number, secs: number) => Float32Array.from({ length: Math.round(rate * secs) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / rate));
  it("is -3.0 LUFS for a full-scale 1 kHz sine, at 48 and 24 kHz, and scales with level", () => {
    expect(integratedLoudness(sine(1, 1000, 48000, 2), 48000)).toBeCloseTo(-3.0, 0);
    expect(integratedLoudness(sine(1, 1000, 24000, 2), 24000)).toBeCloseTo(-3.0, 0);
    expect(integratedLoudness(sine(0.1, 1000, 48000, 2), 48000)).toBeCloseTo(-23.0, 0);
  });
  it("is null for silence; the peak is in dBFS", () => {
    expect(integratedLoudness(new Float32Array(48000), 48000)).toBeNull();
    expect(samplePeak(new Float32Array(10))).toBeNull();
    expect(samplePeak(sine(0.5, 1000, 48000, 0.1))).toBeCloseTo(-6.0, 1);
  });
});

describe("OpenRouter's model lists", () => {
  it("are read into one catalogue: voices, parameters from either list, price per character only when named, and the direction mode", () => {
    const models = {
      data: [
        { id: "openai/gpt-4o-mini-tts-2025-12-15", name: "OpenAI mini TTS", supported_voices: ["nova", "<b>x</b>"], pricing: { prompt: "0.0000006" } },
        { id: "fishaudio/s2.1-pro", supported_voices: ["bright-woman"], pricing: { input_character: "0.000015" } },
        { id: "microsoft/mai-voice-2", pricing: {}, supported_parameters: ["voice", "style"] },
        { id: "<script>" },
      ],
    };
    const params = { data: [{ id: "openai/gpt-4o-mini-tts-2025-12-15", supported_parameters: ["voice", "instructions", { name: "speed" }] }, { id: "fishaudio/s2.1-pro", parameters: { voice: {}, format: {} } }] };
    const c = openRouterCatalog(models, params);
    expect(c.map((m) => m.id)).toEqual(["openai/gpt-4o-mini-tts-2025-12-15", "fishaudio/s2.1-pro", "microsoft/mai-voice-2"]);
    expect(c[0]).toMatchObject({ voices: ["nova"], parameters: ["voice", "instructions", "speed"], pricePerChar: null, mode: "instructions", note: expect.stringMatching(/6 January 2027/) });
    expect(c[1]).toMatchObject({ parameters: ["voice", "format"], pricePerChar: 0.000015, mode: "inline" });
    expect(c[2]).toMatchObject({ parameters: ["voice", "style"], mode: "inline" });
    // without the parameters list, an OpenAI model gets provider options
    expect(openRouterCatalog(models, null)[0]!.mode).toBe("provider-options");
  });
});
