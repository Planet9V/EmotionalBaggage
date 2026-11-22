"use client";

// "It started as a joke": the origin of the idea this page follows, shown as a short silent film. Each scene is
// one of the circumstances from the owner's launch script, staged as a small lit set: the bag is put through it,
// the gadget senses what happened (the label in the lower third), and after a beat the bag says its line as a
// subtitle. The film plays through and loops, with a split-flap slate between scenes; the chapter list cuts to any
// scene. There is no pause control. It starts silent; the visitor may turn the voices on (the sound control, the
// introduction and the clips are in ./SoundControl.tsx and ./voiceTrack.ts). The film is three-dimensional and loads only when the
// section nears the window; until then, and wherever it cannot or should not run (no 3D, a device that cannot keep
// pace, reduced motion, no script), a drawn safety-card frame stands in its place, with the scene's line set over it.
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useInView } from "motion/react";
import { useAnimated, useHydrated } from "../useAnimated";
import { ORIGIN, SCENES, SLATE_MS, SPEAKER, cueName, lineAt, lineText, saidAt, type SceneId } from "./scenes";
import { INTRO, INTRO_CUE, SOUND, introText } from "./voiceScript";
import { heldQueue, preloadList, speechLevelAt, startOffset, voiceTrack, type VoiceManifest } from "./voiceTrack";
import { SoundControl, VoiceIntro } from "./SoundControl";
import { Still } from "./Still";
import { Slate } from "./Slate";
import { filmMode, paceVerdict } from "./pace";

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
/** Dispatched by other parts of the page (the toy) to cut the film to a scene. */
const PLAY_EVENT = "c2r:origin-scene";
const NO_VOICE: VoiceManifest = {};
/** The introduction is heard once a visit: kept for the tab, not beyond it. */
const INTRO_HEARD = "c2r:voice-intro";
function introHeard() {
  try {
    return sessionStorage.getItem(INTRO_HEARD) === "1";
  } catch {
    return false;
  }
}
function markIntroHeard() {
  try {
    sessionStorage.setItem(INTRO_HEARD, "1");
  } catch {
    // private browsing: it plays again on the next visit to the control
  }
}

/** `voice` is the published voice-over set, worked out on the server: cue -> clip address, length, loudness envelope. */
export function OriginScenes({ className = "", bare = false, voice = NO_VOICE }: { className?: string; bare?: boolean; voice?: VoiceManifest }) {
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
  // the sound control has been used; the introduction is up; the cue being spoken over a held picture
  const [asked, setAsked] = useState(false);
  const [intro, setIntro] = useState(false);
  const [held, setHeld] = useState("");
  const capable = useMemo(() => hydrated && hasWebGl(), [hydrated]);
  const mode = useMemo(() => (hydrated ? filmMode(window.location.search) : "normal"), [hydrated]);

  const scene = SCENES[cut.idx]!;
  // reduced motion gets the drawn frames, not a held picture of the film
  const film = capable && near && !slow && (animated || frozen);
  const moving = animated && !frozen;
  // the introduction holds the film: the clock does not run under it
  const playing = film && ready && moving && seen && !intro;
  // no clock runs (reduced motion, the drawn frames, before the film is ready): the voices then follow their own order
  const still = !(film && ready && moving);
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
    setIntro(false);
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
      setIntro(false);
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
    const verdict = paceVerdict(ms, sharp, mode);
    if (verdict === "soften") setSharp(false);
    else if (verdict === "stills") setSlow(true);
  };
  const onInfo = (calls: number, triangles: number) => {
    count(store, "calls", calls);
    count(store, "triangles", triangles);
  };

  const heldLine = still && held ? scene.lines.find((l) => cueName(scene, l) === held) : undefined;
  const line = cut.slate || intro ? null : (heldLine ?? lineAt(scene, t));
  const said = line ? (line.who === "bag" && !heldLine ? saidAt(line, t) : lineText(line)) : "";
  const full = line ? lineText(line) : "";
  const lit = !cut.slate && t >= scene.litAt;
  const spoken = line ? `${line.who === "bag" ? "The bag" : SPEAKER[line.who]}: ${full}` : "";

  // the voice track: with the sound on, a cue's clip starts with its subtitle (from the matching moment when it is
  // joined late), and a cut to the slate or to another scene, or the film leaving the window, silences it
  const cue = line && playing ? cueName(scene, line) : "";
  const lineStart = line ? line.parts[0]!.at : 0;
  // how loud the line is at this moment of its clip, sound on or off: the bag's mark beside its subtitle moves with it
  const level = line && !heldLine ? speechLevelAt(cueName(scene, line), (t - lineStart) / 1000) : 0;
  useEffect(() => voiceTrack.setManifest(voice), [voice]);
  useEffect(() => () => voiceTrack.stop(), []);
  useEffect(() => {
    if (!sound || intro || still) return;
    if (!cue) voiceTrack.stop();
    else voiceTrack.play(cue, startOffset(voice[cue]?.seconds ?? 0, (store.t - lineStart) / 1000));
  }, [sound, intro, still, cue, lineStart, cut.run, voice, store]);
  // clips are fetched one scene ahead, once the visitor has shown they want sound
  useEffect(() => {
    if (sound) voiceTrack.preload(preloadList(voice, SCENES, cut.idx));
  }, [sound, cut.idx, voice]);
  // over a held picture the scene's lines are spoken in order, each shown as it is said
  useEffect(() => {
    if (!sound || intro || !still || !seen) return;
    voiceTrack.playQueue(heldQueue(voice, scene), setHeld);
    return () => {
      voiceTrack.stop();
      setHeld("");
    };
  }, [sound, intro, still, seen, scene, cut.run, voice]);

  // the introduction ends (heard out, skipped, or the section left): scene 1 starts from its top
  const endIntro = () => {
    markIntroHeard();
    voiceTrack.stop();
    setIntro(false);
    setTime(store, animated ? 0 : SCENES[0]!.stillAt);
    mark(store, 0, false);
    setTick(0);
    setCut((c) => ({ idx: 0, slate: false, run: c.run + 1 }));
  };
  const leftDuringIntro = intro && !seen;
  useEffect(() => {
    if (leftDuringIntro) voiceTrack.stop();
  }, [leftDuringIntro]);
  // the sound control: the element is made and first played inside this click, never before it
  const toggleSound = () => {
    setAsked(true);
    if (sound) {
      voiceTrack.stop();
      setIntro(false);
      setSound(false);
      return;
    }
    voiceTrack.unlock();
    setSound(true);
    if (voiceTrack.has(INTRO_CUE) && !introHeard()) {
      setIntro(true);
      voiceTrack.play(INTRO_CUE, 0, endIntro);
    }
  };

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
            <div ref={frame} id="origin-stage" data-film={film ? "film" : "stills"} className="sc-stage relative mx-auto aspect-[4/3] w-full max-w-[1040px] scroll-mt-6 overflow-hidden rounded-xl bg-black ring-1 ring-hairline sm:aspect-video">
              <Still scene={scene.id} n={cut.idx + 1} />
              {film ? (
                <div className={`absolute inset-0 motion-safe:transition-opacity motion-safe:duration-500 ${ready ? "opacity-100" : "opacity-0"}`}>
                  <Film scene={scene.id} duration={scene.duration} clock={store} playing={playing} sharp={sharp} stamp={`${cut.idx}:${cut.run}:${moving}:${frozen ? tick : ""}`} onReady={() => setReady(true)} onPace={onPace} onInfo={onInfo} />
                </div>
              ) : null}

              {intro ? <VoiceIntro onSkip={endIntro} /> : null}

              {/* the subtitle band: the bag's lines are typed on; the people's lines are plain */}
              {line ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-[14.5%] flex justify-center px-3 sm:px-8" aria-hidden="true">
                  {line.who === "bag" ? (
                    <p key={`${cut.idx}${cut.run}${full}`} className="sc-line max-w-[34ch] text-center text-[15px] font-semibold tracking-tight text-white sm:text-[22px] lg:text-[26px]">
                      <span className="sc-sub">
                        <span className="mr-2 inline-block h-3 w-2 rounded-[2px] bg-dutchOrange sm:h-[17px] sm:w-[11px]" style={level ? { opacity: 0.5 + level / 2 } : undefined} />
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
              <div className="absolute inset-x-0 top-0 h-[7%] min-h-6 bg-black" />
              {/* a sound switch, not a pause: the film never stops, and never starts sound by itself */}
              <SoundControl sound={sound} asked={asked} empty={voiceTrack.empty && !voice[INTRO_CUE]} onToggle={toggleSound} onIntent={() => voiceTrack.preload([INTRO_CUE, ...preloadList(voice, SCENES, cut.idx)])} />
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
            {/* said plainly beside the sound control: the voices are synthetic; and the introduction in words */}
            <div className="mx-auto mt-2 flex w-full max-w-[1040px] flex-wrap items-start gap-x-4 gap-y-1 text-xs text-secondary">
              <p>{SOUND.synthetic}</p>
              <details className="min-w-0">
                <summary className="cursor-pointer text-link underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">{SOUND.transcript}</summary>
                <p className="mt-1 max-w-[68ch] leading-relaxed">
                  {INTRO.title}, spoken by a narrator before scene 1 when the sound is first turned on: &ldquo;{introText()}&rdquo;
                </p>
              </details>
            </div>
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
