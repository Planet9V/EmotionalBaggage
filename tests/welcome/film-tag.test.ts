import { describe, expect, it } from "vitest";
import { FACE, HOLE, TAG_MM, perforationRuns, stitchRuns, tagOutline, tagPath } from "@/components/welcome/scenes/film/tagShape";

const bounds = (pts: [number, number][]) => ({
  x0: Math.min(...pts.map((p) => p[0])),
  x1: Math.max(...pts.map((p) => p[0])),
  y0: Math.min(...pts.map((p) => p[1])),
  y1: Math.max(...pts.map((p) => p[1])),
});

describe("the A1 tag's outline", () => {
  it("is the design's 62 by 92 mm, about its middle", () => {
    const b = bounds(tagOutline());
    expect(b.x1 - b.x0).toBeCloseTo(TAG_MM.w, 5);
    expect(b.y1 - b.y0).toBeCloseTo(TAG_MM.h, 5);
    expect(b.x0 + b.x1).toBeCloseTo(0, 5);
    expect(b.y0 + b.y1).toBeCloseTo(0, 5);
  });

  it("has its shoulders cut at 45 degrees: the top edge is narrower than the body by the shoulder on each side", () => {
    const top = tagOutline().filter((p) => p[1] > TAG_MM.h / 2 - 1e-6);
    const xs = top.map((p) => p[0]);
    // the flat top runs between the shoulders' rounded corners: about 37 mm of the 62
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(30);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(38);
    // the long straight edge between the right shoulder's two rounded corners falls at 45 degrees
    const pts = tagOutline();
    const runs = pts.map((p, i) => [p, pts[(i + 1) % pts.length]!] as const).filter(([p, q]) => p[0] > 0 && q[0] > 0 && Math.hypot(q[0] - p[0], q[1] - p[1]) > 8 && p[1] !== q[1] && p[0] !== q[0]);
    expect(runs).toHaveLength(1);
    const [[p, q]] = runs as unknown as [[[number, number], [number, number]]];
    expect(Math.abs((q[1] - p[1]) / (q[0] - p[0]))).toBeCloseTo(1, 5);
  });

  it("stitches 3 mm inside the edge, and the panel and the stamp lie inside the stitch line", () => {
    const s = bounds(tagOutline(3));
    expect(s.x1).toBeCloseTo(TAG_MM.w / 2 - 3, 5);
    expect(s.y0).toBeCloseTo(-TAG_MM.h / 2 + 3, 5);
    expect(FACE.panel.x1).toBeLessThan(s.x1);
    expect(FACE.oval.x + FACE.oval.rx).toBeLessThan(s.x1);
    expect(FACE.oval.y - FACE.oval.ry).toBeGreaterThan(s.y0);
  });

  it("draws as one closed SVG path from the top edge down", () => {
    const d = tagPath(1);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    const ys = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2]));
    expect(Math.min(...ys)).toBeCloseTo(0, 1);
    expect(Math.max(...ys)).toBeCloseTo(TAG_MM.h, 1);
  });

  it("stitches evenly round the stitch line: one stitch about every 3.4 mm, each 2.2 mm long", () => {
    const line = tagOutline(3, 6);
    const round = line.reduce((a, p, i) => a + Math.hypot(line[(i + 1) % line.length]![0] - p[0], line[(i + 1) % line.length]![1] - p[1]), 0);
    const runs = stitchRuns(line, 3.4, 2.2, 0.49);
    expect(runs).toHaveLength(Math.round(round / 3.4));
    for (const [a, b] of runs) expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeCloseTo(2.2, 5);
  });

  it("perforates the panel on its lattice: whole holes only, none on the coin door's line, through over the speaker", () => {
    const holes = perforationRuns().flatMap((r) => Array.from({ length: r.n }, (_, i) => ({ x: r.x + i * HOLE.pitch, y: r.y, through: r.through })));
    expect(holes.length).toBeGreaterThan(180);
    const { panel: p, door: d, speaker: s } = FACE;
    for (const h of holes) {
      expect(h.x - HOLE.r).toBeGreaterThan(p.x0);
      expect(h.x + HOLE.r).toBeLessThan(p.x1);
      expect(h.y - HOLE.r).toBeGreaterThan(p.y0);
      expect(h.y + HOLE.r).toBeLessThan(p.y1);
      expect(Math.abs(Math.hypot(h.x - d.x, h.y - d.y) - d.r)).toBeGreaterThanOrEqual(0.95 - 1e-9);
      expect(h.through).toBe(h.x >= s.x0 && h.x <= s.x1 && h.y >= s.y0 && h.y <= s.y1);
    }
    // no two holes share a place, and one sits at the door's middle row either side of its coin slot
    expect(new Set(holes.map((h) => `${h.x.toFixed(2)} ${h.y.toFixed(2)}`)).size).toBe(holes.length);
    expect(holes.some((h) => h.through)).toBe(true);
    expect(holes.some((h) => !h.through)).toBe(true);
  });
});
