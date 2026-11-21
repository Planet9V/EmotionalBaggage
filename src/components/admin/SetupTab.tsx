"use client";

// First run (plan item 0.4): a plain checklist of what is not set up yet, each with why it matters and a
// button to the tab where it is set. Everything can be skipped.
import Link from "next/link";
import { CircleCheck, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { messageOf } from "@/lib/queries";
import { TAB_OF, useAdminStatus, type AdminTab } from "@/lib/admin/client";
import { LoadError, LoadingBlocks, Panel } from "./shared";

const TAB_LABEL: Record<AdminTab, string> = { setup: "Setup", credentials: "Credentials", models: "Models", printers: "Printers", audit: "Audit log" };

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
    <Panel
      title="Setup"
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
  );
}
