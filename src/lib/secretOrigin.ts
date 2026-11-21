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
import { DEFAULT_BASE_URL, embeddingModel, getCredential, reasoningModel, type ModelChoice, type Provider } from "@/lib/settings";

/** Address of the Perplexity API; tests point it at the stand-in with PERPLEXITY_BASE_URL. */
export const PERPLEXITY_DEFAULT_BASE_URL = "https://api.perplexity.ai";
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
  return builtInOrigin(provider);
}

/**
 * Where a saved secret may go: its recorded origin, binding an older value (saved before 0024) on
 * first read; for a value from the environment, the built-in address. Null when nothing is set.
 */
export async function boundOrigin(provider: Provider, field: string): Promise<string | null> {
  const rows = await q<{ bound_origin: string | null }>("SELECT bound_origin FROM credentials WHERE provider=$1 AND field=$2", [provider, field]);
  if (!rows.length) return (await getCredential(provider, field)) ? builtInOrigin(provider) : null;
  if (rows[0].bound_origin) return rows[0].bound_origin;
  const o = await currentOrigin(provider);
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
  const target = originOf(url);
  if (!boundTo || !target || boundTo !== target) return { value: null, boundTo, refused: true };
  return { value, boundTo, refused: false };
}

/** The secret, or null when none is saved or it belongs to another host. */
export async function getSecretFor(provider: Provider, field: string, url: string): Promise<string | null> {
  return (await secretFor(provider, field, url)).value;
}

/** A sentence for the screen when a saved key was not sent because the address is on another host. */
export function boundElsewhere(label: string, boundTo: string | null, url: string): string {
  return `The saved ${label} key was not sent: it is only sent to ${boundTo ?? "the address it was saved for"}, and ${originOf(url) ?? url} is a different host. Type the key again for this address (saving it binds it to the new host).`;
}
