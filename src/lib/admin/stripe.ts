// Payments settings (Stripe), read by the billing code through getStripeSettings(). This module charges nothing.
// The keys are credentials of the provider "stripe" (src/lib/admin/providers.ts), entered in Admin, Payments.
import { getCredential } from "@/lib/settings";
import { secretFor, stripeApiBase } from "@/lib/secretOrigin";

export type StripeMode = "test" | "live";

/** Where Stripe sends events. The billing workstream mounts its handler at this path. */
export const STRIPE_WEBHOOK_PATH = "/api/billing/stripe/webhook";

/** test or live from a key's prefix (pk_test_, sk_live_, rk_test_, ...); null when the prefix is not Stripe's. */
export function stripeMode(key: string | null | undefined): StripeMode | null {
  const m = /^(?:pk|sk|rk)_(test|live)_/.exec(key ?? "");
  return m ? (m[1] as StripeMode) : null;
}

export type StripeSettings =
  | { configured: false; reason: string }
  | {
      configured: true;
      mode: StripeMode;
      publishableKey: string;
      /** server only: never send it to a browser or a log */
      secretKey: string;
      /** null until a webhook is set up; the billing code must then refuse events */
      webhookSecret: string | null;
      apiBase: string;
    };

/**
 * The Stripe settings in force, or why there are none. Never throws for a missing or mismatched key: the billing
 * code turns `configured: false` into "Payments are not set up yet" and the rest of the app carries on.
 */
export async function getStripeSettings(): Promise<StripeSettings> {
  const apiBase = stripeApiBase();
  const [publishableKey, secret, webhookSecret] = await Promise.all([
    getCredential("stripe", "publishableKey"),
    secretFor("stripe", "secretKey", apiBase),
    getCredential("stripe", "webhookSecret"),
  ]);
  if (!publishableKey && !secret.value && !secret.refused) return { configured: false, reason: "No Stripe keys are saved. Payments are off until they are entered in Admin, Payments." };
  if (secret.refused) return { configured: false, reason: `The saved Stripe secret key belongs to ${secret.boundTo ?? "another address"} and is not sent to ${apiBase}. Enter it again in Admin, Payments.` };
  if (!secret.value) return { configured: false, reason: "The Stripe secret key is missing. Enter it in Admin, Payments." };
  if (!publishableKey) return { configured: false, reason: "The Stripe publishable key is missing. Enter it in Admin, Payments." };
  const a = stripeMode(publishableKey);
  const b = stripeMode(secret.value);
  if (!a || !b) return { configured: false, reason: "A saved Stripe key does not start the way Stripe keys do (pk_test_, pk_live_, sk_test_, sk_live_, rk_...). Enter it again in Admin, Payments." };
  if (a !== b) return { configured: false, reason: `The publishable key is a ${a} key and the secret key a ${b} key. Both must be test keys or both live keys.` };
  return { configured: true, mode: a, publishableKey, secretKey: secret.value, webhookSecret, apiBase };
}
