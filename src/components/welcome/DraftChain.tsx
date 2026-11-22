"use client";

// "How it goes fast": the drafting chain, on the example's own rows. An approved brief line becomes a drafted
// requirement, which becomes a drafted part, a wire, an assembly step, a test and an ad. Each row arrives tagged
// Draft, is approved, and only then does the next one arrive; the last waits, as every draft does until someone
// decides. The rows are seeded rows of the example (storyData.ts); the chain shows the mechanism, and the note
// under it says so.
//
// The server sends the finished chain, every row in place: that is what stays under reduced motion, without
// script and off screen. Each row has its own cell and only opacity and transform change. No pause control.
import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { Check, CornerDownRight } from "lucide-react";
import type { ChainStep } from "./storyData";
import { useAnimated } from "./useAnimated";
import { FAST } from "./content";

export function DraftChain({ steps }: { steps: ChainStep[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const animated = useAnimated();
  const seen = useInView(ref, { amount: 0.35 });
  const running = animated && seen;
  const last = steps.length - 1;
  const rest = { shown: steps.length, approved: last, pressing: -1 };
  const [lap, setLap] = useState(rest);

  useEffect(() => {
    if (!running) return;
    let alive = true;
    let timer = 0;
    const wait = (ms: number) => new Promise<void>((done) => (timer = window.setTimeout(done, ms)));
    void (async () => {
      await wait(1400);
      while (alive) {
        setLap({ shown: 1, approved: 1, pressing: -1 });
        await wait(900);
        for (let i = 1; i <= last && alive; i++) {
          setLap({ shown: i + 1, approved: i, pressing: -1 });
          await wait(850);
          if (i === last) break;
          setLap({ shown: i + 1, approved: i, pressing: i });
          await wait(380);
          setLap({ shown: i + 1, approved: i + 1, pressing: -1 });
          await wait(330);
        }
        await wait(3600);
      }
    })();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [running, last]);

  const { shown, approved, pressing } = running ? lap : rest;

  return (
    <ol ref={ref} aria-label={FAST.label} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => {
        const on = i < shown;
        const ok = i < approved;
        return (
          <li
            key={s.key}
            className={`flex min-h-[176px] flex-col rounded-xl border bg-surface p-3.5 shadow-[var(--shadow-card)] transition-[opacity,transform,border-color] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${on ? "translate-y-0 opacity-100 duration-500" : "translate-y-3 opacity-0 duration-200"} ${on && !ok ? "border-[var(--accent-orange-border)]" : "border-hairline"}`}
          >
            <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
              {i ? <CornerDownRight className="h-3 w-3 shrink-0 text-dutchOrange" aria-hidden /> : null}
              <span className="text-link">{s.stage}</span>
              <span className="truncate">{s.kind}</span>
            </p>
            <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-primary">{s.title}</p>
            <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-secondary">{s.body}</p>
            <p className="mt-auto flex items-center justify-between gap-2 pt-3">
              <span className={`inline-flex h-6 items-center gap-1 rounded-full px-2 font-mono text-[11px] transition-colors duration-300 ${ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                {ok ? <Check className="h-3 w-3" aria-hidden /> : null}
                {ok ? (i ? FAST.approved : FAST.first) : FAST.draft}
              </span>
              {/* the approve step, drawn: a picture of the button the workbench shows on every draft */}
              {i ? (
                <span
                  aria-hidden="true"
                  className={`inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-medium transition-[opacity,transform,background-color,color,border-color] duration-200 ${ok ? "border-transparent opacity-0" : pressing === i ? "scale-95 border-transparent bg-action text-white" : "border-hairline text-secondary"}`}
                >
                  {FAST.approve}
                </span>
              ) : null}
              {i === last && !ok ? <span className="sr-only">{FAST.waits}</span> : null}
            </p>
          </li>
        );
      })}
      <li className="flex min-h-[176px] items-center rounded-xl border border-dashed border-hairline p-3.5" aria-hidden={false}>
        <p className="text-[13px] leading-relaxed text-secondary">{FAST.note}</p>
      </li>
    </ol>
  );
}
