"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { CheckResult } from "@/lib/process/evaluate";

/** A gate's checks: met or not (an icon and the word, never colour alone), what was found, and a link to fix it. */
export function CheckList({ checks, labelledBy }: { checks: CheckResult[]; labelledBy?: string }) {
  return (
    <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface" aria-labelledby={labelledBy}>
      {checks.map((c) => (
        <li key={c.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 xl:grid-cols-[1.25rem_minmax(0,1fr)_auto] px-4 py-2.5 text-sm" data-met={c.met ? "yes" : "no"}>
          {c.met ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" aria-hidden />
          ) : (
            <Circle className="mt-0.5 h-4 w-4 text-muted" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="text-primary">
              <span className="sr-only">{c.met ? "Met: " : "Not met: "}</span>
              {c.label}
            </p>
            <p className="mt-0.5 text-xs text-secondary">{c.detail}</p>
          </div>
          {!c.met && (
            <Link href={c.href} className="col-start-2 text-xs font-medium xl:col-start-auto xl:whitespace-nowrap xl:pt-0.5 text-link hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange">
              {c.action}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
