"use client";

// Admin, Overview. Two parts:
//  - Services: every outside service with its state (configured / not configured / configured but failing), where
//    its values come from, when it was last tested, and what is switched off without it. Nothing is a blocker.
//  - First run (plan item 0.4): the plain checklist of what is not set up yet, each with a button to its section.
import Link from "next/link";
import { CircleCheck, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { messageOf } from "@/lib/queries";
import { ADMIN_TAB_LABEL, isAdminTab, TAB_OF, useAdminStatus, useServiceOverview, type AdminTab, type ServiceStatus } from "@/lib/admin/client";
import { statusTone } from "@/lib/statusTones";
import { fmtDateTime } from "@/lib/format";
import { LoadError, LoadingBlocks } from "@/components/ui/states";
import { Panel } from "@/components/ui/panel";

const TAB_LABEL = ADMIN_TAB_LABEL;

const STATE_WORD: Record<ServiceStatus["state"], string> = { configured: "configured", "not-configured": "not configured", failing: "failing" };
const SOURCE_WORD: Record<NonNullable<ServiceStatus["source"]>, string> = {
  database: "Saved in Admin",
  environment: "From the environment",
  mixed: "Partly saved in Admin, partly from the environment",
  "built-in": "Built in",
};

function Services({ onOpenTab }: { onOpenTab: (t: AdminTab) => void }) {
  const list = useServiceOverview();
  if (list.isPending) return <LoadingBlocks rows={2} label="Reading the state of every service" />;
  if (list.isError) return <LoadError what="The services" message={messageOf(list.error)} onRetry={() => void list.refetch()} />;
  const failing = list.data.filter((s) => s.state === "failing").length;
  const missing = list.data.filter((s) => s.state === "not-configured").length;
  return (
    <Panel
      title="Services"
      description={`Every service is optional: the app runs without any of them, and each line says what is off until it is set up. ${failing ? `${failing} failing, ` : ""}${missing} not configured.`}
    >
      <ul className="divide-y divide-hairline rounded-xl border border-hairline">
        {list.data.map((s) => {
          const tab = isAdminTab(s.tab) ? s.tab : null;
          return (
            <li key={s.key} className="flex flex-wrap items-start gap-3 px-4 py-3" data-state={s.state} data-service={s.key}>
              <div className="min-w-0 flex-1 basis-64">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-primary">
                  {s.label}
                  <StatusBadge tone={statusTone(STATE_WORD[s.state])}>{s.state === "configured" ? "Configured" : s.state === "failing" ? "Configured, but failing" : "Not configured"}</StatusBadge>
                </p>
                <p className="mt-0.5 text-sm text-secondary">{s.summary}</p>
                {s.state !== "configured" ? <p className="mt-0.5 text-sm text-secondary">Without it: {s.without}</p> : null}
                <p className="mt-0.5 text-xs text-muted">
                  {s.source ? SOURCE_WORD[s.source] : "Nothing saved"}.{" "}
                  {s.lastCheck ? `Last tested ${fmtDateTime(s.lastCheck.at)}: ${s.lastCheck.ok ? "it worked" : `it failed (${s.lastCheck.message})`}.` : s.key === "pricing" ? "" : "Not tested since it was last changed."}
                </p>
              </div>
              {tab ? (
                <Button variant={s.state === "configured" ? "ghost" : "outline"} size="sm" onClick={() => onOpenTab(tab)} aria-label={`Open ${TAB_LABEL[tab]} for ${s.label}`}>
                  Open {TAB_LABEL[tab]}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

type Row = { key: string; label: string; configured: boolean; explanation: string; state: string; href: string; action: string };

export function SetupTab({ onOpenTab }: { onOpenTab: (t: AdminTab) => void }) {
  const status = useAdminStatus();
  if (status.isPending) return <LoadingBlocks rows={1} label="Reading what is set up" />;
  if (status.isError) return <LoadError message={messageOf(status.error)} onRetry={() => void status.refetch()} />;

  const rows: Row[] = status.data.items.map((i) => {
    const tab = TAB_OF[i.section];
    return { key: i.key, label: i.label, configured: i.configured, explanation: i.explanation, state: i.state, href: `/admin?tab=${tab}`, action: `Open ${TAB_LABEL[tab]}` };
  });
  rows.push({
    key: "password",
    label: "Your own password",
    configured: !status.data.defaultPassword,
    explanation: "The published default password lets anyone who can reach this install sign in.",
    state: status.data.defaultPassword ? "The default password is still in use." : "Changed from the default.",
    href: "/account",
    action: "Open Account",
  });
  const open = rows.filter((r) => !r.configured);

  return (
    <div className="space-y-4">
    <Services onOpenTab={onOpenTab} />
    <Panel
      title="First run"
      description={
        open.length
          ? "These are not set up yet. Each one switches on a part of the app. You can skip any of them and come back later."
          : "Everything on this list is set up. You can change any of it in the other tabs."
      }
    >
      <ul className="divide-y divide-hairline rounded-xl border border-hairline">
        {rows.map((r) => {
          const tab = r.href.startsWith("/admin?tab=") ? (r.href.slice("/admin?tab=".length) as AdminTab) : null;
          return (
            <li key={r.key} className="flex flex-wrap items-start gap-3 px-4 py-3" data-configured={r.configured}>
              {r.configured ? (
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              ) : (
                <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
              )}
              <div className="min-w-0 flex-1 basis-64">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-primary">
                  {r.label}
                  <StatusBadge tone={r.configured ? "success" : "neutral"}>{r.configured ? "Set up" : "Not set up"}</StatusBadge>
                </p>
                <p className="mt-0.5 text-sm text-secondary">{r.explanation}</p>
                <p className="mt-0.5 text-xs text-muted">{r.state}</p>
              </div>
              {tab ? (
                <Button variant={r.configured ? "ghost" : "outline"} size="sm" onClick={() => onOpenTab(tab)}>
                  {r.action}
                </Button>
              ) : (
                <Button asChild variant={r.configured ? "ghost" : "outline"} size="sm">
                  <Link href={r.href}>{r.action}</Link>
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">Nothing here is required. Features that need something missing say so on their own page.</p>
    </Panel>
    </div>
  );
}
