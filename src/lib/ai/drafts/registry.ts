// Every generator the drafting engine knows. Adding one is adding it to this list.
import type { Generator } from "./types";
import { faq, pressRelease } from "./generators/concept";
import { parts, requirements, wiring } from "./generators/design";
import { assembly, tests } from "./generators/prototype";
import { optimiseCost, optimiseParts, optimisePrint } from "./generators/optimise";
import { campaignPlan } from "@/lib/campaigns/generator";
import type { OptimiseAction } from "./measure";
import { CONTENT_GENERATORS } from "@/lib/content/generators";
import { MARKET_DRAFT_GENERATORS } from "@/lib/market/drafting";
import { complianceGenerator } from "@/lib/compliance/draft";

export const GENERATORS: Generator<never>[] = [pressRelease, faq, requirements, parts, wiring, assembly, tests, optimiseCost, optimiseParts, optimisePrint, ...CONTENT_GENERATORS, campaignPlan, ...MARKET_DRAFT_GENERATORS, complianceGenerator] as unknown as Generator<never>[];

export const OPTIMISE_GENERATOR: Record<OptimiseAction, string> = { cost: optimiseCost.id, parts: optimiseParts.id, print: optimisePrint.id };

export function generator(id: string): Generator<Record<string, unknown>> | undefined {
  return GENERATORS.find((g) => g.id === id) as Generator<Record<string, unknown>> | undefined;
}

/** Section generators that write this store and apply to this product type. */
export function generatorsFor(store: string, productType: string) {
  return GENERATORS.filter((g) => g.kind === "section" && g.to === store && g.applies(productType)) as Generator<Record<string, unknown>>[];
}

/** Generators whose drafts the reviewer attacks once they are approved. */
export const ATTACKED = new Set([pressRelease.id, faq.id]);

for (const g of GENERATORS) {
  if (GENERATORS.filter((x) => x.id === g.id).length > 1) throw new Error(`Two generators are called "${g.id}".`);
}
