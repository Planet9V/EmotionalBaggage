"use client";

// "It started as a joke": the origin of the idea this page follows, shown as a short silent film. Each scene is
// one of the circumstances from the owner's launch script, staged as a small lit set: the bag is put through it,
// the gadget senses what happened (the label in the lower third), and after a beat the bag says its line as a
// subtitle. The film plays through and loops, with a split-flap slate between scenes; the chapter list cuts to any
// scene. There is no pause control and no sound (owner). The film is three-dimensional and loads only when the
// section nears the window; until then, and wherever it cannot or should not run (no 3D, a device that cannot keep
// pace, reduced motion, no script), a drawn safety-card frame stands in its place, with the scene's line set over it.
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useInView } from "motion/react";
import { useAnimated, useHydrated } from "../useAnimated";
import { ORIGIN, RECORDED, SCENES, SLATE_MS, SPEAKER, cueName, lineAt, lineText, saidAt, type SceneId } from "./scenes";
import { Still } from "./Still";
import { Slate } from "./Slate";

const Film = dynamic(() => import("./film/Film"), { ssr: false });

/** What is playing: which scene, whether the slate before it is up, and a count that restarts a scene chosen twice. */
type Cut = { idx: number; slate: boolean; run: number };
/** The film's clock and counters, shared with the canvas. Changed in place, outside React's data flow. */
type Store = { t: number; idx: number; slate: boolean; pace: number; calls: number; triangles: number };

function setTime(store: Store, t: number) {
  store.t = t;
}
/** Records which scene is up, so the clock can tell when it ends without asking React. */
function mark(store: Store, idx: number, slate: boolean) {
  store.idx = idx;
  store.slate = slate;
}
function count(store: Store, key: "pace" | "calls" | "triangles", value: number) {
  store[key] = value;
}
function hasWebGl() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}
const TICK = 40;
/** The slowest the film may run, as the average time of a frame over two seconds: past this it is not a film. */
const SLOW_MS = 40;
/** Dispatched by other parts of the page (the toy) to cut the film to a scene. */
const PLAY_EVENT = "c2r:origin-scene";

export function OriginScenes({ className = "", bare = false }: { className?: string; bare?: boolean }) {
  const hydrated = useHydrated();
  const animated = useAnimated();
  const section = useRef<HTMLElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const near = useInView(section, { margin: "600px 0px", once: true });
  const seen = useInView(frame, { amount: 0.2 });
  const [store] = useState<Store>(() => ({ t: 0, idx: 0, slate: false, pace: 0, calls: 0, triangles: 0 }));
  const [cut, setCut] = useState<Cut>({ idx: 0, slate: false, run: 0 });
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  const [sharp, setSharp] = useState(true);
  const [slow, setSlow] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [sound, setSound] = useState(false);
  const capable = useMemo(() => hydrated && hasWebGl(), [hydrated]);
  const forced = useMemo(() => hydrated && new URLSearchParams(window.location.search).get("film") === "force", [hydrated]);

  const scene = SCENES[cut.idx]!;
  // reduced motion gets the drawn frames, not a held picture of the film
  const film = capable && near && !slow && (animated || frozen);
  const moving = animated && !frozen;
  const playing = film && ready && moving && seen;
  // a held frame: under reduced motion, in the drawn stills, and before the film is ready
  const t = moving && film && ready ? tick : frozen ? tick : scene.stillAt;
  const slate = cut.slate && (playing || frozen);

  // the clock: it runs only while the film is on screen
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      setTime(store, store.t + dt);
      if (store.t >= (store.slate ? SLATE_MS : SCENES[store.idx]!.duration)) {
        // the slate gives way to its scene; a scene gives way to the next scene's slate
        setTime(store, 0);
        if (store.slate) mark(store, store.idx, false);
        else mark(store, (store.idx + 1) % SCENES.length, true);
        const next = { idx: store.idx, slate: store.slate };
        setCut((c) => ({ ...next, run: c.run }));
      }
      const q = Math.floor(store.t / TICK) * TICK;
      setTick((was) => (was === q ? was : q));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, store]);

  // a held frame shows the scene's chosen moment
  useEffect(() => {
    if (!animated) setTime(store, scene.stillAt);
  }, [animated, scene, store, cut.run]);

  const choose = (idx: number) => {
    setTime(store, animated ? 0 : SCENES[idx]!.stillAt);
    mark(store, idx, false);
    setTick(0);
    setCut((c) => ({ idx, slate: false, run: c.run + 1 }));
  };

  // the toy further down the page can cut to a scene
  useEffect(() => {
    const on = (e: Event) => {
      const idx = SCENES.findIndex((s) => s.id === (e as CustomEvent<SceneId>).detail);
      if (idx < 0) return;
      setTime(store, 0);
      mark(store, idx, false);
      setTick(0);
      setCut((c) => ({ idx, slate: false, run: c.run + 1 }));
    };
    window.addEventListener(PLAY_EVENT, on);
    return () => window.removeEventListener(PLAY_EVENT, on);
  }, [store]);

  // for the screenshot script, outside production: hold the film on any moment of any scene
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const hook = {
      seek: (idx: number, at: number) => {
        setFrozen(true);
        setTime(store, at);
        mark(store, idx, false);
        setTick(at);
        setCut((c) => ({ idx, slate: false, run: c.run + 1 }));
      },
      slate: (idx: number, at: number) => {
        setFrozen(true);
        setTime(store, at);
        mark(store, idx, true);
        setTick(at);
        setCut((c) => ({ idx, slate: true, run: c.run + 1 }));
      },
      play: () => setFrozen(false),
      info: () => ({ pace: store.pace, calls: store.calls, triangles: store.triangles }),
    };
    Object.assign(window, { __film: hook });
  }, [store]);

  // the film is measured on the visitor's own device, two seconds at a time: a device that cannot keep pace first
  // gives up sharpness, and if that is not enough gives up the film for the drawn frames
  const onPace = (ms: number) => {
    count(store, "pace", ms);
    if (forced || ms <= SLOW_MS) return;
    if (sharp) setSharp(false);
    else setSlow(true);
  };
  const onInfo = (calls: number, triangles: number) => {
    count(store, "calls", calls);
    count(store, "triangles", triangles);
  };

  const line = cut.slate ? null : lineAt(scene, t);
  const said = line ? (line.who === "bag" ? saidAt(line, t) : lineText(line)) : "";
  const full = line ? lineText(line) : "";
  const lit = !cut.slate && t >= scene.litAt;
  const spoken = line ? `${line.who === "bag" ? "The bag" : SPEAKER[line.who]}: ${full}` : "";

  // the narration track: with the sound switched on, a cue that has a recording plays as its subtitle starts
  const cue = line && playing ? cueName(scene, line) : "";
  useEffect(() => {
    if (!sound || !cue || !RECORDED.includes(cue)) return;
    const voice = new Audio(`/audio/scenes/${cue}.mp3`);
    void voice.play().catch(() => {});
    return () => voice.pause();
  }, [sound, cue, cut.run]);

  return (
    <section ref={section} id="origin" aria-labelledby="origin-title" className={`scroll-mt-4 ${bare ? "" : "border-b border-hairline py-9 sm:py-11"} ${className}`}>
      <div className={bare ? "" : "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8"}>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="mb-2 font-mono text-xs text-link">{ORIGIN.eyebrow}</p>
            <h2 id="origin-title" className="text-2xl font-semibold leading-tight tracking-tight text-primary sm:text-[1.75rem]">
              {ORIGIN.title}
            </h2>
          </div>
          <div className="order-last max-w-[68ch] text-[15px] leading-relaxed text-secondary sm:text-base lg:order-none lg:col-span-8">
            {ORIGIN.body.map((p) => (
              <p key={p} className="mb-2">
                {p}
              </p>
            ))}
            <p className="text-primary">{ORIGIN.bridge}</p>
          </div>

          {/* the stage: its own colours, whatever the page's theme */}
          <div className="dark lg:col-span-12">
            <p className="sr-only">{ORIGIN.stageLabel}</p>
            <div ref={frame} id="origin-stage" className="sc-stage relative mx-auto aspect-[4/3] w-full max-w-[1040px] scroll-mt-6 overflow-hidden rounded-xl bg-black ring-1 ring-hairline sm:aspect-video">
              <Still scene={scene.id} n={cut.idx + 1} />
              {film ? (
                <div className={`absolute inset-0 motion-safe:transition-opacity motion-safe:duration-500 ${ready ? "opacity-100" : "opacity-0"}`}>
                  <Film scene={scene.id} duration={scene.duration} clock={store} playing={playing} sharp={sharp} stamp={`${cut.idx}:${cut.run}:${moving}:${frozen ? tick : ""}`} onReady={() => setReady(true)} onPace={onPace} onInfo={onInfo} />
                </div>
              ) : null}

              {/* the subtitle band: the bag's lines are typed on; the people's lines are plain */}
              {line ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-[14.5%] flex justify-center px-3 sm:px-8" aria-hidden="true">
                  {line.who === "bag" ? (
                    <p key={`${cut.idx}${cut.run}${full}`} className="sc-line max-w-[34ch] text-center text-[15px] font-semibold tracking-tight text-white sm:text-[22px] lg:text-[26px]">
                      <span className="sc-sub">
                        <span className="mr-2 inline-block h-3 w-2 rounded-[2px] bg-dutchOrange sm:h-[17px] sm:w-[11px]" />
                        &ldquo;{said}
                        {said.length === full.length ? <>&rdquo;</> : null}
                      </span>
                      <span className="opacity-0">{full.slice(said.length)}</span>
                    </p>
                  ) : (
                    <p key={`${cut.idx}${cut.run}${full}`} className="sc-line max-w-[40ch] text-center text-sm text-white sm:text-lg lg:text-xl">
                      <span className="sc-sub">
                        <span className="mr-2 font-mono text-[11px] text-zinc-300 sm:text-[13px]">{SPEAKER[line.who]}</span>
                        {full}
                      </span>
                    </p>
                  )}
                </div>
              ) : null}

              {/* the slate between scenes: a split-flap board */}
              <div className={`pointer-events-none absolute inset-0 motion-safe:transition-opacity motion-safe:duration-150 ${slate ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
                {slate ? <Slate scene={scene} n={cut.idx + 1} of={SCENES.length} t={tick} /> : null}
              </div>

              {/* the letterbox, with the lower third in the bottom bar */}
              <div className="absolute inset-x-0 top-0 flex h-[7%] min-h-6 items-center justify-end gap-3 bg-black px-3 sm:px-5">
                {sound && RECORDED.length === 0 ? <span className="font-mono text-[10px] text-muted sm:text-[11px]">{ORIGIN.noSound}</span> : null}
                {/* a sound switch, not a pause: the film never stops */}
                <button type="button" aria-pressed={sound} onClick={() => setSound((on) => !on)} className="-my-2 rounded px-1.5 py-2 font-mono text-[10px] text-secondary outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-focus sm:text-[11px]">
                  {sound ? ORIGIN.soundOff : ORIGIN.soundOn}
                </button>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[12%] min-h-9 items-center gap-2 bg-black px-3 font-mono text-[10px] leading-tight sm:gap-3 sm:px-5 sm:text-xs" aria-hidden="true">
                <span className={`h-2 w-2 shrink-0 rounded-full ${lit ? "bg-dutchOrange" : "bg-hairline"}`} />
                <span className={`min-w-0 truncate ${lit ? "text-primary" : "text-muted"}`}>
                  {ORIGIN.sensed}: <span className="font-semibold">{scene.sensed}</span>
                  <span className="text-muted"> · {scene.how}</span>
                </span>
                <span className="ml-auto shrink-0 text-muted">
                  {cut.idx + 1}/{SCENES.length}
                </span>
              </div>
            </div>
            <p aria-live="polite" className="sr-only">
              {spoken}
            </p>
          </div>

          {/* the chapter list: each scene's safety-card frame */}
          <nav aria-label={ORIGIN.chapters} className="lg:col-span-12">
            <ol className="mx-auto grid max-w-[1040px] grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {SCENES.map((s, i) => {
                const on = i === cut.idx;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => choose(i)}
                      aria-current={on ? "true" : undefined}
                      className={`relative flex min-h-11 w-full items-center gap-2.5 overflow-hidden rounded-lg border p-1.5 text-left text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus lg:flex-col lg:items-stretch lg:gap-1.5 ${on ? "border-dutchOrange bg-surface text-primary" : "border-hairline text-secondary hover:bg-surface hover:text-primary"}`}
                    >
                      <span className="block aspect-video w-16 shrink-0 overflow-hidden rounded lg:w-full">
                        <Still scene={s.id} n={i + 1} thumb />
                      </span>
                      <span className="flex min-w-0 items-baseline gap-2 lg:px-1 lg:pb-0.5">
                        <span className={`font-mono text-[11px] ${on ? "text-link" : "text-muted"}`}>{i + 1}</span>
                        <span className="min-w-0">
                          <span className="block leading-tight">{s.title}</span>
                          <span className="hidden truncate font-mono text-[10.5px] font-normal text-muted lg:block">{s.sensed}</span>
                        </span>
                      </span>
                      {on && playing && !cut.slate ? <span className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-dutchOrange" style={{ transform: `scaleX(${Math.min(1, t / scene.duration)})` }} aria-hidden="true" /> : null}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      </div>
    </section>
  );
}
