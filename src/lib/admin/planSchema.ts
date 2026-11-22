// The plan catalogue's shape and rules, safe for the browser (the editor validates with the same schema as the
// server); reading and saving are in ./plans.ts. The catalogue (Admin, Pricing and tiers) holds the service levels,
// their prices, limits and Stripe price ids, kept as ONE validated JSON document in the settings row "plans.catalogue", so the admin can change tiers and
// turn prices on without a deploy. Until something is saved, the catalogue is the one in
// src/components/welcome/content.ts (LEVELS, with SHOW_PRICES false), exactly as the public page had it.
//
// Limit names follow docs/research/saas-pricing-and-platform-design.md ("A monthly plan sets concepts, seats and
// storage and includes a monthly credit allowance; ... slicing draw credits"). null means "not set": no limit is
// enforced. Nothing enforces limits yet; the billing and limits workstream reads getPlanCatalogue().
import { z } from "zod";
import { LEVELS, SHOW_PRICES, type Level } from "@/components/welcome/content";

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
    action: z.enum(["request", "run"]),
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
/** The only limits content.ts states: Free is 1 concept and 1 person. Everything else waits for the owner. */
const SEED_LIMITS: Partial<Record<Level["key"], Partial<Record<LimitKey, number>>>> = { free: { concepts: 1, members: 1 } };

const amount = (p: string): number | null => {
  if (/^free$/i.test(p.trim())) return 0;
  const n = Number(p.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && p.trim() !== "" ? n : null;
};

/** The catalogue as content.ts has it: every tier shown, prices hidden. */
export function builtInCatalogue(): PlanCatalogue {
  return {
    showPrices: SHOW_PRICES,
    tiers: LEVELS.map((l) => ({
      key: l.key,
      name: l.name,
      shown: true,
      paid: l.paid,
      currency: "USD",
      priceMonthly: amount(l.price),
      priceYearly: null,
      who: l.who,
      what: l.what,
      includes: [...l.includes],
      action: l.action,
      limits: { ...NO_LIMITS, ...SEED_LIMITS[l.key] },
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

export type PublicLevel = Omit<Level, "key"> & { key: string };
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
      })),
  };
}
