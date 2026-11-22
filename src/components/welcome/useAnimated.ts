"use client";

// Two questions every animated piece of the welcome page asks before it moves anything.
import { useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";

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

/**
 * True once the page runs in a browser whose owner has not asked for reduced motion. The server and the first
 * paint render the still version, so the page reads completely without script and without motion.
 */
export function useAnimated() {
  const hydrated = useHydrated();
  const reduced = useReducedMotion();
  return hydrated && !reduced;
}

/** True once the page runs in a browser; false on the server and for the first paint. */
export function useHydrated() {
  return useSyncExternalStore(never, () => true, () => false);
}

/** Scroll-linked motion is for wide screens only (lg and up); on a phone the page is a plain stacked read. */
export function useWide() {
  return useMedia("(min-width: 1024px)");
}
