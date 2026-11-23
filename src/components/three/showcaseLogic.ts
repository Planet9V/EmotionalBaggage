/**
 * Pure logic behind the showcase extras of the 3D views (canvasShowcase.tsx, canvasTags.tsx): which layer a part
 * belongs to, the order parts go together in, the fade and explode weights for one moment of that assembly, where
 * part tags go on screen so they never overlap, and the print layer a cutting height stands at. No three.js and no
 * React here, so every rule is tested on its own (tests/three/showcaseLogic.test.ts).
 */

/** The layers a visitor can switch on and off. Wiring is the wires themselves; the rest group parts by kind. */
export type Layer = "enclosure" | "electronics" | "power" | "wiring" | "fasteners";

const POWER_KINDS = new Set(["battery", "switch", "power", "regulator", "charger"]);
const FASTENER_KINDS = new Set(["mechanical", "fastener", "hardware", "strap", "mount", "screw"]);

/**
 * The layer of one part, from its kind (the parts list's `kind` column), with its reference and title as the
 * fallback for a row that has no kind: "BAT" and "Batteries" are power, "HW1" and "Mount strap" are fasteners.
 * Everything else that is electrical (boards, modules, sensors, speakers, buttons, resistors) is electronics.
 */
export function layerOf(kind: string, ref = "", title = ""): Exclude<Layer, "wiring"> {
  const k = kind.trim().toLowerCase();
  if (k === "enclosure" || k === "shell" || k === "case") return "enclosure";
  if (POWER_KINDS.has(k)) return "power";
  if (FASTENER_KINDS.has(k)) return "fasteners";
  if (k) return "electronics";
  if (/^BAT/i.test(ref) || /batter/i.test(title)) return "power";
  if (/^(HW|STR|SCR|M)\d/i.test(ref) || /strap|screw|mount|bolt|nut/i.test(title)) return "fasteners";
  if (/^ENC/i.test(ref) || /enclosure|housing/i.test(title)) return "enclosure";
  return "electronics";
}

/** Part ids hidden while the given layers are off. */
export function hiddenByLayers(parts: { id: number; layer: Layer }[], off: ReadonlySet<Layer>): Set<number> {
  return new Set(parts.filter((p) => off.has(p.layer)).map((p) => p.id));
}

export type AssemblyPart = { id: number; ref: string; title: string; layer: Exclude<Layer, "wiring">; board: boolean; shell: boolean };
/** One soldering step of the build sheet, in the build sheet's order (buildsheet/derive.ts `sequence`). */
export type SolderStep = { name: string; from: string; fromPin: string; to: string; toPin: string };
/** One phase row of the assembly section (prototype/assembly): its title says what the phase is. */
export type Phase = { key: string; title: string };
export type AssemblyStep = {
  /** the assembly phase this step belongs to, as titled in the example's own rows */
  phase: string;
  /** what goes in, in the build sheet's words */
  label: string;
  /** parts that go into place at this step */
  ids: number[];
  /** shells whose lid closes at this step */
  closes: number[];
};

const phaseTitle = (phases: Phase[], re: RegExp, fallback: string) => {
  const p = phases.find((x) => re.test(x.title));
  // "Phase 2 — Electronics" reads "Phase 2: Electronics"
  return p ? p.title.replace(/\s+—\s+/g, ": ") : fallback;
};
const names = (ps: AssemblyPart[]) => ps.map((p) => `${p.ref} ${p.title}`).join(", ");

/**
 * The order the parts go together in, from the build sheet: the printed enclosure first (its lid left open), then
 * the boards everything is soldered to, then each soldering step in the build sheet's order bringing in the parts
 * it joins for the first time, then whatever is left (cells, then fasteners and straps) at integration, and last the
 * lid closing. Only parts given here (the ones with a 3D shape) take part; a step that would place nothing is left
 * out, so every step moves something.
 */
export function assemblySteps(parts: AssemblyPart[], solder: SolderStep[], phases: Phase[]): AssemblyStep[] {
  const print = phaseTitle(phases, /print/i, "Enclosure");
  const electronics = phaseTitle(phases, /electronic|solder|wiring/i, "Electronics");
  const integration = phaseTitle(phases, /integrat|assembl/i, "Integration");
  const placed = new Set<number>();
  const steps: AssemblyStep[] = [];
  const add = (phase: string, label: string, ps: AssemblyPart[], closes: number[] = []) => {
    const ids = ps.filter((p) => !placed.has(p.id)).map((p) => p.id);
    if (!ids.length && !closes.length) return;
    ids.forEach((id) => placed.add(id));
    steps.push({ phase, label, ids, closes });
  };
  const shells = parts.filter((p) => p.shell);
  add(print, `${names(shells)}: the base, lid open`, shells);
  const boards = parts.filter((p) => p.board && !p.shell);
  add(electronics, names(boards), boards);
  const byRef = new Map<string, AssemblyPart[]>();
  for (const p of parts) if (!p.shell && p.layer !== "fasteners") byRef.set(p.ref, [...(byRef.get(p.ref) ?? []), p]);
  for (const s of solder) {
    const ps = [...(byRef.get(s.from) ?? []), ...(byRef.get(s.to) ?? [])].filter((p) => !placed.has(p.id));
    add(electronics, `${s.name}: ${s.from}.${s.fromPin} to ${s.to}.${s.toPin}`, ps);
  }
  const rest = parts.filter((p) => !placed.has(p.id) && !p.shell && p.layer !== "fasteners");
  add(integration, names(rest), rest);
  const fasteners = parts.filter((p) => !placed.has(p.id) && p.layer === "fasteners");
  add(integration, names(fasteners), fasteners);
  if (shells.length) add(integration, "Lid closed", [], shells.map((p) => p.id));
  return steps;
}

/**
 * Fade and explode weight for every part with `done` steps complete (0 = nothing placed yet, steps.length = all
 * together). A part not yet placed is out of sight at its exploded place (fade 0, weight 1); a placed part sits
 * in place (fade 1, weight 0). A shell is shown once placed and keeps its lid lifted (weight 1) until the step
 * that closes it. Drawn with the scene's explode at 1, the parts glide into place one step at a time.
 */
export function assemblyTargets(steps: AssemblyStep[], done: number, ids: number[]): { fade: Map<number, number>; weights: Map<number, number> } {
  const fade = new Map<number, number>();
  const weights = new Map<number, number>();
  for (const id of ids) {
    fade.set(id, 0);
    weights.set(id, 1);
  }
  steps.slice(0, Math.max(0, done)).forEach((s) => {
    for (const id of s.ids) {
      fade.set(id, 1);
      weights.set(id, 0);
    }
  });
  // shells: the lid stays lifted until it closes
  steps.forEach((s, i) => {
    for (const id of s.ids) if (steps.some((t) => t.closes.includes(id))) weights.set(id, 1);
    if (i < done) for (const id of s.closes) weights.set(id, 0);
  });
  return { fade, weights };
}

/** Multiplies two fade maps (missing ids count as 1) and forces hidden ids to 0. Null when nothing fades. */
export function combineFade(a: ReadonlyMap<number, number> | null, b: ReadonlyMap<number, number> | null, hidden: ReadonlySet<number> | null, ids: number[]): Map<number, number> | null {
  if (!a && !b && !hidden?.size) return null;
  const out = new Map<number, number>();
  for (const id of ids) out.set(id, hidden?.has(id) ? 0 : (a?.get(id) ?? 1) * (b?.get(id) ?? 1));
  return out;
}

/** Where one part sits at explode factor `f` (0 assembled, 1 fully apart), as the canvas places it. */
export function explodedAt(pos: readonly number[], explode: readonly number[], f: number): [number, number, number] {
  return [pos[0]! + explode[0]! * f, pos[1]! + explode[1]! * f, pos[2]! + explode[2]! * f];
}

// ---- tags

export type TagSpot = { side: -1 | 1; x: number; y: number };
export type TagLayout = { spots: Map<number, TagSpot>; moving: boolean };
/** px between tag centres in one column */
export const TAG_GAP = 24;

/**
 * Places a tag for each part: in one column on the side of the model the part is on, never closer than `gap` to
 * the next tag in its column, kept inside the view (below `top`, clear of a reading laid over the view's corner), and centred on its parts as far as it can be. `previous`
 * (last frame's places) keeps a part on its side until it is well across the middle, and the tags glide toward
 * their new places (`ease` of the way each frame; 1 jumps).
 */
export function placeTags(at: ReadonlyMap<number, { x: number; y: number }>, previous: ReadonlyMap<number, TagSpot>, size: { width: number; height: number }, ease = 0.18, gap = TAG_GAP, top = 14): TagLayout {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of at.values()) {
    lo = Math.min(lo, p.x);
    hi = Math.max(hi, p.x);
  }
  const mid = (lo + hi) / 2;
  const narrow = size.width < 640;
  const reach = narrow ? 30 : 150;
  const inset = narrow ? 34 : 150;
  const columns: Record<-1 | 1, number> = { [-1]: Math.max(inset, lo - reach), 1: Math.min(size.width - inset, hi + reach) };
  const sides: Record<-1 | 1, { id: number; y: number }[]> = { [-1]: [], 1: [] };
  for (const [id, p] of at) {
    const was = previous.get(id);
    const side: -1 | 1 = was && Math.abs(p.x - mid) < 18 ? was.side : p.x < mid ? -1 : 1;
    sides[side].push({ id, y: p.y });
  }
  const spots = new Map<number, TagSpot>();
  let moving = false;
  for (const side of [-1, 1] as const) {
    const col = sides[side].sort((a, b) => a.y - b.y || a.id - b.id);
    const ys: number[] = [];
    col.forEach((c, i) => ys.push(i ? Math.max(c.y, ys[i - 1]! + gap) : c.y));
    const drift = col.length ? ys.reduce((a, y, i) => a + (y - col[i]!.y), 0) / col.length : 0;
    const first = (ys[0] ?? 0) - drift;
    const last = (ys[ys.length - 1] ?? 0) - drift;
    const fit = first < top ? top - first : last > size.height - 14 ? size.height - 14 - last : 0;
    col.forEach((c, i) => {
      const to = { x: columns[side], y: ys[i]! - drift + fit };
      const was = previous.get(c.id);
      const now: TagSpot = was && was.side === side ? { side, x: was.x + (to.x - was.x) * ease, y: was.y + (to.y - was.y) * ease } : { side, ...to };
      if (Math.abs(now.x - to.x) + Math.abs(now.y - to.y) > 0.4) moving = true;
      spots.set(c.id, now);
    });
  }
  return { spots, moving };
}

// ---- print layers

/** The layer height a print job's settings name ("0.2 mm layers, 4 perimeters"), or null. */
export function layerHeightOf(settings: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*mm\s*layer/i.exec(settings);
  const v = m ? Number(m[1]) : NaN;
  return v > 0 && v < 2 ? v : null;
}

/** How many layers a part `height` mm tall prints in. */
export const layerCount = (height: number, layer: number) => Math.max(1, Math.ceil(height / layer - 1e-6));

/** The layer being laid at cutting height `h` (1 is the first on the bed); 0 below the bed. */
export function layerAt(h: number, layer: number, height: number): number {
  if (h <= 0) return 0;
  return Math.min(layerCount(height, layer), Math.ceil(h / layer - 1e-6));
}

/** The cutting height that shows layers 1 to `n` printed. */
export const heightOfLayer = (n: number, layer: number, height: number) => Math.min(height, Math.max(0, n) * layer);
