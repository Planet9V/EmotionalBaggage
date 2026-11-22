"use client";

// The toy. Four real buttons; each plays one short movement on the drawing and shows the line the bag says when
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
    <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-10">
      <div>
        <div className="grid grid-cols-2 gap-3">
          {POKE.actions.map((a) => (
            <Button key={a.key} type="button" variant="outline" size="lg" className="h-auto min-h-12 justify-start whitespace-normal rounded-xl px-4 py-2 text-left text-sm font-semibold text-primary" onClick={() => setDone((d) => ({ action: a, count: (d?.count ?? 0) + 1 }))}>
              {a.label}
            </Button>
          ))}
        </div>
        <div aria-live="polite" className="mt-5 min-h-[7.5rem] rounded-2xl border border-hairline bg-surface p-5">
          {said ? (
            <>
              <p className="text-xl font-semibold leading-snug tracking-tight text-primary">
                <span className="sr-only">The bag says: </span>&ldquo;{said.line}&rdquo;
              </p>
              <p className="mt-2 font-mono text-xs text-muted">The bag, {said.where}</p>
            </>
          ) : (
            <p className="text-base text-secondary">{POKE.idle}</p>
          )}
        </div>
      </div>
      <div className="relative mx-auto h-[250px] w-full max-w-[380px] sm:h-[300px] overflow-hidden rounded-2xl border border-hairline bg-subtle" aria-hidden="true">
        <div className="absolute inset-x-8 bottom-6 h-2 sm:bottom-9 rounded-full bg-[var(--border-hairline)]" />
        <div key={done ? `${done.action.key}-${done.count}` : "idle"} className={`absolute inset-x-0 bottom-7 flex sm:bottom-10 justify-center ${done ? MOVE[done.action.key] : ""}`}>
          <Bag speaking={done && !dark ? "briefly" : false} className="block h-[190px] w-auto sm:h-[236px]" />
        </div>
        {dark ? (
          <>
            <div key={done.count} className="wl-dark-on absolute inset-0 bg-black" />
            <p className="wl-zzz absolute right-[22%] top-[18%] flex items-end gap-1 font-mono font-semibold text-white">
              <span className="text-sm">z</span>
              <span className="text-lg">z</span>
              <span className="text-2xl">z</span>
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
