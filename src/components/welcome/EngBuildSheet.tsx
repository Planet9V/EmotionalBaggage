"use client";

// The Build sheet tab: the first soldering steps in order, each drawn with the app's own step card (StepCard, as
// the Wiring and soldering page lists them) from the app's own ordering of the example's seeded wires. Read-only:
// the card shows each joint's status as words, with no controls.
import { useMemo } from "react";
import type { Item } from "@/lib/types";
import { counts, partMap, sequence, toWires } from "@/components/buildsheet/derive";
import { StepCard } from "@/components/buildsheet/StepCard";
import { ENGINEERING } from "./content";
import { StageBar, StageFoot, StageView } from "./StageParts";

const FIRST = 8;
const noop = () => {};

export default function EngBuildSheet({ parts, wires }: { parts: Item[]; wires: Item[] }) {
  const steps = useMemo(() => sequence(toWires(wires)), [wires]);
  const byRef = useMemo(() => partMap(parts), [parts]);
  const c = counts(steps);
  const shown = steps.slice(0, FIRST);
  return (
    <>
      <StageBar path="/s/prototype/wiring">
        <p className="font-mono text-[11px] text-muted">
          Steps 1 to {shown.length} of {steps.length}
        </p>
      </StageBar>
      <StageView className="overflow-y-auto p-3 sm:p-4" tabIndex={0} label="The first soldering steps">
        <h3 className="sr-only">{ENGINEERING.build.heading}</h3>
        <ol className="mx-auto grid max-w-4xl gap-3">
          {shown.map((s) => (
            <StepCard key={s.wire.item.id} step={s} parts={byRef} onStatus={noop} readOnly />
          ))}
        </ol>
        <p className="mx-auto mt-3 max-w-4xl text-[13px] text-secondary">{ENGINEERING.build.more(steps.length - shown.length)}</p>
      </StageView>
      <StageFoot hint={ENGINEERING.build.hint}>
        {steps.length} joints: {c.soldered} soldered, {c.tested} tested
      </StageFoot>
    </>
  );
}
