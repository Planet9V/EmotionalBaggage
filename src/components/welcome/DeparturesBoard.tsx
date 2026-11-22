"use client";

// The seven stages as a departures board. It is a real table: gate, stage, remark. The split-flap letters are
// decoration over it: each tile is hidden from assistive technology and the cell carries the plain word. The
// server renders the settled board; on first view the tiles run through a few characters and settle again
// (about a second and a half, once), unless the visitor asked for reduced motion.
import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { useAnimated } from "./useAnimated";
import { BOARD, STAGES } from "./content";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const WIDTH = 10; // the longest stage name, PRODUCTION
const STEP_MS = 45;
const LAST_STEP = 6 + WIDTH + STAGES.length * 2;

function Flaps({ text, width, row, step }: { text: string; width: number; row: number; step: number | null }) {
  const cells = text.toUpperCase().padEnd(width, " ").split("");
  return (
    <span aria-hidden="true" className="inline-flex gap-[2px] font-mono text-sm font-semibold leading-none text-white sm:text-lg">
      {cells.map((c, k) => {
        const settled = step === null || step >= 6 + k + row * 2;
        const shown = settled || c === " " ? c : CHARS[(step * 7 + k * 3 + row * 5) % CHARS.length];
        return (
          <span key={k} className={`relative inline-flex h-[1.7em] w-[1.15em] items-center justify-center rounded-[3px] bg-[#1c1f26] ${settled ? "" : "wl-flapping"}`}>
            {shown}
            <span className="absolute inset-x-0 top-1/2 h-px bg-[#0b0c0e]" />
          </span>
        );
      })}
    </span>
  );
}

export function DeparturesBoard() {
  const ref = useRef<HTMLTableElement>(null);
  const animated = useAnimated();
  const seen = useInView(ref, { once: true, amount: 0.35 });
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (!animated || !seen) return;
    let s = 0;
    const t = window.setInterval(() => {
      s += 1;
      setStep(s > LAST_STEP ? null : s);
      if (s > LAST_STEP) window.clearInterval(t);
    }, STEP_MS);
    return () => window.clearInterval(t);
  }, [animated, seen]);

  return (
    <div className="dark overflow-hidden rounded-2xl border border-hairline bg-[#0b0c0e] text-primary shadow-[var(--shadow-card)]">
      {/* On a phone each row is laid out as a grid (gate and stage, remark beneath), which would drop the
          browser's table semantics, so the roles are stated. */}
      <table ref={ref} role="table" className="block w-full border-collapse text-left sm:table">
        <caption className="block border-b border-hairline px-4 py-3 text-left sm:table-caption sm:px-6">
          <span className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <span className="font-mono text-sm font-semibold text-dutchOrange-400">Departures</span>
            <span className="font-mono text-xs text-muted">Now boarding: {BOARD.flight}</span>
          </span>
        </caption>
        <thead role="rowgroup" className="sr-only sm:not-sr-only sm:table-header-group">
          <tr role="row" className="font-mono text-[11px] text-muted">
            <th role="columnheader" scope="col" className="px-6 pb-1 pt-3 font-normal">Gate</th>
            <th role="columnheader" scope="col" className="px-2 pb-1 pt-3 font-normal">Stage</th>
            <th role="columnheader" scope="col" className="px-6 pb-1 pt-3 font-normal">Remarks</th>
          </tr>
        </thead>
        <tbody role="rowgroup" className="block sm:table-row-group">
          {STAGES.map((s, row) => (
            <tr key={s.n} role="row" className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 border-hairline px-4 py-2.5 align-middle max-sm:[&:not(:first-child)]:border-t sm:table-row sm:border-t sm:p-0">
              <td role="cell" className="sm:px-6 sm:py-2">
                <Flaps text={s.n} width={2} row={row} step={step} />
                <span className="sr-only">{s.n}</span>
              </td>
              <th role="rowheader" scope="row" className="font-normal sm:px-2 sm:py-2">
                <Flaps text={s.name} width={WIDTH} row={row} step={step} />
                <span className="sr-only">{s.name}</span>
              </th>
              <td role="cell" className="col-span-2 font-mono text-[11px] leading-snug text-secondary sm:px-6 sm:py-2 sm:text-[13px]">{s.short}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
