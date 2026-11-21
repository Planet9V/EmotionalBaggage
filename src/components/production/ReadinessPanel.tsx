"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { isReady, type Check as ReadinessCheck } from "@/lib/economics/readiness";

/** The four production-readiness checks, each met or not, each with a link to where it is fixed. */
export function ReadinessPanel({ checks, batchTitle }: { checks: ReadinessCheck[]; batchTitle?: string }) {
  const ready = isReady(checks);
  return (
    <div>
      <p className="mb-3 text-sm text-secondary" role="status">
        {ready ? "Every check is met" : `${checks.filter((c) => !c.met).length} of ${checks.length} checks are not met`}
        {batchTitle ? <> for <span className="font-medium text-primary">{batchTitle}</span></> : null}.
      </p>
      <ul className="divide-y divide-hairline rounded-lg border border-hairline">
        {checks.map((c) => (
          <li key={c.key} className="px-3 py-2.5">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <span className="mt-0.5" aria-hidden>
                {c.met ? <Check className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-warning" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-primary">
                  {c.label}
                  <StatusBadge tone={c.met ? "success" : "warning"}>{c.met ? "Met" : "Not met"}</StatusBadge>
                </p>
                <p className="text-xs text-secondary">{c.detail}</p>
                {!c.met && c.missing.length ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-secondary">
                    {c.missing.slice(0, 8).map((m, i) => (
                      <li key={`${m}-${i}`}>{m}</li>
                    ))}
                    {c.missing.length > 8 ? <li>and {c.missing.length - 8} more</li> : null}
                  </ul>
                ) : null}
              </div>
              <Link href={c.href} className="text-xs text-link hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange">
                {c.met ? "Open" : "Fix it"}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
