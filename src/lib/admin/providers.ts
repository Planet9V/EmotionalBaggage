// The outside services that hold credentials, and the fields each one takes.
// Admin builds one card per provider from this list; the credentials routes refuse anything not in it.
// Provider ids come from PROVIDERS in src/lib/settings.ts, so the reader and the registry cannot drift apart.
import { PROVIDERS, type Provider } from "@/lib/settings";

export type CredentialField = {
  /** the field name stored in credentials.field */
  name: string;
  label: string;
  /** a secret is never returned in full: at most its last four characters */
  secret: boolean;
  /** every required field must have a value for the provider to count as configured */
  required: boolean;
};

export type ProviderDef = {
  id: Provider;
  label: string;
  /** what it is used for, in one line */
  purpose: string;
  fields: CredentialField[];
};

const key = (required: boolean): CredentialField => ({ name: "apiKey", label: "API key", secret: true, required });

const DEFS: Record<Provider, Omit<ProviderDef, "id">> = {
  ollama: {
    label: "Ollama",
    purpose: "Runs models on your own machine. A local Ollama needs no key; one behind a proxy may.",
    fields: [key(false)],
  },
  lmstudio: {
    label: "LM Studio",
    purpose: "Runs models on your own machine. A key is needed only if you switched one on in LM Studio.",
    fields: [key(false)],
  },
  openrouter: {
    label: "OpenRouter",
    purpose: "Hosted models from many vendors through one account.",
    fields: [key(true)],
  },
  perplexity: {
    label: "Perplexity",
    purpose: "Research: web answers with citations.",
    fields: [key(true)],
  },
  "amazon-sp": {
    label: "Amazon Selling Partner API",
    purpose: "Sales monitor: orders and revenue from Seller Central.",
    fields: [
      { name: "refreshToken", label: "Refresh token", secret: true, required: true },
      { name: "clientId", label: "Client ID", secret: true, required: true },
      { name: "clientSecret", label: "Client secret", secret: true, required: true },
    ],
  },
  x: {
    label: "X",
    purpose: "Marketing: post approved drafts and read replies.",
    fields: [{ name: "accessToken", label: "Access token", secret: true, required: true }],
  },
  instagram: {
    label: "Instagram",
    purpose: "Marketing: post approved drafts and read comments.",
    fields: [
      { name: "accessToken", label: "Access token", secret: true, required: true },
      { name: "accountId", label: "Account ID", secret: false, required: true },
    ],
  },
};

/** Every provider, in the order of PROVIDERS. */
export const PROVIDER_DEFS: ProviderDef[] = PROVIDERS.map((id) => ({ id, ...DEFS[id] }));

export const isProvider = (v: string): v is Provider => (PROVIDERS as readonly string[]).includes(v);

export function providerDef(id: string): ProviderDef | undefined {
  return PROVIDER_DEFS.find((p) => p.id === id);
}

export function fieldDef(provider: string, field: string): CredentialField | undefined {
  return providerDef(provider)?.fields.find((f) => f.name === field);
}

/** Secrets of 12 characters or more show their last four; shorter secrets show nothing. */
export const LAST_FOUR_MIN_LENGTH = 12;

export function lastFour(value: string | null | undefined): string | null {
  if (!value || value.length < LAST_FOUR_MIN_LENGTH) return null;
  return value.slice(-4);
}
