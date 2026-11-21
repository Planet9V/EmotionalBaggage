// A short fingerprint of what an enclosure is generated from: the resolved parameters, the outer and inner
// boxes and every opening. The generate route stores it beside the checks it measured; the stage gate
// works it out again from the saved choice and today's parts, so checks measured on an older layout or
// other settings do not count. Pure and the same in the browser and on the server.
import type { EnclosureSpec } from "./types";

const r = (n: number) => Math.round(n * 1000) / 1000;

/** FNV-1a, 32 bit, as eight hex digits. Not for security: it only tells two inputs apart. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function specFingerprint(spec: EnclosureSpec): string {
  const p = spec.params as unknown as Record<string, unknown>;
  const params = Object.keys(p)
    .sort()
    .map((k) => [k, typeof p[k] === "number" ? r(p[k] as number) : p[k]]);
  const box = (b: EnclosureSpec["outer"]) => [...b.min.map(r), ...b.max.map(r)];
  const openings = spec.openings.map((o) => [o.partRef, o.face, ...(o.center as number[]).map(r), r(o.width), r(o.height)]);
  return fnv1a(JSON.stringify([params, box(spec.outer), box(spec.inner), openings]));
}
