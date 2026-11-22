import { describe, expect, it } from "vitest";
import { stepFoot, walk, walks, type Walk } from "@/components/welcome/scenes/film/gait";

const straight: Walk = { t0: 100, t1: 2100, path: (u) => [-3.6 + 2.8 * u, 0, -0.05], yaw0: Math.PI / 2, yaw1: 0.3, stride: 0.66 };

/** Every moment a foot is on the ground (not lifted), and where it is. */
function samples(w: Walk, side: "footL" | "footR") {
  const out: { t: number; x: number; z: number; lift: number }[] = [];
  for (let t = 0; t <= 2400; t += 4) {
    const f = walk(t, w)[side];
    out.push({ t, x: f.at[0], z: f.at[2], lift: f.lift });
  }
  return out;
}

describe("walking on footfalls", () => {
  it("never moves a foot while it is planted", () => {
    for (const side of ["footL", "footR"] as const) {
      const s = samples(straight, side);
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1]!;
        const b = s[i]!;
        if (a.lift === 0 && b.lift === 0) {
          expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(1e-9);
        }
      }
    }
  });

  it("gets where it is going: feet together at the end, the body between them, turned to its last heading", () => {
    const end = walk(5000, straight);
    expect(end.p[0]).toBeCloseTo(-0.8, 6);
    expect(end.p[2]).toBeCloseTo(-0.05, 6);
    expect(end.yaw).toBeCloseTo(0.3, 6);
    expect(Math.hypot(end.footL.at[0] - end.footR.at[0], end.footL.at[2] - end.footR.at[2])).toBeCloseTo(0.21, 6);
    const start = walk(0, straight);
    expect(start.p[0]).toBeCloseTo(-3.6, 6);
    expect(start.walking).toBe(false);
  });

  it("moves one foot at a time, the other planted", () => {
    for (let t = 100; t < 2100; t += 7) {
      const g = walk(t, straight);
      expect(g.footL.lift > 0 && g.footR.lift > 0).toBe(false);
    }
  });

  it("turns on the spot by stepping, not by sliding", () => {
    const turn: Walk[] = [{ t0: 0, t1: 600, path: () => [0, 0, 0], yaw0: 1.2, yaw1: -1.75 }];
    const a = walks(0, turn);
    const b = walks(1000, turn);
    expect(b.yaw).toBeCloseTo(-1.75, 6);
    expect(a.yaw).toBeCloseTo(1.2, 6);
    expect(Math.hypot(b.p[0], b.p[2])).toBeLessThan(1e-9);
  });

  it("lifts a stepping foot off the ground and puts it down where it was sent", () => {
    const from = { at: [0, 0, 0] as [number, number, number], yaw: 0 };
    const to = { at: [0.3, 0, 0] as [number, number, number], yaw: 0 };
    expect(stepFoot(50, 100, 300, from, to).at).toEqual([0, 0, 0]);
    expect(stepFoot(200, 100, 300, from, to).at[1]).toBeGreaterThan(0.05);
    expect(stepFoot(400, 100, 300, from, to).at).toEqual([0.3, 0, 0]);
  });
});
