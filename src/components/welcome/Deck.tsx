"use client";

// A deck of slides: a horizontal scroller with CSS scroll-snap, so a swipe (or the scroll bar, or the arrow keys
// once it has focus) moves one slide and the page's own vertical scrolling is never touched. Around it: previous
// and next, a "3 of 7" counter, and one button per slide. Every slide is in the page from the server, so with no
// script it is still a row you can scroll through.
//
// `auto` advances a slide every few seconds, on wide screens, only while the deck is in view and only until the
// visitor touches it; then it stops for good. While it runs there is a Pause button (WCAG 2.2.2). Never under
// reduced motion. `untilWide` makes it a deck on phones and tablets only: from lg up the slides are an ordinary
// stacked column and the controls are gone.
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useInView } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnimated, useWide } from "./useAnimated";

const HOLD_MS = 5000;

export function Deck({ label, tabs, auto = false, untilWide = false, children }: { label: string; /** one short name per slide */ tabs: string[]; auto?: boolean; untilWide?: boolean; children: ReactNode }) {
  const slides = Children.toArray(children);
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touched, setTouched] = useState(false);
  const animated = useAnimated();
  const wide = useWide();
  const seen = useInView(root, { amount: 0.6 });
  const last = slides.length - 1;
  const mayRun = auto && animated && wide && !touched && at < last;
  const running = mayRun && seen && !paused;

  const go = useCallback(
    (i: number) => {
      const el = scroller.current;
      const to = el?.children[Math.max(0, Math.min(last, i))];
      if (!el || !(to instanceof HTMLElement)) return;
      el.scrollTo({ left: to.offsetLeft, behavior: animated ? "smooth" : "auto" });
    },
    [animated, last],
  );

  // which slide is showing: the one whose left edge is nearest the scroller's
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    let best = 0;
    Array.from(el.children).forEach((c, i) => {
      if (c instanceof HTMLElement && Math.abs(c.offsetLeft - el.scrollLeft) < Math.abs((el.children[best] as HTMLElement).offsetLeft - el.scrollLeft)) best = i;
    });
    setAt(best);
  };

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => go(at + 1), HOLD_MS);
    return () => window.clearTimeout(t);
  }, [running, at, go]);

  const stop = () => setTouched(true);
  const step = (i: number) => {
    stop();
    go(i);
  };
  const hide = untilWide ? "lg:hidden" : "";

  return (
    <div ref={root} role="group" aria-roledescription="carousel" aria-label={label} onPointerDown={stop} onKeyDown={stop} onWheel={stop}>
      <div className={`mb-4 flex items-center gap-2 ${hide}`}>
        <ol className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1" aria-label={`${label}: slides`}>
          {tabs.map((t, i) => (
            <li key={t} className="shrink-0">
              <button
                type="button"
                aria-current={at === i ? "true" : undefined}
                onClick={() => step(i)}
                className={`h-8 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors duration-150 ${at === i ? "border-transparent bg-action text-white" : "border-hairline bg-surface text-secondary hover:text-primary"}`}
              >
                {t}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div
        ref={scroller}
        onScroll={onScroll}
        tabIndex={untilWide && wide ? undefined : 0}
        role="group"
        aria-label={`${label}: swipe or scroll sideways`}
        className={`relative flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${untilWide ? "lg:block lg:overflow-visible" : ""}`}
      >
        {slides.map((s, i) => (
          <div key={i} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}: ${tabs[i]}`} className={`w-full shrink-0 snap-start ${untilWide ? "lg:w-auto" : ""}`}>
            {s}
          </div>
        ))}
      </div>
      <div className={`mt-4 flex items-center gap-2 ${hide}`}>
        <Button type="button" variant="outline" size="icon" aria-label="Previous slide" disabled={at === 0} onClick={() => step(at - 1)}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Next slide" disabled={at === last} onClick={() => step(at + 1)}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
        <p className="font-mono text-xs tabular-nums text-muted" aria-live={running ? "off" : "polite"}>
          {at + 1} of {slides.length}
        </p>
        {mayRun ? (
          <button type="button" onClick={() => setPaused((p) => !p)} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 font-mono text-xs text-muted transition-colors duration-150 hover:text-primary">
            {paused ? <Play className="h-3.5 w-3.5" aria-hidden /> : <Pause className="h-3.5 w-3.5" aria-hidden />}
            {paused ? "Play the slides" : "Pause the slides"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
