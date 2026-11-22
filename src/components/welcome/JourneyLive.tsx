"use client";

// The journey's Concept panel: the app's own decision tree (DecisionFlow, as the Decision tree page mounts it) on
// the example's seeded decisions, every branch open. Press a decision to frame it and read where it stands;
// nothing can be decided here. Loaded by Journey with next/dynamic into a box of fixed height; until then, and
// without script, the same decisions are in the page as a list of the same size (DecisionsStill in StageRows.tsx).
import { useMemo, useState } from "react";
import { toDecision, type Decision } from "@/lib/domain/decision";
import type { Item } from "@/lib/types";
import { DecisionFlow } from "@/components/decisions/DecisionFlow";
import { buildTree, caption } from "@/components/decisions/model";
import { TapToExplore } from "./TapToExplore";
import { useAnimated } from "./useAnimated";
import { ROWS } from "./content";

const noop = () => {};

export function DecisionsLive({ rows }: { rows: Item[] }) {
  const animated = useAnimated();
  const all = useMemo(() => rows.map(toDecision).filter((d): d is Decision => d !== null), [rows]);
  // it opens framed on the first decision of the tree, the one the Concept gate waits for, at a size that can be read
  const [selected, setSelected] = useState<string | null>(() => all.find((d) => !d.parent)?.key ?? all[0]?.key ?? null);
  const byKey = useMemo(() => new Map(all.map((d) => [d.key, d])), [all]);
  const tree = useMemo(() => buildTree(all, byKey), [all, byKey]);
  const expanded = useMemo(() => new Set(all.map((d) => d.key)), [all]);
  const sel = selected ? byKey.get(selected) : undefined;
  return (
    <>
      <TapToExplore className="relative h-[440px] bg-canvas">
        <DecisionFlow all={all} byKey={byKey} tree={tree} selected={selected} expanded={expanded} only={null} onSelect={setSelected} onUserMove={noop} instant={!animated} readOnly />
      </TapToExplore>
      <p aria-live="polite" className="flex min-h-[5.5rem] items-center sm:min-h-[3.75rem] border-t border-hairline bg-subtle px-3.5 py-2.5 text-[13px] leading-relaxed text-secondary">
        {sel ? caption(sel, all, byKey) : ROWS.decisions.hint}
      </p>
    </>
  );
}
