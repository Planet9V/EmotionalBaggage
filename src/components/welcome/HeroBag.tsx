"use client";

// The hero's picture: the suitcase rolling along, the puck, and a speech bubble that types the bag's lines one
// after another. The server renders the first line whole, so the picture is complete before any script runs.
// When a new line lands the bag gives a small nod and its wheels hurry for a moment. It all stops under reduced
// motion. Screen readers get one still sentence, not a stream of letters.
import { useEffect, useState } from "react";
import { Bag } from "./Bag";
import { useAnimated } from "./useAnimated";
import { BAG_LINES, EXAMPLE, HERO_LINES } from "./content";

const TYPE_MS = 34;
const HOLD_MS = 2600;

export function HeroBag() {
  const animated = useAnimated();
  const [at, setAt] = useState<{ i: number; n: number | null }>({ i: 0, n: null }); // n null: the whole line
  const { line, where } = BAG_LINES[HERO_LINES[at.i]!];
  const shown = at.n ?? line.length;
  const typing = shown < line.length;
  const running = animated;
  // a new line has just started: the first few letters

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(
      () => setAt(({ i, n }) => ((n ?? Infinity) < BAG_LINES[HERO_LINES[i]!].line.length ? { i, n: (n ?? 0) + 1 } : { i: (i + 1) % HERO_LINES.length, n: 0 })),
      typing ? TYPE_MS : HOLD_MS,
    );
    return () => window.clearTimeout(t);
  }, [running, typing, at]);

  return (
    <div className="mx-auto w-full max-w-[360px]">
      <p className="sr-only">
        A drawing of a suitcase with a round puck strapped to it. The puck says, {BAG_LINES[HERO_LINES[0]!].where}: &ldquo;{BAG_LINES[HERO_LINES[0]!].line}&rdquo;
      </p>
      {/* on a phone the bag stands beside its bubble; from sm up the bubble sits over it */}
      <div className="flex items-center gap-3 sm:flex-col-reverse">
        <div key={at.i} className={`w-[30%] shrink-0 sm:w-[50%] ${running && at.n !== null ? "wl-nod" : ""}`}>
          <Bag speaking={running && typing} hurry={running && at.n !== null && shown < 14} className="block h-auto w-full" />
        </div>
        <div className="relative min-w-0 flex-1 rounded-xl sm:w-full sm:flex-none border border-hairline bg-surface px-4 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-5" aria-hidden="true">
          {/* space for the longest line, so nothing below moves as it types */}
          <p className="min-h-[5.5rem] text-base font-semibold leading-snug tracking-tight text-primary sm:min-h-[4.5rem] sm:text-lg">
            &ldquo;{line.slice(0, shown)}
            {typing ? null : <>&rdquo;</>}
            <span className="opacity-0">{line.slice(shown)}</span>
          </p>
          <p className="mt-2 font-mono text-[11px] leading-snug text-muted sm:text-xs">
            {EXAMPLE.name}, {where}
          </p>
          <span className="absolute -left-2 top-[calc(50%-8px)] h-4 w-4 rotate-45 border-b border-l border-hairline bg-surface sm:-bottom-2 sm:left-[calc(50%-8px)] sm:top-auto sm:border-l-0 sm:border-r" />
        </div>
      </div>
    </div>
  );
}
