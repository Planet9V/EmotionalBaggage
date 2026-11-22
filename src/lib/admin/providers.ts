// The outside services that hold credentials, and the fields each one takes.
// Admin builds one card per provider from this list; the credentials routes refuse anything not in it.
// Provider ids come from PROVIDERS in src/lib/settings.ts, so the reader and the registry cannot drift apart.
import { PROVIDERS, type Provider } from "@/lib/settings";
import { channelName } from "@/lib/channels/registry";

export type CredentialField = {
  /** the field name stored in credentials.field */
  name: string;
  label: string;
  /** a secret is never returned in full: at most its last four characters */
  secret: boolean;
  /** every required field must have a value for the provider to count as configured */
  required: boolean;
  /** a password or signing secret: never shown, not even its last four characters, to anyone */
  noLast4?: boolean;
  /** the shape a value must have, checked on the server before it is saved */
  pattern?: { re: RegExp; problem: string };
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
    purpose: "Sales monitor: orders and daily totals read from Seller Central, read only. Needs a Professional selling account and a private SP-API app.",
    fields: [
      { name: "refreshToken", label: "Refresh token", secret: true, required: true },
      { name: "clientId", label: "Client ID", secret: true, required: true },
      { name: "clientSecret", label: "Client secret", secret: true, required: true },
    ],
  },
  x: {
    label: channelName("x"),
    purpose: "Marketing: send approved posts and replies one at a time, and read mentions. The tokens are filled in by Connect X account.",
    // OAuth 2.0 with PKCE (src/lib/channels/x.ts): the client ID (and secret, for a confidential "Web App"
    // client) come from the X Developer Console; the access and refresh tokens are saved by the callback.
    fields: [
      { name: "clientId", label: "OAuth 2.0 client ID", secret: false, required: true },
      { name: "clientSecret", label: "OAuth 2.0 client secret (Web App clients only)", secret: true, required: false },
      { name: "callbackUrl", label: "Callback address (only if this app is reached at another address)", secret: false, required: false },
      { name: "accessToken", label: "Access token", secret: true, required: true },
      { name: "refreshToken", label: "Refresh token", secret: true, required: false },
    ],
  },
  instagram: {
    label: channelName("instagram"),
    purpose: "Marketing: publish approved posts one at a time and read comments, through the Instagram API with Instagram Login.",
    fields: [
      { name: "accessToken", label: "Instagram user access token (long-lived)", secret: true, required: true },
      { name: "accountId", label: "Instagram account ID", secret: false, required: true },
    ],
  },
  stripe: {
    label: "Stripe",
    purpose: "Payments: plans and invoices. The keys are read by the billing code; nothing is charged from here.",
    fields: [
      { name: "publishableKey", label: "Publishable key (pk_test_ or pk_live_)", secret: false, required: true, pattern: { re: /^pk_(test|live)_[A-Za-z0-9]+$/, problem: "must be a Stripe publishable key, starting pk_test_ or pk_live_" } },
      { name: "secretKey", label: "Secret key (sk_ or a restricted rk_ key)", secret: true, required: true, pattern: { re: /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/, problem: "must be a Stripe secret or restricted key, starting sk_test_, sk_live_, rk_test_ or rk_live_" } },
      { name: "webhookSecret", label: "Webhook signing secret (whsec_)", secret: true, required: false, noLast4: true, pattern: { re: /^whsec_[A-Za-z0-9+/=]+$/, problem: "must be a Stripe webhook signing secret, starting whsec_" } },
    ],
  },
  smtp: {
    label: "Mail server (SMTP)",
    purpose: "Email: confirmations, password resets and invitations. The server address is set in Admin, Email.",
    fields: [{ name: "password", label: "SMTP password", secret: true, required: false, noLast4: true }],
  },
  kokoro: {
    label: "Kokoro speech service",
    purpose: "Voice: narration from a Kokoro server you run (its OpenAI-compatible speech interface). A key only if it sits behind a proxy that asks for one. The address is set in Admin, Voice.",
    fields: [key(false)],
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
const LAST_FOUR_MIN_LENGTH = 12;

export function lastFour(value: string | null | undefined): string | null {
  if (!value || value.length < LAST_FOUR_MIN_LENGTH) return null;
  return value.slice(-4);
}
