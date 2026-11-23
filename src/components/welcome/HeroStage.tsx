"use client";

// The hero's picture: the product itself. The worked example's tag (Rev D, A1 "Saddle") hangs by its strap from the
// line that runs from "Idea" to "On sale"; the idea is typed as one line above it (the owner's own first note), and
// four of the example's outputs stand beside it, in the order the stages make them: the schematic and the unit cost
// on the making side, an ad and the listing on the selling side. Every word and number is one of the example's
// seeded rows (storyData.ts).
//
// The server sends the finished picture: the line typed, the four outputs in place and the tag drawn in SVG
// (TagArt). That is what stays without script, under reduced motion, without WebGL and on a device too slow for 3D.
// Otherwise, once the page has painted and gone idle, the tag is replaced in place by the film's own 3D tag
// (hero/HeroTag3D, a separate chunk): same frame, same pose, so nothing jumps, and its box never changes size, so
// nothing on the page moves. The idea then types itself and the outputs arrive one after another; only opacity and
// transform change. There is no pause control (owner, 22 Nov).
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "motion/react";
import { ARTEFACT_KEYS, Artefact } from "./Artefacts";
import { TagArt } from "./TagArt";
import type { HeroFacts } from "./storyData";
import { useAnimated, useHydrated } from "./useAnimated";
import { filmMode, paceVerdict } from "./scenes/pace";
import { TAG_MM } from "./scenes/film/tagShape";
import { BLEED, MARGIN, STRAP_UP } from "./hero/frame";
import { EXAMPLE, HERO_STAGE } from "./content";

const HeroTag3D = dynamic(() => import("./hero/HeroTag3D"), { ssr: false });

const N: number = ARTEFACT_KEYS.length;
const TYPE_MS = 30; // per two characters
const STEP_MS = 900;
const HOLD_MS = 5200;
/** Where each output stands beside the tag from 640 px: making on the left, selling on the right. */
const PLACE = ["sm:col-start-1 sm:row-start-1", "sm:col-start-1 sm:row-start-2", "sm:col-start-3 sm:row-start-1", "sm:col-start-3 sm:row-start-2"];
/** The stops on the line, as shares of its length: two before the strap and two after it. */
const STOPS = [0.2, 0.36, 0.64, 0.8];

function hasWebGl() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}
// the page's own record of the hero's 3D, for the checks that read it (draw calls, pace): not React's to keep
function note(el: HTMLElement | null, key: string, value: string) {
  el?.setAttribute(key, value);
}

export function HeroStage({ idea, facts }: { idea: string; facts: HeroFacts }) {
  const ref = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const hydrated = useHydrated();
  const animated = useAnimated();
  const seen = useInView(ref, { amount: 0.25 });
  const running = animated && seen;
  const [lap, setLap] = useState({ typed: idea.length, shown: N });
  // the 3D tag: asked for once the page is idle, shown once it has drawn, given up if the device cannot keep pace
  const [idle, setIdle] = useState(false);
  const [boxPx, setBoxPx] = useState(0);
  const [ready, setReady] = useState(false);
  const [sharp, setSharp] = useState(true);
  const [slow, setSlow] = useState(false);
  const capable = useMemo(() => hydrated && hasWebGl(), [hydrated]);
  const mode = useMemo(() => (hydrated ? filmMode(window.location.search) : "normal"), [hydrated]);
  const live = capable && animated && idle && !slow && boxPx > 0;

  useEffect(() => {
    if (!hydrated) return;
    // after the hero's text and form have painted and the main thread has rested
    const ask = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 600));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = ask(() => setIdle(true), { timeout: 2500 });
    return () => cancel(id);
  }, [hydrated]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setBoxPx(el.clientHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const seenSize = new ResizeObserver(measure);
    seenSize.observe(el);
    return () => seenSize.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    let alive = true;
    let timer = 0;
    const wait = (ms: number) => new Promise<void>((done) => (timer = window.setTimeout(done, ms)));
    void (async () => {
      // the first lap starts from the finished picture the server sent, so nothing blinks on arrival
      await wait(4200);
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
  // the line is drawn as far as the last output that has arrived; all four, and it reaches "On sale"
  const reach = shown === 0 ? 0 : shown === N ? 1 : STOPS[shown - 1]!;

  const onPointer = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    pointer.current.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    pointer.current.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
  };
  const onLeave = () => {
    pointer.current.x = 0;
    pointer.current.y = 0;
  };
  const onPace = (ms: number, calls: number) => {
    note(ref.current, "data-hero-3d", `${Math.round(ms)}ms ${calls}calls`);
    const verdict = paceVerdict(ms, sharp, mode);
    if (verdict === "soften") setSharp(false);
    else if (verdict === "stills") setSlow(true);
  };

  return (
    <figure ref={ref} aria-label={HERO_STAGE.label(EXAMPLE.name)} className="relative min-w-0" onPointerMove={onPointer} onPointerLeave={onLeave}>
      {/* the light the product stands in: warm, from the upper left, falling off into the page */}
      <div className="pointer-events-none absolute -inset-x-6 -bottom-6 top-10 bg-[radial-gradient(ellipse_52%_46%_at_50%_46%,rgba(214,138,82,0.2),rgba(214,138,82,0.06)_55%,transparent_78%)]" aria-hidden />

      {/* the idea, as one line */}
      <div className="relative rounded-xl border border-hairline bg-surface/85 px-4 py-3 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        <p className="text-[13px] font-medium text-muted">{HERO_STAGE.field}</p>
        <p className="relative mt-1 text-base leading-snug text-primary sm:text-[17px]">
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

      {/* the line from Idea to On sale: the rail the product hangs from */}
      <div className="relative mt-4 flex h-6 items-center gap-3 text-[13px] font-medium" aria-hidden="true">
        <span className="text-primary">{HERO_STAGE.from}</span>
        <span className="relative h-[3px] min-w-0 flex-1 rounded-full bg-[var(--border-hairline)]">
          <span className="absolute inset-0 origin-left rounded-full bg-dutchOrange transition-transform duration-700 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${reach})` }} />
          {STOPS.map((at, i) => (
            <span key={at} className={`absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors duration-300 ${i < shown ? "border-dutchOrange bg-dutchOrange" : "border-hairline bg-canvas"}`} style={{ left: `${at * 100}%` }} />
          ))}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 transition-colors duration-500 ${shown === N ? "bg-action text-white" : "bg-subtle text-secondary"}`}>{HERO_STAGE.to}</span>
      </div>

      <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,264px)_minmax(0,1fr)] sm:grid-rows-2">
        {/* the product, hanging from the rail: drawn by the server, then live */}
        <div className="col-span-2 flex items-start justify-center sm:col-span-1 sm:col-start-2 sm:row-span-2 sm:row-start-1">
          <div ref={box} className="relative -mt-3 w-[62%] max-w-[264px] sm:w-full" style={{ aspectRatio: `${TAG_MM.w + MARGIN * 2} / ${TAG_MM.h + STRAP_UP + MARGIN + 3}` }}>
            <TagArt strap={STRAP_UP} margin={MARGIN} label={HERO_STAGE.tag(EXAMPLE.name, TAG_MM.w, TAG_MM.h, TAG_MM.t)} className={`block h-full w-full transition-opacity duration-500 motion-reduce:transition-none ${live && ready ? "opacity-0" : "opacity-100"}`} />
            {live ? (
              <div className={`pointer-events-none absolute transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`} style={{ left: `${-BLEED.x * 100}%`, right: `${-BLEED.x * 100}%`, top: `${-BLEED.top * 100}%`, bottom: `${-BLEED.bottom * 100}%` }}>
                <HeroTag3D boxPx={boxPx} playing={seen} sharp={sharp} pointer={pointer} onReady={() => setReady(true)} onPace={onPace} />
              </div>
            ) : null}
          </div>
        </div>
        {ARTEFACT_KEYS.map((k, i) => (
          <div
            key={k}
            className={`min-h-[168px] transition-[opacity,transform] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${PLACE[i]} ${i < shown ? "translate-y-0 scale-100 opacity-100 duration-500" : "translate-y-1.5 scale-[0.985] opacity-25 duration-300"}`}
          >
            <Artefact kind={k} facts={facts} />
          </div>
        ))}
      </div>

      <figcaption className="relative mt-4 flex items-start gap-2.5 text-[13px] leading-relaxed text-muted">
        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-dutchOrange" aria-hidden />
        {HERO_STAGE.caption}
      </figcaption>
    </figure>
  );
}
