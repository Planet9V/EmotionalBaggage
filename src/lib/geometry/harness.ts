/**
 * The request for the planner's POST /harness (WireViz), built from the parts and wires.
 * The planner writes the YAML itself with a safe writer; this only gathers plain data.
 */
import { signalNetsOf, suggestedColour, sequence } from "@/components/buildsheet/derive";
import type { Part, Wire } from "@/lib/domain";

export type HarnessWire = {
  id: string;
  from: string;
  fromPin: string;
  to: string;
  toPin: string;
  colour: string;
  net: string;
  via: string;
  lengthMm?: number;
};

export type HarnessRequest = {
  title: string;
  connectors: { ref: string; title: string; pins: string[] }[];
  wires: HarnessWire[];
};

/** Names of the pins a part row declares: plain names, or objects with a name. */
export function declaredPins(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const p of raw) {
    const name = typeof p === "string" ? p : p && typeof p === "object" ? String((p as { name?: unknown }).name ?? "") : "";
    if (name.trim() && !out.includes(name.trim())) out.push(name.trim());
  }
  return out;
}

/**
 * @param lengths routed run per wire row id, in mm. A wire with no entry is drawn with no length:
 *   the drawing never carries a guessed number.
 */
export function buildHarnessRequest(
  title: string,
  parts: Part[],
  wires: Wire[],
  lengths: ReadonlyMap<number, number>,
  /** a part's pin names as every view resolves them (pin rows, library, kind); the row's own data.pins when not given */
  pinsOf: (p: Part) => string[] = (p) => declaredPins(p.item.data.pins),
): { request: HarnessRequest | null; problems: string[] } {
  const byRef = new Map<string, Part>();
  for (const p of parts) if (p.ref && !byRef.has(p.ref)) byRef.set(p.ref, p);
  const problems: string[] = [];
  const steps = sequence(wires);
  const nets = signalNetsOf(steps);
  const usable = steps.filter(({ wire: w }) => {
    const missing = [w.from, w.to].filter((r) => !byRef.has(r));
    if (missing.length) {
      problems.push(`${w.name || `${w.from} to ${w.to}`}: ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not in the bill of materials`);
      return false;
    }
    return true;
  });
  if (!usable.length) return { request: null, problems };
  const used = [...new Set(usable.flatMap(({ wire: w }) => [w.from, w.to]))];
  return {
    request: {
      title: title.slice(0, 120) || "Harness",
      connectors: used.map((ref) => {
        const p = byRef.get(ref) as Part;
        return { ref, title: p.item.title.slice(0, 120), pins: pinsOf(p).slice(0, 400) };
      }),
      wires: usable.map(({ wire: w }) => {
        const colour = suggestedColour(w, nets);
        const len = lengths.get(w.item.id);
        return {
          id: String(w.item.id),
          from: w.from,
          fromPin: w.fromPin,
          to: w.to,
          toPin: w.toPin,
          colour,
          net: w.net,
          via: w.via,
          ...(len !== undefined ? { lengthMm: len } : {}),
        };
      }),
    },
    problems,
  };
}

/** What the harness API answers with. */
export type HarnessOutcome = {
  svg: string;
  yaml: string;
  bom: Record<string, string>[];
  seconds: number;
  wireviz: string;
  /** wires left off the drawing, with why */
  problems: string[];
  /** wires drawn with a routed length, and wires drawn without one */
  withLength: number;
  withoutLength: number;
};
