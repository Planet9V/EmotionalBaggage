"use client";

// The journey: seven panels, one per stage. On a wide screen they are a column with a rail that says where you
// are: the rail is position: sticky, its line and luggage tag follow scroll progress, and nothing is ever locked
// or hijacked. On a phone or tablet the same panels are a deck, one stage per slide, swiped sideways (Deck). Everything is in the page from the server and visible without script or motion.
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { Check } from "lucide-react";
import { Shot } from "./Shot";
import { AdDrafts, CostCount, ExplodedPuck, ListingDraft, PrintLayers, SchematicCorner } from "./StagePieces";
import { Deck } from "./Deck";
import { useAnimated, useWide } from "./useAnimated";
import { BAG_LINES, EXAMPLE, FEATURES, JOURNEY, PROBLEM, type JourneyStage } from "./content";

const N = JOURNEY.length;
const EXTRA: Record<NonNullable<JourneyStage["extras"]>[number], ReactNode> = {
  exploded: <ExplodedPuck />,
  schematic: <SchematicCorner />,
  layers: <PrintLayers />,
  cost: <CostCount />,
  ads: <AdDrafts />,
  listing: <ListingDraft />,
};
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
      <ul ref={ref} className="space-y-2">
        {checks.map((c, i) => {
          const done = !animated || i < met;
          return (
            <li key={c} className="flex items-start gap-2.5 text-sm text-secondary">
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

function Frame({ shot, y, className = "" }: { shot: string; y?: MotionValue<number>; className?: string }) {
  return (
    <motion.div style={y ? { y } : undefined} className={`overflow-hidden rounded-xl border border-hairline bg-surface shadow-[var(--shadow-card)] ${className}`}>
      <Shot name={shot} alt={altOf(shot)} />
    </motion.div>
  );
}

function Panel({ stage, index, active }: { stage: JourneyStage; index: number; active: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const animated = useAnimated();
  const wide = useWide();
  const linked = animated && wide;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const yMain = useTransform(scrollYProgress, [0, 1], [14, -14]);
  const ySecond = useTransform(scrollYProgress, [0, 1], [22, -22]);
  const pair = stage.pair === undefined ? null : PROBLEM.pairs[stage.pair]!;
  const said = BAG_LINES[stage.line];
  // the wide drawings go under the screenshots, the rest beside them, so the two columns end about level
  const under = (stage.extras ?? []).filter((e) => e === "schematic");
  const beside = (stage.extras ?? []).filter((e) => e !== "schematic");

  return (
    <article
      ref={ref}
      id={`stage-${stage.key}`}
      aria-labelledby={`stage-${stage.key}-title`}
      className={`scroll-mt-24 grid items-start gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:py-8 ${index ? "lg:border-t lg:border-hairline" : "lg:pt-0"}`}
    >
      <div className="grid gap-5">
        <div>
          <p className={`font-mono text-sm transition-colors duration-300 ${active ? "text-link" : "text-muted"}`}>
            Gate {stage.n} of 0{N}
          </p>
          <h3 id={`stage-${stage.key}-title`} className="mt-1 text-display-3 font-semibold text-primary">{stage.name}</h3>
          <p className="mt-3 text-base leading-relaxed text-secondary">{stage.does}</p>
          <p className="mt-2 hidden font-mono text-xs text-muted sm:block">In the app: {stage.inApp}</p>
          {pair ? (
            <dl className="mt-4 hidden gap-x-6 gap-y-2 border-l-2 border-dutchOrange pl-4 text-sm sm:grid sm:grid-cols-2">
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
        {/* a second screen sits over the corner of the first on wider screens; the space for it is reserved */}
        <div className={`relative ${stage.shots[1] ? "sm:pb-[10%]" : ""}`}>
          <Frame shot={stage.shots[0]!} y={linked ? yMain : undefined} className={stage.shots[1] ? "sm:w-[88%]" : ""} />
          {stage.shots[1] ? <Frame shot={stage.shots[1]} y={linked ? ySecond : undefined} className="hidden sm:absolute sm:bottom-0 sm:right-0 sm:block sm:w-[50%]" /> : null}
        </div>
        {under.length ? <div className="hidden gap-5 lg:grid">{under.map((e) => <Fragment key={e}>{EXTRA[e]}</Fragment>)}</div> : null}
      </div>

      <div className="grid gap-5">
        {/* the luggage tag: what Baggage Claims looked like at this gate, and what the bag had to say about it */}
        <div className="relative rounded-xl border border-hairline bg-surface p-5 pl-7">
          <span className="absolute inset-y-0 left-0 w-2 rounded-l-xl bg-dutchOrange" aria-hidden />
          <p className="text-sm font-semibold text-primary">{EXAMPLE.name} at this stage</p>
          <dl className="mt-3 space-y-2.5">
            {stage.facts.map((f) => (
              <div key={f.label} className="flex items-baseline gap-3">
                <dt className="order-2 text-sm leading-snug text-secondary">{f.label}</dt>
                <dd className="order-1 shrink-0 font-mono text-2xl font-semibold tabular-nums tracking-tight text-primary">{f.figure}</dd>
              </div>
            ))}
          </dl>
          <figure className="mt-4 border-t border-hairline pt-4">
            <blockquote className="text-lg font-semibold leading-snug tracking-tight text-primary">&ldquo;{said.line}&rdquo;</blockquote>
            <figcaption className="mt-1.5 flex items-center gap-2 font-mono text-xs text-muted">
              <span className="h-3 w-3 shrink-0 rounded-full border-2 border-dutchOrange bg-[#16181d]" aria-hidden />
              The bag, {said.where}
            </figcaption>
          </figure>
          <div className="mt-4 border-t border-hairline pt-4">
            <Gate checks={stage.gate} />
          </div>
        </div>
        {/* the drawings are for wide screens; on a phone each slide keeps to one picture, the screenshot */}
        {beside.length ? <div className="hidden gap-5 lg:grid">{beside.map((e) => <Fragment key={e}>{EXTRA[e]}</Fragment>)}</div> : null}
      </div>
    </article>
  );
}

export function Journey() {
  const ref = useRef<HTMLDivElement>(null);
  const mids = useRef<number[]>(JOURNEY.map((_, i) => (i + 0.5) / N));
  const [active, setActive] = useState(0);
  const animated = useAnimated();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.5", "end 0.5"] });
  const along = useTransform(scrollYProgress, (p) => railPosition(p, mids.current));
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
    <div ref={ref} className="relative lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-12">
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
                    className={`flex h-14 items-center gap-3 pl-10 text-sm transition-colors duration-150 hover:text-primary ${active === i ? "font-semibold text-primary" : "text-secondary"}`}
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
            <Panel key={s.key} stage={s} index={i} active={active === i} />
          ))}
        </Deck>
      </div>
    </div>
  );
}
