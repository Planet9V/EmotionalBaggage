// "What does it cost?": the paid plans as cards, read from the plan catalogue in force (Admin, Pricing and tiers;
// src/lib/admin/plans.ts, publicLevels) and handed in by the page. Only plans that are sold are cards: a tier that
// is not paid or costs nothing is never drawn, whatever the catalogue holds. A
// card's price is the catalogue's; while the catalogue keeps its prices off the page, or has none for a plan, that
// plan is not drawn. What a plan includes is the catalogue's own lines and nothing else: where a limit is not
// decided, no number is written. Every card has the page's one action.
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicLevel } from "@/lib/admin/planSchema";
import { ACTION, PRICING } from "./content";

export type PaidPlan = { key: string; name: string; price: string; per: string; who: string; what: string; includes: string[] };

/** The plans the page sells, with the price each card shows. */
export function paidPlans(levels: PublicLevel[], showPrices: boolean): PaidPlan[] {
  if (!showPrices) return [];
  return levels
    .filter((l) => l.paid && (l.priceMonthly ?? 0) > 0 && l.price !== "")
    .map((l) => ({ key: l.key, name: l.name, price: l.price, per: l.per || PRICING.per, who: l.who, what: l.what, includes: l.includes }));
}

/** `href` is the form the cards' action goes to. */
export function PlanCards({ plans, href }: { plans: PaidPlan[]; href: string }) {
  return (
    <ul className="mt-5 grid gap-5 md:grid-cols-2">
      {plans.map((p) => (
        <li key={p.key} className="flex flex-col rounded-2xl border border-hairline bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-xl font-semibold tracking-tight text-primary">{p.name}</h4>
              <p className="mt-0.5 text-[13px] font-medium text-link">{p.who}</p>
            </div>
            <p className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-[2.5rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-primary">{p.price}</span>
              <span className="text-[15px] text-secondary">{p.per}</span>
            </p>
          </div>
          <p className="mt-4 text-base leading-snug text-secondary">{p.what}</p>
          {p.includes.length ? (
            <>
              <p className="mt-5 border-t border-hairline pt-4 text-[13px] font-medium text-muted">{PRICING.includes}</p>
              <ul className="mt-2.5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {p.includes.map((t) => (
                  <li key={t} className="flex gap-2.5 text-[15px] leading-snug text-secondary">
                    <Check className="mt-[3px] h-4 w-4 shrink-0 text-link" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <div className="mt-auto pt-6">
            <Button asChild variant="outline" className="h-11 w-full rounded-lg text-[15px]">
              <a href={href} data-track={`plan:${p.key}`}>
                {ACTION.label} <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
