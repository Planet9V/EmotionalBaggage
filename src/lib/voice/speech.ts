// Text to speech for narration, behind one interface (owner ruling, 22 Nov: an option set in Admin, Voice; none by
// default; voice-overs through Kokoro or OpenRouter, with the model and voice picked there).
//  - "kokoro": a Kokoro server the admin runs, reached at the address saved in Admin, Voice through its
//    OpenAI-compatible speech interface: POST {base}/audio/speech { model, voice, input, speed } answers the audio;
//    GET {base}/audio/voices and GET {base}/models list what it offers (listVoices, listSpeechModels).
//  - "openrouter": OpenRouter's speech API with the OpenRouter key and address AI models already use:
//    POST {base}/audio/speech { model, input, voice, response_format } answers the audio; GET
//    {base}/models?output_modalities=speech lists the speech models, each with its supported_voices.
// Settings are the row "voice.tts"; an optional Kokoro key is the credential "kokoro", only sent to the address it was
// saved for. Audio is answered in memory as bytes and a content type, and never written anywhere by this module: the
// voice-overs tool that stores clips does that through the files store.
import { DEFAULT_BASE_URL, embeddingModel, getSetting, reasoningModel, SETTING, type ModelChoice } from "@/lib/settings";
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

/**
 * OpenRouter's address and key, as the AI models use them (no second key): the address of a saved OpenRouter model
 * (reasoning first, then embedding), else OpenRouter's own; the key is the credential openrouter.apiKey, only ever sent
 * to the host it was saved for (src/lib/secretOrigin.ts).
 */
async function openRouterTarget(): Promise<{ base: string; key: string } | { reason: string }> {
  const [r, e] = await Promise.all([reasoningModel(), embeddingModel()]);
  const chosen = [r, e].find((c): c is ModelChoice => !!c && typeof c === "object" && c.provider === "openrouter");
  const base = (chosen?.baseUrl || DEFAULT_BASE_URL.openrouter).replace(/\/+$/, "");
  const k = await secretFor("openrouter", "apiKey", base);
  if (k.refused) return { reason: boundElsewhere("OpenRouter", k.boundTo, base) };
  if (!k.value) return { reason: "OpenRouter is chosen, but no OpenRouter key is saved. Add it in Admin, AI models." };
  return { base, key: k.value };
}

const checkText = (text: string) => {
  if (!text.trim()) throw new SpeechError("There is no text to speak.");
  if (text.length > MAX_SPEECH_CHARS) throw new SpeechError(`One piece of narration may be at most ${MAX_SPEECH_CHARS} characters.`);
};

/** The synthesizer in force, or why there is none. Never throws. synthesize() answers bytes and a content type. */
export async function getSpeechSynthesizer(): Promise<{ configured: true; synth: SpeechSynthesizer; settings: VoiceReady } | { configured: false; reason: string }> {
  const s = await readVoiceSettings();
  if (s.provider === "none") return { configured: false, reason: NOT_SET_UP };
  if (s.provider === "openrouter") {
    // POST {base}/audio/speech { model, input, voice, response_format } answers the audio bytes (OpenRouter's speech
    // API, OpenAI Audio Speech compatible; read by the project manager on 22 Nov 2026, not reachable from the build machine).
    const t = await openRouterTarget();
    if ("reason" in t) return { configured: false, reason: t.reason };
    return {
      configured: true,
      settings: s,
      synth: {
        async synthesize(text, opts = {}) {
          checkText(text);
          return post(`${t.base}/audio/speech`, { authorization: `Bearer ${t.key}` }, { model: s.model, input: text, voice: s.voice, response_format: "mp3" }, opts.timeoutMs ?? 30_000, "OpenRouter");
        },
      },
    };
  }
  const base = s.baseUrl;
  const k = await secretFor("kokoro", "apiKey", base);
  if (k.refused) return { configured: false, reason: boundElsewhere("Kokoro", k.boundTo, base) };
  const key = k.value;
  return {
    configured: true,
    settings: s,
    synth: {
      async synthesize(text, opts = {}) {
        checkText(text);
        return post(`${base}/audio/speech`, key ? { authorization: `Bearer ${key}` } : {}, { model: s.model, voice: s.voice, input: text, speed: s.speed, response_format: "mp3" }, opts.timeoutMs ?? 30_000, "The Kokoro server");
      },
    },
  };
}

// --- Pickers: what a Kokoro server or OpenRouter offers -------------------------------------------------------

/** A list for a picker, or why there is none (the form then takes free text). */
export type Offered = { ok: true; items: string[] } | { ok: false; reason: string };

/** The most a list answer may be; a bigger one is not read (it is a list of names). */
const MAX_LIST_BYTES = 1024 * 1024;
const MAX_ITEMS = 500;
const FREE = "Type the name instead.";

/** GET JSON from a speech service. Fixed sentences on failure; the remote body is never repeated. */
async function getJson(url: string, key: string | null, who: string, what: string, ms: number): Promise<{ ok: true; json: unknown } | { ok: false; reason: string }> {
  let res: Response;
  try {
    res = await safeFetch(url, { headers: key ? { authorization: `Bearer ${key}` } : {}, redirect: "manual", signal: AbortSignal.timeout(ms) });
  } catch (e) {
    const refused = blockedIn(e);
    if (refused) return { ok: false, reason: blockedSentence(refused) };
    const err = e as { name?: string };
    if (err.name === "TimeoutError" || err.name === "AbortError") return { ok: false, reason: `${who} did not list its ${what} within ${Math.round(ms / 1000)} seconds. ${FREE}` };
    return { ok: false, reason: `${who} could not be reached to list its ${what}. ${FREE}` };
  }
  if (res.status !== 200) {
    await res.body?.cancel().catch(() => undefined);
    return { ok: false, reason: `${who} does not list its ${what} (HTTP ${res.status}). ${FREE}` };
  }
  try {
    const bytes = await readCapped(res, who, MAX_LIST_BYTES);
    return { ok: true, json: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, reason: `${who}'s list of ${what} could not be read. ${FREE}` };
  }
}

/** Plain names only (a string, or an object's id or name); anything else is dropped. */
function namesOf(list: unknown[]): string[] {
  const names = list
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? ((x as { id?: unknown; name?: unknown }).id ?? (x as { name?: unknown }).name) : null))
    .filter((x): x is string => typeof x === "string" && /^[\w.:@/+-]{1,100}$/.test(x));
  return [...new Set(names)].slice(0, MAX_ITEMS);
}

/** Where a Kokoro list comes from: the address given (the form, before saving) or the saved one, with the key only for its own host. */
async function kokoroTarget(baseUrl?: string): Promise<{ base: string; key: string | null } | { reason: string }> {
  const saved = await readVoiceSettings();
  const base = baseUrl ?? (saved.provider === "kokoro" ? saved.baseUrl : null);
  if (!base) return { reason: "Enter the Kokoro server's address first." };
  const k = await secretFor("kokoro", "apiKey", base);
  return { base, key: k.refused ? null : k.value };
}

/** OpenRouter's speech models: GET {base}/models?output_modalities=speech, each with supported_voices. */
async function openRouterSpeechModels(ms: number): Promise<{ ok: true; models: unknown[] } | { ok: false; reason: string }> {
  const t = await openRouterTarget();
  if ("reason" in t) return { ok: false, reason: t.reason };
  const r = await getJson(`${t.base}/models?output_modalities=speech`, t.key, "OpenRouter", "speech models", ms);
  if (!r.ok) return r;
  const data = (r.json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return { ok: false, reason: `OpenRouter answered, but not with a list of speech models. ${FREE}` };
  return { ok: true, models: data };
}

type ListOptions = { provider?: "kokoro" | "openrouter"; baseUrl?: string; model?: string; timeoutMs?: number };

/** The provider to list for: the one asked for, else the saved one, else Kokoro. */
async function providerOf(o: ListOptions): Promise<"kokoro" | "openrouter"> {
  if (o.provider) return o.provider;
  const s = await readVoiceSettings();
  return s.provider === "openrouter" ? "openrouter" : "kokoro";
}

/**
 * The voices on offer, for the voice picker. Never throws.
 *  - Kokoro: GET {base}/audio/voices.
 *  - OpenRouter: the chosen model's supported_voices, from its list of speech models.
 */
export async function listVoices(o: ListOptions = {}): Promise<Offered> {
  const ms = o.timeoutMs ?? 10_000;
  if ((await providerOf(o)) === "openrouter") {
    const model = o.model ?? (await readVoiceSettings().then((s) => (s.provider === "openrouter" ? s.model : undefined)));
    if (!model) return { ok: false, reason: "Choose a model first: the voices depend on it." };
    const r = await openRouterSpeechModels(ms);
    if (!r.ok) return r;
    const m = r.models.find((x) => (x as { id?: unknown })?.id === model) as { supported_voices?: unknown } | undefined;
    if (!m) return { ok: false, reason: `That model is not in OpenRouter's list of speech models. ${FREE}` };
    if (!Array.isArray(m.supported_voices) || !m.supported_voices.length) return { ok: false, reason: "OpenRouter did not list the voices of that model. Type the voice instead." };
    return { ok: true, items: namesOf(m.supported_voices) };
  }
  const t = await kokoroTarget(o.baseUrl);
  if ("reason" in t) return { ok: false, reason: t.reason };
  const r = await getJson(`${t.base}/audio/voices`, t.key, "The server", "voices", ms);
  if (!r.ok) return r;
  const v = (r.json as { voices?: unknown })?.voices ?? r.json;
  return Array.isArray(v) ? { ok: true, items: namesOf(v) } : { ok: false, reason: `The server answered, but not with a list of voices. ${FREE}` };
}

/**
 * The models on offer, for the model picker. Never throws.
 *  - Kokoro: GET {base}/models (the OpenAI list shape).
 *  - OpenRouter: GET {base}/models?output_modalities=speech, the models that produce speech.
 */
export async function listSpeechModels(o: ListOptions = {}): Promise<Offered> {
  const ms = o.timeoutMs ?? 10_000;
  if ((await providerOf(o)) === "openrouter") {
    const r = await openRouterSpeechModels(ms);
    return r.ok ? { ok: true, items: namesOf(r.models) } : r;
  }
  const t = await kokoroTarget(o.baseUrl);
  if ("reason" in t) return { ok: false, reason: t.reason };
  const r = await getJson(`${t.base}/models`, t.key, "The server", "models", ms);
  if (!r.ok) return r;
  const d = (r.json as { data?: unknown })?.data;
  return Array.isArray(d) ? { ok: true, items: namesOf(d) } : { ok: false, reason: `The server answered, but not with a list of models. ${FREE}` };
}
