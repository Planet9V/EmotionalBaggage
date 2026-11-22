// Text to speech for narration, behind one interface. Two optional providers, neither chosen for the owner:
//  - "openai": any service that speaks the OpenAI speech interface (POST {base}/audio/speech with model, voice,
//    input, speed; the answer is the audio). The address is the admin's to set.
//  - "elevenlabs": POST {api}/v1/text-to-speech/{voice_id} with model_id and voice_settings.speed.
// Settings are the row "voice.tts" (Admin, Voice); keys are credentials of "voice-openai" and "elevenlabs", each
// only sent to the host it was saved for. Audio is answered in memory and never written anywhere by this module.
import { getSetting, SETTING } from "@/lib/settings";
import { boundElsewhere, elevenLabsApiBase, secretFor } from "@/lib/secretOrigin";
import { blockedIn, blockedSentence, safeFetch } from "@/lib/net/outbound";
import { voiceSettings, type VoiceSettings } from "@/lib/admin/schemas";

type SpeechAudio = { audio: Uint8Array; contentType: string };

export type SpeechSynthesizer = { synthesize(text: string, opts?: { timeoutMs?: number }): Promise<SpeechAudio> };

/** The longest text one call may send; narration is cut into pieces by the caller. */
const MAX_SPEECH_CHARS = 4000;

export type VoiceReady = Exclude<VoiceSettings, { provider: "none" }>;

export type VoiceSetup =
  | { configured: false; reason: string }
  | ({ configured: true } & VoiceReady);

/** The saved voice settings; provider "none" when nothing valid is saved. */
export async function readVoiceSettings(): Promise<VoiceSettings> {
  const r = voiceSettings.safeParse(await getSetting<unknown>(SETTING.voice, null));
  return r.success ? r.data : { provider: "none" };
}

/** Whether narration can run, and with what. Never throws; carries no key. */
export async function getVoiceSettings(): Promise<VoiceSetup> {
  const s = await readVoiceSettings();
  if (s.provider === "none") return { configured: false, reason: "No voice is set up, so narration is off. Choose a provider in Admin, Voice." };
  if (s.provider === "elevenlabs" && !(await secretFor("elevenlabs", "apiKey", elevenLabsApiBase())).value) {
    return { configured: false, reason: "ElevenLabs is chosen, but no ElevenLabs key is saved. Add it in Admin, Voice." };
  }
  return { configured: true, ...s };
}

/** A speech failure with a sentence safe to show. */
export class SpeechError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "SpeechError";
  }
}

/** The audio formats a narration may come back in; anything else is refused (review F2). */
const AUDIO_TYPES = new Set(["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/aac", "audio/flac"]);
/** The most audio one call may return; the read stops and the call is cut off beyond it (review F2). */
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

/**
 * A fixed sentence and the status code: the remote body is never repeated, because the address may be one the
 * admin typed and the answer could come from any service (review F2).
 */
async function failure(res: Response, who: string): Promise<SpeechError> {
  await res.body?.cancel().catch(() => undefined);
  if (res.status === 401 || res.status === 403) return new SpeechError(`${who} refused the key (HTTP ${res.status}). Check the key.`, res.status);
  if (res.status === 404) return new SpeechError(`${who} has nothing at that path (HTTP 404). Check the address and the model.`, res.status);
  if (res.status === 429) return new SpeechError(`${who} is limiting how fast this account can ask (HTTP 429). Try again shortly.`, res.status);
  if (res.status >= 500) return new SpeechError(`${who} answered with a server error (HTTP ${res.status}).`, res.status);
  return new SpeechError(`${who} answered HTTP ${res.status}. Check the model and voice.`, res.status);
}

/** Reads at most MAX_AUDIO_BYTES; beyond that the read is cancelled and the call refused. */
async function readCapped(res: Response, who: string): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES) {
    await res.body?.cancel().catch(() => undefined);
    throw new SpeechError(`${who} sent more than ${MAX_AUDIO_BYTES / (1024 * 1024)} MB of audio for one piece; the answer was not read.`);
  }
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_AUDIO_BYTES) {
      void reader.cancel().catch(() => undefined);
      throw new SpeechError(`${who} sent more than ${MAX_AUDIO_BYTES / (1024 * 1024)} MB of audio for one piece; the answer was cut off.`);
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}

async function post(url: string, headers: Record<string, string>, body: unknown, ms: number, who: string): Promise<SpeechAudio> {
  let res: Response;
  try {
    res = await safeFetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), redirect: "manual", signal: AbortSignal.timeout(ms) });
  } catch (e) {
    const err = e as { name?: string; message?: string; cause?: { code?: string; message?: string } };
    if (err.name === "TimeoutError" || err.name === "AbortError") throw new SpeechError(`${who} did not answer within ${Math.round(ms / 1000)} seconds.`);
    const refused = blockedIn(e);
    if (refused) throw new SpeechError(blockedSentence(refused));
    const code = err.cause?.code;
    if (code === "ECONNREFUSED") throw new SpeechError("Nothing answered at that address (connection refused). Check the address and that the service is running.");
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") throw new SpeechError("That host name could not be found. Check the address.");
    throw new SpeechError(`${who} could not be reached.`);
  }
  if (res.status !== 200) throw await failure(res, who);
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!AUDIO_TYPES.has(contentType)) {
    await res.body?.cancel().catch(() => undefined);
    throw new SpeechError(`${who} answered, but not with audio this app plays (MP3, WAV, Ogg, WebM, AAC or FLAC). Check the address and model.`);
  }
  return { audio: await readCapped(res, who), contentType };
}

/** The synthesizer in force, or why there is none. Never throws. */
export async function getSpeechSynthesizer(): Promise<{ configured: true; synth: SpeechSynthesizer; settings: VoiceReady } | { configured: false; reason: string }> {
  const s = await readVoiceSettings();
  if (s.provider === "none") return { configured: false, reason: "No voice is set up, so narration is off. Choose a provider in Admin, Voice." };
  const check = (text: string) => {
    if (!text.trim()) throw new SpeechError("There is no text to speak.");
    if (text.length > MAX_SPEECH_CHARS) throw new SpeechError(`One piece of narration may be at most ${MAX_SPEECH_CHARS} characters.`);
  };
  if (s.provider === "openai") {
    const base = s.baseUrl;
    const k = await secretFor("voice-openai", "apiKey", base);
    if (k.refused) return { configured: false, reason: boundElsewhere("speech endpoint", k.boundTo, base) };
    const key = k.value;
    return {
      configured: true,
      settings: s,
      synth: {
        async synthesize(text, opts = {}) {
          check(text);
          return post(`${base}/audio/speech`, key ? { authorization: `Bearer ${key}` } : {}, { model: s.model, voice: s.voice, input: text, speed: s.speed, response_format: "mp3" }, opts.timeoutMs ?? 30_000, "The speech endpoint");
        },
      },
    };
  }
  const api = elevenLabsApiBase();
  const k = await secretFor("elevenlabs", "apiKey", api);
  if (k.refused) return { configured: false, reason: boundElsewhere("ElevenLabs", k.boundTo, api) };
  if (!k.value) return { configured: false, reason: "ElevenLabs is chosen, but no ElevenLabs key is saved. Add it in Admin, Voice." };
  const key = k.value;
  return {
    configured: true,
    settings: s,
    synth: {
      async synthesize(text, opts = {}) {
        check(text);
        return post(`${api}/v1/text-to-speech/${encodeURIComponent(s.voice)}?output_format=mp3_44100_128`, { "xi-api-key": key, accept: "audio/mpeg" }, { text, model_id: s.model, voice_settings: { speed: s.speed } }, opts.timeoutMs ?? 30_000, "ElevenLabs");
      },
    },
  };
}
