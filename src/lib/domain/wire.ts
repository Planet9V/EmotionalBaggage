import type { Item } from "@/lib/types";
import { NET_CLASSES, type NetClass } from "./schemas";

export type Wire = {
  item: Item;
  /** soldering sequence, lowest first */
  order: number;
  name: string;
  note: string;
  net: string;
  netClass: NetClass;
  /** part refs (a part's `ref` in the parts list) and pin names */
  from: string;
  fromPin: string;
  to: string;
  toPin: string;
  status: string;
  /** the routed run through the enclosure from the planner (plan 5.12), or null when this wire was never routed */
  routed: RoutedWire | null;
};

/** What the planner's router left on a wire row. The length is the run itself, with no strip or slack allowance. */
export type RoutedWire = {
  lengthMm: number;
  cellMm: number | null;
  at: string;
  fingerprint: string;
  path: [number, number, number][];
};

function readRouted(d: Record<string, unknown>): RoutedWire | null {
  const len = typeof d.routedLengthMm === "number" && Number.isFinite(d.routedLengthMm) && d.routedLengthMm >= 0 ? d.routedLengthMm : null;
  if (len === null) return null;
  const path = Array.isArray(d.routedPath)
    ? d.routedPath.filter((p): p is [number, number, number] => Array.isArray(p) && p.length === 3 && p.every((n) => typeof n === "number" && Number.isFinite(n)))
    : [];
  return {
    lengthMm: len,
    cellMm: typeof d.routedCellMm === "number" && Number.isFinite(d.routedCellMm) ? d.routedCellMm : null,
    at: str(d.routedAt),
    fingerprint: str(d.routedFingerprint),
    path,
  };
}

export const CLASS_LABEL: Record<NetClass, string> = { power: "Power", ground: "Ground", signal: "Signal", audio: "Audio" };

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** A row is a wire once it names both ends. */
export function toWire(item: Item): Wire | null {
  const from = str(item.data.from);
  const to = str(item.data.to);
  if (!from || !to) return null;
  const nc = str(item.data.netClass) as NetClass;
  return {
    item,
    order: Number(item.data.order) || 0,
    name: item.title,
    note: item.body,
    net: str(item.data.net),
    netClass: NET_CLASSES.includes(nc) ? nc : "signal",
    from,
    fromPin: str(item.data.fromPin),
    to,
    toPin: str(item.data.toPin),
    status: item.status,
    routed: readRouted(item.data),
  };
}

export function readWires(items: Item[]): Wire[] {
  return items
    .map(toWire)
    .filter((w): w is Wire => !!w)
    .sort((a, b) => a.order - b.order || a.item.id - b.item.id);
}

/** Every pin a part uses, taken from the wires that touch it. */
export function pinsOf(ref: string, wires: Wire[]) {
  const pins = new Set<string>();
  for (const w of wires) {
    if (w.from === ref && w.fromPin) pins.add(w.fromPin);
    if (w.to === ref && w.toPin) pins.add(w.toPin);
  }
  return [...pins];
}

/** One colour role per net class; views map these to token classes or hex for canvas use. */
/**
 * On screen, net colours come from theme tokens (--net-* in globals.css), each at least 3:1 against its
 * canvas in its theme; the hex is the fallback and the colour of exported files.
 */
export const NET_STROKE: Record<NetClass, string> = {
  power: "var(--net-power, #E05A10)",
  ground: "var(--net-ground, #71717A)",
  signal: "var(--net-signal, #1849A9)",
  audio: "var(--net-audio, #067647)",
};

export const NET_COLOR: Record<NetClass, string> = {
  power: "#E05A10",
  ground: "#71717A",
  signal: "#1849A9",
  audio: "#067647",
};

const GROUND_NAME = /^(gnd|agnd|dgnd|pgnd|vss|0v|ground|-|bat-|v-)$/i;
const POWER_NAME = /^(vcc|vdd|vin|vbat|vbus|vsys|3v3|3\.3v|5v|12v|bat\+|\+|v\+|vout|vcc_\w+|3v3_\w+)$/i;
const AUDIO_NAME = /(spk|speaker|audio|dac_?[lr]|mic|lout|rout|l_out|r_out|hp_?[lr])/i;

type PinKindLike = string | null | undefined;

/**
 * The class a new wire most likely is: from the kinds of the pins at its ends (a ground pin makes it ground, a power
 * pin power), else from common pin and net names (GND, VCC, 3V3, SPK+). `why` says which, for the dialog.
 */
export function inferNetClass(ends: { pin: string; kind?: PinKindLike }[], net = ""): { netClass: NetClass; why: string } | null {
  const named = ends.filter((e) => e.pin);
  const byKind = (k: string) => named.find((e) => e.kind === k);
  const g = byKind("ground");
  if (g) return { netClass: "ground", why: `${g.pin} is a ground pin` };
  const pw = byKind("power_out") ?? byKind("power_in");
  if (pw) return { netClass: "power", why: `${pw.pin} is a power pin` };
  const names = [...named.map((e) => e.pin), net].filter(Boolean);
  const gn = names.find((n) => GROUND_NAME.test(n));
  if (gn) return { netClass: "ground", why: `${gn} is a common ground name` };
  const pn = names.find((n) => POWER_NAME.test(n));
  if (pn) return { netClass: "power", why: `${pn} is a common supply name` };
  const an = names.find((n) => AUDIO_NAME.test(n));
  if (an) return { netClass: "audio", why: `${an} is a common audio name` };
  return named.length === 2 ? { netClass: "signal", why: "neither pin is power, ground or audio" } : null;
}
