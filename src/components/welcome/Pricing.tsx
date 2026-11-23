// "What does it cost?": the paid plans as cards, read from the plan catalogue in force (Admin, Pricing and tiers;
// src/lib/admin/plans.ts, publicLevels) and handed in by the page. Only plans that are sold are cards: a tier that
// is not paid, costs nothing, or is the run-it-yourself tier is never drawn, whatever the catalogue holds. A card's
// price is the catalogue's when it shows prices; otherwise the working figure in content.ts (PRICING.prices); a
// plan with neither is left out. What a plan includes is the catalogue's own lines and nothing else: where a limit
// is not decided, no number is written. Every card has the page's one action.
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicLevel } from "@/lib/admin/planSchema";
import { ACTION, PRICING } from "./content";

export type PaidPlan = { key: string; name: string; price: string; per: string; who: string; what: string; includes: string[]; note: string };

const costsNothing = (price: string) => /^(free|\D*0+([.,]0+)?)$/i.test(price.trim());

/** The plans the page sells, with the price each card shows. */
export function paidPlans(levels: PublicLevel[], showPrices: boolean): PaidPlan[] {
  return levels
    .filter((l) => l.paid && l.action !== "run" && !l.key.startsWith("self"))
    .map((l) => {
      const fromCatalogue = showPrices && l.price && !costsNothing(l.price) ? l.price : "";
      return { key: l.key, name: l.name, price: fromCatalogue || (PRICING.prices[l.key] ?? ""), per: l.per || PRICING.per, who: l.who, what: l.what, includes: l.includes, note: PRICING.notes[l.key] ?? "" };
    })
    .filter((p) => p.price !== "");
}

/** `href` is the form the cards' action goes to. */
export function PlanCards({ plans, href }: { plans: PaidPlan[]; href: string }) {
  return (
    <ul className="mt-4 grid gap-4 md:grid-cols-2">
      {plans.map((p) => (
        <li key={p.key} className="flex flex-col rounded-xl border border-hairline bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
          <h4 className="text-lg font-semibold tracking-tight text-primary">{p.name}</h4>
          <p className="mt-0.5 font-mono text-[11px] text-link">{p.who}</p>
          <p className="mt-3 flex items-baseline gap-1.5">
            <span className="text-[2rem] font-semibold leading-none tracking-tight text-primary">{p.price}</span>
            <span className="text-sm text-secondary">{p.per}</span>
          </p>
          <p className="mt-3 text-sm leading-snug text-secondary">{p.what}</p>
          {p.includes.length ? (
            <>
              <p className="mt-4 font-mono text-[11px] text-muted">{PRICING.includes}</p>
              <ul className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {p.includes.map((t) => (
                  <li key={t} className="flex gap-2.5 text-[13px] leading-snug text-secondary">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-link" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {p.note ? (
            <p className="mt-4 flex items-start gap-2 text-[13px] leading-snug text-primary">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-dutchOrange" aria-hidden />
              {p.note}
            </p>
          ) : null}
          <div className="mt-auto pt-5">
            <Button asChild variant="outline" className="h-10 w-full rounded-lg">
              <a href={href} data-track={`cta:pricing-${p.key}`}>
                {ACTION.label} <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
