// The loudness envelope of a voice-over clip: about fifty values a second, each 0 to 1, stored with the clip and sent
// to the page with it, so a character's mouth (the tag's speaker grille) can move with the speech without the browser
// analysing any audio. A value is the loudness of one 20 ms window against the clip's loudest window: the loudest is
// 1, and a window 30 dB or more below it is 0. Pure, and the same in the browser and on the server.

/** Values a second. */
export const ENVELOPE_RATE = 50;
/** A window this far below the clip's loudest window is silence. */
const FLOOR_DB = 30;

/** The envelope of mono samples (-1 to 1): one byte (0 to 255) per whole 20 ms window. */
export function envelopeOf(samples: Float32Array, sampleRate: number): Uint8Array {
  const size = Math.max(1, Math.floor(sampleRate / ENVELOPE_RATE));
  const count = Math.floor(samples.length / size);
  const rms = new Float64Array(count);
  let loudest = 0;
  for (let w = 0; w < count; w++) {
    let sum = 0;
    for (let i = w * size; i < (w + 1) * size; i++) sum += samples[i]! * samples[i]!;
    rms[w] = Math.sqrt(sum / size);
    if (rms[w]! > loudest) loudest = rms[w]!;
  }
  const out = new Uint8Array(count);
  if (loudest <= 0) return out;
  for (let w = 0; w < count; w++) {
    const db = 20 * Math.log10(Math.max(rms[w]!, 1e-9) / loudest);
    out[w] = Math.round(Math.min(1, Math.max(0, 1 + db / FLOOR_DB)) * 255);
  }
  return out;
}

/** The envelope as text (base64 of its bytes), the form it is stored and sent in. */
export function encodeEnvelope(e: Uint8Array): string {
  let s = "";
  for (const b of e) s += String.fromCharCode(b);
  return btoa(s);
}

/** The bytes of a stored envelope; text that is not base64 is an empty envelope. */
export function decodeEnvelope(text: string): Uint8Array {
  try {
    const s = atob(text);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array();
  }
}

/** The speech level (0 to 1) `seconds` into a clip, between the two nearest values; 0 before it starts and after it ends. */
export function levelAt(envelope: Uint8Array, seconds: number): number {
  if (!(seconds >= 0) || !envelope.length) return 0;
  const at = seconds * ENVELOPE_RATE;
  const i = Math.floor(at);
  if (i >= envelope.length) return 0;
  const a = envelope[i]!;
  const b = i + 1 < envelope.length ? envelope[i + 1]! : 0;
  return (a + (b - a) * (at - i)) / 255;
}
