// The loudness envelope stored with each voice-over clip, the level read from it for the animation, the reading of
// WAV audio on the server, and the byte ranges of the public route. No database.
import { describe, expect, it } from "vitest";
import { ENVELOPE_RATE, decodeEnvelope, encodeEnvelope, envelopeOf, levelAt } from "@/lib/voice/envelope";
import { AudioDecodeError, decodeAudio } from "@/lib/voice/decode";
import { byteRange } from "@/lib/voice/range";
import { speechLevel } from "@/components/welcome/scenes/voiceTrack";
import { toneWav } from "./helpers";

const RATE = 24000;
const tone = (windows: number[]) => {
  const size = RATE / ENVELOPE_RATE;
  const out = new Float32Array(windows.length * size);
  for (let i = 0; i < out.length; i++) out[i] = Math.sin((2 * Math.PI * 250 * i) / RATE) * windows[Math.floor(i / size)]!;
  return out;
};

describe("the loudness envelope", () => {
  it("has fifty values a second, 255 for the loudest window, 0 for silence and for 30 dB down", () => {
    const e = envelopeOf(tone([0, 1, 0.5, 10 ** (-30 / 20), 0.001, 1]), RATE);
    expect(ENVELOPE_RATE).toBe(50);
    expect(e).toHaveLength(6);
    expect(e[0]).toBe(0);
    expect(e[1]).toBe(255);
    // half the amplitude is 6 dB down: a fifth of the way to the floor
    expect(e[2]! / 255).toBeCloseTo(1 - 6.02 / 30, 1);
    expect(e[3]).toBeLessThanOrEqual(1);
    expect(e[4]).toBe(0);
    expect(e[5]).toBe(255);
  });

  it("is all zero for silence, and empty for less than one window", () => {
    expect([...envelopeOf(new Float32Array(RATE), RATE)].every((v) => v === 0)).toBe(true);
    expect(envelopeOf(new Float32Array(100), RATE)).toHaveLength(0);
  });

  it("survives being stored as text, and text that is not an envelope is an empty one", () => {
    const e = envelopeOf(tone([0, 0.2, 1, 0.7, 0.1]), RATE);
    expect([...decodeEnvelope(encodeEnvelope(e))]).toEqual([...e]);
    expect(decodeEnvelope("not base64!")).toHaveLength(0);
  });

  it("gives the level at a moment, between the two nearest values, and 0 outside the clip", () => {
    const e = new Uint8Array([0, 255, 51]);
    expect(levelAt(e, 0)).toBe(0);
    expect(levelAt(e, 0.02)).toBe(1);
    expect(levelAt(e, 0.01)).toBeCloseTo(0.5, 5);
    expect(levelAt(e, 0.03)).toBeCloseTo(0.6, 5);
    expect(levelAt(e, 0.05)).toBeCloseTo(0.1, 5); // fading out of the last value
    expect(levelAt(e, 0.06)).toBe(0);
    expect(levelAt(e, -1)).toBe(0);
    expect(levelAt(e, Number.NaN)).toBe(0);
    expect(levelAt(new Uint8Array(), 1)).toBe(0);
  });

  it("is read per cue from the page's manifest; a cue with no clip is silent", () => {
    const manifest = { "scale-fat": { url: "/x", seconds: 0.06, envelope: encodeEnvelope(new Uint8Array([0, 255, 51])) } };
    expect(speechLevel(manifest, "scale-fat", 0.02)).toBe(1);
    expect(speechLevel(manifest, "scale-fat", 9)).toBe(0);
    expect(speechLevel(manifest, "toss-ow", 0.02)).toBe(0);
  });
});

describe("reading a clip on the server", () => {
  it("reads a 16-bit WAV to mono samples whose envelope is the loudness it was made with", async () => {
    const a = await decodeAudio(toneWav([0, 1, 1, 0.5, 0, 0]));
    expect(a.mime).toBe("audio/wav");
    expect(a.sampleRate).toBe(24000);
    expect(a.seconds).toBeCloseTo(0.12, 5);
    const e = envelopeOf(a.samples, a.sampleRate);
    expect([e[0], e[1], e[2], e[4], e[5]]).toEqual([0, 255, 255, 0, 0]);
    expect(e[3]! / 255).toBeCloseTo(0.8, 1);
  });

  it("reads a WAV written as a stream, whose length says 0xffffffff", async () => {
    const wav = Buffer.from(toneWav([1, 1, 1]));
    wav.writeUInt32LE(0xffffffff, 4);
    wav.writeUInt32LE(0xffffffff, 40);
    expect((await decodeAudio(new Uint8Array(wav))).seconds).toBeCloseTo(0.06, 5);
  });

  it("refuses what is neither MP3 nor WAV, and an MP3 with no audio in it, with a plain sentence", async () => {
    await expect(decodeAudio(new TextEncoder().encode("<html>not audio</html>"))).rejects.toThrow(AudioDecodeError);
    await expect(decodeAudio(new TextEncoder().encode("ID3-fake-mp3-bytes"))).rejects.toThrow(/no audio/);
  });
});

describe("the byte range of an audio request", () => {
  it("reads the three forms an audio element sends", () => {
    expect(byteRange("bytes=0-", 1000)).toEqual({ start: 0, end: 999 });
    expect(byteRange("bytes=100-199", 1000)).toEqual({ start: 100, end: 199 });
    expect(byteRange("bytes=-200", 1000)).toEqual({ start: 800, end: 999 });
    expect(byteRange("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
  });
  it("answers the whole clip without a usable header, and names a range past the end as unsatisfiable", () => {
    expect(byteRange(null, 1000)).toBeNull();
    expect(byteRange("items=0-5", 1000)).toBeNull();
    expect(byteRange("bytes=0-1,5-9", 1000)).toBeNull();
    expect(byteRange("bytes=-", 1000)).toBeNull();
    expect(byteRange("bytes=1000-", 1000)).toBe("unsatisfiable");
    expect(byteRange("bytes=5-2", 1000)).toBe("unsatisfiable");
    expect(byteRange("bytes=-0", 1000)).toBe("unsatisfiable");
  });
});
