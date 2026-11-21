"use client";

import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import type { Flag } from "@/lib/content/claims";
import type { Problem } from "@/lib/content/channels";

/** A live count under a field: "27 / 30", red over a limit from the platform, amber over a guide. */
export function Count({ n, max, enforce, shown }: { n: number; max?: number; enforce?: boolean; shown?: number }) {
  if (max === undefined) return <span className="font-mono text-[11px] text-muted">{n}</span>;
  const over = n > max;
  return (
    <span
      aria-live="polite"
      className={cn("font-mono text-[11px]", over ? (enforce ? "font-semibold text-danger" : "font-semibold text-warning") : "text-muted")}
    >
      {n} / {max}
      {over ? (enforce ? ` over the platform limit by ${n - max}` : ` over the guide by ${n - max}`) : ""}
      {!over && shown !== undefined && n > shown ? ` (cut after ${shown})` : ""}
    </span>
  );
}

export function SourceLink({ url, label }: { url: string; label?: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-link hover:underline">
      {label ?? "Source"}
      <ExternalLink className="h-3 w-3" aria-hidden />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** The no-proof lines of a row, in words. */
export function FlagList({ flags }: { flags: Flag[] }) {
  if (!flags.length) return null;
  return (
    <div role="status" className="rounded-md border border-warning bg-warning-soft px-3 py-2 text-xs text-warning">
      <p className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> No proof: this cannot be approved yet
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {flags.slice(0, 6).map((f, i) => (
          <li key={i}>{f.reason}</li>
        ))}
      </ul>
      {flags.length > 6 && <p className="mt-1">and {flags.length - 6} more.</p>}
    </div>
  );
}

export function Problems({ problems }: { problems: (Problem & { source?: string })[] }) {
  if (!problems.length) return null;
  return (
    <ul className="space-y-1 text-xs" aria-label="Problems">
      {problems.map((p, i) => (
        <li key={i} className={p.level === "refuse" ? "text-danger" : "text-warning"}>
          {p.message} {p.source ? <SourceLink url={p.source} /> : null}
        </li>
      ))}
    </ul>
  );
}

/** Which approved message a piece is tied to. */
export function MessageLine({ message, href = "/s/marketing/positioning" }: { message?: { text?: string } | null; href?: string }) {
  if (!message?.text) return <p className="text-xs text-warning">Not tied to an approved message.</p>;
  return (
    <p className="text-xs text-secondary">
      <span className="font-medium text-primary">Message: </span>
      {message.text} <Link href={href} className="text-link hover:underline">Positioning</Link>
    </p>
  );
}

export const asFlags = (v: unknown): Flag[] => (Array.isArray(v) ? (v as Flag[]) : []);

const tone = (status: string) => (status === "approved" || status === "ready" || status === "scheduled" ? "success" : status === "draft" ? "warning" : status === "killed" ? "danger" : "neutral") as "success" | "warning" | "danger" | "neutral";

export const StatusPill = ({ status }: { status: string }) => <StatusBadge tone={tone(status)}>{status}</StatusBadge>;
