"use client";

import { AlertTriangle } from "lucide-react";
import { coverageOf, coverageText } from "@/lib/trace/coverage";
import { useItems, useProject } from "@/lib/client";
import type { Item } from "@/lib/types";

/**
 * What checks a requirement and what it needs. A requirement no test covers is a warning, in words and not only in colour.
 * The links are read from both ends (the concept's rows come from the shared all-rows cache).
 */
export function Coverage({ item }: { item: Pick<Item, "data"> }) {
  const { project } = useProject();
  const { items } = useItems(project?.id, null);
  const c = coverageOf(item, items.length ? items : undefined);
  if (!c.tests) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden /> {coverageText(c)}
      </span>
    );
  }
  return <span className="text-xs text-secondary">{coverageText(c)}</span>;
}
