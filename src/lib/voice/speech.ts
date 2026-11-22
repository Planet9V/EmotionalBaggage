// Text to speech for narration, behind one interface. Two optional providers, neither chosen for the owner:
//  - "openai": any service that speaks the OpenAI speech interface (POST {base}/audio/speech with model, voice,
//    input, speed; the answer is the audio). The address is the admin's to set.
//  - "elevenlabs": POST {api}/v1/text-to-speech/{voice_id} with model_id and voice_settings.speed.
// Settings are the row "voice.tts" (Admin, Voice); keys are credentials of "voice-openai" and "elevenlabs", each
// only sent to the host it was saved for. Audio is answered in memory and never written anywhere by this module.
import { getSetting, SETTING } from "@/lib/settings";
import { boundElsewhere, elevenLabsApiBase, secretFor } from "@/lib/secretOrigin";
import { safeFetch } from "@/lib/net/outbound";
import { scrub } from "@/lib/secrets/scrub";
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

async function failure(res: Response, who: string, key: string | null): Promise<SpeechError> {
  let says = "";
  try {
    const j = (await res.json()) as { error?: { message?: string } | string; detail?: { message?: string } | string };
    const e = j.error ?? j.detail;
    says = typeof e === "string" ? e : (e?.message ?? "");
  } catch {
    // not JSON
  }
  const clean = scrub(says, [key]).trim().slice(0, 200);
  if (res.status === 401 || res.status === 403) return new SpeechError(`${who} refused the key (HTTP ${res.status}).${clean ? ` It said: ${clean}` : ""}`, res.status);
  return new SpeechError(`${who} answered HTTP ${res.status}.${clean ? ` It said: ${clean}` : ""}`, res.status);
}

async function post(url: string, headers: Record<string, string>, body: unknown, ms: number, who: string, key: string | null): Promise<SpeechAudio> {
  let res: Response;
  try {
    res = await safeFetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), redirect: "manual", signal: AbortSignal.timeout(ms) });
  } catch (e) {
    const err = e as { name?: string; message?: string; cause?: { code?: string; message?: string } };
    if (err.name === "TimeoutError" || err.name === "AbortError") throw new SpeechError(`${who} did not answer within ${Math.round(ms / 1000)} seconds.`);
    throw new SpeechError(`${who} could not be reached: ${scrub(err.cause?.message ?? err.message ?? "", [key]).slice(0, 200)}`);
  }
  if (res.status !== 200) throw await failure(res, who, key);
  const contentType = res.headers.get("content-type") ?? "";
  if (!/^audio\//i.test(contentType)) {
    await res.body?.cancel().catch(() => undefined);
    throw new SpeechError(`${who} answered, but not with audio (${contentType || "no content type"}). Check the address and model.`);
  }
  return { audio: new Uint8Array(await res.arrayBuffer()), contentType };
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
          return post(`${base}/audio/speech`, key ? { authorization: `Bearer ${key}` } : {}, { model: s.model, voice: s.voice, input: text, speed: s.speed, response_format: "mp3" }, opts.timeoutMs ?? 30_000, "The speech endpoint", key);
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
        return post(`${api}/v1/text-to-speech/${encodeURIComponent(s.voice)}?output_format=mp3_44100_128`, { "xi-api-key": key, accept: "audio/mpeg" }, { text, model_id: s.model, voice_settings: { speed: s.speed } }, opts.timeoutMs ?? 30_000, "ElevenLabs", key);
      },
    },
  };
}
