"use client";

// The hero's visual: the transformation itself. One line of an idea is typed into a field (the owner's own first
// note), then nine stage outputs appear one after another along a line that runs from "Idea" to "On sale": a
// brief, a claim with its source, the parts list with its total, a corner of the schematic, the 3D model, the
// printed part, the unit cost, an ad and a sales channel. Each is a small artefact drawn from the example's seeded
// rows (Artefacts.tsx). Then it holds, clears and runs again.
//
// The server sends the finished picture: the whole line typed and every artefact in place. That is what stays
// under reduced motion, without script and while the hero is off screen. Each artefact has its own fixed cell and
// only opacity and transform change, so nothing on the page moves. There is no pause control (owner, 22 Nov).
import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { ARTEFACT_KEYS, Artefact } from "./Artefacts";
import type { HeroFacts } from "./storyData";
import { useAnimated } from "./useAnimated";
import { HERO_FLOW } from "./content";

const N: number = ARTEFACT_KEYS.length;
const TYPE_MS = 30; // per two characters
const STEP_MS = 760;
const HOLD_MS = 3400;

export function HeroFlow({ idea, facts }: { idea: string; facts: HeroFacts }) {
  const ref = useRef<HTMLElement>(null);
  const animated = useAnimated();
  const seen = useInView(ref, { amount: 0.3 });
  const running = animated && seen;
  const [lap, setLap] = useState({ typed: idea.length, shown: N });

  useEffect(() => {
    if (!running) return;
    let alive = true;
    let timer = 0;
    const wait = (ms: number) => new Promise<void>((done) => (timer = window.setTimeout(done, ms)));
    void (async () => {
      // the first lap starts from the finished picture the server sent, so nothing blinks on arrival
      await wait(1600);
      while (alive) {
        setLap({ typed: 0, shown: 0 });
        await wait(650);
        for (let c = 2; c < idea.length && alive; c += 2) {
          setLap({ typed: c, shown: 0 });
          await wait(TYPE_MS);
        }
        setLap({ typed: idea.length, shown: 0 });
        await wait(420);
        for (let k = 1; k <= N && alive; k++) {
          setLap({ typed: idea.length, shown: k });
          await wait(STEP_MS);
        }
        await wait(HOLD_MS);
      }
    })();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [running, idea.length]);

  const typed = running ? lap.typed : idea.length;
  const shown = running ? lap.shown : N;
  const typing = running && typed < idea.length;

  return (
    <figure ref={ref} aria-label={HERO_FLOW.label} className="min-w-0">
      {/* the idea, as one line */}
      <div className="rounded-lg border border-hairline bg-surface px-3 py-2.5 shadow-[var(--shadow-card)]">
        <p className="font-mono text-[10px] text-muted">{HERO_FLOW.field}</p>
        <p className="relative mt-1 text-[13px] leading-snug text-primary sm:text-sm">
          {/* the whole line holds the height; the typed part is laid over it */}
          <span className={running ? "invisible" : ""}>{idea}</span>
          {running ? (
            <span className="absolute inset-0" aria-hidden="true">
              {idea.slice(0, typed)}
              <span className={`ml-px inline-block h-[1.05em] w-[2px] translate-y-[0.18em] bg-dutchOrange ${typing ? "" : "wl-caret"}`} />
            </span>
          ) : null}
        </p>
      </div>

      {/* the line from Idea to On sale */}
      <div className="mt-3 flex items-center gap-2.5 font-mono text-[10px]" aria-hidden="true">
        <span className="text-primary">{HERO_FLOW.from}</span>
        <span className="relative h-[3px] min-w-0 flex-1 rounded-full bg-[var(--border-hairline)]">
          <span className="absolute inset-0 origin-left rounded-full bg-dutchOrange transition-transform duration-700 ease-out" style={{ transform: `scaleX(${shown / N})` }} />
          <span className="absolute inset-0 flex items-center justify-between">
            {ARTEFACT_KEYS.map((k, i) => (
              <span key={k} className={`h-[7px] w-[7px] rounded-full border transition-colors duration-300 ${i < shown ? "border-dutchOrange bg-dutchOrange" : "border-hairline bg-canvas"}`} />
            ))}
          </span>
        </span>
        <span className={`rounded-full px-2 py-0.5 transition-colors duration-500 ${shown === N ? "bg-action text-white" : "bg-subtle text-secondary"}`}>{HERO_FLOW.to}</span>
      </div>

      {/* the outputs, in the order the stages make them */}
      <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ARTEFACT_KEYS.map((k, i) => (
          <li
            key={k}
            className={`transition-[opacity,transform] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${i < shown ? "translate-y-0 scale-100 opacity-100 duration-500" : "translate-y-3 scale-[0.96] opacity-0 duration-300"} ${i === N - 1 ? "col-span-2 sm:col-span-1" : ""}`}
          >
            <Artefact kind={k} facts={facts} />
          </li>
        ))}
      </ol>
      <figcaption className="mt-3 flex items-start gap-2 font-mono text-[11px] leading-relaxed text-muted">
        <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-dutchOrange" aria-hidden />
        {HERO_FLOW.caption}
      </figcaption>
    </figure>
  );
}
