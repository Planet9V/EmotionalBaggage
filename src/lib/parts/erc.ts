// Electrical checks (plan 5.4, docs/design/wiring.md "Electrical checks"). Pure: parts, pins and
// wires in, findings out. Shown beside the schematic and exported for the gate system through
// `electricalFindings` and `ercSummary`. They catch mistakes a checklist can catch; they never
// claim a circuit is correct.
import type { Item } from "@/lib/types";
import { BUSES, partKind } from "./kinds";
import { libraryEntryById } from "./library";
import { buildCircuit, pinKey, pinLabel, supplyGroups, type Circuit, type CircuitPart, type Net } from "./circuit";
import type { Pin, PinRow } from "./pins";

export type Severity = "error" | "warning" | "info";

export type Finding = {
  /** stable within one run: rule plus what it is about */
  id: string;
  rule: Rule;
  severity: Severity;
  /** what is wrong and why it matters, in plain sentences */
  text: string;
  /** item ids of the rows involved: parts and wires */
  items: number[];
  refs: string[];
  /** "REF.PIN" of each pin involved */
  pins: string[];
  wireIds: number[];
  /** where to look: the schematic with the row selected */
  link: string;
};

export const RULES = [
  "unknown-part",
  "unknown-pin",
  "no-pin-name",
  "no-connect-wired",
  "outputs-together",
  "unpowered",
  "no-power",
  "power-pin-open",
  "no-ground",
  "ground-pin-open",
  "voltage",
  "current",
  "pull-up",
  "floating-input",
  "single-pin-net",
  "same-part",
  "idle-part",
  "duplicate-ref",
] as const;
export type Rule = (typeof RULES)[number];

export type ErcInput = { parts: Item[]; wires: Item[]; pins: PinRow[] };
export type ErcOptions = { projectId?: string };

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const volts = (v: number) => `${Number(v.toFixed(2))} V`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function linkTo(opts: ErcOptions, select: string) {
  const q = new URLSearchParams();
  if (opts.projectId) q.set("concept", opts.projectId);
  q.set("select", select);
  return `/s/design/schematic?${q.toString()}`;
}

/** Every finding, worst first. */
export function electricalFindings(input: ErcInput, opts: ErcOptions = {}): Finding[] {
  return checkCircuit(buildCircuit(input.parts, input.wires, input.pins), opts);
}

/** For the gate system: counts by severity and whether anything blocks (any error). */
export function ercSummary(input: ErcInput, opts: ErcOptions = {}) {
  const findings = electricalFindings(input, opts);
  const count = (s: Severity) => findings.filter((f) => f.severity === s).length;
  return { ok: count("error") === 0, errors: count("error"), warnings: count("warning"), infos: count("info"), findings };
}

export function checkCircuit(c: Circuit, opts: ErcOptions = {}): Finding[] {
  const out: Finding[] = [];
  const add = (f: Omit<Finding, "link" | "items"> & { link?: string; items?: number[] }) => {
    const items = f.items ?? [...new Set([...f.refs.map((r) => c.byRef.get(r)?.item.id).filter((x): x is number => !!x), ...f.wireIds])];
    const link = f.link ?? (f.wireIds.length ? linkTo(opts, `wire:${f.wireIds[0]}`) : f.pins.length ? linkTo(opts, `pin:${f.pins[0]}`) : f.refs.length ? linkTo(opts, `part:${f.refs[0]}`) : linkTo(opts, "none"));
    out.push({ ...f, items, link });
  };
  const wireName = (w: { order: number; name: string }) => `wire ${w.order}${w.name ? ` (${w.name})` : ""}`;
  const defined = (p: CircuitPart | undefined) => !!p && p.source !== "wires";
  const wiredPins = new Set(c.nets.flatMap((n) => n.members.map((m) => pinKey(m.ref, m.pin))));
  const wiredRefs = new Set(c.wires.flatMap((w) => [w.from, w.to]));
  const groups = supplyGroups(c);
  const netById = new Map(c.nets.map((n) => [n.id, n]));
  const groupPins = (n: Net) => (groups.get(n.id) ?? [n.id]).flatMap((id) => netById.get(id)!.members);

  for (const ref of c.duplicateRefs) {
    add({ id: `duplicate-ref:${ref}`, rule: "duplicate-ref", severity: "error", text: `More than one part uses the reference ${ref}. Wires name parts by reference, so the checks use the first one only.`, refs: [ref], pins: [], wireIds: [] });
  }

  // ───────── each wire on its own
  for (const w of c.wires) {
    const missing = [...new Set([w.from, w.to].filter((r) => !c.byRef.has(r)))];
    if (missing.length) {
      add({ id: `unknown-part:${w.item.id}`, rule: "unknown-part", severity: "error", text: `${wireName(w)} names ${list(missing)}, which ${missing.length > 1 ? "are" : "is"} not in the bill of materials. Add the part or correct the reference.`, refs: missing, pins: [], wireIds: [w.item.id] });
    }
    for (const [ref, pin] of [[w.from, w.fromPin], [w.to, w.toPin]] as const) {
      const part = c.byRef.get(ref);
      if (!pin) {
        add({ id: `no-pin-name:${w.item.id}:${ref}`, rule: "no-pin-name", severity: "warning", text: `${wireName(w)} has no pin name at the ${ref} end, so nobody can tell where it lands.`, refs: [ref], pins: [], wireIds: [w.item.id] });
        continue;
      }
      if (defined(part) && !part!.pins.some((p) => p.name === pin)) {
        add({
          id: `unknown-pin:${w.item.id}:${ref}.${pin}`,
          rule: "unknown-pin",
          severity: "error",
          text: `${wireName(w)} goes to pin ${pin} of ${ref}, but ${ref} has no pin of that name. Its pins are ${list(part!.pins.slice(0, 8).map((p) => p.name))}${part!.pins.length > 8 ? " and more" : ""}.`,
          refs: [ref],
          pins: [pinLabel(ref, pin)],
          wireIds: [w.item.id],
        });
      }
    }
    if (w.from === w.to && w.fromPin && w.toPin) {
      if (w.fromPin === w.toPin) {
        add({ id: `single-pin-net:${w.item.id}`, rule: "single-pin-net", severity: "warning", text: `${wireName(w)} joins ${pinLabel(w.from, w.fromPin)} to itself. It is a wire to nowhere.`, refs: [w.from], pins: [pinLabel(w.from, w.fromPin)], wireIds: [w.item.id] });
      } else {
        const part = c.byRef.get(w.from);
        const a = part?.pins.find((p) => p.name === w.fromPin)?.kind;
        const b = part?.pins.find((p) => p.name === w.toPin)?.kind;
        const tie = a && a === b && (a === "ground" || a === "power_in");
        if (!tie) {
          add({ id: `same-part:${w.item.id}`, rule: "same-part", severity: "warning", text: `${wireName(w)} joins two pins of ${w.from} (${w.fromPin} and ${w.toPin}) with nothing between them. That is a short, or a part is missing from the wire.`, refs: [w.from], pins: [pinLabel(w.from, w.fromPin), pinLabel(w.to, w.toPin)], wireIds: [w.item.id] });
        }
      }
    }
  }

  // ───────── per net
  for (const n of c.nets) {
    const ids = n.wires.map((w) => w.item.id);
    for (const m of n.members) {
      if (m.def?.kind === "no_connect") {
        add({ id: `no-connect-wired:${m.ref}.${m.pin}`, rule: "no-connect-wired", severity: "warning", text: `${pinLabel(m.ref, m.pin)} is marked not connected in the part's documentation, but a wire goes to it. Move the wire to the pin it was meant for.`, refs: [m.ref], pins: [pinLabel(m.ref, m.pin)], wireIds: ids });
      }
    }
    const drivers = n.members.filter((m) => m.def?.kind === "output" || m.def?.kind === "power_out");
    if (drivers.length > 1) {
      const labels = drivers.map((d) => pinLabel(d.ref, d.pin));
      const supplies = drivers.every((d) => d.def?.kind === "power_out");
      add({
        id: `outputs-together:${n.id}`,
        rule: "outputs-together",
        severity: "error",
        text: supplies
          ? `Net ${n.name} joins ${plural(drivers.length, "supply output")} (${list(labels)}). Two supplies tied together fight each other; keep one, or put a switch or diode between them.`
          : `Net ${n.name} joins ${plural(drivers.length, "output")} (${list(labels)}). Outputs tied together fight each other and can damage both parts.`,
        refs: [...new Set(drivers.map((d) => d.ref))],
        pins: labels,
        wireIds: ids,
      });
    }

    // a bus line that needs a pull-up
    const busPins = n.members.filter((m) => m.def?.bus && BUSES[m.def.bus.type].pullUp);
    if (busPins.length) {
      const bus = busPins[0].def!.bus!;
      const pulled =
        n.members.some((m) => m.def?.pullUp) ||
        n.members.some((m) => {
          const part = c.byRef.get(m.ref);
          if (!part || !partKind(part.kindId)?.resistor) return false;
          const other = part.pins.find((p) => p.name !== m.pin);
          const otherNet = other ? c.netOf.get(pinKey(part.ref, other.name)) : undefined;
          return !!otherNet && otherNet.id !== n.id && groupPins(otherNet).some((x) => x.def?.kind === "power_out");
        });
      if (!pulled) {
        // boards sold under one name that differ in whether they carry pull-ups: the warning says to look
        const varies = [...new Set(busPins.map((m) => c.byRef.get(m.ref)).filter((p) => p && libraryEntryById(p.libraryId)?.pullUpsVary).map((p) => `${p!.ref} (${libraryEntryById(p!.libraryId)!.name})`))];
        const check = varies.length ? ` ${varies.join(" and ")} may carry ${varies.length === 1 ? "its" : "their"} own pull-ups: many such boards do and some do not, so check your board.` : "";
        add({
          id: `pull-up:${n.id}`,
          rule: "pull-up",
          severity: "warning",
          text: `${BUSES[bus.type].label} line ${bus.line} (net ${n.name}) has no pull-up resistor to a supply. This bus only idles high through a pull-up, so it will not work without one, unless a board on it has its own: then mark that pin as pulled up.${check}`,
          refs: [...new Set(busPins.map((m) => m.ref))],
          pins: busPins.map((m) => pinLabel(m.ref, m.pin)),
          wireIds: ids,
        });
      }
    }
  }

  // ───────── supply: who is powered, at what voltage, drawing how much
  const doneGroups = new Set<number>();
  for (const n of c.nets) {
    const gid = Math.min(...(groups.get(n.id) ?? [n.id]));
    if (doneGroups.has(gid)) continue;
    doneGroups.add(gid);
    const pins = groupPins(n);
    const groupNets = (groups.get(n.id) ?? [n.id]).map((id) => netById.get(id)!);
    const ids = groupNets.flatMap((x) => x.wires.map((w) => w.item.id));
    const name = groupNets.map((x) => x.name).join(" and ");
    const sources = pins.filter((m) => m.def?.kind === "power_out");
    const sinks = pins.filter((m) => m.def?.kind === "power_in");
    // A pin whose kind nobody has stated may be the supply: say nothing rather than guess.
    const undescribed = pins.some((m) => !m.def?.kind);
    if (sinks.length && !sources.length && !undescribed) {
      const labels = sinks.map((m) => pinLabel(m.ref, m.pin));
      add({
        id: `unpowered:${gid}`,
        rule: "unpowered",
        severity: "error",
        text: `${list(labels)} ${sinks.length > 1 ? "take" : "takes"} power from net ${name}, but nothing on that net supplies power. ${sinks.length > 1 ? "Those parts are" : "That part is"} never powered. Wire a supply to it, or mark the supply's pin as power out.`,
        refs: [...new Set(sinks.map((m) => m.ref))],
        pins: labels,
        wireIds: ids,
      });
    }
    // voltage
    for (const s of sinks) {
      const range = s.def?.voltage;
      if (!range || (range.min === undefined && range.max === undefined)) continue;
      for (const src of sources) {
        const v = src.def?.voltage;
        if (!v) continue;
        const lo = v.min ?? v.nominal ?? v.max!;
        const hi = v.max ?? v.nominal ?? v.min!;
        const tooHigh = range.max !== undefined && hi > range.max + 1e-9;
        const tooLow = range.min !== undefined && lo < range.min - 1e-9;
        if (!tooHigh && !tooLow) continue;
        const supplied = lo === hi ? volts(hi) : `${volts(lo)} to ${volts(hi)}`;
        const accepts = range.min !== undefined && range.max !== undefined ? `${volts(range.min)} to ${volts(range.max)}` : range.max !== undefined ? `at most ${volts(range.max)}` : `at least ${volts(range.min!)}`;
        add({
          id: `voltage:${s.ref}.${s.pin}:${src.ref}.${src.pin}`,
          rule: "voltage",
          severity: "error",
          text: `${pinLabel(s.ref, s.pin)} accepts ${accepts}, but ${pinLabel(src.ref, src.pin)} supplies ${supplied} on net ${name}. ${tooHigh ? "Too high a supply can destroy the part." : "Too low a supply and the part may not start or may reset."}`,
          refs: [...new Set([s.ref, src.ref])],
          pins: [pinLabel(s.ref, s.pin), pinLabel(src.ref, src.pin)],
          wireIds: ids,
        });
      }
    }
    // current
    if (sources.length && sinks.length && sources.every((m) => m.def?.currentMax != null)) {
      const capacity = sources.reduce((a, m) => a + m.def!.currentMax!, 0);
      const known = sinks.filter((m) => m.def?.currentMax != null);
      const draw = known.reduce((a, m) => a + m.def!.currentMax!, 0);
      if (known.length && draw > capacity) {
        const unknown = sinks.length - known.length;
        add({
          id: `current:${gid}`,
          rule: "current",
          severity: "error",
          text: `Net ${name} can supply ${capacity} mA (${list(sources.map((m) => pinLabel(m.ref, m.pin)))}), but the parts on it can draw ${draw} mA (${list(known.map((m) => `${pinLabel(m.ref, m.pin)} ${m.def!.currentMax} mA`))}).${unknown ? ` ${plural(unknown, "more pin")} on it ${unknown === 1 ? "states" : "state"} no current, so the real draw is higher.` : ""} An overloaded supply sags or shuts down.`,
          refs: [...new Set([...sources, ...known].map((m) => m.ref))],
          pins: [...sources, ...known].map((m) => pinLabel(m.ref, m.pin)),
          wireIds: ids,
        });
      }
    }
  }

  // ───────── per part: power, ground and inputs left open, parts left out
  for (const p of c.parts) {
    if (!defined(p) || !p.pins.length) continue;
    const isWired = (pin: Pin) => wiredPins.has(pinKey(p.ref, pin.name));
    if (!wiredRefs.has(p.ref)) {
      if (p.pins.some((x) => x.kind && x.kind !== "no_connect")) {
        add({ id: `idle-part:${p.ref}`, rule: "idle-part", severity: "info", text: `${p.ref} (${p.title}) has pins but no wires. It is left out of the circuit.`, refs: [p.ref], pins: [], wireIds: [] });
      }
      continue;
    }
    const power = p.pins.filter((x) => x.kind === "power_in");
    const ground = p.pins.filter((x) => x.kind === "ground");
    if (power.length && !power.some(isWired)) {
      add({ id: `no-power:${p.ref}`, rule: "no-power", severity: "error", text: `${p.ref} (${p.title}) has wires but none to its supply ${power.length > 1 ? "pins" : "pin"} (${list(power.map((x) => x.name))}). It will not run.`, refs: [p.ref], pins: power.map((x) => pinLabel(p.ref, x.name)), wireIds: [] });
    } else {
      for (const x of power.filter((x) => !x.optional && !isWired(x))) {
        add({ id: `power-pin-open:${p.ref}.${x.name}`, rule: "power-pin-open", severity: "warning", text: `${pinLabel(p.ref, x.name)} is a supply pin with no wire. If the part needs it, it will not run; if it is a spare, mark it optional.`, refs: [p.ref], pins: [pinLabel(p.ref, x.name)], wireIds: [] });
      }
    }
    if (ground.length && !ground.some(isWired)) {
      add({ id: `no-ground:${p.ref}`, rule: "no-ground", severity: "error", text: `${p.ref} (${p.title}) has wires but no ground connection (${list(ground.map((x) => x.name))}). Without a ground there is no return path and nothing works.`, refs: [p.ref], pins: ground.map((x) => pinLabel(p.ref, x.name)), wireIds: [] });
    } else {
      for (const x of ground.filter((x) => !x.optional && !isWired(x))) {
        add({ id: `ground-pin-open:${p.ref}.${x.name}`, rule: "ground-pin-open", severity: "warning", text: `${pinLabel(p.ref, x.name)} is a ground pin with no wire. Ground every ground pin unless the part's documentation says one is enough.`, refs: [p.ref], pins: [pinLabel(p.ref, x.name)], wireIds: [] });
      }
    }
    for (const x of p.pins.filter((x) => x.kind === "input" && !x.optional && !x.pullUp && !isWired(x))) {
      add({ id: `floating-input:${p.ref}.${x.name}`, rule: "floating-input", severity: "info", text: `${pinLabel(p.ref, x.name)} is an input with no wire. A floating input can read at random; tie it high or low if the part does not do that itself.`, refs: [p.ref], pins: [pinLabel(p.ref, x.name)], wireIds: [] });
    }
  }

  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export const SEVERITY_LABEL: Record<Severity, string> = { error: "Error", warning: "Warning", info: "Note" };
