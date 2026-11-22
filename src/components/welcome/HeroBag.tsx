"use client";

// The hero's picture: the suitcase, the puck, and a speech bubble that types the bag's lines one after another.
// The server renders the first line whole, so the picture is complete before any script runs. Typing starts only
// for a visitor who has not asked for reduced motion, and the Pause button stops it (WCAG 2.2.2: it starts by
// itself and would otherwise run on). Screen readers get one still sentence, not a stream of letters.
import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Bag } from "./Bag";
import { useAnimated } from "./useAnimated";
import { BAG_LINES, EXAMPLE, HERO_LINES } from "./content";

const TYPE_MS = 34;
const HOLD_MS = 2600;

export function HeroBag() {
  const animated = useAnimated();
  const [paused, setPaused] = useState(false);
  const [at, setAt] = useState<{ i: number; n: number | null }>({ i: 0, n: null }); // n null: the whole line
  const { line, where } = BAG_LINES[HERO_LINES[at.i]!];
  const shown = at.n ?? line.length;
  const typing = shown < line.length;
  const running = animated && !paused;

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(
      () => setAt(({ i, n }) => ((n ?? Infinity) < BAG_LINES[HERO_LINES[i]!].line.length ? { i, n: (n ?? 0) + 1 } : { i: (i + 1) % HERO_LINES.length, n: 0 })),
      typing ? TYPE_MS : HOLD_MS,
    );
    return () => window.clearTimeout(t);
  }, [running, typing, at]);

  return (
    <div className="mx-auto w-full max-w-[400px]">
      <p className="sr-only">
        A drawing of a suitcase with a round puck strapped to it. The puck says, {BAG_LINES[HERO_LINES[0]!].where}: &ldquo;{BAG_LINES[HERO_LINES[0]!].line}&rdquo;
      </p>
      {/* on a phone the bag stands beside its bubble; from sm up the bubble sits over it */}
      <div className="flex items-center gap-3 sm:flex-col-reverse">
        <Bag speaking={running && typing} className="block h-auto w-[30%] shrink-0 sm:w-[62%]" />
        <div className="relative min-w-0 flex-1 rounded-2xl sm:w-full sm:flex-none border border-hairline bg-surface px-4 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-5" aria-hidden="true">
          {/* space for the longest line, so nothing below moves as it types */}
          <p className="min-h-[6.25rem] text-lg font-semibold leading-snug tracking-tight text-primary sm:min-h-[5.75rem] sm:text-2xl">
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
      <div className="mt-1 flex h-8 justify-center">
        {animated ? (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 font-mono text-xs text-muted transition-colors duration-150 hover:text-primary"
          >
            {paused ? <Play className="h-3.5 w-3.5" aria-hidden /> : <Pause className="h-3.5 w-3.5" aria-hidden />}
            {paused ? "Play the bag's lines" : "Pause the bag's lines"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
