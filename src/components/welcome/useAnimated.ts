"use client";

// The questions every moving piece of the welcome page asks before it moves anything. Motion is on for every
// visitor by default and the page has no pause control of its own (owner, 22 Nov); it is off only for a visitor
// whose operating system asks for reduced motion, and each loop rests while its section is off screen.
import { useEffect, useSyncExternalStore, type RefObject } from "react";
import { animate, useInView, useMotionValue, useReducedMotion, type MotionValue } from "motion/react";

const never = () => () => {};
function useMedia(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", notify);
      return () => m.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True once the page runs in a browser; false on the server and for the first paint. */
export function useHydrated() {
  return useSyncExternalStore(never, () => true, () => false);
}

/**
 * True when things may move: in a browser whose owner has not asked for reduced motion. The server and the first
 * paint render the still version, so the page reads completely without script and without motion.
 */
export function useAnimated() {
  const hydrated = useHydrated();
  const reduced = useReducedMotion();
  return hydrated && !reduced;
}

/** Scroll-linked motion is for wide screens only (lg and up). */
export function useWide() {
  return useMedia("(min-width: 1024px)");
}

/**
 * A value that runs 0 to 1 again and again, `seconds` a lap, while `ref` is on screen and things may move.
 * Off screen or under reduced motion it rests at 1, which every drawing treats as its finished pose.
 */
export function useLoop(ref: RefObject<Element | null>, seconds: number): MotionValue<number> {
  const t = useMotionValue(1);
  const animated = useAnimated();
  const seen = useInView(ref, { amount: 0.25 });
  useEffect(() => {
    if (!animated || !seen) return;
    const run = animate(t, [0, 1], { duration: seconds, ease: "linear", repeat: Infinity });
    return () => {
      run.stop();
      t.set(1);
    };
  }, [animated, seen, seconds, t]);
  return t;
}
