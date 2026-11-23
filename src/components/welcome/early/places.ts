"use client";

/**
 * One store, in the browser, for what every early-access block on the page shows (the page draws up to three):
 *
 *  - the count of places left. The server draws it with the page; after any form on the page has an answer, and
 *    when the tab comes back into view (at most once every REFRESH_MS), it is read again from
 *    GET /api/access-requests/count, and every count line and every form's button follow the new reading;
 *  - this visitor's answer. Once one form has claimed a place, joined the waiting list or been told the address is
 *    on the list, the other forms show that in one line instead of the form, so nobody claims twice by mistake. The
 *    answer is kept in sessionStorage for this tab, so a reload does not offer the form again; "Use another
 *    address" brings it back.
 *
 * Without script none of this runs: each block is the server's plain form and count, as before.
 */
import { useSyncExternalStore } from "react";
import type { EarlyAccessOutcome, PublicPlaces } from "@/lib/accessRequests/shared";

const COUNT_URL = "/api/access-requests/count";
const MINE_KEY = "c2r_early";
/** The least time between two readings of the count when the tab regains focus. */
const REFRESH_MS = 10_000;

let places: PublicPlaces | null = null;
let lastRead = 0;
let memoryMine = "";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

const isCount = (v: unknown): v is PublicPlaces => {
  const p = v as Partial<PublicPlaces> | null;
  return !!p && Number.isInteger(p.left) && Number.isInteger(p.limit) && typeof p.full === "boolean" && p.left! >= 0;
};

const isOutcome = (v: unknown): v is EarlyAccessOutcome => {
  const o = v as { kind?: unknown; place?: unknown; position?: unknown } | null;
  return !!o && ((o.kind === "place" && Number.isInteger(o.place)) || (o.kind === "waiting" && Number.isInteger(o.position)) || o.kind === "listed");
};

/** Reads the count again. Never throws: a failed or refused reading leaves the count as it was. */
async function refresh(fresh: boolean): Promise<void> {
  lastRead = Date.now();
  try {
    const res = await fetch(COUNT_URL, { credentials: "omit", cache: fresh ? "no-store" : "default" });
    if (!res.ok) return;
    const body: unknown = await res.json();
    if (!isCount(body)) return;
    places = { left: body.left, limit: body.limit, full: body.full };
    notify();
  } catch {
    // offline or blocked: the count stays as drawn
  }
}

const onVisible = () => {
  if (document.visibilityState === "hidden" || Date.now() - lastRead < REFRESH_MS) return;
  void refresh(false);
};

function subscribe(listener: () => void): () => void {
  if (!listeners.size) {
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    // the page's own count was read when it was drawn
    if (!lastRead) lastRead = Date.now();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

/** The count of places as last read in this browser, or `initial` (the server's) until it has been read again. */
export function usePlaces(initial: PublicPlaces | null): PublicPlaces | null {
  const read = useSyncExternalStore(subscribe, () => places, () => null);
  return read ?? initial;
}

function mineRaw(): string {
  try {
    return storage()?.getItem(MINE_KEY) || memoryMine;
  } catch {
    return memoryMine;
  }
}
let parsedRaw = "";
let parsed: EarlyAccessOutcome | null = null;
function mineSnapshot(): EarlyAccessOutcome | null {
  const raw = mineRaw();
  if (raw !== parsedRaw) {
    parsedRaw = raw;
    try {
      const v: unknown = raw ? JSON.parse(raw) : null;
      parsed = isOutcome(v) ? v : null;
    } catch {
      parsed = null;
    }
  }
  return parsed;
}

/** This visitor's answer from any form on the page in this tab, or null. */
export function useMine(): EarlyAccessOutcome | null {
  return useSyncExternalStore(subscribe, mineSnapshot, () => null);
}

function setMine(o: EarlyAccessOutcome | null): void {
  const raw = o ? JSON.stringify(o) : "";
  const s = storage();
  try {
    if (!s) throw new Error("no storage");
    if (raw) s.setItem(MINE_KEY, raw);
    else s.removeItem(MINE_KEY);
    memoryMine = "";
  } catch {
    // storage blocked or full: kept in memory for this page only
    memoryMine = raw;
  }
  notify();
}

/** A form on the page has its answer: the other forms say so, and the count is read again. */
export function answered(o: EarlyAccessOutcome): void {
  setMine(o);
  void refresh(true);
}

/** "Use another address": the forms are offered again. */
export function forgetMine(): void {
  setMine(null);
}
