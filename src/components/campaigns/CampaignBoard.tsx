"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Select } from "@/components/parts/controls";
import { statusTone } from "@/lib/statusTones";
import { inclusiveDays, formatDay } from "@/lib/campaigns/days";
import type { Campaign } from "@/lib/campaigns/read";
import { OBJECTIVE_LABEL, TARGET_INFO, type Objective } from "@/lib/campaigns/schemas";
import type { useMoney } from "./hooks";

type Money = ReturnType<typeof useMoney>;

function budgetLine(c: Campaign, money: Money): string {
  const days = c.startDate && c.endDate ? inclusiveDays(c.startDate, c.endDate) : null;
  const total = c.budgetTotalMinor ?? (c.budgetDailyMinor !== null && days ? c.budgetDailyMinor * days : null);
  const parts: string[] = [];
  if (total !== null) parts.push(`${money.format(total)} in all`);
  if (c.budgetDailyMinor !== null) parts.push(`${money.format(c.budgetDailyMinor)} a day`);
  return parts.length ? parts.join(", ") : "No budget set";
}

function targetLine(c: Campaign, money: Money): string | null {
  if (!c.target) return null;
  const info = TARGET_INFO[c.target.metric];
  const v = info.kind === "money" ? money.format(c.target.value) : info.kind === "fraction" ? `${Number((c.target.value * 100).toFixed(2))}%` : String(c.target.value);
  return `${info.label} ${info.direction === "at_most" ? "at most" : "at least"} ${v}`;
}

/** The board: one column per status, as a labelled list in each. Status is changed with a select, so the board works from the keyboard. */
export function CampaignBoard({ campaigns, statuses, money, onEdit, onDelete, onStatus }: {
  campaigns: Campaign[];
  statuses: string[];
  money: Money;
  onEdit: (c: Campaign) => void;
  onDelete: (c: Campaign) => void;
  onStatus: (c: Campaign, status: string) => void;
}) {
  const known = new Set(statuses);
  // a row whose status is not in the list (an older row, a seeded one) still shows, in a column of its own
  const extra = [...new Set(campaigns.map((c) => c.status).filter((s) => !known.has(s)))];
  const columns = [...statuses, ...extra];
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" data-testid="campaign-board">
      {columns.map((status) => {
        const here = campaigns.filter((c) => c.status === status);
        return (
          <section key={status} aria-label={`${status}, ${here.length}`} className="min-w-0 rounded-xl border border-hairline bg-subtle p-2">
            <h3 className="mb-2 flex items-center justify-between px-1 text-xs font-medium text-secondary">
              <span className="capitalize">{status}</span>
              <span className="font-mono text-[11px] text-muted">{here.length}</span>
            </h3>
            {here.length === 0 ? (
              <p className="px-1 py-3 text-xs text-muted">None</p>
            ) : (
              <ul className="space-y-2">
                {here.map((c) => (
                  <li key={c.id} className="rounded-lg border border-hairline bg-surface p-3 text-sm">
                    <p className="font-medium text-primary wrap-anywhere">{c.title}</p>
                    <p className="mt-0.5 text-xs text-secondary">
                      {[c.objective ? OBJECTIVE_LABEL[c.objective as Objective] ?? c.objective : "", c.channel].filter(Boolean).join(" on ") || "Objective and channel not set"}
                    </p>
                    <p className="mt-1 text-xs text-secondary">{budgetLine(c, money)}</p>
                    {c.legacy.map((l, i) => <p key={i} className="text-xs text-muted wrap-anywhere">{l}</p>)}
                    <p className="text-xs text-secondary">{c.startDate && c.endDate ? `${formatDay(c.startDate)} to ${formatDay(c.endDate)}` : "No dates set"}</p>
                    {targetLine(c, money) && <p className="mt-1 text-xs text-secondary">Target: {targetLine(c, money)}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <label className="sr-only" htmlFor={`status-${c.id}`}>Status of {c.title}</label>
                      <Select id={`status-${c.id}`} value={c.status} onChange={(e) => onStatus(c, e.target.value)} className="h-8 w-28 px-2 text-xs">
                        {[...new Set([...statuses, c.status])].map((s) => <option key={s}>{s}</option>)}
                      </Select>
                      <Button size="sm" variant="outline" onClick={() => onEdit(c)} aria-label={`Edit ${c.title}`}><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(c)} aria-label={`Delete ${c.title}`}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                    </div>
                    {c.status === "killed" || c.status === "paused" ? <StatusBadge tone={statusTone(c.status)} className="mt-2">{c.status}</StatusBadge> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
