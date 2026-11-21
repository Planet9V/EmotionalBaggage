"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { budgetRollup } from "@/lib/campaigns/budget";
import type { Campaign, PlanSettings } from "@/lib/campaigns/read";
import type { useMoney } from "./hooks";

type Money = ReturnType<typeof useMoney>;

const monthName = (m: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));

/** The campaigns' planned spend by month, set against the concept's marketing budget. A month over its limit says so in words. */
export function BudgetTable({ campaigns, plan, money }: { campaigns: Campaign[]; plan: PlanSettings; money: Money }) {
  const r = budgetRollup(campaigns, { monthlyMinor: plan.monthlyMinor, totalMinor: plan.totalMinor });
  if (!r.months.length && !r.leftOut.length) return <p className="text-sm text-secondary">Add a campaign with dates and a budget to see its spend by month.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-primary" data-testid="budget-sentence">
        {plan.totalMinor === null
          ? `Planned spend across all campaigns is ${money.format(r.plannedTotal)}. No total marketing budget is set.`
          : r.totalOver > 0
            ? `Planned spend is ${money.format(r.plannedTotal)}, which is ${money.format(r.totalOver)} over the total marketing budget of ${money.format(plan.totalMinor)}.`
            : `Planned spend is ${money.format(r.plannedTotal)} of a total marketing budget of ${money.format(plan.totalMinor)}; ${money.format(plan.totalMinor - r.plannedTotal)} is not planned yet.`}
      </p>
      {r.months.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Planned</TableHead>
              <TableHead className="text-right">Monthly budget</TableHead>
              <TableHead>Against the budget</TableHead>
              <TableHead>Campaigns</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.months.map((m) => (
              <TableRow key={m.month}>
                <TableCell className="font-medium">{monthName(m.month)}</TableCell>
                <TableCell className="text-right font-mono">{money.format(m.planned)}</TableCell>
                <TableCell className="text-right font-mono">{m.limit === null ? "Not set" : money.format(m.limit)}</TableCell>
                <TableCell className={m.over > 0 ? "font-medium text-danger" : "text-secondary"}>
                  {m.limit === null ? "No limit to compare with" : m.over > 0 ? `Over by ${money.format(m.over)}` : `Within, ${money.format(m.limit - m.planned)} left`}
                </TableCell>
                <TableCell className="text-secondary">{m.shares.map((s) => `${s.title} ${money.format(s.amount)}`).join("; ")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {r.leftOut.length > 0 && (
        <div className="text-sm text-secondary">
          <p className="font-medium text-primary">Left out of the roll-up</p>
          <ul className="list-disc pl-5">{r.leftOut.map((l) => <li key={l.campaignId}>{l.title}: {l.reason}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
