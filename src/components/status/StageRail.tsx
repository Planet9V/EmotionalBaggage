"use client";

// The seven stages as one rail, idea to sale: a station per stage, its gate drawn as a ring cut into one segment
// per check (lit for a met check), the stage's status in words beneath, and the track lit up to where the concept
// is. Across the page from md up; down the page on a phone. Every station is a link to that stage's gate below.
//
// The ring is decoration that repeats what the words say: the status and "4 of 6" are always written out, and
// the station's link names them, so nothing is carried by colour or the drawing alone. The only motion is the
// track filling once and the current station's halo; both rest under reduced motion.
import { Check, OctagonAlert } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { STATUS_WORD, type StageCard, type StageStatus } from "./derive";

const R = 21;
const C = 2 * Math.PI * R;

/** The gate as a segmented ring: one arc per check, lit when met. */
function GateRing({ stage, current }: { stage: StageCard; current: boolean }) {
  const n = Math.max(1, stage.total);
  const gap = n > 1 ? 3.2 : 0;
  const seg = C / n - gap;
  const passed = stage.status === "passed";
  const blocked = stage.status === "blocked";
  return (
    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
      {current && <span aria-hidden className="absolute inset-[-5px] rounded-full bg-dutchOrange/12 motion-safe:animate-pulse-slow" />}
      <span aria-hidden className={`absolute inset-0 rounded-full bg-surface ${current ? "ring-1 ring-dutchOrange/40" : ""}`} />
      <svg viewBox="0 0 56 56" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        {Array.from({ length: n }, (_, i) => {
          const met = stage.total > 0 && stage.checks[i]?.met;
          return (
            <circle
              key={i}
              cx="28"
              cy="28"
              r={R}
              fill="none"
              strokeWidth={4}
              strokeLinecap="butt"
              strokeDasharray={`${seg} ${C - seg}`}
              strokeDashoffset={-(i * C) / n}
              className={met ? "stroke-dutchOrange" : "stroke-[var(--border-hairline)]"}
            />
          );
        })}
      </svg>
      <span
        className={`relative flex h-9 w-9 items-center justify-center rounded-full font-mono text-xs font-semibold ${
          passed ? "bg-action text-white" : blocked ? "bg-danger-soft text-danger" : current ? "text-link" : "text-muted"
        }`}
      >
        {passed ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : blocked ? <OctagonAlert className="h-4 w-4" aria-hidden /> : String(stage.n).padStart(2, "0")}
      </span>
    </span>
  );
}

const WORD_TONE: Record<StageStatus, string> = {
  passed: "text-success",
  blocked: "text-danger",
  "in-progress": "text-info",
  "not-started": "text-muted",
};

export function StageRail({ stages, currentKey }: { stages: StageCard[]; currentKey: string }) {
  const reduced = useReducedMotion();
  const ci = Math.max(0, stages.findIndex((s) => s.key === currentKey));
  const share = stages.length > 1 ? ci / (stages.length - 1) : 0;
  const transition = { duration: 0.9, ease: [0.2, 0, 0, 1] as const, delay: 0.15 };

  return (
    <ol aria-label="The seven stages, idea to sale" className="relative grid gap-y-1 md:grid-cols-7 md:gap-y-0">
      {/* the track: down the page on a phone, across it from md up; lit from the first station to the current one */}
      <span aria-hidden className="absolute bottom-7 left-7 top-7 w-0.5 -translate-x-1/2 bg-[var(--border-hairline)] md:hidden" />
      <motion.span
        aria-hidden
        className="absolute left-7 top-7 w-0.5 origin-top -translate-x-1/2 bg-dutchOrange md:hidden"
        style={{ height: `calc((100% - 3.5rem) * ${share})` }}
        initial={reduced ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={transition}
      />
      <span aria-hidden className="absolute left-[calc(100%/14)] right-[calc(100%/14)] top-7 hidden h-0.5 -translate-y-1/2 bg-[var(--border-hairline)] md:block" />
      <motion.span
        aria-hidden
        className="absolute left-[calc(100%/14)] top-7 hidden h-0.5 origin-left -translate-y-1/2 bg-dutchOrange md:block"
        style={{ width: `calc((100% - 100% / 7) * ${share})` }}
        initial={reduced ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={transition}
      />
      {stages.map((s, i) => {
        const current = i === ci;
        return (
          <li key={s.key} aria-current={current ? "step" : undefined} className="relative">
            <a
              href={`#stage-${s.key}`}
              className="group flex items-center gap-4 rounded-lg py-1.5 pr-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange md:flex-col md:gap-2.5 md:px-1 md:py-0 md:pb-1 md:text-center"
            >
              <GateRing stage={s} current={current} />
              <span className="min-w-0">
                <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  {String(s.n).padStart(2, "0")}
                  {current && <span className="ml-1.5 text-link">Now</span>}
                </span>
                <span className={`block text-sm font-semibold tracking-tight group-hover:text-link ${current ? "text-primary" : "text-primary/90"}`}>{s.label}</span>
                <span className="mt-0.5 flex items-baseline gap-2 md:flex-col md:items-center md:gap-0.5">
                  <span className={`text-xs font-medium ${WORD_TONE[s.status]}`}>
                    {STATUS_WORD[s.status]}
                    {s.byOverride ? " by override" : ""}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-muted">
                    {s.met}/{s.total}
                    <span className="sr-only"> checks met</span>
                  </span>
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}
