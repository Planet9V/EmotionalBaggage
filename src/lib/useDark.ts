"use client";

import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}

/** True while the page is in the dark theme (the `dark` class on <html>); follows the theme switch. */
export function useDark(): boolean {
  return useSyncExternalStore(subscribe, () => document.documentElement.classList.contains("dark"), () => false);
}
