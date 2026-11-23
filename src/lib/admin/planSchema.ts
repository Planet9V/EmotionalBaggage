// The plan catalogue's shape and rules, safe for the browser (the editor validates with the same schema as the
// server); reading and saving are in ./plans.ts. The catalogue (Admin, Pricing and tiers) holds the service levels,
// their prices, limits and Stripe price ids, kept as ONE validated JSON document in the settings row "plans.catalogue", so the admin can change tiers and
// turn prices on without a deploy. Until something is saved, the catalogue is BUILT_IN_TIERS below: two plans, Maker
// $20 and Studio $40 a month, prices shown (owner, 22 Nov: "nothing free"; "limit early access to 50 only, then
// convert to 20/month and 40 per month"; "no you cannot run it yourself, remove it"). Migration 0042 brought saved
// catalogues to the same two plans without overwriting a price an admin had set.
//
// Limit names follow docs/research/saas-pricing-and-platform-design.md ("A monthly plan sets concepts, seats and
// storage and includes a monthly credit allowance; ... slicing draw credits"). null means "not set": no limit is
// enforced. Nothing enforces limits yet; the billing and limits workstream reads getPlanCatalogue().
import { z } from "zod";

export const LIMIT_KEYS = ["concepts", "members", "aiCreditsPerMonth", "storageMb", "printJobsPerMonth"] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];
export const LIMIT_LABEL: Record<LimitKey, string> = {
  concepts: "Concepts",
  members: "Members (seats)",
  aiCreditsPerMonth: "AI credits a month",
  storageMb: "Storage (MB)",
  printJobsPerMonth: "Print jobs a month",
};

const limit = z.number().int("must be a whole number").min(0, "cannot be negative").max(1_000_000_000).nullable();
const price = z.number().min(0, "cannot be negative").max(1_000_000, "is too large").multipleOf(0.01, "has more than two decimals").nullable();
const stripePrice = z.string().trim().regex(/^price_[A-Za-z0-9]+$/, "must be a Stripe price id (price_...)").nullable();
const line = z.string().trim().min(1, "cannot be empty").max(160);

const planTier = z
  .object({
    key: z.string().trim().regex(/^[a-z][a-z0-9-]{1,31}$/, "must be 2 to 32 lower-case letters, digits or dashes, starting with a letter"),
    name: z.string().trim().min(1, "is required").max(60),
    shown: z.boolean(),
    paid: z.boolean(),
    currency: z.string().trim().regex(/^[A-Z]{3}$/, "must be a three-letter currency code such as USD"),
    priceMonthly: price,
    priceYearly: price,
    who: z.string().trim().max(120),
    what: z.string().trim().max(300),
    includes: z.array(line).max(12, "at most 12 lines"),
    // what the public card's button does: ask for early access. ("run", Run it yourself, is retired: owner, 22 Nov.)
    action: z.enum(["request"]),
    limits: z.object(Object.fromEntries(LIMIT_KEYS.map((k) => [k, limit])) as Record<LimitKey, typeof limit>).strict(),
    stripePriceMonthly: stripePrice,
    stripePriceYearly: stripePrice,
  })
  .strict();
export type PlanTier = z.infer<typeof planTier>;

export const planCatalogue = z
  .object({ showPrices: z.boolean(), tiers: z.array(planTier).min(1, "needs at least one tier").max(12, "at most 12 tiers") })
  .strict()
  .superRefine((c, ctx) => {
    const seen = new Set<string>();
    c.tiers.forEach((t, i) => {
      if (seen.has(t.key)) ctx.addIssue({ code: "custom", path: ["tiers", i, "key"], message: `"${t.key}" is used by another tier; keys must be unique` });
      seen.add(t.key);
      if (t.paid && t.priceMonthly === 0) ctx.addIssue({ code: "custom", path: ["tiers", i, "priceMonthly"], message: "is 0 on a paid tier; untick Paid or set a price" });
    });
    if (!c.tiers.some((t) => t.shown)) ctx.addIssue({ code: "custom", path: ["tiers"], message: "must show at least one tier on the public page" });
  });
export type PlanCatalogue = z.infer<typeof planCatalogue>;

const NO_LIMITS: Record<LimitKey, number | null> = { concepts: null, members: null, aiCreditsPerMonth: null, storageMb: null, printJobsPerMonth: null };

type SeedTier = Pick<PlanTier, "key" | "name" | "priceMonthly" | "who" | "what" | "includes">;

/**
 * The two plans until the admin saves a catalogue. Prices: owner, 22 Nov ("then convert to 20/month and 40 per
 * month"); which is which (Maker $20, Studio $40) and Studio's seats opening after early access are working
 * assumptions recorded in docs/TASKS.md. Limits wait for the owner, so none are set.
 */
const BUILT_IN_TIERS: SeedTier[] = [
  {
    key: "maker",
    name: "Maker",
    priceMonthly: 20,
    who: "Makers and first-time founders",
    what: "One person taking an idea to a prototype and a launch.",
    includes: ["Several concepts", "Monthly AI credits, with top-ups", "Slicing for your printer", "Exports", "Channels: Amazon, X, Instagram"],
  },
  {
    key: "studio",
    name: "Studio",
    priceMonthly: 40,
    who: "Small product firms",
    what: "A team with several products in one shared workspace.",
    includes: ["Everything in Maker", "Team seats, opening after early access", "A shared workspace with roles", "Pooled AI credits", "More concepts and storage"],
  },
];

/** The built-in catalogue: Maker and Studio, prices shown, no limits set. */
export function builtInCatalogue(): PlanCatalogue {
  return {
    showPrices: true,
    tiers: BUILT_IN_TIERS.map((t) => ({
      ...t,
      includes: [...t.includes],
      shown: true,
      paid: true,
      currency: "USD",
      priceYearly: null,
      action: "request",
      limits: { ...NO_LIMITS },
      stripePriceMonthly: null,
      stripePriceYearly: null,
    })),
  };
}

/** A price as the public page writes it: "Free" for 0, else the amount in its currency. */
function priceText(amountValue: number | null, currency: string): string | null {
  if (amountValue === null) return null;
  if (amountValue === 0) return "Free";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: Number.isInteger(amountValue) ? 0 : 2 }).format(amountValue);
}

/** One plan as the public page shows it (the pricing cards and the early-access price line). */
export type PublicLevel = {
  key: string;
  name: string;
  /** "$20", "Free" for 0, "" when no price is set */
  price: string;
  /** what follows the price: "a month", or "" */
  per: string;
  paid: boolean;
  who: string;
  what: string;
  includes: string[];
  action: PlanTier["action"];
  /** the monthly amount and its currency, for anything that formats it itself; null when not set */
  priceMonthly: number | null;
  currency: string;
};
export type PublicLevels = { levels: PublicLevel[]; showPrices: boolean };

/** The shown tiers, in order, in the shape the public page's cards take. */
export function levelsOf(c: PlanCatalogue): PublicLevels {
  return {
    showPrices: c.showPrices,
    levels: c.tiers
      .filter((t) => t.shown)
      .map((t) => ({
        key: t.key,
        name: t.name,
        price: priceText(t.priceMonthly, t.currency) ?? "",
        per: t.priceMonthly ? "a month" : "",
        paid: t.paid,
        who: t.who,
        what: t.what,
        includes: t.includes,
        action: t.action,
        priceMonthly: t.priceMonthly,
        currency: t.currency,
      })),
  };
}
