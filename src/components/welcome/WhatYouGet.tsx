"use client";

// "What do I end up with?": a track of the seven stages in two lanes, Make it and Sell it. Choosing a stage shows
// what it leaves you with: the outcome in a sentence, the sections the workbench holds for it (the menu's own
// names), and its real output from the worked example (Artefacts.tsx). Until a visitor chooses, the track walks
// itself, a stage every few seconds, while it is on screen; a choice stops the walk for good. There is no pause
// control (owner, 22 Nov).
//
// The server sends the first stage open. Without script the stages cannot change, so the other six are set out in
// the <noscript> block; under reduced motion the track stays where the visitor puts it. The detail has one
// fixed height on a wide screen, so nothing below moves as the stages change.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useInView } from "motion/react";
import { ArrowDown } from "lucide-react";
import type { HeroFacts } from "./storyData";
import { Artefact, type ArtefactKey } from "./Artefacts";
import { useAnimated } from "./useAnimated";
import { GET } from "./content";

const ITEMS = GET.groups.flatMap((g) => g.items.map((it) => ({ ...it, group: g.key })));
/** the example's outputs a stage shows, and where on the page the stage runs live */
const SHOWS: Record<string, { art: ArtefactKey[]; see?: "engineering" | "market" }> = {
  "01": { art: ["brief"] },
  "02": { art: ["claim"] },
  "03": { art: ["parts", "schematic", "model"], see: "engineering" },
  "04": { art: ["print"], see: "engineering" },
  "05": { art: ["cost"] },
  "06": { art: ["ad"], see: "market" },
  "07": { art: ["channel"], see: "market" },
};
const WALK_MS = 4200;

function Detail({ n, facts, holds }: { n: string; facts: HeroFacts; holds: Record<string, string[]> }) {
  const it = ITEMS.find((x) => x.n === n)!;
  const shows = SHOWS[n]!;
  return (
    <div className="grid h-full gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex min-w-0 flex-col">
        <p className="font-mono text-[11px] text-muted">
          <span className="text-link">{it.n}</span> {it.stage}
        </p>
        <h3 className="mt-1.5 text-xl font-semibold leading-snug tracking-tight text-primary sm:text-[1.375rem]">{it.get}</h3>
        <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-secondary">{it.also}</p>
        <p className="mt-5 font-mono text-[11px] text-muted">{GET.holds}</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {(holds[n] ?? []).map((s) => (
            <li key={s} className="rounded-md border border-hairline bg-subtle px-2 py-1 text-xs text-secondary">{s}</li>
          ))}
        </ul>
        {shows.see ? (
          <p className="mt-auto pt-5">
            <a href={`#${shows.see}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-link underline-offset-4 hover:underline">
              {GET.see[shows.see]} <ArrowDown className="h-4 w-4" aria-hidden />
            </a>
          </p>
        ) : null}
      </div>
      <div className={`grid content-center gap-2.5 ${shows.art.length > 1 ? "sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" : ""}`} aria-hidden="true">
        {shows.art.map((a, i) => (
          <div key={a} className={shows.art.length === 3 && i === 0 ? "sm:col-span-2 lg:col-span-1 xl:col-span-2" : shows.art.length === 1 ? "mx-auto w-full max-w-[20rem]" : ""}>
            <Artefact kind={a} facts={facts} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function WhatYouGet({ facts, holds }: { facts: HeroFacts; /** each stage's sections, by stage number */ holds: Record<string, string[]> }) {
  const ref = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const animated = useAnimated();
  const seen = useInView(ref, { amount: 0.4 });
  const [at, setAt] = useState(0);
  const [chosen, setChosen] = useState(false);
  const walking = animated && seen && !chosen;

  useEffect(() => {
    if (!walking) return;
    const t = window.setInterval(() => setAt((i) => (i + 1) % ITEMS.length), WALK_MS);
    return () => window.clearInterval(t);
  }, [walking]);

  const pick = (i: number) => {
    setChosen(true);
    setAt(i);
  };
  const onKey = (e: KeyboardEvent) => {
    const to = e.key === "ArrowRight" || e.key === "ArrowDown" ? (at + 1) % ITEMS.length : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (at + ITEMS.length - 1) % ITEMS.length : e.key === "Home" ? 0 : e.key === "End" ? ITEMS.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    pick(to);
    tabRefs.current[to]?.focus();
  };
  const now = ITEMS[at]!;

  return (
    <div ref={ref} className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-5">
      {/* the track: two lanes, one stop a stage */}
      <div role="group" aria-label={GET.label} onKeyDown={onKey} className="grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-1">
        {GET.groups.map((g) => (
          <div key={g.key}>
            <p className="text-base font-semibold tracking-tight text-primary">{g.title}</p>
            <p className="text-xs text-secondary">{g.sub}</p>
            <div className="relative mt-2.5 grid gap-1.5">
              <span className="absolute bottom-4 left-[15px] top-4 w-0.5 bg-[var(--border-hairline)]" aria-hidden />
              {g.items.map((it) => {
                const i = ITEMS.findIndex((x) => x.n === it.n);
                const on = i === at;
                return (
                  <button
                    key={it.n}
                    ref={(el) => {
                      tabRefs.current[i] = el;
                    }}
                    type="button"
                    aria-pressed={on}
                    aria-controls="get-panel"
                    onClick={() => pick(i)}
                    className={`relative flex min-h-11 items-center gap-3 overflow-hidden rounded-lg border px-1.5 py-1.5 text-left transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus ${on ? "border-hairline bg-surface shadow-[var(--shadow-card)]" : "border-transparent hover:bg-surface"}`}
                  >
                    <span className={`relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border font-mono text-[10px] transition-colors duration-200 ${on ? "border-transparent bg-action text-white" : "border-hairline bg-canvas text-secondary"}`}>{it.n}</span>
                    <span className={`text-sm ${on ? "font-semibold text-primary" : "text-secondary"}`}>{it.stage}</span>
                    {/* how long until the walk moves on */}
                    {on && walking ? <span key={at} className="wl-progress absolute inset-x-0 bottom-0 h-0.5 bg-dutchOrange" style={{ animationDuration: `${WALK_MS}ms` }} aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="min-w-0">
        <div id="get-panel" className="rounded-xl border border-hairline bg-surface shadow-[var(--shadow-card)] min-h-[720px] sm:min-h-[560px] lg:h-[452px] lg:min-h-0">
          <Detail n={now.n} facts={facts} holds={holds} />
        </div>
        <noscript>
          {ITEMS.slice(1).map((it) => (
            <div key={it.n} className="mt-4 rounded-xl border border-hairline bg-surface">
              <Detail n={it.n} facts={facts} holds={holds} />
            </div>
          ))}
        </noscript>
      </div>
    </div>
  );
}
