"use client";

// The toy, kept small: a strip with the bag at one end. Four real buttons; each plays one short movement on the drawing and shows the line the bag says when
// that happens to it. No sound. The line sits in a live region, so it is announced when it changes. Under
// reduced motion the drawing stays still (the dark one still dims, which moves nothing) and the line still shows.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bag } from "./Bag";
import { BAG_LINES, POKE } from "./content";

type Action = (typeof POKE.actions)[number];
const MOVE: Record<Action["key"], string> = { weigh: "wl-weigh", toss: "wl-toss", spin: "wl-spin", dark: "" };

export function PokeTheBag() {
  const [done, setDone] = useState<{ action: Action; count: number } | null>(null);
  const said = done ? BAG_LINES[done.action.line] : null;
  const dark = done?.action.key === "dark";
  return (
    <div className="flex items-center gap-4 rounded-xl border border-hairline bg-surface p-4 sm:gap-6">
      <div className="relative h-[132px] w-[104px] shrink-0 overflow-hidden rounded-lg bg-subtle sm:h-[150px] sm:w-[124px]" aria-hidden="true">
        <div key={done ? `${done.action.key}-${done.count}` : "idle"} className={`absolute inset-x-0 bottom-1 flex justify-center ${done ? MOVE[done.action.key] : ""}`}>
          <Bag speaking={done && !dark ? "briefly" : false} className="block h-[120px] w-auto sm:h-[138px]" />
        </div>
        {dark ? (
          <>
            <div key={done.count} className="wl-dark-on absolute inset-0 bg-black" />
            <p className="wl-zzz absolute right-2 top-2 flex items-end gap-0.5 font-mono font-semibold text-white">
              <span className="text-[10px]">z</span>
              <span className="text-xs">z</span>
              <span className="text-base">z</span>
            </p>
          </>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2">
          {POKE.actions.map((a) => (
            <Button key={a.key} type="button" variant="outline" size="sm" className="h-9 rounded-full px-3.5 text-[13px] font-medium text-primary" onClick={() => setDone((d) => ({ action: a, count: (d?.count ?? 0) + 1 }))}>
              {a.label}
            </Button>
          ))}
        </div>
        <div aria-live="polite" className="mt-3 min-h-[3.75rem]">
          {said ? (
            <>
              <p className="text-base font-semibold leading-snug tracking-tight text-primary">
                <span className="sr-only">The bag says: </span>&ldquo;{said.line}&rdquo;
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted">The bag, {said.where}</p>
            </>
          ) : (
            <p className="text-sm text-secondary">{POKE.idle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
