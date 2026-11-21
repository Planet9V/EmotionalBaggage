"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LockOpen } from "lucide-react";
import { queries } from "@/lib/queries";
import { DECISIONS_STORE } from "@/lib/plan";
import { lockingDecisions } from "@/lib/process/unlocks";

/**
 * At the top of a section: the decisions not yet made that unlock it (plan 3.3). A warning only;
 * the section stays usable. Nothing is shown while loading, when nothing locks it, or when the
 * decision tree cannot be read (the section's own view reports load errors).
 */
export function SectionLockBanner({ projectId, stageKey, sectionKey }: { projectId: string; stageKey: string; sectionKey: string }) {
  const { data } = useQuery(queries.items(projectId, DECISIONS_STORE));
  const locking = data ? lockingDecisions(data, stageKey, sectionKey) : [];
  if (!locking.length) return null;
  const one = locking.length === 1;
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-warning bg-warning-soft px-4 py-3 text-sm" role="status" data-testid="section-lock-banner">
      <LockOpen className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold text-primary">
          {one ? "A decision that opens this section is not made yet." : `${locking.length} decisions that open this section are not made yet.`}
        </p>
        <ul className="mt-1 space-y-0.5 text-secondary">
          {locking.map((d) => (
            <li key={d.key}>
              <span className="font-mono text-xs text-muted">{d.key}</span> {d.question}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-secondary">
          You can still work here. <Link href="/s/concept/decisions" className="font-medium text-link hover:underline">Open the decision tree</Link> to decide {one ? "it" : "them"}.
        </p>
      </div>
    </div>
  );
}
