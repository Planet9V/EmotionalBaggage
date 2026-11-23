"use client";

// The questions every moving piece of the welcome page asks before it moves anything. Motion is on for every
// visitor by default and the page has no pause control of its own (owner, 22 Nov); it is off only for a visitor
// whose operating system asks for reduced motion, and each loop rests while its section is off screen.
import { useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";

const never = () => () => {};

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
