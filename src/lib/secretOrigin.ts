// Which host a saved secret may be sent to.
//
// Every credential saved in Admin records the origin (scheme, host and port) it was saved for, in
// credentials.bound_origin (migration 0024). A secret is only ever sent to that origin: callers ask
// for it with the address they are about to call, and get null when the address is somewhere else.
// That stops a signed-in session from pointing a model, Perplexity or a channel at a host of its
// choosing and receiving the saved key there.
//
// - A value saved before migration 0024 has no origin yet. The first read binds it to the address the
//   install uses for that provider at that moment (models: the saved model address; others: their
//   fixed API address), and records the binding.
// - A value from an environment variable is bound to the provider's built-in address only
//   (DEFAULT_BASE_URL for the model hosts, the API host for Perplexity and the channels), because the
//   environment is set by whoever runs the server while the model address can be changed by any
//   signed-in user.
// Printers keep their secrets on the printer row next to the address, so they are bound by that
// row: src/lib/admin/printers.ts (resolveAccess) refuses to carry a saved secret to a new host.
import { q } from "@/lib/db";
import { lwaTokenUrl, igGraphBase, xApiBase } from "@/lib/channels/http";
import { DEFAULT_BASE_URL, embeddingModel, getCredential, getSetting, reasoningModel, SETTING, type ModelChoice, type Provider } from "@/lib/settings";

/** Fixed API addresses of the hosted services. Only tests change them (setServiceBaseForTests), to reach a stand-in. */
const SERVICE_BASE = { stripe: "https://api.stripe.com", openrouter: "https://openrouter.ai/api/v1" };
const serviceBase = { ...SERVICE_BASE };
export function setServiceBaseForTests(name: keyof typeof SERVICE_BASE, url: string | null) {
  serviceBase[name] = url ?? SERVICE_BASE[name];
}
/** OpenRouter's own API, where narration goes (review S3: never the address in the open model settings). */
export const openRouterVoiceBase = () => serviceBase.openrouter;
/** Stripe's API, where its secret key is sent. */
export const stripeApiBase = () => serviceBase.stripe;

/** The binding of an SMTP password: smtp://host:port of the mail server it was saved for (not a web address). */
export function smtpOrigin(host: string | null | undefined, port: number | null | undefined): string | null {
  const h = host?.trim().toLowerCase();
  return h && port ? `smtp://${h}:${port}` : null;
}

/** originOf for a web address, or the smtp:// binding as it is. */
const targetOf = (url: string) => (/^smtp:\/\//i.test(url) ? url.toLowerCase() : originOf(url));

/** Address of the Perplexity API; tests point it at the stand-in with PERPLEXITY_BASE_URL. */
const PERPLEXITY_DEFAULT_BASE_URL = "https://api.perplexity.ai";
export const perplexityBaseUrl = () => (process.env.PERPLEXITY_BASE_URL?.trim() || PERPLEXITY_DEFAULT_BASE_URL).replace(/\/+$/, "");

/** scheme://host[:port] of an address, lower case, default ports left out; null when it is not a URL. */
export function originOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin.toLowerCase();
  } catch {
    return null;
  }
}

const MODEL_PROVIDERS = ["ollama", "lmstudio", "openrouter"] as const;
type ModelProvider = (typeof MODEL_PROVIDERS)[number];
export const isModelProvider = (p: string): p is ModelProvider => (MODEL_PROVIDERS as readonly string[]).includes(p);

/** The built-in address a provider's secrets go to when nothing else says so. */
function builtInOrigin(provider: Provider): string | null {
  if (isModelProvider(provider)) return originOf(DEFAULT_BASE_URL[provider]);
  if (provider === "perplexity") return originOf(perplexityBaseUrl());
  if (provider === "amazon-sp") return originOf(lwaTokenUrl());
  if (provider === "x") return originOf(xApiBase());
  if (provider === "instagram") return originOf(igGraphBase());
  if (provider === "stripe") return originOf(stripeApiBase());
  // kokoro and smtp have no built-in address: the one saved in Admin (currentOrigin)
  return null;
}

/** The model choices saved in Admin that use this provider. */
async function modelChoicesFor(provider: ModelProvider): Promise<ModelChoice[]> {
  const [r, e] = await Promise.all([reasoningModel(), embeddingModel()]);
  return [r, e].filter((c): c is ModelChoice => !!c && typeof c === "object" && c.provider === provider);
}

/**
 * The origin a secret saved now for this provider is bound to: the model address in use for that
 * provider (reasoning first, then embedding), else the built-in address.
 */
export async function currentOrigin(provider: Provider): Promise<string | null> {
  if (isModelProvider(provider)) {
    for (const c of await modelChoicesFor(provider)) {
      const o = originOf(c.baseUrl || DEFAULT_BASE_URL[provider]);
      if (o) return o;
    }
  }
  if (provider === "kokoro") {
    const v = await getSetting<{ baseUrl?: string } | null>(SETTING.voice, null);
    return originOf(v?.baseUrl);
  }
  if (provider === "smtp") {
    const m = await getSetting<{ host?: string; port?: number } | null>(SETTING.mail, null);
    return smtpOrigin(m?.host, m?.port);
  }
  return builtInOrigin(provider);
}

/**
 * Where a saved secret may go: its recorded origin; for a value from the environment, the built-in address. Null when
 * nothing is set. A saved row with no recorded origin (older than 0024) is bound to the provider's built-in address
 * only, never to an address someone could have just changed (review S4; migration 0040 bound the existing ones); a
 * provider with no built-in address (Kokoro, mail) stays unbound, so the secret is not sent until typed again.
 */
export async function boundOrigin(provider: Provider, field: string): Promise<string | null> {
  const rows = await q<{ bound_origin: string | null }>("SELECT bound_origin FROM credentials WHERE provider=$1 AND field=$2", [provider, field]);
  if (!rows.length) return (await getCredential(provider, field)) ? builtInOrigin(provider) : null;
  if (rows[0].bound_origin) return rows[0].bound_origin;
  const o = builtInOrigin(provider);
  if (o) await q("UPDATE credentials SET bound_origin=$3 WHERE provider=$1 AND field=$2 AND bound_origin IS NULL", [provider, field, o]);
  return o;
}

export type SecretFor = { value: string | null; boundTo: string | null; refused: boolean };

/**
 * A saved secret, only when `url` is on the origin it was saved for.
 * `refused` is true when a value exists but belongs to another host.
 */
export async function secretFor(provider: Provider, field: string, url: string): Promise<SecretFor> {
  const value = await getCredential(provider, field);
  if (!value) return { value: null, boundTo: null, refused: false };
  const boundTo = await boundOrigin(provider, field);
  const target = targetOf(url);
  if (!boundTo || !target || boundTo !== target) return { value: null, boundTo, refused: true };
  return { value, boundTo, refused: false };
}

/** The secret, or null when none is saved or it belongs to another host. */
export async function getSecretFor(provider: Provider, field: string, url: string): Promise<string | null> {
  return (await secretFor(provider, field, url)).value;
}

/** A sentence for the screen when a saved key was not sent because the address is on another host. */
export function boundElsewhere(label: string, boundTo: string | null, url: string): string {
  return `The saved ${label} key was not sent: it is only sent to ${boundTo ?? "the address it was saved for"}, and ${targetOf(url) ?? url} is a different host. Type the key again for this address (saving it binds it to the new host).`;
}
