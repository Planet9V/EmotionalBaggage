"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const RING = ["ring-2", "ring-dutchOrange", "ring-offset-2", "ring-offset-background", "rounded-md"];

/**
 * A next step links to the control that fixes it with `#<id>` (process definitions, `anchor`). Pages load their
 * rows after the address changes, so the control may appear a moment later: this waits for it (up to 5 s), scrolls
 * it into view, moves the keyboard focus to it and outlines it briefly in the accent colour.
 */
export function focusHash(hash: string = typeof window === "undefined" ? "" : window.location.hash) {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (!id) return () => {};
  let tries = 0;
  const timer = window.setInterval(() => {
    const el = document.getElementById(id);
    if (!el && ++tries < 50) return;
    window.clearInterval(timer);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "auto" });
    if (!el.matches("a,button,input,select,textarea,[tabindex]")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    el.classList.add(...RING);
    window.setTimeout(() => el.classList.remove(...RING), 2500);
  }, 100);
  return () => window.clearInterval(timer);
}

/** Runs focusHash on every page change and every change of the address's #part. */
export function DeepLinkFocus() {
  const pathname = usePathname();
  useEffect(() => {
    let stop = focusHash();
    const again = () => {
      stop();
      stop = focusHash();
    };
    window.addEventListener("hashchange", again);
    return () => {
      stop();
      window.removeEventListener("hashchange", again);
    };
  }, [pathname]);
  return null;
}
