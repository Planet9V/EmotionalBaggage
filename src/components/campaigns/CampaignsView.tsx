"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorLine } from "@/components/parts/controls";
import { LoadFailed, LoadingBlock } from "@/components/market/shared";
import { useItems } from "@/lib/client";
import { campaignsOf, planOf, type Campaign } from "@/lib/campaigns/read";
import { toLaunch, toStep, isLaunchRow, isStepRow } from "@/lib/campaigns/launch";
import { CAMPAIGN_STORE, LAUNCH_STORE } from "@/lib/campaigns/schemas";
import type { ViewProps } from "@/components/views/types";
import { BudgetTable } from "./BudgetTable";
import { CampaignBoard } from "./CampaignBoard";
import { CampaignCalendar } from "./CampaignCalendar";
import { CampaignDialog } from "./CampaignDialog";
import { Section } from "./fields";
import { useMoney, useSummary } from "./hooks";
import { PlanCard } from "./PlanCard";

export function CampaignsView({ project, section }: ViewProps) {
  const { items, loading, error, reload, patch, remove } = useItems(project.id, CAMPAIGN_STORE);
  const launchRows = useItems(project.id, LAUNCH_STORE).items;
  const { summary, loading: summaryLoading, error: summaryError, retry: retrySummary } = useSummary(project.id);
  const money = useMoney(summary?.currency);
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);
  const [actionError, setActionError] = useState("");

  const campaigns = useMemo(() => campaignsOf(items), [items]);
  const plan = useMemo(() => planOf(items), [items]);
  const launches = useMemo(() => launchRows.filter(isLaunchRow).map(toLaunch), [launchRows]);
  const steps = useMemo(() => launchRows.filter(isStepRow).map(toStep), [launchRows]);
  const statuses = section.statuses ?? [];

  if (loading || summaryLoading) return <LoadingBlock label="Loading campaigns" />;
  if (summaryError) return <LoadFailed what="The concept's currency and margins" message={summaryError} retry={retrySummary} />;
  if (error && !items.length) return <LoadFailed what="Campaigns" message={error} retry={() => void reload()} />;

  const guard = async (p: Promise<unknown>) => {
    setActionError("");
    try {
      await p;
    } catch (e) {
      setActionError((e as Error).message);
    }
  };
  const del = (c: Campaign) => {
    if (typeof window !== "undefined" && !window.confirm(`Delete the campaign "${c.title}"? Its results and links are kept but lose their campaign.`)) return;
    void guard(remove(c.id));
  };

  return (
    <div className="space-y-8">
      <PlanCard projectId={project.id} plan={plan} money={money} />

      {(actionError || error) && <ErrorLine>{actionError || error}</ErrorLine>}

      <Section
        id="board"
        title="Campaigns by status"
        aside={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden /> Add campaign</Button>}
      >
        {campaigns.length === 0 ? (
          <EmptyState title="No campaigns yet">
            Draft a campaign plan with the button at the top of the page, which works from the budget above and the margin on your sales channel, or add one by hand. Drafts stay drafts until you approve them.
          </EmptyState>
        ) : (
          <CampaignBoard campaigns={campaigns} statuses={statuses} money={money} onEdit={setEditing} onDelete={del} onStatus={(c, status) => void guard(patch(c.id, { status }))} />
        )}
      </Section>

      <Section id="calendar" title="Calendar">
        <CampaignCalendar campaigns={campaigns} launches={launches} steps={steps} />
      </Section>

      <Section id="budget" title="Budget by month">
        <BudgetTable campaigns={campaigns} plan={plan} money={money} />
        <p className="text-xs text-muted">Killed campaigns are not counted. A campaign with a total spreads it evenly over its days; with only a daily budget it spends that each day.</p>
      </Section>

      {editing && (
        <CampaignDialog
          key={editing === "new" ? "new" : editing.id}
          projectId={project.id}
          campaign={editing === "new" ? null : editing}
          plan={plan}
          summary={summary}
          money={money}
          statuses={statuses}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
