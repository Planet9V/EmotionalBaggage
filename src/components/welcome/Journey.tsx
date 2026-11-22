"use client";

// The journey: seven panels, one per stage. On a wide screen they are a column with a rail that says where you
// are: the rail is position: sticky, its line and luggage tag follow scroll progress, and nothing is ever locked
// or hijacked. On a phone or tablet the same panels are a deck, one stage per slide, swiped sideways (Deck). Everything is in the page from the server and visible without script or motion.
import { Fragment, useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { ArrowUp, Check } from "lucide-react";
import { Shot } from "./Shot";
import { STAGE_PICTURE } from "./StagePieces";
import { stageRows, type JourneyRows } from "./StageRows";
import { Deck } from "./Deck";
import { useAnimated, useWide } from "./useAnimated";
import { BAG_LINES, EXAMPLE, FEATURES, JOURNEY, LIVE_LINK, SHOT_PATH, PROBLEM, type JourneyStage } from "./content";

const N = JOURNEY.length;
const altOf = (shot: string) => FEATURES.find((f) => f.shot === shot)?.alt ?? "";

/** Where the tag sits (0 to 1 down the rail) for a scroll position, given where each panel's middle is. */
function railPosition(p: number, mids: number[]) {
  const xs = [0, ...mids, 1];
  const ys = [0, ...mids.map((_, i) => (i + 0.5) / N), 1];
  for (let i = 1; i < xs.length; i++) {
    if (p <= xs[i]!) {
      const span = xs[i]! - xs[i - 1]! || 1;
      return ys[i - 1]! + ((p - xs[i - 1]!) / span) * (ys[i]! - ys[i - 1]!);
    }
  }
  return 1;
}

function LuggageTag() {
  return (
    <svg viewBox="0 0 24 32" className="h-8 w-6 -translate-y-1/2" aria-hidden="true">
      <path d="M5 1h14l4 6v21a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V7z" fill="var(--accent-orange)" />
      <circle cx="12" cy="8" r="2.6" fill="var(--bg-canvas)" />
      <path d="M7 17h10M7 22h10" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Gate({ checks }: { checks: string[] }) {
  const ref = useRef<HTMLUListElement>(null);
  const animated = useAnimated();
  const seen = useInView(ref, { once: true, amount: 0.6 });
  const [met, setMet] = useState(0);
  useEffect(() => {
    if (!animated || !seen) return;
    let k = 0;
    const t = window.setInterval(() => {
      k += 1;
      setMet(k);
      if (k >= checks.length) window.clearInterval(t);
    }, 320);
    return () => window.clearInterval(t);
  }, [animated, seen, checks.length]);
  return (
    <>
      <p className="sr-only">Gate checks:</p>
      <ul ref={ref} className="space-y-1.5">
        {checks.map((c, i) => {
          const done = !animated || i < met;
          return (
            <li key={c} className="flex items-start gap-2.5 text-[13px] leading-snug text-secondary">
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${done ? "border-transparent bg-success-soft" : "border-hairline"}`}>
                {done ? <Check key="met" className={`h-3 w-3 text-success ${animated ? "wl-tick" : ""}`} aria-hidden /> : null}
              </span>
              {c}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** A screenshot in its frame: a plain browser bar with the page's address, a hairline, one shadow. */
function Frame({ shot, y, className = "" }: { shot: string; y?: MotionValue<number>; className?: string }) {
  return (
    <motion.div style={y ? { y } : undefined} className={`overflow-hidden rounded-xl border border-hairline bg-surface shadow-[var(--shadow-card)] ${className}`}>
      <div className="flex h-7 items-center gap-1.5 border-b border-hairline bg-subtle px-3" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-[var(--border-hairline)]" />
        <span className="h-2 w-2 rounded-full bg-[var(--border-hairline)]" />
        <span className="h-2 w-2 rounded-full bg-[var(--border-hairline)]" />
        <span className="ml-2 truncate font-mono text-[11px] text-muted">{SHOT_PATH[shot]}</span>
      </div>
      <Shot name={shot} alt={altOf(shot)} />
    </motion.div>
  );
}

function Panel({ stage, index, active, rows }: { stage: JourneyStage; index: number; active: boolean; rows: JourneyRows }) {
  const ref = useRef<HTMLElement>(null);
  const animated = useAnimated();
  const wide = useWide();
  const linked = animated && wide;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const yMain = useTransform(scrollYProgress, [0, 1], [14, -14]);
  const pair = stage.pair === undefined ? null : PROBLEM.pairs[stage.pair]!;
  const said = BAG_LINES[stage.line];
  // A stage shows one of three things in its wide column: a screenshot (Concept, Production), the example's own
  // seeded rows (Research, Marketing, Sales), or, for the stages whose views run live in the engineering stage
  // (Design, Prototype), its drawings and a link up to them.
  const table = stageRows(stage.key, rows);
  const under = stage.live ? (stage.extras ?? []) : [];
  const beside = stage.live ? [] : (stage.extras ?? []);

  return (
    <article
      ref={ref}
      id={`stage-${stage.key}`}
      aria-labelledby={`stage-${stage.key}-title`}
      className={`scroll-mt-24 grid items-start gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:py-7 ${index ? "lg:border-t lg:border-hairline" : "lg:pt-0"}`}
    >
      <div className="grid gap-4">
        <div>
          <p className={`font-mono text-xs transition-colors duration-300 ${active ? "text-link" : "text-muted"}`}>
            Gate {stage.n} of 0{N}
          </p>
          <h3 id={`stage-${stage.key}-title`} className="mt-1 text-[1.375rem] font-semibold leading-tight tracking-tight text-primary">{stage.name}</h3>
          <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-secondary">{stage.does}</p>
          <p className="mt-2 hidden font-mono text-[11px] text-muted sm:block">In the app: {stage.inApp}</p>
          {pair ? (
            <dl className="mt-3 hidden gap-x-6 gap-y-2 border-l-2 border-dutchOrange pl-4 text-[13px] leading-relaxed sm:grid sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-primary">Spread over separate tools</dt>
                <dd className="mt-0.5 text-secondary">{pair.before}</dd>
              </div>
              <div>
                <dt className="font-semibold text-primary">In the workbench</dt>
                <dd className="mt-0.5 text-secondary">{pair.after}</dd>
              </div>
            </dl>
          ) : null}
        </div>
        {stage.shots[0] ? <Frame shot={stage.shots[0]} y={linked ? yMain : undefined} /> : null}
        {table}
        {under.length ? (
          <>
            <div className={`grid gap-4 ${under.length > 1 ? "sm:grid-cols-2" : "sm:max-w-md"}`}>{under.map((e) => <Fragment key={e}>{STAGE_PICTURE[e]}</Fragment>)}</div>
            <p>
              <a href="#engineering" className="inline-flex items-center gap-1.5 text-sm font-medium text-link underline-offset-4 hover:underline">
                {LIVE_LINK} <ArrowUp className="h-4 w-4" aria-hidden />
              </a>
            </p>
          </>
        ) : null}
      </div>

      <div className="grid gap-4">
        {/* the luggage tag: what Baggage Claims looked like at this gate, and what the bag had to say about it */}
        <div className="relative rounded-xl border border-hairline bg-surface p-4 pl-6">
          <span className="absolute inset-y-0 left-0 w-1.5 rounded-l-xl bg-dutchOrange" aria-hidden />
          <p className="font-mono text-[11px] text-muted">{EXAMPLE.name} at this stage</p>
          <dl className="mt-3 space-y-2.5">
            {stage.facts.map((f) => (
              <div key={f.label} className="flex items-baseline gap-3">
                <dt className="order-2 text-[13px] leading-snug text-secondary">{f.label}</dt>
                <dd className="order-1 shrink-0 font-mono text-xl font-semibold tabular-nums tracking-tight text-primary">{f.figure}</dd>
              </div>
            ))}
          </dl>
          <figure className="mt-3 border-t border-hairline pt-3">
            <blockquote className="text-base font-semibold leading-snug tracking-tight text-primary">&ldquo;{said.line}&rdquo;</blockquote>
            <figcaption className="mt-1.5 flex items-center gap-2 font-mono text-[11px] text-muted">
              <span className="h-3 w-3 shrink-0 rounded-full border-2 border-dutchOrange bg-[#16181d]" aria-hidden />
              The bag, {said.where}
            </figcaption>
          </figure>
          <div className="mt-3 border-t border-hairline pt-3">
            <Gate checks={stage.gate} />
          </div>
        </div>
        {/* these drawings are for wide screens; on a phone each slide keeps to its main panel */}
        {beside.length ? <div className="hidden gap-4 lg:grid">{beside.map((e) => <Fragment key={e}>{STAGE_PICTURE[e]}</Fragment>)}</div> : null}
      </div>
    </article>
  );
}

export function Journey({ rows }: { rows: JourneyRows }) {
  const ref = useRef<HTMLDivElement>(null);
  const mids = useRef<number[]>(JOURNEY.map((_, i) => (i + 0.5) / N));
  const [active, setActive] = useState(0);
  const animated = useAnimated();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.5", "end 0.5"] });
  const raw = useTransform(scrollYProgress, (p) => railPosition(p, mids.current));
  const along = useSpring(raw, { stiffness: 90, damping: 22, mass: 0.6 });
  const tagY = useTransform(along, (v) => `${v * 100}%`);
  useMotionValueEvent(along, "change", (v) => setActive(Math.min(N - 1, Math.max(0, Math.floor(v * N)))));

  // Where each panel's middle is, as a share of the section. The active stage is the one the tag is beside.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const panels = Array.from(root.querySelectorAll<HTMLElement>("article[id^='stage-']"));
    const measure = () => {
      const top = root.getBoundingClientRect().top;
      const h = root.offsetHeight || 1;
      mids.current = panels.map((p) => {
        const r = p.getBoundingClientRect();
        return (r.top - top + r.height / 2) / h;
      });
    };
    measure();
    const sizes = new ResizeObserver(measure);
    sizes.observe(root);
    return () => {
      sizes.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className="relative lg:grid lg:grid-cols-[9rem_minmax(0,1fr)] lg:gap-10">
      {/* wide screens: the rail stays beside the panels while they scroll */}
      <nav aria-label="Stages of the journey" className="hidden lg:block">
        <div className="sticky top-24">
          <div className="relative">
            <div className="absolute bottom-0 left-[11px] top-0 w-0.5 bg-[var(--border-hairline)]" aria-hidden="true">
              {animated ? <motion.div className="h-full w-full origin-top bg-dutchOrange" style={{ scaleY: along }} /> : null}
            </div>
            {animated ? (
              <motion.div className="pointer-events-none absolute left-0 top-0 h-full w-6" style={{ y: tagY }} aria-hidden="true">
                <LuggageTag />
              </motion.div>
            ) : null}
            <ol>
              {JOURNEY.map((s, i) => (
                <li key={s.key}>
                  <a
                    href={`#stage-${s.key}`}
                    aria-current={active === i ? "step" : undefined}
                    className={`flex h-11 items-center gap-3 pl-9 text-[13px] transition-colors duration-150 hover:text-primary ${active === i ? "font-semibold text-primary" : "text-secondary"}`}
                  >
                    <span className={`font-mono text-xs ${active === i ? "text-link" : "text-muted"}`}>{s.n}</span>
                    {s.name}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </nav>

      {/* one stage per slide on a phone or tablet (swipe sideways); a plain column beside the rail when wide */}
      <div className="min-w-0">
        <Deck label="The journey, stage by stage" tabs={JOURNEY.map((s) => s.name)} untilWide>
          {JOURNEY.map((s, i) => (
            <Panel key={s.key} stage={s} index={i} active={active === i} rows={rows} />
          ))}
        </Deck>
      </div>
    </div>
  );
}
