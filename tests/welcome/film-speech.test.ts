import { describe, expect, it } from "vitest";
import { SCENES, saidAt, type Line } from "@/components/welcome/scenes/scenes";
import { PEOPLE_MS, bagVoice, presence, speechLevel, syllables, voiceOf } from "@/components/welcome/scenes/speech";

const fat: Line = SCENES.find((s) => s.id === "scale")!.lines[0]!;

describe("how loud a line is, from the subtitle timing", () => {
  it("splits words into syllables", () => {
    expect(syllables("FAT?").length).toBe(1);
    expect(syllables("calling").length).toBe(2);
    expect(syllables("souvenirs").length).toBe(3);
    expect(syllables("take it").length).toBe(2);
  });

  it("is silent before the line, between words and after it", () => {
    expect(speechLevel(fat, 0)).toBe(0);
    expect(speechLevel(fat, 5899)).toBe(0);
    // "Are you...": the space after "Are" is typed at 5900 + 3 * 55
    expect(speechLevel(fat, 5900 + 3 * 55 + 20)).toBe(0);
    expect(speechLevel(fat, 20000)).toBe(0);
  });

  it("pulses once a syllable, in step with the letters as they are typed", () => {
    // "Are" is one syllable over three letters: rising, a peak in the middle, falling
    const peak = speechLevel(fat, 5900 + 1.5 * 55);
    expect(peak).toBeGreaterThan(0.75);
    expect(speechLevel(fat, 5900 + 0.1 * 55)).toBeLessThan(peak);
    expect(speechLevel(fat, 5900 + 2.9 * 55)).toBeLessThan(peak);
    // the level is non-zero only while the subtitle is typing that word
    const t = 5900 + 1.5 * 55;
    expect(saidAt(fat, t)).toBe("Ar");
  });

  it("shouts a word in capitals", () => {
    // "FAT?" starts at 7450, 70 ms a letter; its peak is louder than an ordinary word's
    const shout = Math.max(...[0, 0.5, 1, 1.5, 2, 2.5].map((k) => speechLevel(fat, 7450 + k * 70)));
    expect(shout).toBeGreaterThan(0.95);
    const plain = Math.max(...[0, 0.5, 1, 1.5, 2, 2.5].map((k) => speechLevel(fat, 5900 + k * 55)));
    expect(plain).toBeLessThan(shout);
  });

  it("gives the people's lines a speaking pace and finds a speaker across a scene", () => {
    const scale = SCENES.find((s) => s.id === "scale")!;
    expect(voiceOf(scale, "agent", 8700 + 1.5 * PEOPLE_MS)).toBeGreaterThan(0);
    expect(voiceOf(scale, "host", 8700 + 1.5 * PEOPLE_MS)).toBe(0);
    expect(voiceOf(scale, "bag", 5900 + 1.5 * 55)).toBeGreaterThan(0);
  });

  it("is present smoothly across a line, rising before it and falling after", () => {
    const scale = SCENES.find((s) => s.id === "scale")!;
    expect(presence(scale, "bag", 5000)).toBe(0);
    expect(presence(scale, "bag", 5900 - 75)).toBeGreaterThan(0);
    expect(presence(scale, "bag", 5900 - 75)).toBeLessThan(1);
    // inside a word and in the gap between words, the bag is still speaking
    expect(presence(scale, "bag", 5900 + 3.5 * 55)).toBe(1);
    expect(speechLevel(fat, 5900 + 3.5 * 55)).toBe(0);
    // "FAT?" ends at 7450 + 4 * 70; it has let go 350 ms later
    expect(presence(scale, "bag", 7450 + 280 + 100)).toBeGreaterThan(0);
    expect(presence(scale, "bag", 7450 + 280 + 400)).toBe(0);
    const v = bagVoice(scale, 5900 + 1.5 * 55);
    expect(v.on).toBe(1);
    expect(v.level).toBeGreaterThan(0.75);
  });
});
