"use client";

/**
 * First-party funnel counting for the welcome page (docs/design/early-access.md). Everything goes to this app's own
 * POST /api/events and is stored in its PostgreSQL; nothing is sent to anyone else.
 *
 *   <Tracker />                         once on the page: sends page_view, and handles every click on an element
 *                                       with data-track (see TRACK_KINDS) in one delegated listener
 *   <TrackSection id="pricing">...      wraps a section; sends section_view once per visit when it is first seen
 *   track("film_scene", { scene: "3" }) any other event, from a client component
 *
 * Nothing is recorded when the browser asks not to be tracked (Do Not Track or Global Privacy Control). The visit id
 * is a random value kept in sessionStorage for this browser tab's session only; there is no cookie.
 */
import { useCallback, useEffect, type ReactNode } from "react";
import { UTM_KEYS, type EventDetail, type EventName } from "@/lib/events/shared";

const VISIT_KEY = "c2r_visit";
const SEEN_KEY = "c2r_seen";
const ENDPOINT = "/api/events";

let memoryVisit = "";
const memorySeen = new Set<string>();

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** The browser asked not to be tracked. */
function trackingRefused(): boolean {
  if (typeof navigator === "undefined") return true;
  const n = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const w = window as Window & { doNotTrack?: string };
  return n.globalPrivacyControl === true || n.doNotTrack === "1" || n.doNotTrack === "yes" || n.msDoNotTrack === "1" || w.doNotTrack === "1";
}

/** This browser session's anonymous visit id ("" on the server or when tracking is refused). */
export function visitId(): string {
  if (typeof window === "undefined" || trackingRefused()) return "";
  const s = storage();
  const saved = s?.getItem(VISIT_KEY) ?? memoryVisit;
  if (saved && /^[A-Za-z0-9_-]{8,40}$/.test(saved)) return saved;
  const id = randomId();
  memoryVisit = id;
  try {
    s?.setItem(VISIT_KEY, id);
  } catch {
    // storage full or blocked: the id lives in memory for this page
  }
  return id;
}

/** Sends one event. Never throws and never waits; a failure is dropped. */
export function track(event: EventName, detail: EventDetail = {}, section = ""): void {
  if (typeof window === "undefined" || trackingRefused()) return;
  const visit = visitId();
  if (!visit) return;
  const body = JSON.stringify({ event, path: window.location.pathname, section, visit, detail });
  try {
    void fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" }, credentials: "omit" }).catch(() => undefined);
  } catch {
    // no fetch: nothing to do
  }
}

/** Sends the event only the first time `key` is seen in this visit. */
export function trackOnce(key: string, event: EventName, detail: EventDetail = {}, section = ""): void {
  if (typeof window === "undefined" || trackingRefused()) return;
  const s = storage();
  let seen: string[] = [];
  try {
    seen = JSON.parse(s?.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    seen = [];
  }
  if (seen.includes(key) || memorySeen.has(key)) return;
  memorySeen.add(key);
  try {
    s?.setItem(SEEN_KEY, JSON.stringify([...seen, key].slice(-200)));
  } catch {
    // kept in memory only
  }
  track(event, detail, section);
}

/** A ref callback: section_view for `id`, once per visit, when at least a quarter of the element is in view. */
function useTrackView<T extends Element = HTMLElement>(id: string): (el: T | null) => void | (() => void) {
  return useCallback(
    (el: T | null) => {
      if (!el || typeof IntersectionObserver === "undefined") return;
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            trackOnce(`section:${window.location.pathname}:${id}`, "section_view", {}, id);
            obs.disconnect();
          }
        },
        { threshold: 0.25 }
      );
      obs.observe(el);
      return () => obs.disconnect();
    },
    [id]
  );
}

/** Wraps a section of the page: section_view once per visit; clicks inside carry this id as their section. */
export function TrackSection({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const ref = useTrackView<HTMLDivElement>(id);
  return (
    <div ref={ref} data-track-section={id} className={className}>
      {children}
    </div>
  );
}

/**
 * What a data-track value means: "<kind>:<value>". `data-track="cta:hero"` is a cta_click with { cta: "hero" },
 * `data-track="plan:maker"` a plan_click, `data-track="example:hero"` an example_open, `data-track="sound:film"` a
 * sound_on. The section comes from the nearest TrackSection (data-track-section) around the element.
 */
const TRACK_KINDS = {
  cta: { event: "cta_click", key: "cta" },
  plan: { event: "plan_click", key: "plan" },
  example: { event: "example_open", key: "from" },
  sound: { event: "sound_on", key: "from" },
} as const satisfies Record<string, { event: EventName; key: string }>;

/** Reads one data-track value; null for one that does not follow the convention. */
export function parseTrack(value: string): { event: EventName; detail: EventDetail } | null {
  const m = /^([a-z]+):([a-z0-9_-]{1,40})$/.exec(value.trim());
  if (!m) return null;
  const kind = TRACK_KINDS[m[1] as keyof typeof TRACK_KINDS];
  return kind ? { event: kind.event, detail: { [kind.key]: m[2]! } } : null;
}

const deviceClass = () => (window.matchMedia?.("(max-width: 639px)").matches ? "phone" : window.matchMedia?.("(max-width: 1023px)").matches ? "tablet" : "desktop");

let viewedPath = "";

/**
 * Mount once per page. Sends page_view (referrer host, campaign tags from the address, device class, theme) and
 * listens for clicks on [data-track] anywhere in the page.
 */
export function Tracker() {
  useEffect(() => {
    if (viewedPath !== window.location.pathname) {
      viewedPath = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const detail: EventDetail = { device: deviceClass(), theme: document.documentElement.classList.contains("dark") ? "dark" : "light" };
      let ref = "";
      try {
        ref = document.referrer ? new URL(document.referrer).hostname : "";
      } catch {
        ref = "";
      }
      if (ref && ref !== window.location.hostname) detail.referrer = ref;
      for (const k of UTM_KEYS) {
        const v = params.get(k);
        if (v) detail[k] = v.slice(0, 100);
      }
      track("page_view", detail);
    }
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("[data-track]");
      if (!el) return;
      const parsed = parseTrack(el.getAttribute("data-track") ?? "");
      if (!parsed) return;
      track(parsed.event, parsed.detail, el.closest("[data-track-section]")?.getAttribute("data-track-section") ?? "");
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
