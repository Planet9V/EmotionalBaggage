/**
 * The hero's schematic, worked out on the server from the example's rows (pure; tested in
 * tests/welcome/projection.test.ts): a crop of the product's real electrical schematic, drawn with the app's own
 * circuit (lib/parts/circuit: the parts' pins and the nets the wires make) and its own symbols (lib/parts/symbols,
 * what the Schematic view draws). The crop is the readable heart of it: the part every wire lands on (the build
 * sheet's hub, the controller), the part that drives the speaker and the speaker itself, and the chip with the
 * most signal nets to the hub. Each is its symbol with its pin stubs; each net between two of them is a line from
 * pin to pin in its net class's colour, a few of them named. Pin names are left out: at the card's size they could
 * not be read. Everything is in the symbols' own units (mm).
 */
import type { Item } from "@/lib/types";
import { buildCircuit, type CircuitPart } from "@/lib/parts/circuit";
import { symbolLayout, type SymbolLayout } from "@/lib/parts/symbols";
import { hubRef } from "@/components/buildsheet/derive";

export type NetClassName = "power" | "ground" | "signal" | "audio";
type Line = [number, number, number, number];
export type SchematicCrop = {
  /** x, y, width, height */
  box: [number, number, number, number];
  symbols: { ref: string; title: string; rect: [number, number, number, number] | null; strokes: { d: string; fill: boolean }[]; circles: [number, number, number, boolean][]; stubs: { line: Line; netClass: NetClassName | null }[]; label: [number, number] }[];
  routes: { net: string; netClass: NetClassName; d: string; /** where its name goes, for the few that are named */ name: [number, number] | null }[];
  /** how many nets the crop shows, of how many the schematic has */
  nets: number;
  of: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const GAP = 21; // mm between the hub and the chips beside it: room for the nets' channels
const NAMED = 3;

type Placed = { part: CircuitPart; layout: SymbolLayout; x: number; y: number };

export function schematicCrop(partItems: Item[], wireItems: Item[]): SchematicCrop | null {
  const c = buildCircuit(partItems, wireItems, []);
  const hub = c.byRef.get(hubRef(c.wires));
  if (!hub) return null;
  const linked = (a: string, b: string, cls?: NetClassName) => c.nets.filter((n) => (!cls || n.netClass === cls) && n.members.some((m) => m.ref === a) && n.members.some((m) => m.ref === b)).length;
  // the sounder and what drives it: the two ends of the audio nets
  const audio = c.nets.filter((n) => n.netClass === "audio");
  const onAudio = [...new Set(audio.flatMap((n) => n.members.map((m) => m.ref)))].filter((r) => r !== hub.ref);
  const driver = onAudio.find((r) => linked(hub.ref, r, "signal") > 0);
  const sounder = onAudio.find((r) => r !== driver);
  // and the chip with the most signal nets to the hub
  const other = c.parts.filter((p) => p.ref !== hub.ref && p.ref !== driver && p.ref !== sounder && p.pins.length > 2).sort((a, b) => linked(hub.ref, b.ref, "signal") - linked(hub.ref, a.ref, "signal"))[0];
  const lay = (p: CircuitPart) => symbolLayout(p.symbol, p.pins);
  const placed: Placed[] = [];
  const H = lay(hub);
  placed.push({ part: hub, layout: H, x: 0, y: 0 });
  const right = H.bbox.x2 + GAP;
  const put = (ref: string | undefined, x: number, y: (l: SymbolLayout) => number) => {
    const part = ref ? c.byRef.get(ref) : undefined;
    if (!part) return null;
    const layout = lay(part);
    const p = { part, layout, x: x - layout.bbox.x1, y: y(layout) };
    placed.push(p);
    return p;
  };
  // beside the hub: the other chip above, the driver below, and the sounder under the driver, a little to its
  // right: the picture is taller than wide, as the card it stands in is
  const top = put(other?.ref, right, (l) => H.bbox.y1 - l.bbox.y1 - 4);
  const low = put(driver, right, (l) => Math.max(H.bbox.y2 - l.bbox.y2 + 4, (top ? top.y + top.layout.bbox.y2 : H.bbox.y1) + 12 - l.bbox.y1));
  if (low) put(sounder, low.x + low.layout.bbox.x2 + 5, (l) => low.y + low.layout.bbox.y2 + 9 - l.bbox.y1);

  const at = new Map(placed.map((p) => [p.part.ref, p]));
  const pinAt = (ref: string, pin: string) => {
    const p = at.get(ref);
    const sp = p?.layout.pins.find((q) => q.name === pin);
    return p && sp ? { x: p.x + sp.x, y: p.y + sp.y, toward: sp.toward } : null;
  };
  // every net between two placed parts, pin to pin; power and ground are flags in the schematic, not lines
  type Run = { net: string; netClass: NetClassName; a: { x: number; y: number }; b: { x: number; y: number }; channel: number };
  const runs: Run[] = [];
  for (const n of c.nets) {
    if (n.netClass === "power" || n.netClass === "ground") continue;
    const ends = n.members.map((m) => ({ m, p: pinAt(m.ref, m.pin) })).filter((e) => e.p);
    if (ends.length < 2) continue;
    // from the leftmost pin that looks right to the pin that looks left to meet it
    const from = ends.find((e) => e.p!.toward === "left");
    const to = ends.find((e) => e !== from && e.p!.toward === "right" && e.m.ref !== from?.m.ref);
    if (!from || !to || to.p!.x <= from.p!.x) continue;
    runs.push({ net: n.name, netClass: n.netClass as NetClassName, a: from.p!, b: to.p!, channel: 0 });
  }
  // each run turns in a channel of its own between its two parts: those that climb furthest turn first
  const groups = new Map<string, Run[]>();
  for (const r of runs) groups.set(`${r.a.x}|${r.b.x}`, [...(groups.get(`${r.a.x}|${r.b.x}`) ?? []), r]);
  for (const g of groups.values()) {
    const up = g.filter((r) => r.b.y < r.a.y).sort((p, q) => p.a.y - q.a.y);
    const down = g.filter((r) => r.b.y >= r.a.y).sort((p, q) => q.a.y - p.a.y);
    const order = [...up, ...down];
    order.forEach((r, i) => (r.channel = r.a.x + ((i + 1) / (order.length + 1)) * (r.b.x - r.a.x)));
  }
  // one net is named at each part the lines run to: the one whose last stretch is longest, where a name fits
  const named = new Set<string>();
  const byTarget = new Map<number, Run>();
  for (const r of runs) if (!byTarget.has(r.b.x) || r.b.x - r.channel > byTarget.get(r.b.x)!.b.x - byTarget.get(r.b.x)!.channel) byTarget.set(r.b.x, r);
  for (const r of [...byTarget.values()].filter((r) => r.b.x - r.channel >= 9).slice(0, NAMED)) named.add(r.net);
  // the crop: the hub's right-hand edge and what is beside it, so what is shown is large enough to read
  const cut = H.rect ? H.rect.x2 - 9 : H.bbox.x1;

  let [x1, y1, x2, y2] = [Infinity, Infinity, -Infinity, -Infinity];
  const symbols = placed.map((p) => {
    const l = p.layout;
    x1 = Math.min(x1, p.part === hub ? cut : p.x + l.bbox.x1);
    y1 = Math.min(y1, p.y + l.bbox.y1 - 7);
    x2 = Math.max(x2, p.x + l.bbox.x2, p.x + (l.rect ? l.rect.x1 : l.bbox.x1) + p.part.ref.length * 3.6);
    y2 = Math.max(y2, p.y + l.bbox.y2);
    const end = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] } as const;
    const top = (l.rect ? l.rect.y1 : l.bbox.y1) - 1.6;
    return {
      ref: p.part.ref,
      title: p.part.title,
      rect: l.rect ? ([r2(p.x + l.rect.x1), r2(p.y + l.rect.y1), r2(l.rect.x2 - l.rect.x1), r2(l.rect.y2 - l.rect.y1)] as [number, number, number, number]) : null,
      strokes: l.strokes.map((s) => ({ d: `M${s.points.map(([x, y]) => `${r2(p.x + x)} ${r2(p.y + y)}`).join("L")}${s.closed ? "Z" : ""}`, fill: !!s.fill })),
      circles: l.circles.map((k) => [r2(p.x + k.x), r2(p.y + k.y), r2(k.r), !!k.fill] as [number, number, number, boolean]),
      stubs: l.pins.map((sp) => ({
        line: [r2(p.x + sp.x), r2(p.y + sp.y), r2(p.x + sp.x + end[sp.toward][0] * sp.length), r2(p.y + sp.y + end[sp.toward][1] * sp.length)] as Line,
        netClass: (c.netOf.get(`${p.part.ref}\u0000${sp.name}`)?.netClass as NetClassName | undefined) ?? null,
      })),
      label: [r2(p.part === hub ? cut + 1 : p.x + (l.rect ? l.rect.x1 : l.bbox.x1)), r2(p.y + top)] as [number, number],
    };
  });
  const pad = 2;
  return {
    box: [r2(x1), r2(y1 - pad), r2(x2 - x1 + pad), r2(y2 - y1 + pad * 2)],
    symbols,
    routes: runs.map((r) => ({
      net: r.net,
      netClass: r.netClass,
      d: `M${r2(r.a.x)} ${r2(r.a.y)}H${r2(r.channel)}V${r2(r.b.y)}H${r2(r.b.x)}`,
      name: named.has(r.net) ? ([r2((r.channel + r.b.x) / 2), r2(r.b.y)] as [number, number]) : null,
    })),
    nets: runs.length,
    of: c.nets.length,
  };
}
