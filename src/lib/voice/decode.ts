// Reads a voice-over clip into mono samples on the server, so its length and loudness envelope can be measured when
// an administrator accepts a take. WAV is read here by hand (PCM of 8, 16, 24 or 32 bits and 32-bit float). MP3 is
// decoded by mpg123-decoder: mpg123 compiled to WebAssembly and carried inside the package as text, so there is no
// native module to build and nothing to install in the container. Other formats are refused with a plain sentence.
import { MPEGDecoder } from "mpg123-decoder";

export type DecodedAudio = { samples: Float32Array; sampleRate: number; seconds: number; mime: "audio/mpeg" | "audio/wav" };

/** A clip that cannot be measured, with a sentence safe to show. */
export class AudioDecodeError extends Error {}

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));

function isMp3(b: Uint8Array) {
  if (b.length < 4) return false;
  if (ascii(b, 0, 3) === "ID3") return true;
  // a frame header: eleven set bits, then a version and layer that are not reserved
  return b[0] === 0xff && (b[1]! & 0xe0) === 0xe0 && (b[1]! & 0x18) !== 0x08 && (b[1]! & 0x06) !== 0;
}

function decodeWav(b: Uint8Array): DecodedAudio {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let at = 12;
  let fmt: { format: number; channels: number; rate: number; bits: number } | null = null;
  while (at + 8 <= b.length) {
    const id = ascii(b, at, 4);
    const declared = v.getUint32(at + 4, true);
    const body = at + 8;
    // a stream written before its length was known says 0 or 0xffffffff: the data then runs to the end
    const size = Math.min(declared === 0xffffffff || (id === "data" && declared === 0) ? b.length - body : declared, b.length - body);
    if (id === "fmt " && size >= 16) {
      let format = v.getUint16(body, true);
      if (format === 0xfffe && size >= 26) format = v.getUint16(body + 24, true);
      fmt = { format, channels: v.getUint16(body + 2, true), rate: v.getUint32(body + 4, true), bits: v.getUint16(body + 14, true) };
    } else if (id === "data") {
      if (!fmt || !fmt.channels || !fmt.rate) break;
      const bytes = fmt.bits / 8;
      const float = fmt.format === 3 && fmt.bits === 32;
      if (!float && !(fmt.format === 1 && [8, 16, 24, 32].includes(fmt.bits))) throw new AudioDecodeError("This WAV file's encoding is not one this app measures (PCM or 32-bit float).");
      const frames = Math.floor(size / (bytes * fmt.channels));
      const samples = new Float32Array(frames);
      for (let f = 0; f < frames; f++) {
        let sum = 0;
        for (let c = 0; c < fmt.channels; c++) {
          const p = body + (f * fmt.channels + c) * bytes;
          if (float) sum += v.getFloat32(p, true);
          else if (fmt.bits === 8) sum += (v.getUint8(p) - 128) / 128;
          else if (fmt.bits === 16) sum += v.getInt16(p, true) / 32768;
          else if (fmt.bits === 24) sum += ((v.getInt8(p + 2) << 16) | (v.getUint8(p + 1) << 8) | v.getUint8(p)) / 8388608;
          else sum += v.getInt32(p, true) / 2147483648;
        }
        samples[f] = sum / fmt.channels;
      }
      return { samples, sampleRate: fmt.rate, seconds: frames / fmt.rate, mime: "audio/wav" };
    }
    at = body + size + (size % 2);
  }
  throw new AudioDecodeError("This WAV file has no audio this app can read.");
}

async function decodeMp3(b: Uint8Array): Promise<DecodedAudio> {
  const decoder = new MPEGDecoder();
  try {
    await decoder.ready;
    const out = decoder.decode(b);
    if (!out.samplesDecoded || !out.sampleRate || !out.channelData.length) throw new AudioDecodeError("This MP3 file has no audio this app can read.");
    const n = out.samplesDecoded;
    const samples = new Float32Array(n);
    for (const ch of out.channelData) for (let i = 0; i < n; i++) samples[i] = samples[i]! + ch[i]! / out.channelData.length;
    return { samples, sampleRate: out.sampleRate, seconds: n / out.sampleRate, mime: "audio/mpeg" };
  } finally {
    decoder.free();
  }
}

/** The clip as mono samples. MP3 and WAV only, told apart by their first bytes, never by a name or a declared type. */
export async function decodeAudio(bytes: Uint8Array): Promise<DecodedAudio> {
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") return decodeWav(bytes);
  if (isMp3(bytes)) return decodeMp3(bytes);
  throw new AudioDecodeError("The voice-over must be MP3 or WAV to be measured and stored. Ask the speech service for MP3.");
}
