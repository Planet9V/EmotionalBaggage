// The speech models the configured voice service offers, for Admin, Voice-overs: each with its voices, its supported
// parameters, its price per character when the service lists one, and how a performance direction reaches it.
//  - OpenRouter: GET {base}/models?output_modalities=speech (each model with supported_voices and pricing) and
//    GET {base}/audio/speech/models (each model's supported parameters, such as `instructions`). Both read at run time;
//    nothing about a model is hard-coded here except the bracket-cue family test in ./direction.ts.
//  - Kokoro: GET {base}/models and GET {base}/audio/voices. Kokoro takes no direction: "no emotion control: for drafts".
// The answers' shapes are read leniently (OpenRouter's documentation was read by the project manager on 22 Nov 2026;
// the real service is not reachable from the build machine). Never throws.
import { KOKORO_NOTE, directionModeOf, type DirectionMode } from "./direction";
import { getJson, kokoroTarget, namesOf, openRouterTarget, readVoiceSettings } from "./speech";

export type CatalogModel = {
  id: string;
  name: string | null;
  voices: string[];
  /** the request parameters the model lists, lower case */
  parameters: string[];
  /** US dollars per character of input, when the service lists a price per character */
  pricePerChar: number | null;
  mode: DirectionMode;
  modeWhy: string;
  /** a warning shown beside the model, such as Kokoro's */
  note: string | null;
  description: string | null;
};
export type Catalog = { provider: "kokoro" | "openrouter"; ok: true; models: CatalogModel[] } | { provider: "kokoro" | "openrouter" | null; ok: false; reason: string };

const MS = 10_000;

const str = (v: unknown) => (typeof v === "string" && v.length <= 400 ? v : null);
const plainName = (v: unknown) => (typeof v === "string" && /^[\w.:@/+-]{1,100}$/.test(v) ? v : null);

/** A parameter list in any of the forms seen: an array of names, an array of { name }, or an object keyed by name. */
function parametersOf(m: Record<string, unknown>): string[] {
  const raw = m.supported_parameters ?? m.supported_params ?? m.parameters;
  const names = Array.isArray(raw) ? raw.map((x) => (typeof x === "string" ? x : (x as { name?: unknown })?.name)) : raw && typeof raw === "object" ? Object.keys(raw) : [];
  return [...new Set(names.map(plainName).filter((x): x is string => !!x).map((x) => x.toLowerCase()))].slice(0, 50);
}

/** A price per character, only from a pricing field that names characters; a per-token price is not converted. */
function pricePerCharOf(pricing: unknown): number | null {
  if (!pricing || typeof pricing !== "object") return null;
  for (const [k, v] of Object.entries(pricing as Record<string, unknown>)) {
    if (!/char/i.test(k)) continue;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (Number.isFinite(n) && n >= 0 && n < 1) return n;
  }
  return null;
}

const listOf = (json: unknown): Record<string, unknown>[] => {
  const d = Array.isArray(json) ? json : (json as { data?: unknown; models?: unknown })?.data ?? (json as { models?: unknown })?.models;
  return Array.isArray(d) ? d.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];
};

/** The OpenRouter catalogue from its two lists' answers (pure, for tests). */
export function openRouterCatalog(models: unknown, speechModels: unknown): CatalogModel[] {
  const params = new Map<string, string[]>();
  for (const m of listOf(speechModels)) {
    const id = plainName(m.id ?? m.model);
    if (id) params.set(id, parametersOf(m));
  }
  return listOf(models)
    .map((m): CatalogModel | null => {
      const id = plainName(m.id);
      if (!id) return null;
      const parameters = [...new Set([...(params.get(id) ?? []), ...parametersOf(m)])];
      const description = str(m.description);
      const { mode, why } = directionModeOf({ provider: "openrouter", id, parameters, description: description ?? undefined });
      return { id, name: str(m.name), voices: Array.isArray(m.supported_voices) ? namesOf(m.supported_voices) : [], parameters, pricePerChar: pricePerCharOf(m.pricing), mode, modeWhy: why, note: /gpt-4o-mini-tts/i.test(id) ? "OpenAI has announced this model's shutdown on 6 January 2027." : null, description };
    })
    .filter((x): x is CatalogModel => !!x)
    .slice(0, 200);
}

/** The models of the configured voice service. */
export async function speechCatalog(): Promise<Catalog> {
  const s = await readVoiceSettings();
  if (s.provider === "none") return { provider: null, ok: false, reason: "No voice is set up. Choose a provider in Admin, Voice." };
  if (s.provider === "openrouter") {
    const t = await openRouterTarget();
    if ("reason" in t) return { provider: "openrouter", ok: false, reason: t.reason };
    const [models, params] = await Promise.all([getJson(`${t.base}/models?output_modalities=speech`, t.key, "OpenRouter", "speech models", MS), getJson(`${t.base}/audio/speech/models`, t.key, "OpenRouter", "speech parameters", MS)]);
    if (!models.ok) return { provider: "openrouter", ok: false, reason: models.reason };
    return { provider: "openrouter", ok: true, models: openRouterCatalog(models.json, params.ok ? params.json : null) };
  }
  const t = await kokoroTarget();
  if ("reason" in t) return { provider: "kokoro", ok: false, reason: t.reason };
  const [models, voices] = await Promise.all([getJson(`${t.base}/models`, t.key, "The server", "models", MS), getJson(`${t.base}/audio/voices`, t.key, "The server", "voices", MS)]);
  const voiceList = voices.ok ? ((voices.json as { voices?: unknown })?.voices ?? voices.json) : [];
  const names = models.ok ? namesOf(listOf(models.json)) : [s.model];
  const { mode, why } = directionModeOf({ provider: "kokoro", id: s.model, parameters: [] });
  return { provider: "kokoro", ok: true, models: (names.length ? names : [s.model]).map((id) => ({ id, name: null, voices: Array.isArray(voiceList) ? namesOf(voiceList) : [], parameters: ["voice", "speed"], pricePerChar: 0, mode, modeWhy: why, note: KOKORO_NOTE, description: null })) };
}

/** The facts of one model, from a catalogue; a model not in it is treated by its id alone. */
export function factsOf(catalog: Catalog, provider: "kokoro" | "openrouter", id: string) {
  const m = catalog.ok ? catalog.models.find((x) => x.id === id) : undefined;
  return { provider, id, parameters: m?.parameters ?? [], description: m?.description ?? undefined, pricePerChar: provider === "kokoro" ? 0 : (m?.pricePerChar ?? null) };
}
