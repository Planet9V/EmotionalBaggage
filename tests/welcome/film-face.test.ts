import { describe, expect, it } from "vitest";
import { BLINK_MS, blinkAt, lidCurve, mouthFor, pupilFor } from "@/components/welcome/scenes/film/face";

describe("the people's faces", () => {
  it("blinks in 150 ms: down, shut a moment, up again", () => {
    expect(lidCurve(0)).toBe(0);
    expect(lidCurve(70)).toBe(1);
    expect(lidCurve(BLINK_MS)).toBe(0);
    expect(lidCurve(30)).toBeGreaterThan(0);
    expect(lidCurve(120)).toBeGreaterThan(0);
  });

  it("blinks every 1.8 to 4.6 seconds, never for long, and on its own rhythm per seed", () => {
    const shutTimes = (seed: number) => {
      const starts: number[] = [];
      let was = 0;
      for (let t = 0; t < 30000; t += 5) {
        const v = blinkAt(t, seed);
        if (v > 0 && was === 0) starts.push(t);
        was = v;
      }
      return starts;
    };
    const a = shutTimes(1.3);
    expect(a.length).toBeGreaterThan(5);
    for (let i = 1; i < a.length; i++) {
      const gap = a[i]! - a[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(1790);
      expect(gap).toBeLessThanOrEqual(4610);
    }
    expect(shutTimes(8.9)).not.toEqual(a);
    // the same moment always draws the same lids
    expect(blinkAt(12345, 1.3)).toBe(blinkAt(12345, 1.3));
  });

  it("keeps the resting mouth when silent and opens it with the voice", () => {
    expect(mouthFor(undefined, 0)).toEqual({ mouth: "flat", open: 0 });
    expect(mouthFor("wince", 0).mouth).toBe("wince");
    expect(mouthFor(undefined, 0.9).mouth).toBe("open");
    expect(mouthFor(undefined, 0.4).mouth).toBe("o");
    expect(mouthFor(undefined, 0.15).mouth).toBe("closed");
    // a smile keeps smiling as it talks
    expect(["grin", "laugh"]).toContain(mouthFor("smile", 0.9).mouth);
    expect(mouthFor(undefined, 0.9).open).toBeCloseTo(0.9);
  });

  it("points the pupils at a target, and pins them to the side for one behind the head", () => {
    expect(pupilFor(0, 0, 1)).toEqual([0, 0]);
    const [rx] = pupilFor(1, 0, 1);
    expect(rx).toBeGreaterThan(0.9);
    const [, up] = pupilFor(0, 0.3, 1);
    expect(up).toBeGreaterThan(0.3);
    expect(pupilFor(-1, 0, -1)[0]).toBe(-1);
  });
});
