"use client";

// On a touch screen a canvas that takes drags would trap the page: a finger that lands on it could no longer
// scroll. So on touch devices each canvas starts asleep under a clear overlay: a vertical drag scrolls the page
// as usual, and a tap wakes the canvas ("Tap to explore"). It goes back to sleep on a tap anywhere outside it.
// With a mouse there is no overlay at all: a drag turns or pans at once, and the wheel is left to the page.
// It is not a pause control: whatever the canvas animates keeps running underneath.
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Hand } from "lucide-react";
import { ENGINEERING } from "./content";

const never = () => () => {};
/** True on a device whose main pointer is a finger. False on the server and for the first paint. */
function useTouch() {
  return useSyncExternalStore(never, () => window.matchMedia("(hover: none) and (pointer: coarse)").matches, () => false);
}

export function TapToExplore({ children, className = "relative" }: { children: ReactNode; /** must position the box (relative or absolute): the overlay fills it */ className?: string }) {
  const touch = useTouch();
  const box = useRef<HTMLDivElement>(null);
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    if (!awake) return;
    const outside = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setAwake(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [awake]);
  return (
    <div ref={box} className={className}>
      {children}
      {touch && !awake ? (
        <button type="button" onClick={() => setAwake(true)} className="absolute inset-0 z-20 flex touch-pan-y items-end justify-center bg-transparent pb-14 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline bg-[#131519] px-4 text-[13px] font-medium text-white shadow-[var(--shadow-card)]">
            <Hand className="h-4 w-4" aria-hidden /> {ENGINEERING.tap}
          </span>
        </button>
      ) : null}
    </div>
  );
}
