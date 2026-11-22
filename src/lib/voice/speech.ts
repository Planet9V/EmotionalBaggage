// Text to speech for narration, behind one interface (owner ruling, 22 Nov: an option set in Admin, Voice; none by
// default; voice-overs through Kokoro or OpenRouter, with the model and voice picked there).
//  - "kokoro": a Kokoro server the admin runs, reached at the address saved in Admin, Voice through its
//    OpenAI-compatible speech interface: POST {base}/audio/speech { model, voice, input, speed } answers the audio;
//    GET {base}/audio/voices and GET {base}/models list what it offers (listVoices, listSpeechModels).
//  - "openrouter": listed but NOT offered (see VOICE_PROVIDERS): its speech output could not be confirmed against
//    OpenRouter's documentation, so nothing here pretends to speak through it.
// Settings are the row "voice.tts"; an optional Kokoro key is the credential "kokoro", only sent to the address it was
// saved for. Audio is answered in memory as bytes and a content type, and never written anywhere by this module: the
// voice-overs tool that stores clips does that through the files store.
import { getSetting, SETTING } from "@/lib/settings";
import { boundElsewhere, secretFor } from "@/lib/secretOrigin";
import { blockedIn, blockedSentence, safeFetch } from "@/lib/net/outbound";
import { voiceSettings, type VoiceSettings } from "@/lib/admin/schemas";

/** One spoken piece: the bytes and their content type (audio/mpeg, audio/wav, ...). */
type SpeechAudio = { audio: Uint8Array; contentType: string };

export type SpeechSynthesizer = { synthesize(text: string, opts?: { timeoutMs?: number }): Promise<SpeechAudio> };

/** The longest text one call may send; narration is cut into pieces by the caller. */
const MAX_SPEECH_CHARS = 4000;

export type VoiceReady = Exclude<VoiceSettings, { provider: "none" }>;

export type VoiceSetup =
  | { configured: false; reason: string }
  | ({ configured: true } & VoiceReady);

const NOT_SET_UP = "No voice is set up, so narration is off. Choose a provider in Admin, Voice.";

/** The saved voice settings; provider "none" when nothing valid is saved. */
export async function readVoiceSettings(): Promise<VoiceSettings> {
  const r = voiceSettings.safeParse(await getSetting<unknown>(SETTING.voice, null));
  return r.success ? r.data : { provider: "none" };
}

/** Whether narration can run, and with what. Never throws; carries no key. */
export async function getVoiceSettings(): Promise<VoiceSetup> {
  const s = await readVoiceSettings();
  if (s.provider === "none") return { configured: false, reason: NOT_SET_UP };
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

/** Reads at most `max` bytes (2 MB of audio by default); beyond that the read is cancelled and the call refused. */
async function readCapped(res: Response, who: string, max = MAX_AUDIO_BYTES): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > max) {
    await res.body?.cancel().catch(() => undefined);
    throw new SpeechError(`${who} sent more than ${Math.round((max / (1024 * 1024)) * 100) / 100} MB for one answer; it was not read.`);
  }
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      void reader.cancel().catch(() => undefined);
      throw new SpeechError(`${who} sent more than ${Math.round((max / (1024 * 1024)) * 100) / 100} MB for one answer; it was cut off.`);
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

/** The synthesizer in force, or why there is none. Never throws. synthesize() answers bytes and a content type. */
export async function getSpeechSynthesizer(): Promise<{ configured: true; synth: SpeechSynthesizer; settings: VoiceReady } | { configured: false; reason: string }> {
  const s = await readVoiceSettings();
  if (s.provider === "none") return { configured: false, reason: NOT_SET_UP };
  const base = s.baseUrl;
  const k = await secretFor("kokoro", "apiKey", base);
  if (k.refused) return { configured: false, reason: boundElsewhere("Kokoro", k.boundTo, base) };
  const key = k.value;
  return {
    configured: true,
    settings: s,
    synth: {
      async synthesize(text, opts = {}) {
        if (!text.trim()) throw new SpeechError("There is no text to speak.");
        if (text.length > MAX_SPEECH_CHARS) throw new SpeechError(`One piece of narration may be at most ${MAX_SPEECH_CHARS} characters.`);
        return post(`${base}/audio/speech`, key ? { authorization: `Bearer ${key}` } : {}, { model: s.model, voice: s.voice, input: text, speed: s.speed, response_format: "mp3" }, opts.timeoutMs ?? 30_000, "The Kokoro server");
      },
    },
  };
}

// --- Pickers: what a Kokoro server offers ---------------------------------------------------------------------

/** A list for a picker, or why there is none (the form then takes free text). */
export type Offered = { ok: true; items: string[] } | { ok: false; reason: string };

/** The most a list answer may be; a bigger one is not read (it is a list of names). */
const MAX_LIST_BYTES = 256 * 1024;
const MAX_ITEMS = 500;

/** GET a JSON list at a Kokoro address. Fixed sentences on failure; the remote body is never repeated. */
async function getList(url: string, key: string | null, pick: (j: unknown) => unknown[] | null, what: string, ms: number): Promise<Offered> {
  let res: Response;
  try {
    res = await safeFetch(url, { headers: key ? { authorization: `Bearer ${key}` } : {}, redirect: "manual", signal: AbortSignal.timeout(ms) });
  } catch (e) {
    const refused = blockedIn(e);
    if (refused) return { ok: false, reason: blockedSentence(refused) };
    const err = e as { name?: string; cause?: { code?: string } };
    if (err.name === "TimeoutError" || err.name === "AbortError") return { ok: false, reason: `The server did not list its ${what} within ${Math.round(ms / 1000)} seconds. Type the name instead.` };
    return { ok: false, reason: `The server could not be reached to list its ${what}. Type the name instead.` };
  }
  if (res.status !== 200) {
    await res.body?.cancel().catch(() => undefined);
    return { ok: false, reason: `The server does not list its ${what} (HTTP ${res.status}). Type the name instead.` };
  }
  let j: unknown;
  try {
    const bytes = await readCapped(res, "The server", MAX_LIST_BYTES);
    j = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, reason: `The server's list of ${what} could not be read. Type the name instead.` };
  }
  const list = pick(j);
  if (!list) return { ok: false, reason: `The server answered, but not with a list of ${what}. Type the name instead.` };
  const names = list
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? ((x as { id?: unknown; name?: unknown }).id ?? (x as { name?: unknown }).name) : null))
    .filter((x): x is string => typeof x === "string" && /^[\w.:@/+-]{1,100}$/.test(x));
  return { ok: true, items: [...new Set(names)].slice(0, MAX_ITEMS) };
}

/** Where to list from: the address given (the form, before saving) or the saved one, with the key only for its own host. */
async function listTarget(baseUrl?: string): Promise<{ base: string; key: string | null } | { reason: string }> {
  const saved = await readVoiceSettings();
  const base = baseUrl ?? (saved.provider === "kokoro" ? saved.baseUrl : null);
  if (!base) return { reason: "Enter the Kokoro server's address first." };
  const k = await secretFor("kokoro", "apiKey", base);
  return { base, key: k.refused ? null : k.value };
}

/** The voices a Kokoro server offers (GET {base}/audio/voices), for the voice picker. Never throws. */
export async function listVoices(opts: { baseUrl?: string; timeoutMs?: number } = {}): Promise<Offered> {
  const t = await listTarget(opts.baseUrl);
  if ("reason" in t) return { ok: false, reason: t.reason };
  return getList(`${t.base}/audio/voices`, t.key, (j) => {
    const v = (j as { voices?: unknown })?.voices ?? j;
    return Array.isArray(v) ? v : null;
  }, "voices", opts.timeoutMs ?? 10_000);
}

/** The models a Kokoro server lists (GET {base}/models, the OpenAI list shape), for the model picker. Never throws. */
export async function listSpeechModels(opts: { baseUrl?: string; timeoutMs?: number } = {}): Promise<Offered> {
  const t = await listTarget(opts.baseUrl);
  if ("reason" in t) return { ok: false, reason: t.reason };
  return getList(`${t.base}/models`, t.key, (j) => {
    const d = (j as { data?: unknown })?.data;
    return Array.isArray(d) ? d : null;
  }, "models", opts.timeoutMs ?? 10_000);
}
