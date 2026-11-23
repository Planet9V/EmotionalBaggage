/**
 * The hero's schematic, worked out on the server from the example's rows (pure; tested in
 * tests/welcome/projection.test.ts): the netlist as a wheel, the part every wire lands on in the middle (the build
 * sheet's hub), the other parts around it in the order the build sheet first reaches them, and one line per wire,
 * by net class.
 */

export type NetClassName = "power" | "ground" | "signal" | "audio";
export type Wheel = { size: number; nodes: { ref: string; x: number; y: number; hub: boolean }[]; links: { a: string; b: string; netClass: NetClassName; d: string }[] };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** The wires as a wheel of `size` units square: the hub in the middle, the rest on a ring. */
export function netWheel(wires: { from: string; to: string; netClass: NetClassName }[], hub: string, size = 120): Wheel {
  const order: string[] = [];
  for (const w of wires) for (const r of [w.from, w.to]) if (r !== hub && !order.includes(r)) order.push(r);
  const c = size / 2;
  const R = size / 2 - 12;
  const at = new Map<string, { x: number; y: number }>([[hub, { x: c, y: c }]]);
  order.forEach((ref, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, order.length)) * Math.PI * 2;
    at.set(ref, { x: r1(c + Math.cos(a) * R), y: r1(c + Math.sin(a) * R) });
  });
  // several wires between the same two parts bow apart, so each stays visible
  const seen = new Map<string, number>();
  const links = wires
    .filter((w) => at.has(w.from) && at.has(w.to) && w.from !== w.to)
    .map((w) => {
      const key = [w.from, w.to].sort().join("|");
      const k = seen.get(key) ?? 0;
      seen.set(key, k + 1);
      const p = at.get(w.from)!;
      const q = at.get(w.to)!;
      const bow = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 5;
      const mx = (p.x + q.x) / 2;
      const my = (p.y + q.y) / 2;
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const cx = mx + (-(q.y - p.y) / len) * bow;
      const cy = my + ((q.x - p.x) / len) * bow;
      return { a: w.from, b: w.to, netClass: w.netClass, d: `M${p.x} ${p.y}Q${r1(cx)} ${r1(cy)} ${q.x} ${q.y}` };
    });
  return { size, nodes: [...at].map(([ref, p]) => ({ ref, ...p, hub: ref === hub })), links };
}
